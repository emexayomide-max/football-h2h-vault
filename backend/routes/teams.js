const express = require("express");
const pool = require("../db");
const { searchTeam } = require("../services/theSportsDb");

const router = express.Router();

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function createSlug(name) {
  return normalizeText(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/*
|--------------------------------------------------------------------------
| GET /api/teams
|--------------------------------------------------------------------------
| Load teams already stored in our database.
*/
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        external_id,
        name,
        short_name,
        country,
        logo_url,
        slug,
        api_football_id,
        thesportsdb_id
      FROM teams
      ORDER BY name ASC
    `);

    res.json({
      status: "success",
      teams: result.rows,
    });
  } catch (error) {
    console.error("GET /api/teams error:", error);

    res.status(500).json({
      status: "error",
      message: "Failed to load teams",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/teams/search?q=...
|--------------------------------------------------------------------------
| Search:
|
| 1. Our local PostgreSQL database
| 2. TheSportsDB
|
| IMPORTANT:
| API-Football is intentionally NOT called here.
|
| This allows team search to continue working even when the
| API-Football daily request quota has been exhausted.
*/
router.get("/search", async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (query.length < 2) {
    return res.json({
      status: "success",
      query,
      count: 0,
      teams: [],
    });
  }

  try {
    /*
    |--------------------------------------------------------------------------
    | 1. Search our local database
    |--------------------------------------------------------------------------
    */

    const localResult = await pool.query(
      `
      SELECT
        id,
        external_id,
        name,
        short_name,
        country,
        logo_url,
        slug,
        api_football_id,
        thesportsdb_id
      FROM teams
      WHERE
        name ILIKE $1
        OR short_name ILIKE $1
        OR country ILIKE $1
        OR slug ILIKE $1
      ORDER BY
        CASE
          WHEN LOWER(name) = LOWER($2) THEN 0
          WHEN LOWER(name) LIKE LOWER($2) || '%' THEN 1
          ELSE 2
        END,
        name ASC
      LIMIT 10
      `,
      [`%${query}%`, query]
    );

    /*
    |--------------------------------------------------------------------------
    | 2. Search TheSportsDB
    |--------------------------------------------------------------------------
    */

    let sportsDbTeams = [];

    try {
      const sportsDbResponse = await searchTeam(query);

      if (
        sportsDbResponse &&
        Array.isArray(sportsDbResponse.teams)
      ) {
        sportsDbTeams = sportsDbResponse.teams;
      }
    } catch (sportsDbError) {
      /*
      |--------------------------------------------------------------------------
      | TheSportsDB failed.
      |
      | We do NOT fail the entire search.
      | Local database results can still be returned.
      |--------------------------------------------------------------------------
      */

      console.error(
        "TheSportsDB team search failed:",
        sportsDbError.message
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Convert TheSportsDB teams into our application format
    |--------------------------------------------------------------------------
    */

    const externalSuggestions = sportsDbTeams
      .filter((team) => {
        return (
          team &&
          team.idTeam &&
          team.strTeam
        );
      })
      .map((team) => ({
        id: null,

        /*
        IMPORTANT:
        external_id is kept as the TheSportsDB ID for now because
        the team-import route can use thesportsdb_id explicitly.
        */
        external_id: Number(team.idTeam),

        name: team.strTeam,

        short_name:
          team.strTeamShort || null,

        country:
          team.strCountry || null,

        logo_url:
          team.strBadge || null,

        slug: createSlug(team.strTeam),

        api_football_id:
          team.idAPIfootball
            ? Number(team.idAPIfootball)
            : null,

        thesportsdb_id:
          Number(team.idTeam),

        source: "thesportsdb",

        isStored: false,
      }));

    /*
    |--------------------------------------------------------------------------
    | Convert local teams
    |--------------------------------------------------------------------------
    */

    const localTeams = localResult.rows.map(
      (team) => ({
        ...team,
        source: "database",
        isStored: true,
      })
    );

    /*
    |--------------------------------------------------------------------------
    | Combine local + TheSportsDB results
    |--------------------------------------------------------------------------
    |
    | Local teams come first.
    |
    | This means if Arsenal is already imported, the user sees:
    |
    | Arsenal
    | Already imported
    |
    | instead of another Arsenal suggestion from TheSportsDB.
    |--------------------------------------------------------------------------
    */

    const combined = [
      ...localTeams,
      ...externalSuggestions,
    ];

    /*
    |--------------------------------------------------------------------------
    | Remove duplicates
    |--------------------------------------------------------------------------
    |
    | A team can potentially match using:
    |
    | - TheSportsDB ID
    | - API-Football ID
    | - Name
    |--------------------------------------------------------------------------
    */

    const seen = new Set();

    const teams = combined.filter((team) => {
      const keys = [];

      if (team.thesportsdb_id) {
        keys.push(
          `sportsdb:${team.thesportsdb_id}`
        );
      }

      if (team.api_football_id) {
        keys.push(
          `apifootball:${team.api_football_id}`
        );
      }

      if (team.name) {
        keys.push(
          `name:${normalizeText(team.name)}`
        );
      }

      const alreadySeen = keys.some((key) =>
        seen.has(key)
      );

      if (alreadySeen) {
        return false;
      }

      keys.forEach((key) => {
        seen.add(key);
      });

      return true;
    });

    /*
    |--------------------------------------------------------------------------
    | Return maximum 10 suggestions
    |--------------------------------------------------------------------------
    */

    const limitedTeams = teams.slice(0, 10);

    res.json({
      status: "success",
      query,
      count: limitedTeams.length,
      teams: limitedTeams,
    });
  } catch (error) {
    console.error(
      "GET /api/teams/search error:",
      error
    );

    res.status(500).json({
      status: "error",
      message: "Failed to search teams",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/teams/:teamSlug/form
|--------------------------------------------------------------------------
| Return the team's last 5 completed matches and calculate W/D/L.
*/
router.get("/:teamSlug/form", async (req, res) => {
  const { teamSlug } = req.params;

  try {
    const teamResult = await pool.query(
      `
      SELECT
        id,
        name,
        short_name,
        slug,
        logo_url
      FROM teams
      WHERE slug = $1
      LIMIT 1
      `,
      [teamSlug]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    const matchesResult = await pool.query(
      `
      SELECT
        m.id,
        m.match_date,
        m.home_score,
        m.away_score,
        m.status,

        home.id AS home_team_id,
        home.name AS home_team_name,
        home.slug AS home_team_slug,

        away.id AS away_team_id,
        away.name AS away_team_name,
        away.slug AS away_team_slug

      FROM matches m

      JOIN teams home
        ON home.id = m.home_team_id

      JOIN teams away
        ON away.id = m.away_team_id

      WHERE
        (m.home_team_id = $1 OR m.away_team_id = $1)
        AND m.status = 'finished'
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL

      ORDER BY m.match_date DESC

      LIMIT 5
      `,
      [team.id]
    );

    const form = matchesResult.rows.map(
      (match) => {
        const isHome =
          match.home_team_id === team.id;

        const teamScore = isHome
          ? match.home_score
          : match.away_score;

        const opponentScore = isHome
          ? match.away_score
          : match.home_score;

        let result = "D";

        if (teamScore > opponentScore) {
          result = "W";
        } else if (
          teamScore < opponentScore
        ) {
          result = "L";
        }

        return {
          matchId: match.id,

          date: match.match_date,

          opponent: {
            id: isHome
              ? match.away_team_id
              : match.home_team_id,

            name: isHome
              ? match.away_team_name
              : match.home_team_name,

            slug: isHome
              ? match.away_team_slug
              : match.home_team_slug,
          },

          score: {
            team: teamScore,
            opponent: opponentScore,
          },

          result,
        };
      }
    );

    res.json({
      status: "success",

      team: {
        id: team.id,
        name: team.name,
        short_name: team.short_name,
        slug: team.slug,
        logo_url: team.logo_url,
      },

      form,
    });
  } catch (error) {
    console.error(
      "GET /api/teams/:teamSlug/form error:",
      error
    );

    res.status(500).json({
      status: "error",
      message: "Failed to load team form",
    });
  }
});

module.exports = router;