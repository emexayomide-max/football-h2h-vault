const express = require("express");
const pool = require("../db");

const router = express.Router();

const INTERNAL_BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  `http://127.0.0.1:${process.env.PORT || 3001}`;

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function findTeam(identifier) {
  const value = normalizeText(identifier);

  const result = await pool.query(
    `
    SELECT
      id,
      name,
      short_name,
      slug,
      logo_url
    FROM teams
    WHERE
      LOWER(slug) = $1
      OR LOWER(name) = $1
      OR LOWER(short_name) = $1
    LIMIT 1
    `,
    [value]
  );

  return result.rows[0] || null;
}

/*
  Check whether we already have at least one finished H2H match
  between the two teams.

  We use this to avoid calling the provider APIs on every
  frontend page refresh.
*/
async function hasH2HData(team1Id, team2Id) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::integer AS count
    FROM matches
    WHERE
      (
        (home_team_id = $1 AND away_team_id = $2)
        OR
        (home_team_id = $2 AND away_team_id = $1)
      )
      AND status = 'finished'
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
    `,
    [team1Id, team2Id]
  );

  return Number(result.rows[0]?.count || 0) > 0;
}

/*
  Trigger the existing H2H importer.

  We intentionally reuse:
    POST /api/matches/import-h2h/:team1/:team2

  This keeps all provider logic in matches.js instead of
  duplicating API-Football and TheSportsDB code here.
*/
async function triggerH2HImport(team1, team2) {
  const url =
    `${INTERNAL_BACKEND_URL}/api/matches/import-h2h/` +
    `${encodeURIComponent(team1)}/${encodeURIComponent(team2)}`;

  console.log(
    `H2H data missing. Triggering import for ${team1} vs ${team2}`
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      `H2H import failed with status ${response.status}`;

    throw new Error(message);
  }

  console.log(
    `H2H import completed for ${team1} vs ${team2}`
  );

  return data;
}

/*
  Make sure H2H data exists before querying it.

  Important behavior:

  1. If both teams exist and H2H matches already exist:
     - Do NOT call provider APIs.
     - Use the existing database data.

  2. If one/both teams are missing:
     - Trigger the importer.
     - The importer resolves the teams through the providers.

  3. If both teams exist but no H2H matches exist:
     - Trigger the importer.

  4. After importing, resolve the teams again because the importer
     may have created them dynamically.
*/
async function ensureH2HData(team1Identifier, team2Identifier) {
  let [team1Data, team2Data] = await Promise.all([
    findTeam(team1Identifier),
    findTeam(team2Identifier),
  ]);

  /*
    If both teams already exist, first check whether their H2H
    data is already stored.
  */
  if (team1Data && team2Data) {
    if (team1Data.id === team2Data.id) {
      throw new Error("H2H requires two different teams");
    }

    const exists = await hasH2HData(
      team1Data.id,
      team2Data.id
    );

    if (exists) {
      return {
        team1Data,
        team2Data,
        imported: false,
      };
    }
  }

  /*
    Data is missing, so use the existing importer.
  */
  await triggerH2HImport(
    team1Identifier,
    team2Identifier
  );

  /*
    Resolve the teams again because the importer can create
    new canonical teams dynamically.
  */
  [team1Data, team2Data] = await Promise.all([
    findTeam(team1Identifier),
    findTeam(team2Identifier),
  ]);

  return {
    team1Data,
    team2Data,
    imported: true,
  };
}

/*
  GET
  /api/h2h/:team1/:team2

  Returns:
  - Team information
  - H2H summary
  - Goal statistics
  - Goal markets
  - Clean sheets
  - Previous meetings

  NEW BEHAVIOR:
  If H2H data is not already stored, the existing importer
  is triggered automatically.
*/
router.get("/:team1/:team2", async (req, res) => {
  const { team1, team2 } = req.params;

  try {
    const ensured = await ensureH2HData(team1, team2);

    const team1Data = ensured.team1Data;
    const team2Data = ensured.team2Data;

    if (!team1Data) {
      return res.status(404).json({
        status: "error",
        message: `Team not found: ${team1}`,
      });
    }

    if (!team2Data) {
      return res.status(404).json({
        status: "error",
        message: `Team not found: ${team2}`,
      });
    }

    if (team1Data.id === team2Data.id) {
      return res.status(400).json({
        status: "error",
        message: "H2H requires two different teams",
      });
    }

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 50, 1),
      50
    );

    const competitionId = req.query.competition
      ? Number(req.query.competition)
      : null;

    const seasonId = req.query.season
      ? Number(req.query.season)
      : null;

    const matchesResult = await pool.query(
      `
      SELECT
        m.id,
        m.match_date,
        m.home_score,
        m.away_score,
        m.status,
        m.venue,
        m.provider,

        home.id AS home_team_id,
        home.name AS home_team_name,
        home.slug AS home_team_slug,

        away.id AS away_team_id,
        away.name AS away_team_name,
        away.slug AS away_team_slug,

        c.id AS competition_id,
        c.name AS competition_name,

        s.id AS season_id,
        s.name AS season_name

      FROM matches m

      JOIN teams home
        ON home.id = m.home_team_id

      JOIN teams away
        ON away.id = m.away_team_id

      LEFT JOIN competitions c
        ON c.id = m.competition_id

      LEFT JOIN seasons s
        ON s.id = m.season_id

      WHERE
        (
          (m.home_team_id = $1 AND m.away_team_id = $2)
          OR
          (m.home_team_id = $2 AND m.away_team_id = $1)
        )
        AND m.status = 'finished'
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
        AND ($3::integer IS NULL OR m.competition_id = $3)
        AND ($4::integer IS NULL OR m.season_id = $4)

      ORDER BY m.match_date DESC

      LIMIT $5
      `,
      [
        team1Data.id,
        team2Data.id,
        competitionId,
        seasonId,
        limit,
      ]
    );

    const matches = matchesResult.rows;

    let team1Wins = 0;
    let team2Wins = 0;
    let draws = 0;

    let team1Goals = 0;
    let team2Goals = 0;

    let btts = 0;

    let over05 = 0;
    let over15 = 0;
    let over25 = 0;
    let over35 = 0;
    let over45 = 0;

    let team1CleanSheets = 0;
    let team2CleanSheets = 0;

    let highestScoringMeeting = null;

    for (const match of matches) {
      const homeScore = Number(match.home_score);
      const awayScore = Number(match.away_score);

      const totalGoals = homeScore + awayScore;

      const team1IsHome =
        match.home_team_id === team1Data.id;

      const team1Score = team1IsHome
        ? homeScore
        : awayScore;

      const team2Score = team1IsHome
        ? awayScore
        : homeScore;

      team1Goals += team1Score;
      team2Goals += team2Score;

      if (team1Score > team2Score) {
        team1Wins++;
      } else if (team2Score > team1Score) {
        team2Wins++;
      } else {
        draws++;
      }

      if (
        team1Score > 0 &&
        team2Score > 0
      ) {
        btts++;
      }

      if (totalGoals > 0) {
        over05++;
      }

      if (totalGoals > 1) {
        over15++;
      }

      if (totalGoals > 2) {
        over25++;
      }

      if (totalGoals > 3) {
        over35++;
      }

      if (totalGoals > 4) {
        over45++;
      }

      if (team1Score === 0) {
        team2CleanSheets++;
      }

      if (team2Score === 0) {
        team1CleanSheets++;
      }

      if (
        !highestScoringMeeting ||
        totalGoals >
          highestScoringMeeting.totalGoals
      ) {
        highestScoringMeeting = {
          matchId: match.id,
          date: match.match_date,
          totalGoals,
          team1Score,
          team2Score,
          homeTeam: match.home_team_name,
          awayTeam: match.away_team_name,
        };
      }
    }

    const totalMatches = matches.length;

    const totalGoals =
      team1Goals + team2Goals;

    const averageGoals =
      totalMatches > 0
        ? Number(
            (
              totalGoals / totalMatches
            ).toFixed(2)
          )
        : 0;

    const team1WinPercentage =
      totalMatches > 0
        ? Number(
            (
              (team1Wins / totalMatches) *
              100
            ).toFixed(1)
          )
        : 0;

    const team2WinPercentage =
      totalMatches > 0
        ? Number(
            (
              (team2Wins / totalMatches) *
              100
            ).toFixed(1)
          )
        : 0;

    const drawPercentage =
      totalMatches > 0
        ? Number(
            (
              (draws / totalMatches) *
              100
            ).toFixed(1)
          )
        : 0;

    res.json({
      status: "success",

      teams: {
        team1: team1Data,
        team2: team2Data,
      },

      filters: {
        competition: competitionId,
        season: seasonId,
        limit,
      },

      summary: {
        totalMatches,

        team1Wins,
        team2Wins,
        draws,

        team1WinPercentage,
        team2WinPercentage,
        drawPercentage,

        team1Goals,
        team2Goals,

        totalGoals,

        goalDifference:
          team1Goals - team2Goals,

        averageGoals,

        btts,

        bttsPercentage:
          totalMatches > 0
            ? Number(
                (
                  (btts / totalMatches) *
                  100
                ).toFixed(1)
              )
            : 0,

        over05,
        over15,
        over25,
        over35,
        over45,

        team1CleanSheets,
        team2CleanSheets,

        highestScoringMeeting,
      },

      matches,
    });
  } catch (error) {
    console.error(
      "GET /api/h2h/:team1/:team2 error:",
      error
    );

    res.status(500).json({
      status: "error",
      message:
        error.message ||
        "Failed to load H2H data",
    });
  }
});

/*
  GET
  /api/h2h/:team1/:team2/home-away

  Returns home/away breakdown for the two teams.

  This route also uses ensureH2HData(), so a new matchup
  can populate itself automatically.
*/
router.get(
  "/:team1/:team2/home-away",
  async (req, res) => {
    const { team1, team2 } = req.params;

    try {
      const ensured = await ensureH2HData(
        team1,
        team2
      );

      const team1Data = ensured.team1Data;
      const team2Data = ensured.team2Data;

      if (!team1Data || !team2Data) {
        return res.status(404).json({
          status: "error",
          message: "One or both teams not found",
        });
      }

      if (team1Data.id === team2Data.id) {
        return res.status(400).json({
          status: "error",
          message: "H2H requires two different teams",
        });
      }

      const result = await pool.query(
        `
        SELECT
          m.id,
          m.match_date,
          m.home_score,
          m.away_score,

          m.home_team_id,
          m.away_team_id,

          home.name AS home_team_name,
          away.name AS away_team_name

        FROM matches m

        JOIN teams home
          ON home.id = m.home_team_id

        JOIN teams away
          ON away.id = m.away_team_id

        WHERE
          (
            (
              m.home_team_id = $1
              AND m.away_team_id = $2
            )
            OR
            (
              m.home_team_id = $2
              AND m.away_team_id = $1
            )
          )
          AND m.status = 'finished'
          AND m.home_score IS NOT NULL
          AND m.away_score IS NOT NULL

        ORDER BY m.match_date DESC
        `,
        [
          team1Data.id,
          team2Data.id,
        ]
      );

      const breakdown = {
        team1: {
          home: {
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
          },

          away: {
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
          },
        },

        team2: {
          home: {
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
          },

          away: {
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
          },
        },
      };

      for (const match of result.rows) {
        const homeScore = Number(
          match.home_score
        );

        const awayScore = Number(
          match.away_score
        );

        const team1IsHome =
          match.home_team_id === team1Data.id;

        const team1Side =
          team1IsHome ? "home" : "away";

        const team2Side =
          team1IsHome ? "away" : "home";

        const team1Stats =
          breakdown.team1[team1Side];

        const team2Stats =
          breakdown.team2[team2Side];

        team1Stats.played++;
        team2Stats.played++;

        if (team1IsHome) {
          team1Stats.goalsFor += homeScore;
          team1Stats.goalsAgainst += awayScore;

          team2Stats.goalsFor += awayScore;
          team2Stats.goalsAgainst += homeScore;

          if (homeScore > awayScore) {
            team1Stats.wins++;
            team2Stats.losses++;
          } else if (homeScore < awayScore) {
            team1Stats.losses++;
            team2Stats.wins++;
          } else {
            team1Stats.draws++;
            team2Stats.draws++;
          }
        } else {
          team1Stats.goalsFor += awayScore;
          team1Stats.goalsAgainst += homeScore;

          team2Stats.goalsFor += homeScore;
          team2Stats.goalsAgainst += awayScore;

          if (awayScore > homeScore) {
            team1Stats.wins++;
            team2Stats.losses++;
          } else if (awayScore < homeScore) {
            team1Stats.losses++;
            team2Stats.wins++;
          } else {
            team1Stats.draws++;
            team2Stats.draws++;
          }
        }
      }

      res.json({
        status: "success",

        teams: {
          team1: team1Data,
          team2: team2Data,
        },

        breakdown,
      });
    } catch (error) {
      console.error(
        "GET /api/h2h/:team1/:team2/home-away error:",
        error
      );

      res.status(500).json({
        status: "error",
        message:
          error.message ||
          "Failed to load home/away H2H data",
      });
    }
  }
);

module.exports = router;