
require("dotenv").config();

const THE_SPORTS_DB_BASE_URL =
  "https://www.thesportsdb.com/api/v1/json/123";

/*
|--------------------------------------------------------------------------
| TheSportsDB request helper
|--------------------------------------------------------------------------
|
| 123 is the public/demo API key currently being used.
|
| We do NOT require a personal TheSportsDB account for these
| requests.
|--------------------------------------------------------------------------
*/

async function theSportsDbRequest(
  endpoint,
  params = {}
) {
  const url = new URL(
    `${THE_SPORTS_DB_BASE_URL}${endpoint}`
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
  });

  if (!response.ok) {
    throw new Error(
      `TheSportsDB request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/*
|--------------------------------------------------------------------------
| Search teams
|--------------------------------------------------------------------------
*/

async function searchTeam(teamName) {
  return theSportsDbRequest(
    "/searchteams.php",
    {
      t: teamName,
    }
  );
}

/*
|--------------------------------------------------------------------------
| Lookup one team
|--------------------------------------------------------------------------
*/

async function getTeamById(teamId) {
  return theSportsDbRequest(
    "/lookupteam.php",
    {
      id: teamId,
    }
  );
}

/*
|--------------------------------------------------------------------------
| Get events for a league season
|--------------------------------------------------------------------------
*/

async function getSeasonEvents(
  leagueId,
  season
) {
  return theSportsDbRequest(
    "/eventsseason.php",
    {
      id: leagueId,
      s: season,
    }
  );
}

/*
|--------------------------------------------------------------------------
| Get recent events for a team
|--------------------------------------------------------------------------
*/

async function getRecentEvents(
  teamId
) {
  return theSportsDbRequest(
    "/eventslast.php",
    {
      id: teamId,
    }
  );
}

/*
|--------------------------------------------------------------------------
| Search events by text
|--------------------------------------------------------------------------
|
| This is a search endpoint, NOT treated as a complete
| historical H2H source.
|--------------------------------------------------------------------------
*/

async function searchEvents(
  eventName
) {
  return theSportsDbRequest(
    "/searchevents.php",
    {
      e: eventName,
    }
  );
}

/*
|--------------------------------------------------------------------------
| Lookup league
|--------------------------------------------------------------------------
*/

async function lookupLeague(
  leagueId
) {
  return theSportsDbRequest(
    "/lookupleague.php",
    {
      id: leagueId,
    }
  );
}

module.exports = {
  theSportsDbRequest,
  searchTeam,
  getTeamById,
  getSeasonEvents,
  getRecentEvents,
  searchEvents,
  lookupLeague,
};
