const express = require("express");
const pool = require("../db");
const { apiFootballRequest } = require("../services/apiFootball");

const router = express.Router();

/*
 * Get all seasons stored in PostgreSQL
 *
 * GET /api/seasons
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
          id,
          external_id,
          name,
          start_year,
          end_year
      FROM seasons
      ORDER BY start_year DESC
      `
    );

    res.json({
      status: "success",
      seasons: result.rows,
    });
  } catch (error) {
    console.error(
      "Season query failed:",
      error.message
    );

    res.status(500).json({
      status: "error",
      message: "Failed to retrieve seasons",
    });
  }
});

/*
 * Import a specific season from API-Football
 *
 * POST /api/seasons/import/:leagueId/:seasonYear
 *
 * Example:
 * POST /api/seasons/import/39/2025
 *
 * leagueId = API-Football league ID
 * seasonYear = API-Football season year
 */
router.post(
  "/import/:leagueId/:seasonYear",
  async (req, res) => {
    const { leagueId, seasonYear } = req.params;

    const apiFootballLeagueId =
      Number(leagueId);

    const apiFootballSeasonYear =
      Number(seasonYear);

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

    if (
      !Number.isInteger(apiFootballSeasonYear) ||
      apiFootballSeasonYear <= 0
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "A valid season year is required",
      });
    }

    try {
      /*
       * Check whether this season already exists.
       *
       * We use the season year as external_id because
       * API-Football identifies seasons by their year.
       */
      const existingSeason =
        await pool.query(
          `
          SELECT
              id,
              external_id,
              name,
              start_year,
              end_year
          FROM seasons
          WHERE external_id = $1
          `,
          [apiFootballSeasonYear]
        );

      if (existingSeason.rows.length > 0) {
        return res.json({
          status: "success",
          source: "database",
          message: "Season already exists",
          season: existingSeason.rows[0],
        });
      }

      /*
       * Get the league information from API-Football.
       *
       * The league response contains the available
       * seasons for that competition.
       */
      const apiData =
        await apiFootballRequest(
          "/leagues",
          {
            id: apiFootballLeagueId,
          }
        );

      if (
        !apiData.response ||
        apiData.response.length === 0
      ) {
        return res.status(404).json({
          status: "error",
          message:
            "League not found in API-Football",
        });
      }

      const leagueData =
        apiData.response[0];

      const seasons =
        leagueData.seasons || [];

      /*
       * Find the requested season.
       */
      const apiSeason = seasons.find(
        (season) =>
          Number(season.year) ===
          apiFootballSeasonYear
      );

      if (!apiSeason) {
        return res.status(404).json({
          status: "error",
          message:
            "Season not found for this league in API-Football",
        });
      }

      /*
       * API-Football provides:
       *
       * year  -> 2025
       * start -> 2025-08-15
       * end   -> 2026-05-24
       *
       * We convert that into our database format:
       *
       * external_id -> 2025
       * name        -> 2025/26
       * start_year  -> 2025
       * end_year    -> 2026
       */
      const startDate =
        new Date(apiSeason.start);

      const endDate =
        new Date(apiSeason.end);

      const startYear =
        startDate.getUTCFullYear();

      const endYear =
        endDate.getUTCFullYear();

      const name =
        `${startYear}/${String(endYear).slice(-2)}`;

      /*
       * Insert the season.
       */
      const insertResult =
        await pool.query(
          `
          INSERT INTO seasons (
              external_id,
              name,
              start_year,
              end_year
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
              id,
              external_id,
              name,
              start_year,
              end_year
          `,
          [
            apiSeason.year,
            name,
            startYear,
            endYear,
          ]
        );

      return res.status(201).json({
        status: "success",
        source: "api-football",
        message:
          "Season imported successfully",
        season:
          insertResult.rows[0],
      });
    } catch (error) {
      console.error(
        "Season import failed:",
        error.message
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to import season",
      });
    }
  }
);

module.exports = router;