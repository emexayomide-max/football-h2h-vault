
const express = require("express");
const pool = require("../db");

const router = express.Router();

/*
 * Search teams
 *
 * GET /api/teams/search?q=ars
 */
router.get("/search", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Search query is required",
    });
  }

  try {
    const searchTerm = `%${q.trim()}%`;

    const result = await pool.query(
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
      WHERE
          name ILIKE $1
          OR short_name ILIKE $1
          OR slug ILIKE $1
      ORDER BY name ASC
      LIMIT 10
      `,
      [searchTerm]
    );

    res.json({
      status: "success",
      teams: result.rows,
    });
  } catch (error) {
    console.error(
      "Team search failed:",
      error.message
    );

    res.status(500).json({
      status: "error",
      message: "Failed to search teams",
    });
  }
});

/*
 * Get recent form for a team
 *
 * GET /api/teams/:teamSlug/form
 *
 * Returns the team's five most recent
 * completed matches.
 */
router.get("/:teamSlug/form", async (req, res) => {
  const { teamSlug } = req.params;

  try {
    /*
     * First find the team using its slug.
     */
    const teamResult = await pool.query(
      `
      SELECT
          id,
          name,
          short_name,
          country,
          logo_url,
          slug
      FROM teams
      WHERE slug = $1
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

    /*
     * Get the team's five most recent
     * completed matches.
     */
    const matchesResult = await pool.query(
      `
      SELECT
          m.id,
          m.match_date,
          m.home_team_id,
          m.away_team_id,
          m.home_score,
          m.away_score,
          m.status,
          home_team.name AS home_team,
          away_team.name AS away_team,
          c.name AS competition,
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
              m.home_team_id = $1
              OR m.away_team_id = $1
          )
          AND m.status = 'finished'
          AND m.home_score IS NOT NULL
          AND m.away_score IS NOT NULL
      ORDER BY m.match_date DESC
      LIMIT 5
      `,
      [team.id]
    );

    /*
     * Calculate W / D / L from the team's perspective.
     */
    const matches = matchesResult.rows.map((match) => {
      const isHome = match.home_team_id === team.id;

      const teamScore = isHome
        ? match.home_score
        : match.away_score;

      const opponentScore = isHome
        ? match.away_score
        : match.home_score;

      let result;

      if (teamScore > opponentScore) {
        result = "W";
      } else if (teamScore < opponentScore) {
        result = "L";
      } else {
        result = "D";
      }

      return {
        id: match.id,
        match_date: match.match_date,
        opponent: isHome
          ? match.away_team
          : match.home_team,
        venue: isHome ? "Home" : "Away",
        team_score: teamScore,
        opponent_score: opponentScore,
        result,
        competition: match.competition,
        season: match.season,
      };
    });

    res.json({
      status: "success",

      team: {
        id: team.id,
        name: team.name,
        short_name: team.short_name,
        country: team.country,
        logo_url: team.logo_url,
        slug: team.slug,
      },

      form: matches.map(
        (match) => match.result
      ),

      matches,
    });
  } catch (error) {
    console.error(
      "Team form query failed:",
      error.message
    );

    res.status(500).json({
      status: "error",
      message: "Failed to retrieve team form",
    });
  }
});

module.exports = router;
