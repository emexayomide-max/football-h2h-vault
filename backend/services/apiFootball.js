
require("dotenv").config();

const API_BASE_URL =
  "https://v3.football.api-sports.io";

/*
|--------------------------------------------------------------------------
| API-Football request helper
|--------------------------------------------------------------------------
*/

async function apiFootballRequest(
  endpoint,
  params = {}
) {
  if (!process.env.API_FOOTBALL_KEY) {
    throw new Error(
      "API_FOOTBALL_KEY is not configured"
    );
  }

  const url = new URL(
    `${API_BASE_URL}${endpoint}`
  );

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        url.searchParams.set(
          key,
          String(value)
        );
      }
    }
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-apisports-key":
        process.env.API_FOOTBALL_KEY,
    },
  });

  /*
  |--------------------------------------------------------------------------
  | HTTP-level failure
  |--------------------------------------------------------------------------
  */

  if (!response.ok) {
    throw new Error(
      `API-Football request failed: ${response.status} ${response.statusText}`
    );
  }

  const data =
    await response.json();

  /*
  |--------------------------------------------------------------------------
  | API-Football can return HTTP 200 while reporting
  | quota/authentication/API errors inside "errors".
  |--------------------------------------------------------------------------
  */

  if (
    data.errors &&
    Object.keys(data.errors).length > 0
  ) {
    throw new Error(
      `API-Football error: ${JSON.stringify(
        data.errors
      )}`
    );
  }

  return data;
}

/*
|--------------------------------------------------------------------------
| Search teams
|--------------------------------------------------------------------------
*/

async function searchTeams(search) {
  return apiFootballRequest(
    "/teams",
    {
      search,
    }
  );
}

/*
|--------------------------------------------------------------------------
| Get team by API-Football ID
|--------------------------------------------------------------------------
*/

async function getTeamById(id) {
  return apiFootballRequest(
    "/teams",
    {
      id,
    }
  );
}

/*
|--------------------------------------------------------------------------
| Get fixtures for a team
|
| API-Football requires "season" when querying fixtures by team.
|
| Example:
|
| getFixtures({
|   team: 42,
|   season: 2024
| })
|
| "from" and "to" are still accepted so the caller can
| additionally restrict the returned fixtures by date.
|--------------------------------------------------------------------------
*/

async function getFixtures({
  team,
  season,
  from,
  to,
}) {
  return apiFootballRequest(
    "/fixtures",
    {
      team,
      season,
      from,
      to,
    }
  );
}

module.exports = {
  apiFootballRequest,
  searchTeams,
  getTeamById,
  getFixtures,
};
