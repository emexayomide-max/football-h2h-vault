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

module.exports = router;