const express = require("express");
const pool = require("../db");

const router = express.Router();

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

module.exports = router;