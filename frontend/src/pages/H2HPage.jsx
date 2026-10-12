import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

function formatDate(date) {
  if (!date) return "Unknown date";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPercentage(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

/*
 * Convert the backend match shape into the shape
 * expected by the existing UI.
 *
 * Backend:
 *   home_score
 *   away_score
 *   home_team_id
 *   away_team_id
 *   home_team_name
 *   away_team_name
 *   match_date
 *
 * Frontend:
 *   score.home
 *   score.away
 *   homeTeam.id
 *   homeTeam.name
 *   awayTeam.id
 *   awayTeam.name
 *   date
 */
function normalizeMatch(match) {
  return {
    ...match,

    date: match.match_date,

    score: {
      home: Number(match.home_score ?? 0),
      away: Number(match.away_score ?? 0),
    },

    homeTeam: {
      id: match.home_team_id,
      name: match.home_team_name,
      slug: match.home_team_slug,
    },

    awayTeam: {
      id: match.away_team_id,
      name: match.away_team_name,
      slug: match.away_team_slug,
    },

    competition: {
      id: match.competition_id,
      name: match.competition_name,
    },

    season: {
      id: match.season_id,
      name: match.season_name,
    },
  };
}

/*
 * Convert the backend summary into the shape
 * expected by the UI.
 */
function normalizeSummary(summary) {
  const totalMatches = Number(summary.totalMatches || 0);

  const team1Wins = Number(summary.team1Wins || 0);
  const team2Wins = Number(summary.team2Wins || 0);
  const draws = Number(summary.draws || 0);

  const team1Goals = Number(summary.team1Goals || 0);
  const team2Goals = Number(summary.team2Goals || 0);

  const btts = Number(summary.btts || 0);

  const over05 = Number(summary.over05 || 0);
  const over15 = Number(summary.over15 || 0);
  const over25 = Number(summary.over25 || 0);
  const over35 = Number(summary.over35 || 0);
  const over45 = Number(summary.over45 || 0);

  const team1CleanSheets = Number(
    summary.team1CleanSheets || 0
  );

  const team2CleanSheets = Number(
    summary.team2CleanSheets || 0
  );

  return {
    ...summary,

    totalMatches,

    team1Wins,
    team2Wins,
    draws,

    team1WinPercentage:
      totalMatches > 0
        ? (team1Wins / totalMatches) * 100
        : 0,

    team2WinPercentage:
      totalMatches > 0
        ? (team2Wins / totalMatches) * 100
        : 0,

    drawPercentage:
      totalMatches > 0
        ? (draws / totalMatches) * 100
        : 0,

    team1Goals,
    team2Goals,

    totalGoals: team1Goals + team2Goals,

    goalDifference:
      team1Goals - team2Goals,

    averageGoals:
      totalMatches > 0
        ? (team1Goals + team2Goals) /
          totalMatches
        : 0,

    btts: {
      count: btts,
      percentage:
        totalMatches > 0
          ? (btts / totalMatches) * 100
          : 0,
    },

    over05: {
      count: over05,
      percentage:
        totalMatches > 0
          ? (over05 / totalMatches) * 100
          : 0,
    },

    over15: {
      count: over15,
      percentage:
        totalMatches > 0
          ? (over15 / totalMatches) * 100
          : 0,
    },

    over25: {
      count: over25,
      percentage:
        totalMatches > 0
          ? (over25 / totalMatches) * 100
          : 0,
    },

    over35: {
      count: over35,
      percentage:
        totalMatches > 0
          ? (over35 / totalMatches) * 100
          : 0,
    },

    over45: {
      count: over45,
      percentage:
        totalMatches > 0
          ? (over45 / totalMatches) * 100
          : 0,
    },

    cleanSheets: {
      team1: team1CleanSheets,
      team2: team2CleanSheets,
    },
  };
}

/*
 * Convert the backend home/away response into
 * arrays of normalized matches.
 */
function normalizeHomeAway(data) {
  if (!data?.breakdown) {
    return {
      team1Home: [],
      team2Home: [],
      team1Away: [],
      team2Away: [],
    };
  }

  return {
    team1Home: Array.isArray(
      data.breakdown.team1?.home?.matches
    )
      ? data.breakdown.team1.home.matches.map(
          normalizeMatch
        )
      : [],

    team2Home: Array.isArray(
      data.breakdown.team2?.home?.matches
    )
      ? data.breakdown.team2.home.matches.map(
          normalizeMatch
        )
      : [],

    team1Away: Array.isArray(
      data.breakdown.team1?.away?.matches
    )
      ? data.breakdown.team1.away.matches.map(
          normalizeMatch
        )
      : [],

    team2Away: Array.isArray(
      data.breakdown.team2?.away?.matches
    )
      ? data.breakdown.team2.away.matches.map(
          normalizeMatch
        )
      : [],
  };
}

function getResult(match, teamId) {
  const homeScore = Number(
    match.score?.home ?? 0
  );

  const awayScore = Number(
    match.score?.away ?? 0
  );

  const isHome =
    Number(match.homeTeam?.id) === Number(teamId);

  const teamScore = isHome
    ? homeScore
    : awayScore;

  const opponentScore = isHome
    ? awayScore
    : homeScore;

  if (teamScore > opponentScore) return "W";
  if (teamScore < opponentScore) return "L";

  return "D";
}

function ResultBadge({ result }) {
  const classes = {
    W: "bg-[#B7F34A]/15 text-[#B7F34A] border-[#B7F34A]/20",
    D: "bg-white/5 text-[#8B95A7] border-white/10",
    L: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
        classes[result] || classes.D
      }`}
    >
      {result}
    </span>
  );
}

function StatCard({
  label,
  value,
  subtext,
  accent = false,
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#111722] p-4 sm:p-5">
      <p className="break-words text-[10px] font-semibold uppercase tracking-wider text-[#596274] sm:text-xs">
        {label}
      </p>

      <p
        className={`mt-2 break-words text-xl font-bold sm:mt-3 sm:text-2xl ${
          accent
            ? "text-[#B7F34A]"
            : "text-[#F5F7FA]"
        }`}
      >
        {value}
      </p>

      {subtext && (
        <p className="mt-1 break-words text-[11px] text-[#8B95A7] sm:text-xs">
          {subtext}
        </p>
      )}
    </div>
  );
}

function PercentageBar({
  label,
  percentage,
  count,
  total,
}) {
  const safePercentage = Math.max(
    0,
    Math.min(100, Number(percentage || 0))
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="min-w-0 text-xs text-[#F5F7FA] sm:text-sm">
          {label}
        </span>

        <span className="shrink-0 text-xs font-semibold text-[#B7F34A] sm:text-sm">
          {formatPercentage(safePercentage)}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-[#B7F34A] transition-all"
          style={{
            width: `${safePercentage}%`,
          }}
        />
      </div>

      <p className="mt-1 text-[10px] text-[#596274] sm:text-xs">
        {count || 0} of {total || 0} matches
      </p>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#111722] p-4 sm:p-6">
      <div className="mb-5 sm:mb-6">
        <h2 className="text-base font-bold text-[#F5F7FA] sm:text-lg">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-xs leading-5 text-[#8B95A7] sm:text-sm sm:leading-6">
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function TeamHeader({ team, side }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 sm:gap-4 ${
        side === "right"
          ? "flex-row-reverse text-right"
          : ""
      }`}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#080B12] sm:h-16 sm:w-16">
        {team?.logo_url ? (
          <img
            src={team.logo_url}
            alt={team.name}
            className="h-10 w-10 object-contain sm:h-12 sm:w-12"
          />
        ) : (
          <span className="text-lg font-bold text-[#B7F34A] sm:text-xl">
            {team?.name?.charAt(0) || "?"}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#596274] sm:text-xs">
          {side === "right" ? "Team 2" : "Team 1"}
        </p>

        <h1 className="mt-1 break-words text-base font-bold text-[#F5F7FA] sm:text-2xl">
          {team?.name || "Unknown team"}
        </h1>

        {team?.short_name && (
          <p className="mt-1 text-xs text-[#8B95A7] sm:text-sm">
            {team.short_name}
          </p>
        )}
      </div>
    </div>
  );
}

function FormCard({ team, matches }) {
  const form = matches
    .slice(0, 5)
    .map((match) => ({
      match,
      result: getResult(match, team.id),
    }));

  const wins = form.filter(
    (item) => item.result === "W"
  ).length;

  const draws = form.filter(
    (item) => item.result === "D"
  ).length;

  const losses = form.filter(
    (item) => item.result === "L"
  ).length;

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#111722] p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#080B12]">
          {team?.logo_url ? (
            <img
              src={team.logo_url}
              alt={team.name}
              className="h-7 w-7 object-contain"
            />
          ) : (
            <span className="font-bold text-[#B7F34A]">
              {team?.name?.charAt(0) || "?"}
            </span>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-semibold text-[#F5F7FA]">
            {team?.name}
          </h3>

          <p className="text-[11px] text-[#596274] sm:text-xs">
            Last {form.length} H2H meetings
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {form.length > 0 ? (
          form.map((item) => (
            <ResultBadge
              key={item.match.id}
              result={item.result}
            />
          ))
        ) : (
          <p className="text-sm text-[#596274]">
            No recent meetings
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#080B12] p-2.5 text-center sm:p-3">
          <p className="text-base font-bold text-[#B7F34A] sm:text-lg">
            {wins}
          </p>

          <p className="text-[9px] uppercase text-[#596274] sm:text-[10px]">
            Wins
          </p>
        </div>

        <div className="rounded-xl bg-[#080B12] p-2.5 text-center sm:p-3">
          <p className="text-base font-bold text-[#8B95A7] sm:text-lg">
            {draws}
          </p>

          <p className="text-[9px] uppercase text-[#596274] sm:text-[10px]">
            Draws
          </p>
        </div>

        <div className="rounded-xl bg-[#080B12] p-2.5 text-center sm:p-3">
          <p className="text-base font-bold text-red-400 sm:text-lg">
            {losses}
          </p>

          <p className="text-[9px] uppercase text-[#596274] sm:text-[10px]">
            Losses
          </p>
        </div>
      </div>
    </div>
  );
}

function MeetingRow({ match, team1, team2 }) {
  const homeScore = Number(
    match.score?.home ?? 0
  );

  const awayScore = Number(
    match.score?.away ?? 0
  );

  return (
    <div className="border-b border-white/5 py-4 last:border-b-0">
      {/* Mobile */}
      <div className="flex flex-col gap-3 sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-right">
            <p className="break-words text-xs font-semibold text-[#F5F7FA]">
              {match.homeTeam?.name ||
                team1?.name}
            </p>

            <p className="mt-1 text-[10px] text-[#596274]">
              Home
            </p>
          </div>

          <div className="shrink-0">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#080B12] px-3 py-2">
              <span className="text-base font-bold text-[#F5F7FA]">
                {homeScore}
              </span>

              <span className="text-xs text-[#596274]">
                -
              </span>

              <span className="text-base font-bold text-[#F5F7FA]">
                {awayScore}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="break-words text-xs font-semibold text-[#F5F7FA]">
              {match.awayTeam?.name ||
                team2?.name}
            </p>

            <p className="mt-1 text-[10px] text-[#596274]">
              Away
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-[#596274]">
          <span>{formatDate(match.date)}</span>

          {match.competition?.name && (
            <>
              <span>•</span>

              <span className="break-words">
                {match.competition.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-3 sm:grid">
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-semibold text-[#F5F7FA]">
            {match.homeTeam?.name ||
              team1?.name}
          </p>

          <p className="mt-1 text-xs text-[#596274]">
            Home
          </p>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#080B12] px-4 py-2">
            <span className="text-lg font-bold text-[#F5F7FA]">
              {homeScore}
            </span>

            <span className="text-xs text-[#596274]">
              -
            </span>

            <span className="text-lg font-bold text-[#F5F7FA]">
              {awayScore}
            </span>
          </div>

          <p className="mt-2 text-[10px] text-[#596274]">
            {formatDate(match.date)}
          </p>
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#F5F7FA]">
            {match.awayTeam?.name ||
              team2?.name}
          </p>

          <p className="mt-1 text-xs text-[#596274]">
            Away
          </p>
        </div>
      </div>
    </div>
  );
}

function HomeAwayCard({
  title,
  matches,
  team,
}) {
  let wins = 0;
  let draws = 0;
  let losses = 0;

  matches.forEach((match) => {
    const result = getResult(match, team.id);

    if (result === "W") wins++;
    if (result === "D") draws++;
    if (result === "L") losses++;
  });

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#080B12] p-4 sm:p-5">
      <h3 className="break-words font-semibold text-[#F5F7FA]">
        {title}
      </h3>

      <p className="mt-1 text-xs text-[#596274]">
        {matches.length} meetings
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#111722] p-2.5 text-center sm:p-3">
          <p className="text-base font-bold text-[#B7F34A] sm:text-lg">
            {wins}
          </p>

          <p className="text-[9px] uppercase text-[#596274] sm:text-[10px]">
            Wins
          </p>
        </div>

        <div className="rounded-xl bg-[#111722] p-2.5 text-center sm:p-3">
          <p className="text-base font-bold text-[#8B95A7] sm:text-lg">
            {draws}
          </p>

          <p className="text-[9px] uppercase text-[#596274] sm:text-[10px]">
            Draws
          </p>
        </div>

        <div className="rounded-xl bg-[#111722] p-2.5 text-center sm:p-3">
          <p className="text-base font-bold text-red-400 sm:text-lg">
            {losses}
          </p>

          <p className="text-[9px] uppercase text-[#596274] sm:text-[10px]">
            Losses
          </p>
        </div>
      </div>
    </div>
  );
}

export default function H2HPage() {
  const { matchup } = useParams();

  const [data, setData] = useState(null);
  const [homeAway, setHomeAway] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  const [showAllMatches, setShowAllMatches] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadH2H() {
      try {
        setLoading(true);
        setError("");

        if (
          !matchup ||
          !matchup.includes("-vs-")
        ) {
          throw new Error(
            "Invalid H2H matchup URL."
          );
        }

        const [team1Slug, team2Slug] =
          matchup.split("-vs-");

        if (!team1Slug || !team2Slug) {
          throw new Error(
            "Invalid H2H matchup."
          );
        }

        const encodedTeam1 =
          encodeURIComponent(team1Slug);

        const encodedTeam2 =
          encodeURIComponent(team2Slug);

        const h2hResponse = await fetch(
          `${API_BASE_URL}/api/h2h/${encodedTeam1}/${encodedTeam2}?limit=50`
        );

        const h2hJson =
          await h2hResponse.json();

        if (!h2hResponse.ok) {
          throw new Error(
            h2hJson.message ||
              "Failed to load H2H data."
          );
        }

        /*
         * Adapt the backend response once,
         * then the rest of the page can continue
         * using the existing UI data structure.
         */
        const normalizedData = {
          ...h2hJson,

          summary: normalizeSummary(
            h2hJson.summary || {}
          ),

          matches: Array.isArray(
            h2hJson.matches
          )
            ? h2hJson.matches.map(
                normalizeMatch
              )
            : [],
        };

        if (!cancelled) {
          setData(normalizedData);
        }

        try {
          const homeAwayResponse =
            await fetch(
              `${API_BASE_URL}/api/h2h/${encodedTeam1}/${encodedTeam2}/home-away`
            );

          if (homeAwayResponse.ok) {
            const homeAwayJson =
              await homeAwayResponse.json();

            const normalizedHomeAway =
              normalizeHomeAway(
                homeAwayJson
              );

            if (!cancelled) {
              setHomeAway(
                normalizedHomeAway
              );
            }
          }
        } catch (homeAwayError) {
          console.warn(
            "Home-away data unavailable:",
            homeAwayError
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            "H2H loading error:",
            err
          );

          setError(
            err.message ||
              "Failed to load H2H data."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadH2H();

    return () => {
      cancelled = true;
    };
  }, [matchup]);

  const team1 = data?.teams?.team1;
  const team2 = data?.teams?.team2;

  const summary = data?.summary || {};

  const matches = data?.matches || [];

  const visibleMatches =
    showAllMatches
      ? matches
      : matches.slice(0, 10);

  const team1WinPercentage =
    Number(
      summary.team1WinPercentage || 0
    );

  const team2WinPercentage =
    Number(
      summary.team2WinPercentage || 0
    );

  const drawPercentage =
    Number(summary.drawPercentage || 0);

  const totalGoals =
    Number(summary.team1Goals || 0) +
    Number(summary.team2Goals || 0);

  const goalDifference =
    Number(summary.team1Goals || 0) -
    Number(summary.team2Goals || 0);

  const highestScoringMatch = useMemo(() => {
    if (!matches.length) return null;

    return matches.reduce(
      (highest, current) => {
        const highestGoals =
          Number(
            highest.score?.home || 0
          ) +
          Number(
            highest.score?.away || 0
          );

        const currentGoals =
          Number(
            current.score?.home || 0
          ) +
          Number(
            current.score?.away || 0
          );

        return currentGoals > highestGoals
          ? current
          : highest;
      },
      matches[0]
    );
  }, [matches]);

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-[#080B12] text-[#F5F7FA]">
        <header className="border-b border-white/5">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-5 sm:py-5">
            <Link
              to="/"
              className="flex items-center gap-2.5 sm:gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B7F34A] font-black text-[#080B12]">
                H
              </div>

              <span className="text-sm font-black tracking-tight sm:text-lg">
                H2H VAULT
              </span>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-16">
          <div className="rounded-3xl border border-white/10 bg-[#111722] p-6 text-center sm:p-10">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#B7F34A]" />

            <p className="mt-5 text-sm text-[#8B95A7]">
              Loading head-to-head analytics...
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-[#080B12] text-[#F5F7FA]">
        <header className="border-b border-white/5">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-5 sm:py-5">
            <Link
              to="/"
              className="flex items-center gap-2.5 sm:gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B7F34A] font-black text-[#080B12]">
                H
              </div>

              <span className="text-sm font-black tracking-tight sm:text-lg">
                H2H VAULT
              </span>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-16">
          <div className="rounded-3xl border border-red-500/20 bg-[#111722] p-6 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-xl text-red-400">
              !
            </div>

            <h1 className="mt-5 text-lg font-bold sm:text-xl">
              Unable to load H2H data
            </h1>

            <p className="mt-3 break-words text-sm leading-6 text-[#8B95A7]">
              {error}
            </p>

            <Link
              to="/"
              className="mt-6 inline-flex rounded-xl bg-[#B7F34A] px-5 py-3 text-sm font-bold text-[#080B12] transition hover:opacity-90"
            >
              Back to H2H Vault
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080B12] text-[#F5F7FA]">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#080B12]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 sm:gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B7F34A] font-black text-[#080B12]">
              H
            </div>

            <span className="text-sm font-black tracking-tight sm:text-lg">
              H2H VAULT
            </span>
          </Link>

          <Link
            to="/"
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[#8B95A7] transition hover:border-[#B7F34A]/30 hover:text-[#B7F34A] sm:px-4 sm:text-sm"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111722] p-5 sm:p-8">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#B7F34A]/5 blur-3xl" />

          <div className="relative">
            <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8">
              <span className="rounded-full border border-[#B7F34A]/20 bg-[#B7F34A]/5 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-[#B7F34A] sm:text-[10px]">
                Head-to-Head
              </span>

              <span className="text-[11px] text-[#596274] sm:text-xs">
                {summary.totalMatches || 0} recorded meetings
              </span>
            </div>

            <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr] md:gap-8">
              <TeamHeader team={team1} />

              <div className="flex items-center justify-center gap-3 md:block">
                <div className="h-px w-10 bg-white/10 md:mx-auto md:w-20" />

                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#596274]">
                  VS
                </p>

                <div className="h-px w-10 bg-white/10 md:mx-auto md:mt-3 md:w-20" />
              </div>

              <TeamHeader
                team={team2}
                side="right"
              />
            </div>
          </div>
        </section>

        {/* RECORD */}
        <section className="mt-5 sm:mt-6">
          <Section
            title="H2H Record"
            description="Historical results between these two teams."
          >
            <div className="grid gap-3 md:grid-cols-3 sm:gap-4">
              <div className="rounded-2xl border border-[#B7F34A]/20 bg-[#B7F34A]/5 p-5 text-center sm:p-6">
                <p className="break-words text-[10px] uppercase tracking-wider text-[#596274] sm:text-xs">
                  {team1?.name}
                </p>

                <p className="mt-2 text-3xl font-black text-[#B7F34A] sm:mt-3 sm:text-4xl">
                  {summary.team1Wins || 0}
                </p>

                <p className="mt-1 text-xs text-[#8B95A7] sm:text-sm">
                  {formatPercentage(
                    team1WinPercentage
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#080B12] p-5 text-center sm:p-6">
                <p className="text-[10px] uppercase tracking-wider text-[#596274] sm:text-xs">
                  Draws
                </p>

                <p className="mt-2 text-3xl font-black text-[#F5F7FA] sm:mt-3 sm:text-4xl">
                  {summary.draws || 0}
                </p>

                <p className="mt-1 text-xs text-[#8B95A7] sm:text-sm">
                  {formatPercentage(
                    drawPercentage
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#080B12] p-5 text-center sm:p-6">
                <p className="break-words text-[10px] uppercase tracking-wider text-[#596274] sm:text-xs">
                  {team2?.name}
                </p>

                <p className="mt-2 text-3xl font-black text-[#F5F7FA] sm:mt-3 sm:text-4xl">
                  {summary.team2Wins || 0}
                </p>

                <p className="mt-1 text-xs text-[#8B95A7] sm:text-sm">
                  {formatPercentage(
                    team2WinPercentage
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/5 sm:mt-5 sm:h-3">
              <div className="flex h-full">
                <div
                  className="bg-[#B7F34A]"
                  style={{
                    width: `${team1WinPercentage}%`,
                  }}
                />

                <div
                  className="bg-white/20"
                  style={{
                    width: `${drawPercentage}%`,
                  }}
                />

                <div
                  className="bg-white/10"
                  style={{
                    width: `${team2WinPercentage}%`,
                  }}
                />
              </div>
            </div>
          </Section>
        </section>

        {/* CORE STATS */}
        <section className="mt-5 sm:mt-6">
          <Section
            title="Core Statistics"
            description="Aggregate scoring and defensive numbers across all recorded meetings."
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
              <StatCard
                label="Meetings"
                value={
                  summary.totalMatches || 0
                }
              />

              <StatCard
                label="Total Goals"
                value={totalGoals}
                accent
              />

              <StatCard
                label="Average Goals"
                value={Number(
                  summary.averageGoals || 0
                ).toFixed(2)}
                subtext="per match"
              />

              <StatCard
                label="Goal Difference"
                value={
                  goalDifference > 0
                    ? `+${goalDifference}`
                    : goalDifference
                }
                subtext={`${team1?.short_name || team1?.name} perspective`}
              />

              <StatCard
                label={`${team1?.short_name || team1?.name} Goals`}
                value={
                  summary.team1Goals || 0
                }
              />

              <StatCard
                label={`${team2?.short_name || team2?.name} Goals`}
                value={
                  summary.team2Goals || 0
                }
              />

              <StatCard
                label={`${team1?.short_name || team1?.name} Clean Sheets`}
                value={
                  summary.cleanSheets
                    ?.team1 || 0
                }
              />

              <StatCard
                label={`${team2?.short_name || team2?.name} Clean Sheets`}
                value={
                  summary.cleanSheets
                    ?.team2 || 0
                }
              />
            </div>
          </Section>
        </section>

        {/* GOAL MARKETS */}
        <section className="mt-5 sm:mt-6">
          <Section
            title="Goal Markets"
            description="How often different scoring thresholds have been reached."
          >
            <div className="grid gap-7 lg:grid-cols-2 lg:gap-8">
              <div>
                <h3 className="mb-5 text-xs font-bold uppercase tracking-wider text-[#8B95A7] sm:text-sm">
                  Over
                </h3>

                <div className="space-y-5">
                  {[
                    ["Over 0.5", summary.over05],
                    ["Over 1.5", summary.over15],
                    ["Over 2.5", summary.over25],
                    ["Over 3.5", summary.over35],
                    ["Over 4.5", summary.over45],
                  ].map(
                    ([label, market]) => (
                      <PercentageBar
                        key={label}
                        label={label}
                        percentage={
                          market?.percentage || 0
                        }
                        count={
                          market?.count || 0
                        }
                        total={
                          summary.totalMatches
                        }
                      />
                    )
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-5 text-xs font-bold uppercase tracking-wider text-[#8B95A7] sm:text-sm">
                  Under
                </h3>

                <div className="space-y-5">
                  {[
                    ["Under 0.5", summary.over05],
                    ["Under 1.5", summary.over15],
                    ["Under 2.5", summary.over25],
                    ["Under 3.5", summary.over35],
                    ["Under 4.5", summary.over45],
                  ].map(
                    ([label, market]) => {
                      const overCount =
                        Number(
                          market?.count || 0
                        );

                      const total =
                        Number(
                          summary.totalMatches ||
                            0
                        );

                      const underCount =
                        Math.max(
                          total - overCount,
                          0
                        );

                      const underPercentage =
                        total > 0
                          ? (underCount /
                              total) *
                            100
                          : 0;

                      return (
                        <PercentageBar
                          key={label}
                          label={label}
                          percentage={
                            underPercentage
                          }
                          count={underCount}
                          total={total}
                        />
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3 sm:mt-8 sm:gap-4">
              <StatCard
                label="BTTS"
                value={formatPercentage(
                  summary.btts?.percentage ||
                    0
                )}
                subtext={`${
                  summary.btts?.count || 0
                } matches`}
                accent
              />

              <StatCard
                label={`${team1?.short_name || team1?.name} Clean Sheets`}
                value={
                  summary.cleanSheets
                    ?.team1 || 0
                }
                subtext="matches without conceding"
              />

              <StatCard
                label={`${team2?.short_name || team2?.name} Clean Sheets`}
                value={
                  summary.cleanSheets
                    ?.team2 || 0
                }
                subtext="matches without conceding"
              />
            </div>
          </Section>
        </section>

        {/* FORM */}
        <section className="mt-5 sm:mt-6">
          <Section
            title="Recent H2H Form"
            description="Results from the latest recorded meetings."
          >
            <div className="grid gap-4 md:grid-cols-2 sm:gap-5">
              <FormCard
                team={team1}
                matches={matches}
              />

              <FormCard
                team={team2}
                matches={matches}
              />
            </div>
          </Section>
        </section>

        {/* HOME AWAY */}
        <section className="mt-5 sm:mt-6">
          <Section
            title="Home & Away Breakdown"
            description="How the H2H record looks according to which team hosted the match."
          >
            {homeAway ? (
              <div className="grid gap-4 md:grid-cols-2 sm:gap-5">
                <HomeAwayCard
                  title={`${team1?.name} at Home`}
                  team={team1}
                  matches={
                    homeAway.team1Home || []
                  }
                />

                <HomeAwayCard
                  title={`${team2?.name} at Home`}
                  team={team2}
                  matches={
                    homeAway.team2Home || []
                  }
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/5 bg-[#080B12] p-6 text-center">
                <p className="text-xs leading-5 text-[#596274] sm:text-sm">
                  Home/away breakdown is currently unavailable.
                </p>
              </div>
            )}
          </Section>
        </section>

        {/* HIGHEST SCORING */}
        {highestScoringMatch && (
          <section className="mt-5 sm:mt-6">
            <Section
              title="Highest-Scoring Meeting"
              description="The meeting with the most combined goals in the current dataset."
            >
              <div className="rounded-2xl border border-[#B7F34A]/10 bg-[#080B12] p-5 sm:p-6">
                <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-6">
                  <div className="text-center md:text-right">
                    <p className="break-words text-sm font-semibold text-[#F5F7FA]">
                      {
                        highestScoringMatch
                          .homeTeam?.name
                      }
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-black text-[#B7F34A] sm:text-4xl">
                      {
                        highestScoringMatch
                          .score?.home
                      }

                      <span className="mx-2 text-[#596274]">
                        -
                      </span>

                      {
                        highestScoringMatch
                          .score?.away
                      }
                    </div>

                    <p className="mt-2 text-[10px] text-[#596274] sm:text-xs">
                      {formatDate(
                        highestScoringMatch.date
                      )}
                    </p>
                  </div>

                  <div className="text-center md:text-left">
                    <p className="break-words text-sm font-semibold text-[#F5F7FA]">
                      {
                        highestScoringMatch
                          .awayTeam?.name
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap justify-center gap-2 text-[10px] text-[#596274] sm:text-xs">
                  {highestScoringMatch
                    .competition?.name && (
                    <span className="max-w-full break-words rounded-full bg-[#111722] px-3 py-1">
                      {
                        highestScoringMatch
                          .competition.name
                      }
                    </span>
                  )}

                  {highestScoringMatch
                    .season?.name && (
                    <span className="max-w-full break-words rounded-full bg-[#111722] px-3 py-1">
                      {
                        highestScoringMatch.season
                          .name
                      }
                    </span>
                  )}

                  {highestScoringMatch.venue && (
                    <span className="max-w-full break-words rounded-full bg-[#111722] px-3 py-1">
                      {
                        highestScoringMatch.venue
                      }
                    </span>
                  )}
                </div>
              </div>
            </Section>
          </section>
        )}

        {/* PREVIOUS MEETINGS */}
        <section className="mt-5 sm:mt-6">
          <Section
            title="Previous Meetings"
            description={`Showing ${
              visibleMatches.length
            } of ${
              matches.length
            } recorded meetings.`}
          >
            {matches.length > 0 ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#080B12] px-3 sm:px-4">
                  {visibleMatches.map(
                    (match) => (
                      <MeetingRow
                        key={match.id}
                        match={match}
                        team1={team1}
                        team2={team2}
                      />
                    )
                  )}
                </div>

                {matches.length > 10 && (
                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        setShowAllMatches(
                          (current) => !current
                        )
                      }
                      className="w-full rounded-xl border border-white/10 px-5 py-3 text-xs font-semibold text-[#8B95A7] transition hover:border-[#B7F34A]/30 hover:text-[#B7F34A] sm:w-auto sm:text-sm"
                    >
                      {showAllMatches
                        ? "Show fewer meetings"
                        : `Show all ${matches.length} meetings`}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-white/5 bg-[#080B12] p-8 text-center sm:p-10">
                <p className="text-xs leading-5 text-[#596274] sm:text-sm">
                  No completed H2H meetings are currently stored for these teams.
                </p>
              </div>
            )}
          </Section>
        </section>

        {/* DATA INFORMATION */}
        <section className="mt-5 sm:mt-6">
          <div className="rounded-2xl border border-white/5 bg-[#111722] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#B7F34A]/10 text-[#B7F34A]">
                i
              </div>

              <div className="min-w-0">
                <h3 className="font-semibold text-[#F5F7FA]">
                  About these statistics
                </h3>

                <p className="mt-2 text-xs leading-6 text-[#8B95A7] sm:text-sm">
                  H2H Vault calculates the statistics
                  from the completed matches stored in
                  the application database. The dashboard
                  does not treat a provider as the source
                  of the calculated percentages or
                  head-to-head results.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    ...new Set(
                      matches
                        .map(
                          (match) =>
                            match.provider
                        )
                        .filter(Boolean)
                    ),
                  ].map((provider) => (
                    <span
                      key={provider}
                      className="max-w-full break-words rounded-full border border-white/10 bg-[#080B12] px-3 py-1 text-[10px] text-[#596274] sm:text-xs"
                    >
                      Source: {provider}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="mt-8 border-t border-white/5 sm:mt-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-7 text-center sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-8 sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#B7F34A] text-xs font-black text-[#080B12]">
              H
            </div>

            <span className="text-sm font-bold">
              H2H VAULT
            </span>
          </div>

          <p className="text-xs text-[#596274]">
            Football head-to-head analytics
          </p>
        </div>
      </footer>
    </div>
  );
}