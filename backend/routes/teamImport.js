const express = require("express");

const router = express.Router();

const pool = require("../db");
const { apiFootballRequest } = require("../services/apiFootball");
const { searchTeam } = require("../services/theSportsDb");

function createSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|ac|club)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function namesMatch(apiName, sportsDbTeam) {
  const apiNormalized = normalizeName(apiName);

  const possibleNames = [
    sportsDbTeam.strTeam,
    sportsDbTeam.strTeamAlternate,
    sportsDbTeam.strTeamShort,
  ];

  return possibleNames.some(
    (name) => normalizeName(name) === apiNormalized
  );
}

function countriesMatch(apiCountry, sportsDbCountry) {
  if (!apiCountry || !sportsDbCountry) {
    return false;
  }

  return (
    String(apiCountry).toLowerCase().trim() ===
    String(sportsDbCountry).toLowerCase().trim()
  );
}

async function resolveTheSportsDbTeam(
  externalId,
  teamName,
  country
) {
  try {
    const result = await searchTeam(teamName);

    const teams = result?.teams || [];

    if (teams.length === 0) {
      return null;
    }

    // First choice:
    // TheSportsDB directly provides the API-Football ID.
    const apiFootballMatch = teams.find(
      (team) =>
        String(team.idAPIfootball || "") ===
        String(externalId)
    );

    if (apiFootballMatch) {
      return {
        thesportsdb_id: Number(
          apiFootballMatch.idTeam
        ),
        match_method:
          "api-football-id",
        sportsdb_team:
          apiFootballMatch,
      };
    }

    // Second choice:
    // Match normalized name + country.
    const nameCountryMatch = teams.find(
      (team) =>
        namesMatch(teamName, team) &&
        countriesMatch(
          country,
          team.strCountry
        )
    );

    if (nameCountryMatch) {
      return {
        thesportsdb_id: Number(
          nameCountryMatch.idTeam
        ),
        match_method:
          "name-country",
        sportsdb_team:
          nameCountryMatch,
      };
    }

    // Third choice:
    // Match normalized name only.
    const nameMatch = teams.find((team) =>
      namesMatch(teamName, team)
    );

    if (nameMatch) {
      return {
        thesportsdb_id: Number(
          nameMatch.idTeam
        ),
        match_method: "name",
        sportsdb_team: nameMatch,
      };
    }

    return null;
  } catch (error) {
    console.error(
      "TheSportsDB team resolution failed:",
      error.message
    );

    return null;
  }
}

router.post("/:externalId", async (req, res) => {
  const externalId = Number(req.params.externalId);

  if (!Number.isInteger(externalId)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid API-Football team ID",
    });
  }

  try {
    /*
     * Get the team from API-Football.
     */
    const data = await apiFootballRequest(
      "/teams",
      {
        id: externalId,
      }
    );

    const apiTeam =
      data?.response?.[0]?.team;

    if (!apiTeam) {
      return res.status(404).json({
        status: "error",
        message:
          "Team was not found in API-Football",
      });
    }

    const teamName = apiTeam.name;
    const shortName =
      apiTeam.code || null;
    const country =
      apiTeam.country || null;
    const logoUrl =
      apiTeam.logo || null;

    /*
     * Automatically find the same club
     * inside TheSportsDB.
     */
    const resolvedSportsDbTeam =
      await resolveTheSportsDbTeam(
        externalId,
        teamName,
        country
      );

    const thesportsdbId =
      resolvedSportsDbTeam?.thesportsdb_id ||
      null;

    /*
     * Check whether this club already exists.
     */
    const existingResult = await pool.query(
      `
      SELECT
        id,
        external_id,
        thesportsdb_id,
        name,
        short_name,
        country,
        logo_url,
        slug
      FROM teams
      WHERE external_id = $1
      LIMIT 1
      `,
      [externalId]
    );

    if (existingResult.rows.length > 0) {
      const existingTeam =
        existingResult.rows[0];

      /*
       * Update the existing club with the
       * TheSportsDB ID if we found one.
       */
      const updatedResult =
        await pool.query(
          `
          UPDATE teams
          SET
            name = $1,
            short_name = $2,
            country = $3,
            logo_url = $4,
            thesportsdb_id = COALESCE($5, thesportsdb_id)
          WHERE external_id = $6
          RETURNING
            id,
            external_id,
            thesportsdb_id,
            name,
            short_name,
            country,
            logo_url,
            slug
          `,
          [
            teamName,
            shortName,
            country,
            logoUrl,
            thesportsdbId,
            externalId,
          ]
        );

      return res.json({
        status: "success",
        source: "database",
        message: "Team already exists",
        mapping: {
          thesportsdb_id:
            updatedResult.rows[0]
              .thesportsdb_id,
          method:
            resolvedSportsDbTeam?.match_method ||
            null,
        },
        team: updatedResult.rows[0],
      });
    }

    /*
     * Create a unique slug.
     */
    let slug = createSlug(teamName);

    const slugCheck = await pool.query(
      `
      SELECT id
      FROM teams
      WHERE slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (slugCheck.rows.length > 0) {
      slug = `${slug}-${externalId}`;
    }

    /*
     * Insert the new club.
     */
    const insertResult = await pool.query(
      `
      INSERT INTO teams (
        external_id,
        thesportsdb_id,
        name,
        short_name,
        country,
        logo_url,
        slug
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        external_id,
        thesportsdb_id,
        name,
        short_name,
        country,
        logo_url,
        slug
      `,
      [
        externalId,
        thesportsdbId,
        teamName,
        shortName,
        country,
        logoUrl,
        slug,
      ]
    );

    return res.status(201).json({
      status: "success",
      source: "api-football",
      message: "Team imported successfully",
      mapping: {
        thesportsdb_id: thesportsdbId,
        method:
          resolvedSportsDbTeam?.match_method ||
          null,
      },
      team: insertResult.rows[0],
    });
  } catch (error) {
    console.error(
      "Team import error:",
      error
    );

    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

module.exports = router;