const express = require("express");
const pool = require("../db");
const { apiFootballRequest } = require("../services/apiFootball");

const router = express.Router();

/*
 * Get all competitions stored in PostgreSQL
 *
 * GET /api/competitions
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
          id,
          external_id,
          name,
          country,
          logo_url,
          slug
      FROM competitions
      ORDER BY name ASC
      `
    );

    res.json({
      status: "success",
      competitions: result.rows,
    });
  } catch (error) {
    console.error(
      "Competition query failed:",
      error.message
    );

    res.status(500).json({
      status: "error",
      message: "Failed to retrieve competitions",
    });
  }
});

/*
 * Import a specific competition from API-Football
 *
 * POST /api/competitions/import/:externalId
 *
 * Example:
 * POST /api/competitions/import/39
 */
router.post(
  "/import/:externalId",
  async (req, res) => {
    const { externalId } = req.params;

    const apiFootballLeagueId =
      Number(externalId);

    /*
     * Validate the ID.
     */
    if (
      !Number.isInteger(apiFootballLeagueId) ||
      apiFootballLeagueId <= 0
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "A valid API-Football league ID is required",
      });
    }

    try {
      /*
       * Check whether this competition
       * already exists locally.
       */
      const existingCompetition =
        await pool.query(
          `
          SELECT
              id,
              external_id,
              name,
              country,
              logo_url,
              slug
          FROM competitions
          WHERE external_id = $1
          `,
          [apiFootballLeagueId]
        );

      if (
        existingCompetition.rows.length > 0
      ) {
        return res.json({
          status: "success",
          source: "database",
          message:
            "Competition already exists",
          competition:
            existingCompetition.rows[0],
        });
      }

      /*
       * Fetch the competition from
       * API-Football.
       */
      const apiData =
        await apiFootballRequest(
          "/leagues",
          {
            id: apiFootballLeagueId,
          }
        );

      /*
       * Make sure API-Football returned
       * a competition.
       */
      if (
        !apiData.response ||
        apiData.response.length === 0
      ) {
        return res.status(404).json({
          status: "error",
          message:
            "Competition not found in API-Football",
        });
      }

      const apiCompetition =
        apiData.response[0];

      const league =
        apiCompetition.league;

      const country =
        apiCompetition.country;

      /*
       * Generate a URL-friendly slug.
       *
       * Example:
       * Premier League
       * becomes
       * premier-league
       */
      const baseSlug = league.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      /*
       * Check whether another competition
       * already uses this slug.
       */
      const slugResult = await pool.query(
        `
        SELECT id, external_id
        FROM competitions
        WHERE slug = $1
        `,
        [baseSlug]
      );

      /*
       * If the slug is already used,
       * append the API-Football ID.
       */
      const slug =
        slugResult.rows.length > 0
          ? `${baseSlug}-${league.id}`
          : baseSlug;

      /*
       * Insert the real competition.
       */
      const insertResult =
        await pool.query(
          `
          INSERT INTO competitions (
              external_id,
              name,
              country,
              logo_url,
              slug
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING
              id,
              external_id,
              name,
              country,
              logo_url,
              slug
          `,
          [
            league.id,
            league.name,
            country?.name || null,
            league.logo || null,
            slug,
          ]
        );

      return res.status(201).json({
        status: "success",
        source: "api-football",
        message:
          "Competition imported successfully",
        competition:
          insertResult.rows[0],
      });
    } catch (error) {
      console.error(
        "Competition import failed:",
        error.message
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to import competition",
      });
    }
  }
);

module.exports = router;