import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const API_BASE_URL = "http://localhost:3001";

function safeText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (typeof value === "object") {
    if (value.name) {
      return String(value.name);
    }

    if (value.short_name) {
      return String(value.short_name);
    }

    if (value.slug) {
      return String(value.slug);
    }

    if (value.team1 && value.team2) {
      const team1Name = safeText(value.team1);
      const team2Name = safeText(value.team2);

      if (team1Name || team2Name) {
        return `${team1Name} vs ${team2Name}`;
      }
    }

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function getTeamName(team, fallback = "Team") {
  const name = safeText(team, "");

  return name || fallback;
}

function formatDate(dateString) {
  if (!dateString) {
    return "Unknown date";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getNumber(value, fallback = 0) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return fallback;
}

function FormBadge({ result }) {
  const normalizedResult = safeText(result).toUpperCase();

  const styles = {
    W: "bg-lime-400 text-slate-950",
    D: "bg-slate-600 text-white",
    L: "bg-red-500 text-white",
  };

  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
        styles[normalizedResult] ||
        "bg-slate-700 text-white"
      }`}
    >
      {normalizedResult || "-"}
    </span>
  );
}

function FormCard({
  team,
  form,
  matches,
  loading,
}) {
  const teamName = getTeamName(team);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111722] p-5">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Recent Form
          </p>

          <h3 className="mt-1 text-xl font-bold text-white">
            {teamName}
          </h3>
        </div>

        <div className="flex gap-2">
          {Array.isArray(form) &&
          form.length > 0 ? (
            form.map((result, index) => (
              <FormBadge
                key={`${safeText(result)}-${index}`}
                result={result}
              />
            ))
          ) : (
            <span className="text-sm text-slate-500">
              No form data
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">
          Loading recent matches...
        </p>
      ) : Array.isArray(matches) &&
        matches.length > 0 ? (
        <div className="space-y-3">
          {matches.map((match, index) => {
            const opponent = safeText(
              match?.opponent,
              "Unknown opponent"
            );

            const teamScore = safeText(
              match?.team_score,
              "-"
            );

            const opponentScore = safeText(
              match?.opponent_score,
              "-"
            );

            const venue = safeText(
              match?.venue,
              ""
            );

            return (
              <div
                key={
                  match?.id ??
                  `${opponent}-${index}`
                }
                className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0b1018] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {opponent}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(
                      match?.match_date
                    )}

                    {venue
                      ? ` · ${venue}`
                      : ""}
                  </p>
                </div>

                <div className="ml-4 flex items-center gap-3">
                  <span className="text-sm font-bold text-white">
                    {teamScore} -{" "}
                    {opponentScore}
                  </span>

                  <FormBadge
                    result={match?.result}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No recent finished matches found.
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111722] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {safeText(label)}
      </p>

      <p className="mt-3 text-3xl font-black tracking-tight text-white">
        {safeText(value, "0")}
      </p>

      {description && (
        <p className="mt-1 text-xs text-slate-500">
          {safeText(description)}
        </p>
      )}
    </div>
  );
}

function GoalStat({
  label,
  value,
  total,
}) {
  const numericValue = getNumber(value);
  const numericTotal = getNumber(total);

  const percentage =
    numericTotal > 0
      ? Math.round(
          (numericValue / numericTotal) * 100
        )
      : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111722] p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {safeText(label)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {numericValue} of{" "}
            {numericTotal} meetings
          </p>
        </div>

        <p className="text-2xl font-black text-lime-400">
          {percentage}%
        </p>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-lime-400 transition-all"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function HomeAwayCard({
  title,
  subtitle,
  data,
  homeTeam,
  opponentTeam,
  homeTeamKey,
  opponentTeamKey,
}) {
  if (!data || typeof data !== "object") {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#111722] p-5">
        <p className="text-sm text-slate-500">
          No home/away data available.
        </p>
      </div>
    );
  }

  const meetings = getNumber(
    data.meetings
  );

  const draws = getNumber(
    data.draws
  );

  const cleanSheets = getNumber(
    data.cleanSheets
  );

  const average = getNumber(
    data.average
  );

  const homeWins = getNumber(
    data[homeTeamKey]
  );

  const opponentWins = getNumber(
    data[opponentTeamKey]
  );

  const homeGoals = getNumber(
    data.goals?.[homeTeamKey]
  );

  const opponentGoals = getNumber(
    data.goals?.[opponentTeamKey]
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111722] p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
          {safeText(subtitle)}
        </p>

        <h3 className="mt-2 text-2xl font-black text-white">
          {safeText(title)}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Meetings"
          value={meetings}
        />

        <StatCard
          label="Average Goals"
          value={average.toFixed(2)}
        />

        <StatCard
          label={`${safeText(homeTeam)} Wins`}
          value={homeWins}
        />

        <StatCard
          label="Draws"
          value={draws}
        />

        <StatCard
          label={`${safeText(opponentTeam)} Wins`}
          value={opponentWins}
        />

        <StatCard
          label="Clean Sheets"
          value={cleanSheets}
        />
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-[#0b1018] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
          Goals
        </p>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-black text-white">
            {homeGoals}
          </span>

          <span className="text-slate-600">
            -
          </span>

          <span className="text-3xl font-black text-white">
            {opponentGoals}
          </span>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {safeText(homeTeam)} vs{" "}
          {safeText(opponentTeam)}
        </p>
      </div>
    </div>
  );
}

export default function H2HPage() {
  const { matchup } = useParams();

  const parts = safeText(matchup).split(
    "-vs-"
  );

  const team1Slug = parts[0] || "";
  const team2Slug = parts[1] || "";

  const [h2h, setH2h] = useState(null);
  const [homeAway, setHomeAway] =
    useState(null);

  const [team1Form, setTeam1Form] =
    useState(null);

  const [team2Form, setTeam2Form] =
    useState(null);

  const [competitions, setCompetitions] =
    useState([]);

  const [seasons, setSeasons] =
    useState([]);

  const [selectedCompetition, setSelectedCompetition] =
    useState("");

  const [selectedSeason, setSelectedSeason] =
    useState("");

  const [limit, setLimit] = useState(10);

  const [loading, setLoading] =
    useState(true);

  const [homeAwayLoading, setHomeAwayLoading] =
    useState(true);

  const [formLoading, setFormLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function fetchFilters() {
      try {
        const [
          competitionResponse,
          seasonResponse,
        ] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/competitions`
          ),
          fetch(
            `${API_BASE_URL}/api/seasons`
          ),
        ]);

        if (competitionResponse.ok) {
          const competitionData =
            await competitionResponse.json();

          setCompetitions(
            Array.isArray(
              competitionData.competitions
            )
              ? competitionData.competitions
              : []
          );
        }

        if (seasonResponse.ok) {
          const seasonData =
            await seasonResponse.json();

          setSeasons(
            Array.isArray(
              seasonData.seasons
            )
              ? seasonData.seasons
              : []
          );
        }
      } catch (err) {
        console.error(
          "Failed to load filters:",
          err
        );
      }
    }

    fetchFilters();
  }, []);

  useEffect(() => {
    async function fetchH2H() {
      setLoading(true);
      setError("");

      try {
        const params =
          new URLSearchParams();

        params.set(
          "limit",
          String(limit)
        );

        if (selectedCompetition) {
          params.set(
            "competition",
            selectedCompetition
          );
        }

        if (selectedSeason) {
          params.set(
            "season",
            selectedSeason
          );
        }

        const response = await fetch(
          `${API_BASE_URL}/api/h2h/${team1Slug}/${team2Slug}?${params.toString()}`
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            safeText(
              data?.message,
              "Failed to load H2H data"
            )
          );
        }

        setH2h(data);
      } catch (err) {
        console.error(
          "H2H error:",
          err
        );

        setError(
          err.message ||
            "Failed to load H2H data"
        );
      } finally {
        setLoading(false);
      }
    }

    if (team1Slug && team2Slug) {
      fetchH2H();
    }
  }, [
    team1Slug,
    team2Slug,
    limit,
    selectedCompetition,
    selectedSeason,
  ]);

  useEffect(() => {
    async function fetchHomeAway() {
      setHomeAwayLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/h2h/${team1Slug}/${team2Slug}/home-away`
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            safeText(
              data?.message,
              "Failed to load home/away H2H data"
            )
          );
        }

        setHomeAway(data);
      } catch (err) {
        console.error(
          "Home/away H2H error:",
          err
        );

        setHomeAway(null);
      } finally {
        setHomeAwayLoading(false);
      }
    }

    if (team1Slug && team2Slug) {
      fetchHomeAway();
    }
  }, [
    team1Slug,
    team2Slug,
  ]);

  useEffect(() => {
    async function fetchForms() {
      setFormLoading(true);

      try {
        const [
          team1Response,
          team2Response,
        ] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/teams/${team1Slug}/form`
          ),
          fetch(
            `${API_BASE_URL}/api/teams/${team2Slug}/form`
          ),
        ]);

        const team1Data =
          await team1Response.json();

        const team2Data =
          await team2Response.json();

        if (team1Response.ok) {
          setTeam1Form(team1Data);
        }

        if (team2Response.ok) {
          setTeam2Form(team2Data);
        }
      } catch (err) {
        console.error(
          "Form error:",
          err
        );
      } finally {
        setFormLoading(false);
      }
    }

    if (team1Slug && team2Slug) {
      fetchForms();
    }
  }, [
    team1Slug,
    team2Slug,
  ]);

  const rawTeam1 =
    h2h?.teams?.team1;

  const rawTeam2 =
    h2h?.teams?.team2;

  const team1Name = getTeamName(
    rawTeam1,
    team1Slug
  );

  const team2Name = getTeamName(
    rawTeam2,
    team2Slug
  );

  const record =
    h2h?.record &&
    typeof h2h.record === "object"
      ? h2h.record
      : {};

  const goals =
    h2h?.goals &&
    typeof h2h.goals === "object"
      ? h2h.goals
      : {};

  const btts =
    h2h?.btts &&
    typeof h2h.btts === "object"
      ? h2h.btts
      : {};

  const overGoals =
    h2h?.overGoals &&
    typeof h2h.overGoals === "object"
      ? h2h.overGoals
      : {};

  const cleanSheets =
    h2h?.cleanSheets &&
    typeof h2h.cleanSheets === "object"
      ? h2h.cleanSheets
      : {};

  const matches = Array.isArray(
    h2h?.matches
  )
    ? h2h.matches
    : [];

  const team1Home =
    homeAway?.team1Home;

  const team2Home =
    homeAway?.team2Home;

  return (
    <div className="min-h-screen bg-[#080b12] text-[#f5f7fa]">
      <header className="border-b border-white/10 bg-[#080b12]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="text-lg font-black tracking-tight text-white"
          >
            Football{" "}
            <span className="text-lime-400">
              H2H
            </span>{" "}
            Vault
          </Link>

          <Link
            to="/"
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-lime-400/40 hover:text-lime-400"
          >
            New Search
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {safeText(error)}
          </div>
        )}

        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-lime-400">
            Head-to-Head
          </p>

          <div className="mt-3">
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              {team1Name}{" "}
              <span className="text-slate-600">
                vs
              </span>{" "}
              {team2Name}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              The history behind every matchup.
              Explore results, form, scoring
              patterns, and home versus away
              records.
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-[#111722] p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Competition
              </label>

              <select
                value={selectedCompetition}
                onChange={(event) =>
                  setSelectedCompetition(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-[#0b1018] px-4 py-3 text-sm text-white outline-none transition focus:border-lime-400/50"
              >
                <option value="">
                  All competitions
                </option>

                {competitions.map(
                  (competition) => (
                    <option
                      key={
                        competition.id ||
                        competition.external_id
                      }
                      value={safeText(
                        competition.slug
                      )}
                    >
                      {safeText(
                        competition.name
                      )}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Season
              </label>

              <select
                value={selectedSeason}
                onChange={(event) =>
                  setSelectedSeason(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-[#0b1018] px-4 py-3 text-sm text-white outline-none transition focus:border-lime-400/50"
              >
                <option value="">
                  All seasons
                </option>

                {seasons.map((season) => (
                  <option
                    key={
                      season.id ||
                      season.external_id
                    }
                    value={safeText(
                      season.name
                    )}
                  >
                    {safeText(
                      season.name
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Meetings
              </label>

              <select
                value={limit}
                onChange={(event) =>
                  setLimit(
                    Number(
                      event.target.value
                    )
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-[#0b1018] px-4 py-3 text-sm text-white outline-none transition focus:border-lime-400/50"
              >
                <option value={5}>
                  Last 5
                </option>

                <option value={10}>
                  Last 10
                </option>

                <option value={20}>
                  Last 20
                </option>

                <option value={50}>
                  Last 50
                </option>
              </select>
            </div>
          </div>
        </section>

        <section className="mb-10 grid gap-5 lg:grid-cols-2">
          <FormCard
            team={rawTeam1}
            form={team1Form?.form}
            matches={team1Form?.matches}
            loading={formLoading}
          />

          <FormCard
            team={rawTeam2}
            form={team2Form?.form}
            matches={team2Form?.matches}
            loading={formLoading}
          />
        </section>

        <section className="mb-10">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
              Home & Away
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              Where the matchup happened
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Compare the historical H2H record
              when each team hosted the fixture.
            </p>
          </div>

          {homeAwayLoading ? (
            <div className="rounded-2xl border border-white/10 bg-[#111722] p-6">
              <p className="text-sm text-slate-500">
                Loading home and away records...
              </p>
            </div>
          ) : homeAway ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <HomeAwayCard
                title={`${team1Name} at Home`}
                subtitle="Home team"
                data={team1Home}
                homeTeam={team1Name}
                opponentTeam={team2Name}
                homeTeamKey="team1Wins"
                opponentTeamKey="team2Wins"
              />

              <HomeAwayCard
                title={`${team2Name} at Home`}
                subtitle="Home team"
                data={team2Home}
                homeTeam={team2Name}
                opponentTeam={team1Name}
                homeTeamKey="team2Wins"
                opponentTeamKey="team1Wins"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#111722] p-6">
              <p className="text-sm text-slate-500">
                Home and away data is not available.
              </p>
            </div>
          )}
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#111722] p-8 text-center">
            <p className="text-sm text-slate-500">
              Loading H2H history...
            </p>
          </div>
        ) : h2h ? (
          <>
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
                  Overall Record
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Head-to-head record
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Meetings"
                  value={getNumber(
                    record.meetings,
                    matches.length
                  )}
                />

                <StatCard
                  label={`${team1Name} Wins`}
                  value={getNumber(
                    record.team1Wins
                  )}
                />

                <StatCard
                  label="Draws"
                  value={getNumber(
                    record.draws
                  )}
                />

                <StatCard
                  label={`${team2Name} Wins`}
                  value={getNumber(
                    record.team2Wins
                  )}
                />
              </div>
            </section>

            <section className="mb-10">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
                  Goals
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Scoring history
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label={`${team1Name} Goals`}
                  value={getNumber(
                    goals.team1
                  )}
                />

                <StatCard
                  label={`${team2Name} Goals`}
                  value={getNumber(
                    goals.team2
                  )}
                />

                <StatCard
                  label="Total Goals"
                  value={getNumber(
                    goals.total
                  )}
                />

                <StatCard
                  label="Average Goals"
                  value={getNumber(
                    goals.average
                  ).toFixed(2)}
                />
              </div>
            </section>

            <section className="mb-10">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
                  Both Teams To Score
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  BTTS history
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <StatCard
                  label="BTTS Yes"
                  value={getNumber(
                    btts.yes
                  )}
                />

                <StatCard
                  label="BTTS No"
                  value={getNumber(
                    btts.no
                  )}
                />
              </div>
            </section>

            <section className="mb-10">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
                  Goal Lines
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Over goals
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <GoalStat
                  label="Over 0.5"
                  value={overGoals.over05}
                  total={
                    record.meetings ??
                    matches.length
                  }
                />

                <GoalStat
                  label="Over 1.5"
                  value={overGoals.over15}
                  total={
                    record.meetings ??
                    matches.length
                  }
                />

                <GoalStat
                  label="Over 2.5"
                  value={overGoals.over25}
                  total={
                    record.meetings ??
                    matches.length
                  }
                />

                <GoalStat
                  label="Over 3.5"
                  value={overGoals.over35}
                  total={
                    record.meetings ??
                    matches.length
                  }
                />

                <GoalStat
                  label="Over 4.5"
                  value={overGoals.over45}
                  total={
                    record.meetings ??
                    matches.length
                  }
                />
              </div>
            </section>

            <section className="mb-10">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
                  Defensive Record
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Clean sheets
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <StatCard
                  label={`${team1Name} Clean Sheets`}
                  value={getNumber(
                    cleanSheets.team1
                  )}
                />

                <StatCard
                  label={`${team2Name} Clean Sheets`}
                  value={getNumber(
                    cleanSheets.team2
                  )}
                />
              </div>
            </section>

            <section>
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-400">
                  Match History
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Recent meetings
                </h2>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111722]">
                {matches.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {matches.map(
                      (match, index) => {
                        const homeTeam =
                          safeText(
                            match?.home_team,
                            "Unknown team"
                          );

                        const awayTeam =
                          safeText(
                            match?.away_team,
                            "Unknown team"
                          );

                        const homeScore =
                          safeText(
                            match?.home_score,
                            "-"
                          );

                        const awayScore =
                          safeText(
                            match?.away_score,
                            "-"
                          );

                        const venue =
                          safeText(
                            match?.venue,
                            ""
                          );

                        const competition =
                          safeText(
                            match?.competition,
                            ""
                          );

                        const season =
                          safeText(
                            match?.season,
                            ""
                          );

                        return (
                          <div
                            key={
                              match?.id ??
                              `${homeTeam}-${awayTeam}-${index}`
                            }
                            className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_auto_1fr] md:items-center"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {homeTeam}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {venue}
                              </p>
                            </div>

                            <div className="text-left md:text-center">
                              <p className="text-xl font-black text-white">
                                {homeScore}{" "}
                                -{" "}
                                {awayScore}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {formatDate(
                                  match?.match_date
                                )}
                              </p>
                            </div>

                            <div className="md:text-right">
                              <p className="text-sm font-semibold text-white">
                                {awayTeam}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {competition}

                                {season
                                  ? ` · ${season}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-500">
                      No meetings found for
                      the selected filters.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>

      <footer className="mt-16 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center sm:px-6 lg:px-8">
          <p className="text-xs text-slate-600">
            Football H2H Vault — The history behind
            every matchup.
          </p>
        </div>
      </footer>
    </div>
  );
}