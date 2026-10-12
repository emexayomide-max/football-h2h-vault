const express = require("express");
const router = express.Router();

const pool = require("../db");

const {
  apiFootballRequest,
  searchTeams: searchApiFootballTeams,
} = require("../services/apiFootball");

const {
  theSportsDbRequest,
  searchTeam: searchSportsDbTeam,
} = require("../services/theSportsDb");

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
|
| API-Football:
|   Historical responsibility: 2022-01-01 -> 2024-12-31
|
| TheSportsDB:
|   Historical responsibility: outside 2022-2024
|   Recent/current matches: TheSportsDB
|
| Neither provider calculates H2H.
| They only provide raw match data.
|
| PostgreSQL is the source used by the H2H calculator.
|--------------------------------------------------------------------------
*/

const API_FOOTBALL_FROM = "2022-01-01";
const API_FOOTBALL_TO = "2024-12-31";

const API_FOOTBALL_SEASONS = [
  2022,
  2023,
  2024,
];

const SPORTSDB_SEASON_START_YEAR = 2010;

const CURRENT_YEAR =
  new Date().getUTCFullYear();

const SPORTSDB_SEASON_END_YEAR =
  CURRENT_YEAR + 1;

const COMPLETED_API_FOOTBALL_STATUSES =
  new Set([
    "FT",
    "AET",
    "PEN",
  ]);

const COMPLETED_SPORTSDB_STATUSES =
  new Set([
    "FT",
    "AET",
    "PEN",
    "Finished",
    "finished",
  ]);

