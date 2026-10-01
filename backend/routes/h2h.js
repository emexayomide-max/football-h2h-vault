const express = require("express");
const pool = require("../db");

const router = express.Router();

/*
 * ==========================================
 * HOME / AWAY H2H
 * ==========================================
 *
 * IMPORTANT:
 * This route must come BEFORE the general
 * /:team1Slug/:team2Slug route below.
 */
router.get(
  "/:team1Slug/:team2Slug/home-away",
  async (req, res) => {
    const {
      team1Slug,
      team2Slug,
    } = req.params;

    try {
      /*
       * Find both teams
       */
      const teamsResult = await pool.query(
        `
        SELECT
            id,
            external_id,
            name,
            short_name,
            country,
            logo_url,
            slug
        FROM teams
        WHERE slug IN ($1, $2)
        `,
        [team1Slug, team2Slug]
      );

      if (teamsResult.rows.length !== 2) {
        return res.status(404).json({
          status: "error",
          message: "One or both teams not found",
        });
      }

      const team1 = teamsResult.rows.find(
        (team) => team.slug === team1Slug
      );

      const team2 = teamsResult.rows.find(
        (team) => team.slug === team2Slug
      );

      /*
       * Find all finished H2H meetings
       */
      const matchesResult = await pool.query(
        `
        SELECT
            m.id,
            m.external_id,
            m.match_date,
            m.home_team_id,
            m.away_team_id,
            m.home_score,
            m.away_score,
            m.halftime_home_score,
            m.halftime_away_score,
            m.status,
            m.venue,

            home_team.name AS home_team,
            away_team.name AS away_team,

            c.name AS competition,
            c.slug AS competition_slug,

            s.name AS season
        FROM matches m

        JOIN teams home_team
            ON home_team.id = m.home_team_id

        JOIN teams away_team
            ON away_team.id = m.away_team_id

        JOIN competitions c
            ON c.id = m.competition_id

        JOIN seasons s
            ON s.id = m.season_id

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
        [team1.id, team2.id]
      );

      const matches = matchesResult.rows;

      /*
       * ==========================================
       * TEAM 1 AT HOME
       * ==========================================
       */

      const team1HomeMatches =
        matches.filter(
          (match) =>
            match.home_team_id === team1.id
        );

      let team1HomeWins = 0;
      let team1HomeDraws = 0;
      let team2AwayWins = 0;

      let team1HomeGoals = 0;
      let team2AwayGoals = 0;

      let team1HomeCleanSheets = 0;
      let team2AwayCleanSheets = 0;

      team1HomeMatches.forEach(
        (match) => {
          team1HomeGoals +=
            match.home_score;

          team2AwayGoals +=
            match.away_score;

          /*
           * Result
           */
          if (
            match.home_score >
            match.away_score
          ) {
            team1HomeWins++;
          } else if (
            match.home_score ===
            match.away_score
          ) {
            team1HomeDraws++;
          } else {
            team2AwayWins++;
          }

          /*
           * Clean sheets
           */
          if (match.away_score === 0) {
            team1HomeCleanSheets++;
          }

          if (match.home_score === 0) {
            team2AwayCleanSheets++;
          }
        }
      );

      /*
       * ==========================================
       * TEAM 2 AT HOME
       * ==========================================
       */

      const team2HomeMatches =
        matches.filter(
          (match) =>
            match.home_team_id === team2.id
        );

      let team2HomeWins = 0;
      let team2HomeDraws = 0;
      let team1AwayWins = 0;

      let team2HomeGoals = 0;
      let team1AwayGoals = 0;

      let team2HomeCleanSheets = 0;
      let team1AwayCleanSheets = 0;

      team2HomeMatches.forEach(
        (match) => {
          team2HomeGoals +=
            match.home_score;

          team1AwayGoals +=
            match.away_score;

          /*
           * Result
           */
          if (
            match.home_score >
            match.away_score
          ) {
            team2HomeWins++;
          } else if (
            match.home_score ===
            match.away_score
          ) {
            team2HomeDraws++;
          } else {
            team1AwayWins++;
          }

          /*
           * Clean sheets
           */
          if (match.away_score === 0) {
            team2HomeCleanSheets++;
          }

          if (match.home_score === 0) {
            team1AwayCleanSheets++;
          }
        }
      );

      /*
       * ==========================================
       * RESPONSE
       * ==========================================
       */

      res.json({
        status: "success",

        teams: {
          team1,
          team2,
        },

        team1Home: {
          meetings:
            team1HomeMatches.length,

          team1Wins:
            team1HomeWins,

          draws:
            team1HomeDraws,

          team2Wins:
            team2AwayWins,

          goals: {
            team1:
              team1HomeGoals,

            team2:
              team2AwayGoals,

            total:
              team1HomeGoals +
              team2AwayGoals,

            average:
              team1HomeMatches.length > 0
                ? Number(
                    (
                      (team1HomeGoals +
                        team2AwayGoals) /
                      team1HomeMatches.length
                    ).toFixed(2)
                  )
                : 0,
          },

          cleanSheets: {
            team1:
              team1HomeCleanSheets,

            team2:
              team2AwayCleanSheets,
          },

          matches:
            team1HomeMatches,
        },

        team2Home: {
          meetings:
            team2HomeMatches.length,

          team2Wins:
            team2HomeWins,

          draws:
            team2HomeDraws,

          team1Wins:
            team1AwayWins,

          goals: {
            team1:
              team1AwayGoals,

            team2:
              team2HomeGoals,

            total:
              team1AwayGoals +
              team2HomeGoals,

            average:
              team2HomeMatches.length > 0
                ? Number(
                    (
                      (team1AwayGoals +
                        team2HomeGoals) /
                      team2HomeMatches.length
                    ).toFixed(2)
                  )
                : 0,
          },

          cleanSheets: {
            team1:
              team1AwayCleanSheets,

            team2:
              team2HomeCleanSheets,
          },

          matches:
            team2HomeMatches,
        },
      });
    } catch (error) {
      console.error(
        "Home-away H2H query failed:",
        error.message
      );

      res.status(500).json({
        status: "error",
        message:
          "Failed to retrieve home-away H2H data",
      });
    }
  }
);

/*
 * ==========================================
 * GENERAL H2H
 * ==========================================
 */

router.get(
  "/:team1Slug/:team2Slug",
  async (req, res) => {
    const {
      team1Slug,
      team2Slug,
    } = req.params;

    const {
      limit = 10,
      competition,
      season,
    } = req.query;

    try {
      /*
       * Validate limit
       */
      const parsedLimit =
        Math.min(
          Math.max(
            parseInt(limit, 10) || 10,
            1
          ),
          50
        );

      /*
       * Find teams
       */
      const teamsResult = await pool.query(
        `
        SELECT
            id,
            external_id,
            name,
            short_name,
            country,
            logo_url,
            slug
        FROM teams
        WHERE slug IN ($1, $2)
        `,
        [team1Slug, team2Slug]
      );

      if (teamsResult.rows.length !== 2) {
        return res.status(404).json({
          status: "error",
          message: "One or both teams not found",
        });
      }

      const team1 = teamsResult.rows.find(
        (team) => team.slug === team1Slug
      );

      const team2 = teamsResult.rows.find(
        (team) => team.slug === team2Slug
      );

      /*
       * Build dynamic filters
       */
      const queryParams = [
        team1.id,
        team2.id,
      ];

      let paramIndex = 3;

      let additionalFilters = "";

      if (competition) {
        additionalFilters += `
          AND c.slug = $${paramIndex}
        `;

        queryParams.push(competition);

        paramIndex++;
      }

      if (season) {
        additionalFilters += `
          AND s.name = $${paramIndex}
        `;

        queryParams.push(season);

        paramIndex++;
      }

      /*
       * Get H2H matches
       */
      const matchesResult = await pool.query(
        `
        SELECT
            m.id,
            m.external_id,
            m.match_date,

            m.home_team_id,
            m.away_team_id,

            m.home_score,
            m.away_score,

            m.halftime_home_score,
            m.halftime_away_score,

            m.status,
            m.venue,

            home_team.name AS home_team,
            away_team.name AS away_team,

            c.name AS competition,
            c.slug AS competition_slug,

            s.name AS season

        FROM matches m

        JOIN teams home_team
            ON home_team.id = m.home_team_id

        JOIN teams away_team
            ON away_team.id = m.away_team_id

        JOIN competitions c
            ON c.id = m.competition_id

        JOIN seasons s
            ON s.id = m.season_id

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

            ${additionalFilters}

        ORDER BY m.match_date DESC

        LIMIT $${paramIndex}
        `,
        [
          ...queryParams,
          parsedLimit,
        ]
      );

      const matches =
        matchesResult.rows;

      /*
       * ==========================================
       * CALCULATE H2H RECORD
       * ==========================================
       */

      let team1Wins = 0;
      let team2Wins = 0;
      let draws = 0;

      let team1Goals = 0;
      let team2Goals = 0;

      let bttsYes = 0;
      let bttsNo = 0;

      let over05 = 0;
      let over15 = 0;
      let over25 = 0;
      let over35 = 0;
      let over45 = 0;

      let team1CleanSheets = 0;
      let team2CleanSheets = 0;

      matches.forEach(
        (match) => {
          const isTeam1Home =
            match.home_team_id ===
            team1.id;

          const team1Score =
            isTeam1Home
              ? match.home_score
              : match.away_score;

          const team2Score =
            isTeam1Home
              ? match.away_score
              : match.home_score;

          /*
           * Wins / draws
           */
          if (
            team1Score >
            team2Score
          ) {
            team1Wins++;
          } else if (
            team1Score <
            team2Score
          ) {
            team2Wins++;
          } else {
            draws++;
          }

          /*
           * Goals
           */
          team1Goals +=
            team1Score;

          team2Goals +=
            team2Score;

          const totalGoals =
            team1Score +
            team2Score;

          /*
           * BTTS
           */
          if (
            team1Score > 0 &&
            team2Score > 0
          ) {
            bttsYes++;
          } else {
            bttsNo++;
          }

          /*
           * Over goals
           */
          if (totalGoals > 0.5) {
            over05++;
          }

          if (totalGoals > 1.5) {
            over15++;
          }

          if (totalGoals > 2.5) {
            over25++;
          }

          if (totalGoals > 3.5) {
            over35++;
          }

          if (totalGoals > 4.5) {
            over45++;
          }

          /*
           * Clean sheets
           */
          if (team2Score === 0) {
            team1CleanSheets++;
          }

          if (team1Score === 0) {
            team2CleanSheets++;
          }
        }
      );

      /*
       * Calculate average goals
       */
      const totalGoals =
        team1Goals +
        team2Goals;

      const averageGoals =
        matches.length > 0
          ? Number(
              (
                totalGoals /
                matches.length
              ).toFixed(2)
            )
          : 0;

      /*
       * BTTS percentage
       */
      const bttsPercentage =
        matches.length > 0
          ? Number(
              (
                (bttsYes /
                  matches.length) *
                100
              ).toFixed(1)
            )
          : 0;

      /*
       * Response
       */
      res.json({
        status: "success",

        filters: {
          limit: parsedLimit,
          competition:
            competition || null,
          season:
            season || null,
        },

        teams: {
          team1,
          team2,
        },

        record: {
          meetings:
            matches.length,

          team1Wins,

          team2Wins,

          draws,
        },

        goals: {
          team1:
            team1Goals,

          team2:
            team2Goals,

          total:
            totalGoals,

          average:
            averageGoals,
        },

        btts: {
          yes:
            bttsYes,

          no:
            bttsNo,

          percentage:
            bttsPercentage,
        },

        overGoals: {
          over05,
          over15,
          over25,
          over35,
          over45,
        },

        cleanSheets: {
          team1:
            team1CleanSheets,

          team2:
            team2CleanSheets,
        },

        matches,
      });
    } catch (error) {
      console.error(
        "H2H query failed:",
        error.message
      );

      res.status(500).json({
        status: "error",
        message:
          "Failed to retrieve H2H data",
      });
    }
  }
);

module.exports = router;