/*
|--------------------------------------------------------------------------
| Generic helpers
|--------------------------------------------------------------------------
*/

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function slugify(value) {
  return normalize(value)
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getYear(value) {
  if (!value) {
    return null;
  }

  const year = Number(
    String(value).substring(0, 4)
  );

  return Number.isInteger(year)
    ? year
    : null;
}

function getCurrentYear() {
  return new Date().getUTCFullYear();
}

function isCompletedApiFootballFixture(
  fixture
) {
  const status =
    fixture?.fixture?.status?.short;

  return COMPLETED_API_FOOTBALL_STATUSES.has(
    status
  );
}

function isCompletedSportsDbEvent(event) {
  if (!event) {
    return false;
  }

  if (
    event.strPostponed &&
    normalize(event.strPostponed) === "yes"
  ) {
    return false;
  }

  return COMPLETED_SPORTSDB_STATUSES.has(
    event.strStatus
  );
}

function parseScore(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function toIsoDate(value) {
  const date = parseDate(value);

  if (!date) {
    return null;
  }

  return date
    .toISOString()
    .substring(0, 10);
}

/*
|--------------------------------------------------------------------------
| Team database lookups
|--------------------------------------------------------------------------
*/

async function getTeamById(id) {
  const result = await pool.query(
    `
      SELECT *
      FROM teams
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getTeamByApiFootballId(
  apiFootballId
) {
  const result = await pool.query(
    `
      SELECT *
      FROM teams
      WHERE api_football_id = $1
      LIMIT 1
    `,
    [apiFootballId]
  );

  return result.rows[0] || null;
}

async function getTeamBySportsDbId(
  sportsDbId
) {
  const result = await pool.query(
    `
      SELECT *
      FROM teams
      WHERE thesportsdb_id = $1
      LIMIT 1
    `,
    [sportsDbId]
  );

  return result.rows[0] || null;
}

async function getTeamByExternalId(
  externalId
) {
  const result = await pool.query(
    `
      SELECT *
      FROM teams
      WHERE external_id = $1
      LIMIT 1
    `,
    [externalId]
  );

  return result.rows[0] || null;
}

async function getTeamBySlug(slug) {
  const result = await pool.query(
    `
      SELECT *
      FROM teams
      WHERE slug = $1
      LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function findTeamByName(name) {
  const result = await pool.query(
    `
      SELECT *
      FROM teams
      WHERE LOWER(name) = LOWER($1)
         OR LOWER(short_name) = LOWER($1)
      ORDER BY id
      LIMIT 1
    `,
    [name]
  );

  return result.rows[0] || null;
}

/*
|--------------------------------------------------------------------------
| API-Football team lookup
|--------------------------------------------------------------------------
*/

async function getApiFootballTeamById(id) {
  try {
    const response =
      await apiFootballRequest(
        "/teams",
        {
          id,
        }
      );

    return (
      response?.response?.[0] ||
      null
    );
  } catch (error) {
    console.error(
      "API-Football team lookup failed:",
      error.message
    );

    return null;
  }
}

async function findApiFootballTeam(name) {
  try {
    const response =
      await searchApiFootballTeams(
        name
      );

    return (
      response?.response?.[0] ||
      null
    );
  } catch (error) {
    console.error(
      "API-Football team search failed:",
      error.message
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| TheSportsDB team lookup
|--------------------------------------------------------------------------
*/

async function findSportsDbTeam(name) {
  try {
    const response =
      await searchSportsDbTeam(name);

    return (
      response?.teams?.find(
        (team) =>
          normalize(team.strTeam) ===
          normalize(name)
      ) ||
      response?.teams?.[0] ||
      null
    );
  } catch (error) {
    console.error(
      "TheSportsDB team search failed:",
      error.message
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| Save / merge canonical team
|--------------------------------------------------------------------------
|
| This function is intentionally provider-aware.
|
| A team may initially arrive from:
|
|   API-Football
|   TheSportsDB
|
| We keep both provider IDs on the same canonical PostgreSQL team.
|--------------------------------------------------------------------------
*/

async function saveTeam({
  apiTeam = null,
  sportsDbTeam = null,
  existingTeam = null,
}) {
  const apiId =
    apiTeam?.team?.id
      ? Number(apiTeam.team.id)
      : existingTeam?.api_football_id ||
        null;

  const sportsDbId =
    sportsDbTeam?.idTeam
      ? Number(sportsDbTeam.idTeam)
      : existingTeam?.thesportsdb_id ||
        null;

  const name =
    apiTeam?.team?.name ||
    sportsDbTeam?.strTeam ||
    existingTeam?.name ||
    null;

  const shortName =
    apiTeam?.team?.code ||
    sportsDbTeam?.strTeamShort ||
    existingTeam?.short_name ||
    null;

  const country =
    apiTeam?.team?.country ||
    sportsDbTeam?.strCountry ||
    existingTeam?.country ||
    null;

  const logo =
    apiTeam?.team?.logo ||
    sportsDbTeam?.strTeamBadge ||
    existingTeam?.logo_url ||
    null;

  const slug =
    existingTeam?.slug ||
    slugify(name);

  if (!name) {
    throw new Error(
      "Unable to determine canonical team name"
    );
  }

  let team =
    existingTeam || null;

  /*
  |--------------------------------------------------------------------------
  | Find by API-Football ID
  |--------------------------------------------------------------------------
  */

  if (!team && apiId) {
    team =
      await getTeamByApiFootballId(
        apiId
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Find by TheSportsDB ID
  |--------------------------------------------------------------------------
  */

  if (!team && sportsDbId) {
    team =
      await getTeamBySportsDbId(
        sportsDbId
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Find by external ID
  |--------------------------------------------------------------------------
  |
  | Important for existing records where the original external_id was
  | created before provider-specific IDs were added.
  |--------------------------------------------------------------------------
  */

  if (!team && apiId) {
    team =
      await getTeamByExternalId(
        apiId
      );
  }

  if (!team && sportsDbId) {
    team =
      await getTeamByExternalId(
        sportsDbId
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Find by canonical name
  |--------------------------------------------------------------------------
  */

  if (!team) {
    team =
      await findTeamByName(name);
  }

  /*
  |--------------------------------------------------------------------------
  | Update existing canonical team
  |--------------------------------------------------------------------------
  */

  if (team) {
    const result = await pool.query(
      `
        UPDATE teams
        SET
          api_football_id =
            COALESCE($1, api_football_id),

          thesportsdb_id =
            COALESCE($2, thesportsdb_id),

          external_id =
            COALESCE(external_id, $1, $2),

          name =
            COALESCE($3, name),

          short_name =
            COALESCE($4, short_name),

          country =
            COALESCE($5, country),

          logo_url =
            COALESCE($6, logo_url),

          slug =
            COALESCE(slug, $7),

          updated_at = NOW()

        WHERE id = $8

        RETURNING *
      `,
      [
        apiId,
        sportsDbId,
        name,
        shortName,
        country,
        logo,
        slug,
        team.id,
      ]
    );

    return result.rows[0];
  }

  /*
  |--------------------------------------------------------------------------
  | Create new canonical team
  |--------------------------------------------------------------------------
  */

  const result = await pool.query(
    `
      INSERT INTO teams (
        external_id,
        api_football_id,
        thesportsdb_id,
        name,
        short_name,
        country,
        logo_url,
        slug,
        created_at,
        updated_at
      )
      VALUES (
        COALESCE($1, $2),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [
      apiId,
      sportsDbId,
      name,
      shortName,
      country,
      logo,
      slug,
    ]
  );

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| Resolve team identifier
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Previously, if API-Football or TheSportsDB found a team that wasn't
| already in PostgreSQL, resolveTeam() returned null.
|
| Now we automatically create/merge the canonical team.
|--------------------------------------------------------------------------
*/

async function resolveTeam(identifier) {
  const value = String(identifier);

  /*
  |--------------------------------------------------------------------------
  | Numeric identifier
  |--------------------------------------------------------------------------
  */

  if (/^\d+$/.test(value)) {
    const numericValue =
      Number(value);

    const byDbId =
      await getTeamById(
        numericValue
      );

    if (byDbId) {
      return byDbId;
    }

    const byApiId =
      await getTeamByApiFootballId(
        numericValue
      );

    if (byApiId) {
      return byApiId;
    }

    const bySportsDbId =
      await getTeamBySportsDbId(
        numericValue
      );

    if (bySportsDbId) {
      return bySportsDbId;
    }

    const byExternalId =
      await getTeamByExternalId(
        numericValue
      );

    if (byExternalId) {
      return byExternalId;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Slug
  |--------------------------------------------------------------------------
  */

  const bySlug =
    await getTeamBySlug(
      slugify(value)
    );

  if (bySlug) {
    return bySlug;
  }

  /*
  |--------------------------------------------------------------------------
  | Existing database name
  |--------------------------------------------------------------------------
  */

  const byName =
    await findTeamByName(value);

  if (byName) {
    return byName;
  }

  /*
  |--------------------------------------------------------------------------
  | API-Football
  |--------------------------------------------------------------------------
  */

  const apiTeam =
    await findApiFootballTeam(value);

  if (apiTeam) {
    const apiTeamId =
      apiTeam.team?.id
        ? Number(apiTeam.team.id)
        : null;

    if (apiTeamId) {
      const existing =
        await getTeamByApiFootballId(
          apiTeamId
        );

      if (existing) {
        /*
        |----------------------------------------------------------------------
        | If the existing team doesn't have its TheSportsDB ID yet,
        | we leave that to the TheSportsDB lookup below when necessary.
        |----------------------------------------------------------------------
        */

        return existing;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT:
    | Save newly discovered API-Football teams.
    |--------------------------------------------------------------------------
    */

    const savedApiTeam =
      await saveTeam({
        apiTeam,
      });

    return savedApiTeam;
  }

  /*
  |--------------------------------------------------------------------------
  | TheSportsDB
  |--------------------------------------------------------------------------
  */

  const sportsDbTeam =
    await findSportsDbTeam(value);

  if (sportsDbTeam) {
    const sportsDbId =
      sportsDbTeam.idTeam
        ? Number(
            sportsDbTeam.idTeam
          )
        : null;

    if (sportsDbId) {
      const existing =
        await getTeamBySportsDbId(
          sportsDbId
        );

      if (existing) {
        return existing;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT:
    | Save newly discovered TheSportsDB teams.
    |--------------------------------------------------------------------------
    */

    const savedSportsDbTeam =
      await saveTeam({
        sportsDbTeam,
      });

    return savedSportsDbTeam;
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Competition
|--------------------------------------------------------------------------
*/

async function ensureCompetition({
  providerId,
  name,
  country = null,
  logoUrl = null,
}) {
  if (!name) {
    return null;
  }

  const slug =
    slugify(name);

  let result = await pool.query(
    `
      SELECT *
      FROM competitions
      WHERE slug = $1
      LIMIT 1
    `,
    [slug]
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  const numericProviderId =
    providerId !== null &&
    providerId !== undefined &&
    providerId !== ""
      ? Number(providerId)
      : null;

  /*
  |--------------------------------------------------------------------------
  | Try existing competition by provider external ID as well.
  |--------------------------------------------------------------------------
  */

  if (numericProviderId) {
    result = await pool.query(
      `
        SELECT *
        FROM competitions
        WHERE external_id = $1
        LIMIT 1
      `,
      [numericProviderId]
    );

    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  result = await pool.query(
    `
      INSERT INTO competitions (
        external_id,
        name,
        country,
        logo_url,
        slug,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        NOW(),
        NOW()
      )

      ON CONFLICT (slug)
      DO UPDATE SET
        name = EXCLUDED.name,

        country = COALESCE(
          EXCLUDED.country,
          competitions.country
        ),

        logo_url = COALESCE(
          EXCLUDED.logo_url,
          competitions.logo_url
        ),

        updated_at = NOW()

      RETURNING *
    `,
    [
      numericProviderId,
      name,
      country,
      logoUrl,
      slug,
    ]
  );

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| Season
|--------------------------------------------------------------------------
|
| seasons.external_id is UNIQUE.
|
| We first search by BOTH:
|
|   name
|   external_id
|
| This prevents an existing season from causing:
|
|   seasons_external_id_key
|
| We also use ON CONFLICT as a final database-level safeguard.
|--------------------------------------------------------------------------
*/

async function ensureSeason(seasonName) {
  if (!seasonName) {
    return null;
  }

  const normalizedName =
    String(seasonName).trim();

  const match =
    normalizedName.match(
      /^(\d{4})(?:-(\d{4}))?$/
    );

  const startYear =
    match
      ? Number(match[1])
      : null;

  const endYear =
    match
      ? Number(
          match[2] || match[1]
        )
      : null;

  const externalId =
    startYear || Date.now();

  /*
  |--------------------------------------------------------------------------
  | First find by name OR external ID.
  |--------------------------------------------------------------------------
  */

  let result = await pool.query(
    `
      SELECT *
      FROM seasons
      WHERE name = $1
         OR external_id = $2
      ORDER BY
        CASE
          WHEN name = $1 THEN 0
          ELSE 1
        END
      LIMIT 1
    `,
    [
      normalizedName,
      externalId,
    ]
  );

  if (result.rows[0]) {
    result = await pool.query(
      `
        UPDATE seasons
        SET
          external_id = $1,

          name = $2,

          start_year =
            COALESCE(
              $3,
              start_year
            ),

          end_year =
            COALESCE(
              $4,
              end_year
            ),

          updated_at = NOW()

        WHERE id = $5

        RETURNING *
      `,
      [
        externalId,
        normalizedName,
        startYear,
        endYear,
        result.rows[0].id,
      ]
    );

    return result.rows[0];
  }

  /*
  |--------------------------------------------------------------------------
  | Insert with database-level conflict protection.
  |--------------------------------------------------------------------------
  */

  result = await pool.query(
    `
      INSERT INTO seasons (
        external_id,
        name,
        start_year,
        end_year,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        NOW(),
        NOW()
      )

      ON CONFLICT (external_id)
      DO UPDATE SET
        name = EXCLUDED.name,

        start_year =
          COALESCE(
            EXCLUDED.start_year,
            seasons.start_year
          ),

        end_year =
          COALESCE(
            EXCLUDED.end_year,
            seasons.end_year
          ),

        updated_at = NOW()

      RETURNING *
    `,
    [
      externalId,
      normalizedName,
      startYear,
      endYear,
    ]
  );

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| API-Football fixture normalization
|--------------------------------------------------------------------------
*/

function normalizeApiFootballFixture(
  fixture
) {
  const date =
    fixture?.fixture?.date;

  const status =
    fixture?.fixture?.status?.short;

  if (
    !date ||
    !COMPLETED_API_FOOTBALL_STATUSES.has(
      status
    )
  ) {
    return null;
  }

  return {
    provider: "api-football",

    providerMatchId:
      fixture.fixture.id,

    date,

    status: "finished",

    homeTeam: {
      providerId:
        fixture.teams.home.id,

      name:
        fixture.teams.home.name,

      logo:
        fixture.teams.home.logo,
    },

    awayTeam: {
      providerId:
        fixture.teams.away.id,

      name:
        fixture.teams.away.name,

      logo:
        fixture.teams.away.logo,
    },

    homeScore:
      parseScore(
        fixture.goals?.home
      ),

    awayScore:
      parseScore(
        fixture.goals?.away
      ),

    halftimeHomeScore:
      parseScore(
        fixture.score?.halftime?.home
      ),

    halftimeAwayScore:
      parseScore(
        fixture.score?.halftime?.away
      ),

    competition: {
      providerId:
        fixture.league?.id,

      name:
        fixture.league?.name,

      country:
        fixture.league?.country,

      logo:
        fixture.league?.logo,
    },

    season:
      fixture.league?.season
        ? String(
            fixture.league.season
          )
        : null,

    venue:
      fixture.fixture?.venue?.name ||
      null,
  };
}

/*
|--------------------------------------------------------------------------
| TheSportsDB event normalization
|--------------------------------------------------------------------------
*/

function normalizeSportsDbEvent(
  event
) {
  if (
    !event ||
    !isCompletedSportsDbEvent(event)
  ) {
    return null;
  }

  const date =
    event.strTimestamp ||
    event.dateEvent;

  if (!date) {
    return null;
  }

  return {
    provider: "thesportsdb",

    providerMatchId:
      event.idEvent,

    date,

    status: "finished",

    homeTeam: {
      providerId:
        event.idHomeTeam
          ? Number(
              event.idHomeTeam
            )
          : null,

      name:
        event.strHomeTeam,

      logo:
        event.strHomeTeamBadge,
    },

    awayTeam: {
      providerId:
        event.idAwayTeam
          ? Number(
              event.idAwayTeam
            )
          : null,

      name:
        event.strAwayTeam,

      logo:
        event.strAwayTeamBadge,
    },

    homeScore:
      parseScore(
        event.intHomeScore
      ),

    awayScore:
      parseScore(
        event.intAwayScore
      ),

    halftimeHomeScore: null,

    halftimeAwayScore: null,

    competition: {
      providerId:
        event.idLeague
          ? Number(
              event.idLeague
            )
          : null,

      name:
        event.strLeague,

      country:
        event.strCountry ||
        null,

      logo:
        event.strLeagueBadge,
    },

    season:
      event.strSeason || null,

    venue:
      event.strVenue || null,
  };
}

/*
|--------------------------------------------------------------------------
| Resolve canonical team from normalized provider team
|--------------------------------------------------------------------------
*/

async function resolveCanonicalTeam(
  provider,
  providerTeam
) {
  if (!providerTeam) {
    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | API-Football
  |--------------------------------------------------------------------------
  */

  if (
    provider === "api-football"
  ) {
    const providerId =
      providerTeam.providerId
        ? Number(
            providerTeam.providerId
          )
        : null;

    const existing =
      providerId
        ? await getTeamByApiFootballId(
            providerId
          )
        : null;

    if (existing) {
      return existing;
    }

    /*
    |----------------------------------------------------------------------
    | Try external ID too.
    |----------------------------------------------------------------------
    */

    if (providerId) {
      const byExternal =
        await getTeamByExternalId(
          providerId
        );

      if (byExternal) {
        const apiTeam =
          await getApiFootballTeamById(
            providerId
          );

        return saveTeam({
          apiTeam,
          existingTeam:
            byExternal,
        });
      }
    }

    const apiTeam =
      providerId
        ? await getApiFootballTeamById(
            providerId
          )
        : null;

    return saveTeam({
      apiTeam,
      existingTeam: null,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | TheSportsDB
  |--------------------------------------------------------------------------
  */

  if (
    provider === "thesportsdb"
  ) {
    const providerId =
      providerTeam.providerId
        ? Number(
            providerTeam.providerId
          )
        : null;

    const existing =
      providerId
        ? await getTeamBySportsDbId(
            providerId
          )
        : null;

    if (existing) {
      return existing;
    }

    if (providerId) {
      const byExternal =
        await getTeamByExternalId(
          providerId
        );

      if (byExternal) {
        const sportsDbTeam =
          (
            await theSportsDbRequest(
              "/lookupteam.php",
              {
                id: providerId,
              }
            )
          )?.teams?.[0];

        return saveTeam({
          sportsDbTeam,
          existingTeam:
            byExternal,
        });
      }
    }

    const sportsDbTeam =
      providerId
        ? (
            await theSportsDbRequest(
              "/lookupteam.php",
              {
                id: providerId,
              }
            )
          )?.teams?.[0]
        : null;

    return saveTeam({
      sportsDbTeam,
      existingTeam: null,
    });
  }

  return findTeamByName(
    providerTeam.name
  );
}

async function ensureProviderTeam(
  provider,
  providerTeam
) {
  return resolveCanonicalTeam(
    provider,
    providerTeam
  );
}

/*
|--------------------------------------------------------------------------
| Match key
|--------------------------------------------------------------------------
*/

function buildMatchKey({
  date,
  homeTeamId,
  awayTeamId,
  competitionId,
}) {
  const datePart =
    toIsoDate(date);

  return [
    datePart,
    homeTeamId,
    awayTeamId,
    competitionId,
  ].join("|");
}

/*
|--------------------------------------------------------------------------
| Save normalized match
|--------------------------------------------------------------------------
*/

async function saveNormalizedMatch(
  normalized
) {
  const homeTeam =
    await ensureProviderTeam(
      normalized.provider,
      normalized.homeTeam
    );

  const awayTeam =
    await ensureProviderTeam(
      normalized.provider,
      normalized.awayTeam
    );

  if (!homeTeam || !awayTeam) {
    throw new Error(
      `Unable to resolve teams for match ${normalized.providerMatchId}`
    );
  }

  const competition =
    await ensureCompetition({
      providerId:
        normalized.competition
          ?.providerId,

      name:
        normalized.competition?.name ||
        "Unknown Competition",

      country:
        normalized.competition?.country,

      logoUrl:
        normalized.competition?.logo,
    });

  const season =
    await ensureSeason(
      normalized.season
    );

  const matchDate =
    parseDate(
      normalized.date
    );

  if (!matchDate) {
    throw new Error(
      `Invalid match date for ${normalized.providerMatchId}`
    );
  }

  const matchKey =
    buildMatchKey({
      date: matchDate,

      homeTeamId:
        homeTeam.id,

      awayTeamId:
        awayTeam.id,

      competitionId:
        competition?.id || null,
    });

  /*
  |--------------------------------------------------------------------------
  | Provider + provider match ID
  |--------------------------------------------------------------------------
  */

  let result = await pool.query(
    `
      SELECT *
      FROM matches
      WHERE provider = $1
        AND provider_match_id = $2
      LIMIT 1
    `,
    [
      normalized.provider,
      normalized.providerMatchId,
    ]
  );

  if (result.rows[0]) {
    result = await pool.query(
      `
        UPDATE matches
        SET
          competition_id =
            COALESCE(
              $1,
              competition_id
            ),

          season_id =
            COALESCE(
              $2,
              season_id
            ),

          match_date = $3,

          home_team_id = $4,

          away_team_id = $5,

          home_score =
            COALESCE(
              $6,
              home_score
            ),

          away_score =
            COALESCE(
              $7,
              away_score
            ),

          halftime_home_score =
            COALESCE(
              $8,
              halftime_home_score
            ),

          halftime_away_score =
            COALESCE(
              $9,
              halftime_away_score
            ),

          status = $10,

          venue =
            COALESCE(
              $11,
              venue
            ),

          match_key =
            COALESCE(
              match_key,
              $12
            ),

          updated_at = NOW()

        WHERE id = $13

        RETURNING *
      `,
      [
        competition?.id || null,
        season?.id || null,
        matchDate,
        homeTeam.id,
        awayTeam.id,
        normalized.homeScore,
        normalized.awayScore,
        normalized.halftimeHomeScore,
        normalized.halftimeAwayScore,
        "finished",
        normalized.venue,
        matchKey,
        result.rows[0].id,
      ]
    );

    return {
      action: "updated",
      match: result.rows[0],
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Match key deduplication
  |--------------------------------------------------------------------------
  */

  result = await pool.query(
    `
      SELECT *
      FROM matches
      WHERE match_key = $1
      LIMIT 1
    `,
    [matchKey]
  );

  if (result.rows[0]) {
    result = await pool.query(
      `
        UPDATE matches
        SET
          competition_id =
            COALESCE(
              competition_id,
              $1
            ),

          season_id =
            COALESCE(
              season_id,
              $2
            ),

          home_score =
            COALESCE(
              home_score,
              $3
            ),

          away_score =
            COALESCE(
              away_score,
              $4
            ),

          halftime_home_score =
            COALESCE(
              halftime_home_score,
              $5
            ),

          halftime_away_score =
            COALESCE(
              halftime_away_score,
              $6
            ),

          venue =
            COALESCE(
              venue,
              $7
            ),

          status = 'finished',

          updated_at = NOW()

        WHERE id = $8

        RETURNING *
      `,
      [
        competition?.id || null,
        season?.id || null,
        normalized.homeScore,
        normalized.awayScore,
        normalized.halftimeHomeScore,
        normalized.halftimeAwayScore,
        normalized.venue,
        result.rows[0].id,
      ]
    );

    return {
      action: "duplicate",
      match: result.rows[0],
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Insert new match
  |--------------------------------------------------------------------------
  */

  result = await pool.query(
    `
      INSERT INTO matches (
        provider_match_id,
        provider,
        competition_id,
        season_id,
        match_date,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        halftime_home_score,
        halftime_away_score,
        status,
        venue,
        match_key,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        'finished',
        $12,
        $13,
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [
      normalized.providerMatchId,
      normalized.provider,
      competition?.id || null,
      season?.id || null,
      matchDate,
      homeTeam.id,
      awayTeam.id,
      normalized.homeScore,
      normalized.awayScore,
      normalized.halftimeHomeScore,
      normalized.halftimeAwayScore,
      normalized.venue,
      matchKey,
    ]
  );

  return {
    action: "inserted",
    match: result.rows[0],
  };
}

/*
|--------------------------------------------------------------------------
| API-Football H2H matches
|--------------------------------------------------------------------------
|
| API-Football requires a season when querying fixtures by team.
|
| We therefore query each season separately.
|--------------------------------------------------------------------------
*/

async function getApiFootballMatches(
  team1,
  team2,
  from = API_FOOTBALL_FROM,
  to = API_FOOTBALL_TO
) {
  if (
    !team1.api_football_id ||
    !team2.api_football_id
  ) {
    console.log(
      "API-Football H2H skipped: missing API-Football team ID",
      {
        team1:
          team1.name,

        team1ApiId:
          team1.api_football_id,

        team2:
          team2.name,

        team2ApiId:
          team2.api_football_id,
      }
    );

    return [];
  }

  const allFixtures = [];

  for (
    const season of API_FOOTBALL_SEASONS
  ) {
    try {
      console.log(
        `API-Football: fetching ${team1.name} fixtures for season ${season}...`
      );

      const response =
        await apiFootballRequest(
          "/fixtures",
          {
            team:
              team1.api_football_id,

            season,
          }
        );

      const fixtures =
        response?.response || [];

      console.log(
        `API-Football: season ${season} returned ${fixtures.length} fixtures`
      );

      allFixtures.push(
        ...fixtures
      );
    } catch (error) {
      console.error(
        `API-Football season ${season} import skipped: ${error.message}`
      );
    }
  }

  const seen =
    new Set();

  return allFixtures
    .filter(
      isCompletedApiFootballFixture
    )

    .filter((fixture) => {
      const fixtureDate =
        fixture.fixture?.date;

      if (!fixtureDate) {
        return false;
      }

      const date =
        toIsoDate(
          fixtureDate
        );

      if (!date) {
        return false;
      }

      return (
        date >= from &&
        date <= to
      );
    })

    .filter((fixture) => {
      const homeId =
        fixture.teams?.home?.id;

      const awayId =
        fixture.teams?.away?.id;

      return (
        (
          homeId ===
            team1.api_football_id &&
          awayId ===
            team2.api_football_id
        ) ||
        (
          homeId ===
            team2.api_football_id &&
          awayId ===
            team1.api_football_id
        )
      );
    })

    .filter((fixture) => {
      const providerMatchId =
        fixture.fixture?.id;

      if (!providerMatchId) {
        return false;
      }

      if (
        seen.has(
          providerMatchId
        )
      ) {
        return false;
      }

      seen.add(
        providerMatchId
      );

      return true;
    })

    .map(
      normalizeApiFootballFixture
    )

    .filter(Boolean);
}

/*
|--------------------------------------------------------------------------
| TheSportsDB event search
|--------------------------------------------------------------------------
*/

async function searchSportsDbEvents(
  eventName
) {
  try {
    const response =
      await theSportsDbRequest(
        "/searchevents.php",
        {
          e: eventName,
        }
      );

    return (
      response?.event || []
    );
  } catch (error) {
    console.error(
      "TheSportsDB event search failed:",
      error.message
    );

    return [];
  }
}

/*
|--------------------------------------------------------------------------
| TheSportsDB recent matches
|--------------------------------------------------------------------------
*/

async function getRecentSportsDbMatches(
  team
) {
  if (!team.thesportsdb_id) {
    return [];
  }

  try {
    const response =
      await theSportsDbRequest(
        "/eventslast.php",
        {
          id:
            team.thesportsdb_id,
        }
      );

    return (
      response?.results || []
    )
      .filter(
        isCompletedSportsDbEvent
      )
      .map(
        normalizeSportsDbEvent
      )
      .filter(Boolean);
  } catch (error) {
    console.error(
      "TheSportsDB recent matches failed:",
      error.message
    );

    return [];
  }
}

/*
|--------------------------------------------------------------------------
| TheSportsDB direct H2H search
|--------------------------------------------------------------------------
*/

async function getSportsDbH2HMatches(
  team1,
  team2,
  from = "2010-01-01",
  to = `${CURRENT_YEAR + 1}-12-31`
) {
  const searches = [
    `${team1.name} vs ${team2.name}`,
    `${team2.name} vs ${team1.name}`,
  ];

  const allEvents = [];

  for (
    const search of searches
  ) {
    const events =
      await searchSportsDbEvents(
        search
      );

    allEvents.push(
      ...events
    );
  }

  const seen =
    new Set();

  return allEvents
    .filter((event) => {
      if (!event.idEvent) {
        return false;
      }

      if (
        seen.has(
          event.idEvent
        )
      ) {
        return false;
      }

      seen.add(
        event.idEvent
      );

      return true;
    })

    .filter(
      isCompletedSportsDbEvent
    )

    .filter((event) => {
      const homeId =
        Number(
          event.idHomeTeam
        );

      const awayId =
        Number(
          event.idAwayTeam
        );

      const team1Id =
        Number(
          team1.thesportsdb_id
        );

      const team2Id =
        Number(
          team2.thesportsdb_id
        );

      const isH2H =
        (
          homeId === team1Id &&
          awayId === team2Id
        ) ||
        (
          homeId === team2Id &&
          awayId === team1Id
        );

      if (!isH2H) {
        return false;
      }

      const date =
        toIsoDate(
          event.strTimestamp ||
          event.dateEvent
        );

      if (!date) {
        return false;
      }

      return (
        date >= from &&
        date <= to
      );
    })

    .map(
      normalizeSportsDbEvent
    )

    .filter(Boolean);
}

/*
|--------------------------------------------------------------------------
| TheSportsDB season events
|--------------------------------------------------------------------------
*/

async function getSportsDbSeasonEvents(
  leagueId,
  season
) {
  try {
    const response =
      await theSportsDbRequest(
        "/eventsseason.php",
        {
          id: leagueId,
          s: season,
        }
      );

    return (
      response?.events || []
    );
  } catch (error) {
    console.error(
      `TheSportsDB season ${season} failed: ${error.message}`
    );

    return [];
  }
}

/*
|--------------------------------------------------------------------------
| TheSportsDB historical matches
|--------------------------------------------------------------------------
*/

async function getSportsDbMatches(
  team1,
  team2,
  from,
  to
) {
  if (
    !team1.thesportsdb_id ||
    !team2.thesportsdb_id
  ) {
    console.log(
      "TheSportsDB H2H skipped: missing team ID",
      {
        team1:
          team1.name,

        team1SportsDbId:
          team1.thesportsdb_id,

        team2:
          team2.name,

        team2SportsDbId:
          team2.thesportsdb_id,
      }
    );

    return [];
  }

  /*
  |--------------------------------------------------------------------------
  | Direct H2H search
  |--------------------------------------------------------------------------
  */

  const direct =
    await getSportsDbH2HMatches(
      team1,
      team2,
      from,
      to
    );

  const results = [
    ...direct,
  ];

  /*
  |--------------------------------------------------------------------------
  | Discover competitions from recent matches.
  |--------------------------------------------------------------------------
  */

  const leagueIds =
    new Set();

  /*
  |--------------------------------------------------------------------------
  | Premier League
  |--------------------------------------------------------------------------
  */

  leagueIds.add(4328);

  /*
  |--------------------------------------------------------------------------
  | Discover other competitions from BOTH teams.
  |--------------------------------------------------------------------------
  */

  try {
    const recentTeam1 =
      await getRecentSportsDbMatches(
        team1
      );

    for (
      const match of recentTeam1
    ) {
      const leagueId =
        match.competition
          ?.providerId;

      if (leagueId) {
        leagueIds.add(
          Number(leagueId)
        );
      }
    }
  } catch {
    // Ignore discovery failure.
  }

  try {
    const recentTeam2 =
      await getRecentSportsDbMatches(
        team2
      );

    for (
      const match of recentTeam2
    ) {
      const leagueId =
        match.competition
          ?.providerId;

      if (leagueId) {
        leagueIds.add(
          Number(leagueId)
        );
      }
    }
  } catch {
    // Ignore discovery failure.
  }

  /*
  |--------------------------------------------------------------------------
  | Query discovered league seasons.
  |--------------------------------------------------------------------------
  */

  const fromYear =
    getYear(from) ||
    SPORTSDB_SEASON_START_YEAR;

  const toYear =
    getYear(to) ||
    SPORTSDB_SEASON_END_YEAR;

  for (
    let year = fromYear;
    year <= toYear;
    year++
  ) {
    const seasonsToTry = [
      `${year}-${year + 1}`,
      `${year}`,
    ];

    for (
      const season of seasonsToTry
    ) {
      for (
        const leagueId of leagueIds
      ) {
        const events =
          await getSportsDbSeasonEvents(
            leagueId,
            season
          );

        for (
          const event of events
        ) {
          const homeId =
            Number(
              event.idHomeTeam
            );

          const awayId =
            Number(
              event.idAwayTeam
            );

          const team1Id =
            Number(
              team1.thesportsdb_id
            );

          const team2Id =
            Number(
              team2.thesportsdb_id
            );

          const isH2H =
            (
              homeId === team1Id &&
              awayId === team2Id
            ) ||
            (
              homeId === team2Id &&
              awayId === team1Id
            );

          if (!isH2H) {
            continue;
          }

          const normalized =
            normalizeSportsDbEvent(
              event
            );

          if (!normalized) {
            continue;
          }

          const date =
            toIsoDate(
              normalized.date
            );

          if (
            date &&
            date >= from &&
            date <= to
          ) {
            results.push(
              normalized
            );
          }
        }
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Deduplicate TheSportsDB events.
  |--------------------------------------------------------------------------
  */

  const seen =
    new Set();

  return results.filter(
    (match) => {
      const key =
        `${match.provider}:${match.providerMatchId}`;

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      return true;
    }
  );
}

/*
|--------------------------------------------------------------------------
| POST /import-h2h/:team1/:team2
|--------------------------------------------------------------------------
*/

router.post(
  "/import-h2h/:team1/:team2",
  async (req, res) => {
    try {
      const {
        team1: team1Identifier,
        team2: team2Identifier,
      } = req.params;

      /*
      |--------------------------------------------------------------------------
      | Resolve teams.
      |--------------------------------------------------------------------------
      */

      const team1 =
        await resolveTeam(
          team1Identifier
        );

      const team2 =
        await resolveTeam(
          team2Identifier
        );

      if (!team1) {
        return res.status(404).json({
          status: "error",
          message:
            `Team not found: ${team1Identifier}`,
        });
      }

      if (!team2) {
        return res.status(404).json({
          status: "error",
          message:
            `Team not found: ${team2Identifier}`,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Provider ranges.
      |--------------------------------------------------------------------------
      */

      const apiFrom =
        API_FOOTBALL_FROM;

      const apiTo =
        API_FOOTBALL_TO;

      const sportsDbFrom =
        "2010-01-01";

      const sportsDbTo =
        `${getCurrentYear() + 1}-12-31`;

      /*
      |--------------------------------------------------------------------------
      | API-Football.
      |--------------------------------------------------------------------------
      */

      const apiFootballMatches =
        await getApiFootballMatches(
          team1,
          team2,
          apiFrom,
          apiTo
        );

      /*
      |--------------------------------------------------------------------------
      | TheSportsDB historical.
      |--------------------------------------------------------------------------
      */

      const sportsDbMatches =
        await getSportsDbMatches(
          team1,
          team2,
          sportsDbFrom,
          sportsDbTo
        );

      /*
      |--------------------------------------------------------------------------
      | TheSportsDB recent/current.
      |--------------------------------------------------------------------------
      */

      const recentTeam1 =
        await getRecentSportsDbMatches(
          team1
        );

      const recentTeam2 =
        await getRecentSportsDbMatches(
          team2
        );

      const recentEvents = [
        ...recentTeam1,
        ...recentTeam2,
      ].filter((match) => {
        const home =
          Number(
            match.homeTeam
              .providerId
          );

        const away =
          Number(
            match.awayTeam
              .providerId
          );

        const team1Id =
          Number(
            team1.thesportsdb_id
          );

        const team2Id =
          Number(
            team2.thesportsdb_id
          );

        return (
          (
            home === team1Id &&
            away === team2Id
          ) ||
          (
            home === team2Id &&
            away === team1Id
          )
        );
      });

      /*
      |--------------------------------------------------------------------------
      | Merge all providers.
      |--------------------------------------------------------------------------
      */

      const allMatches = [
        ...apiFootballMatches,
        ...sportsDbMatches,
        ...recentEvents,
      ];

      /*
      |--------------------------------------------------------------------------
      | Deduplicate provider records.
      |--------------------------------------------------------------------------
      */

      const providerSeen =
        new Set();

      const deduplicated =
        allMatches.filter(
          (match) => {
            const key =
              `${match.provider}:${match.providerMatchId}`;

            if (
              providerSeen.has(key)
            ) {
              return false;
            }

            providerSeen.add(key);

            return true;
          }
        );

      /*
      |--------------------------------------------------------------------------
      | Sort newest first.
      |--------------------------------------------------------------------------
      */

      deduplicated.sort(
        (a, b) => {
          const dateA =
            parseDate(a.date)?.getTime() ||
            0;

          const dateB =
            parseDate(b.date)?.getTime() ||
            0;

          return dateB - dateA;
        }
      );

      /*
      |--------------------------------------------------------------------------
      | Save.
      |--------------------------------------------------------------------------
      */

      let inserted = 0;
      let updated = 0;
      let duplicates = 0;
      let failed = 0;

      let apiInserted = 0;
      let apiUpdated = 0;
      let apiDuplicates = 0;
      let apiFailed = 0;

      let sportsDbInserted = 0;
      let sportsDbUpdated = 0;
      let sportsDbDuplicates = 0;
      let sportsDbFailed = 0;

      for (
        const match of deduplicated
      ) {
        try {
          const result =
            await saveNormalizedMatch(
              match
            );

          if (
            result.action ===
            "inserted"
          ) {
            inserted++;

            if (
              match.provider ===
              "api-football"
            ) {
              apiInserted++;
            } else if (
              match.provider ===
              "thesportsdb"
            ) {
              sportsDbInserted++;
            }
          }

          if (
            result.action ===
            "updated"
          ) {
            updated++;

            if (
              match.provider ===
              "api-football"
            ) {
              apiUpdated++;
            } else if (
              match.provider ===
              "thesportsdb"
            ) {
              sportsDbUpdated++;
            }
          }

          if (
            result.action ===
            "duplicate"
          ) {
            duplicates++;

            if (
              match.provider ===
              "api-football"
            ) {
              apiDuplicates++;
            } else if (
              match.provider ===
              "thesportsdb"
            ) {
              sportsDbDuplicates++;
            }
          }
        } catch (error) {
          failed++;

          if (
            match.provider ===
            "api-football"
          ) {
            apiFailed++;
          }

          if (
            match.provider ===
            "thesportsdb"
          ) {
            sportsDbFailed++;
          }

          console.error(
            `Failed saving ${match.provider} match ${match.providerMatchId}:`,
            error.message
          );
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Actual saved counts.
      |--------------------------------------------------------------------------
      */

      const apiSaved =
        apiInserted +
        apiUpdated +
        apiDuplicates;

      const sportsDbSaved =
        sportsDbInserted +
        sportsDbUpdated +
        sportsDbDuplicates;

      /*
      |--------------------------------------------------------------------------
      | Return importer information.
      |--------------------------------------------------------------------------
      */

      return res.json({
        status: "success",

        teams: {
          team1: {
            id:
              team1.id,

            name:
              team1.name,

            apiFootballId:
              team1.api_football_id,

            sportsDbId:
              team1.thesportsdb_id,
          },

          team2: {
            id:
              team2.id,

            name:
              team2.name,

            apiFootballId:
              team2.api_football_id,

            sportsDbId:
              team2.thesportsdb_id,
          },
        },

        requestedRange: {
          from:
            "2010-01-01",

          to:
            `${getCurrentYear() + 1}-12-31`,
        },

        sources: {
          apiFootball: {
            responsibility:
              "2022-2024",

            requestedRange: {
              from:
                apiFrom,

              to:
                apiTo,
            },

            seasons:
              API_FOOTBALL_SEASONS,

            fetched:
              apiFootballMatches.length,

            saved:
              apiSaved,

            inserted:
              apiInserted,

            updated:
              apiUpdated,

            duplicates:
              apiDuplicates,

            failed:
              apiFailed,
          },

          theSportsDB: {
            responsibility:
              "outside 2022-2024 + recent/current",

            fetched:
              sportsDbMatches.length,

            recentFetched:
              recentEvents.length,

            saved:
              sportsDbSaved,

            inserted:
              sportsDbInserted,

            updated:
              sportsDbUpdated,

            duplicates:
              sportsDbDuplicates,

            failed:
              sportsDbFailed,
          },
        },

        totals: {
          normalized:
            deduplicated.length,

          inserted,

          updated,

          duplicates,

          failed,
        },
      });
    } catch (error) {
      console.error(
        "H2H import error:",
        error
      );

      return res.status(500).json({
        status: "error",

        message:
          error.message,
      });
    }
  }
);

module.exports = router;