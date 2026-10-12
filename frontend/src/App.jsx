import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

const popularMatchups = [
  {
    team1: "Arsenal",
    team2: "Chelsea",
    slug1: "arsenal",
    slug2: "chelsea",
  },
  {
    team1: "Liverpool",
    team2: "Manchester United",
    slug1: "liverpool",
    slug2: "manchester-united",
  },
  {
    team1: "Barcelona",
    team2: "Real Madrid",
    slug1: "barcelona",
    slug2: "real-madrid",
  },
  {
    team1: "Inter Milan",
    team2: "AC Milan",
    slug1: "inter-milan",
    slug2: "ac-milan",
  },
];

function App() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showResults, setShowResults] = useState(false);

  const [selectedTeam1, setSelectedTeam1] =
    useState(null);
  const [selectedTeam2, setSelectedTeam2] =
    useState(null);

  useEffect(() => {
    const query = search.trim();

    if (!query) {
      setResults([]);
      setSearchError("");
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setSearchError("");
        setShowResults(true);

        const response = await fetch(
          `${API_BASE_URL}/api/teams/search?q=${encodeURIComponent(
            query
          )}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to search teams"
          );
        }

        setResults(data.teams || []);
      } catch (error) {
        console.error(
          "Team search failed:",
          error
        );

        setResults([]);
        setSearchError(
          "Unable to search clubs right now."
        );
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const importTeamIfNeeded = async (team) => {
    if (team.slug) {
      return team;
    }

    if (!team.external_id) {
      throw new Error(
        "This club cannot be selected."
      );
    }

    const response = await fetch(
      `${API_BASE_URL}/api/teams/import/${team.external_id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to import club"
      );
    }

    return (
      data.team ||
      data.data ||
      data.importedTeam ||
      data
    );
  };

  const selectTeam = async (team) => {
    try {
      setLoading(true);
      setSearchError("");

      const selected =
        await importTeamIfNeeded(team);

      if (!selected.slug) {
        throw new Error(
          "Club was found but could not be prepared for H2H."
        );
      }

      if (!selectedTeam1) {
        setSelectedTeam1(selected);
        setSearch("");
        setResults([]);
        setShowResults(false);
        return;
      }

      if (
        selectedTeam1.slug === selected.slug
      ) {
        setSearchError(
          "Please choose a different club."
        );
        return;
      }

      setSelectedTeam2(selected);
      setSearch("");
      setResults([]);
      setShowResults(false);
    } catch (error) {
      console.error(
        "Club selection failed:",
        error
      );

      setSearchError(
        error.message ||
          "Unable to select this club."
      );
    } finally {
      setLoading(false);
    }
  };

  const viewSelectedMatchup = () => {
    if (!selectedTeam1 || !selectedTeam2) {
      return;
    }

    navigate(
      `/h2h/${selectedTeam1.slug}-vs-${selectedTeam2.slug}`
    );
  };

  const resetSelection = () => {
    setSelectedTeam1(null);
    setSelectedTeam2(null);
    setSearch("");
    setResults([]);
    setSearchError("");
    setShowResults(false);
  };

  const openPopularMatchup = (matchup) => {
    navigate(
      `/h2h/${matchup.slug1}-vs-${matchup.slug2}`
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080B12] text-[#F5F7FA]">
      {/* HEADER */}
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <button
            onClick={() => navigate("/")}
            className="group flex items-center gap-2.5 sm:gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B7F34A] text-base font-black text-[#080B12] shadow-[0_0_30px_rgba(183,243,74,0.15)] sm:h-10 sm:w-10 sm:text-lg">
              H
            </div>

            <div className="text-left">
              <div className="text-xs font-black tracking-[0.16em] sm:text-sm sm:tracking-[0.18em]">
                H2H VAULT
              </div>

              <div className="text-[9px] uppercase tracking-[0.15em] text-[#8B95A7] sm:text-[10px] sm:tracking-[0.2em]">
                Football history
              </div>
            </div>
          </button>

          <nav className="hidden items-center gap-8 text-sm text-[#8B95A7] md:flex">
            <button
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                })
              }
              className="transition hover:text-white"
            >
              Home
            </button>

            <button
              onClick={() =>
                document
                  .getElementById("popular")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="transition hover:text-white"
            >
              Matchups
            </button>

            <button
              onClick={() =>
                document
                  .getElementById("about")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="transition hover:text-white"
            >
              About
            </button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <main>
        <section className="relative overflow-visible">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-[-120px] h-[350px] w-[450px] -translate-x-1/2 rounded-full bg-[#B7F34A]/5 blur-[100px] sm:top-[-180px] sm:h-[500px] sm:w-[700px] sm:blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-32 lg:pt-32">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#B7F34A]/20 bg-[#B7F34A]/5 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.13em] text-[#B7F34A] sm:mb-6 sm:px-4 sm:text-[11px] sm:tracking-[0.18em]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#B7F34A]" />
                Football H2H Database
              </div>

              <h1 className="text-4xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-8xl">
                The history
                <br />
                behind every
                <span className="text-[#B7F34A]">
                  {" "}
                  matchup.
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl px-2 text-sm leading-6 text-[#8B95A7] sm:mt-7 sm:text-lg sm:leading-7">
                Explore the history between football
                clubs. Compare meetings, wins, draws,
                goals, clean sheets, and more.
              </p>

              {/* SEARCH BOX */}
              <div className="relative mx-auto mt-9 max-w-3xl sm:mt-12">
                <div className="rounded-2xl border border-white/10 bg-[#111722] p-2 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                  <div className="flex flex-col gap-2">
                    <div className="relative flex-1">
                      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#8B95A7]">
                        <svg
                          width="19"
                          height="19"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle
                            cx="11"
                            cy="11"
                            r="7"
                          />
                          <path d="m20 20-4-4" />
                        </svg>
                      </div>

                      <input
                        type="text"
                        value={search}
                        onChange={(event) =>
                          setSearch(
                            event.target.value
                          )
                        }
                        onFocus={() => {
                          if (results.length) {
                            setShowResults(true);
                          }
                        }}
                        placeholder={
                          selectedTeam1
                            ? "Search for the second club..."
                            : "Search for a club..."
                        }
                        className="h-14 w-full rounded-xl bg-[#080B12] pl-12 pr-4 text-sm text-white outline-none placeholder:text-[#596274] focus:ring-1 focus:ring-[#B7F34A]/40"
                      />
                    </div>

                    {selectedTeam1 && (
                      <div className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-[#B7F34A]/20 bg-[#B7F34A]/5 px-3 py-2 sm:px-4">
                        {selectedTeam1.logo_url && (
                          <img
                            src={
                              selectedTeam1.logo_url
                            }
                            alt=""
                            className="h-7 w-7 shrink-0 object-contain"
                          />
                        )}

                        <span className="min-w-0 flex-1 truncate text-left text-sm font-bold text-[#B7F34A]">
                          {selectedTeam1.name}
                        </span>

                        <button
                          onClick={
                            resetSelection
                          }
                          className="shrink-0 px-1 text-xl leading-none text-[#8B95A7] transition hover:text-white"
                          title="Clear selection"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* SEARCH RESULTS */}
                {showResults &&
                  (loading ||
                    results.length > 0 ||
                    searchError) && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-3 max-h-[65vh] overflow-y-auto overflow-hidden rounded-2xl border border-white/10 bg-[#111722] text-left shadow-[0_25px_80px_rgba(0,0,0,0.6)]">
                      {loading && (
                        <div className="px-4 py-5 text-sm text-[#8B95A7] sm:px-5">
                          Searching clubs...
                        </div>
                      )}

                      {!loading &&
                        searchError && (
                          <div className="px-4 py-5 text-sm text-red-400 sm:px-5">
                            {searchError}
                          </div>
                        )}

                      {!loading &&
                        !searchError &&
                        results.length === 0 && (
                          <div className="px-4 py-5 text-sm text-[#8B95A7] sm:px-5">
                            No clubs found.
                          </div>
                        )}

                      {!loading &&
                        results.map(
                          (team, index) => (
                            <button
                              key={
                                team.external_id ||
                                team.id ||
                                `${team.name}-${index}`
                              }
                              onClick={() =>
                                selectTeam(
                                  team
                                )
                              }
                              className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-4 text-left transition last:border-b-0 hover:bg-white/[0.04] sm:gap-4 sm:px-5"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#080B12] sm:h-11 sm:w-11">
                                {team.logo_url ? (
                                  <img
                                    src={
                                      team.logo_url
                                    }
                                    alt=""
                                    className="h-7 w-7 object-contain sm:h-8 sm:w-8"
                                  />
                                ) : (
                                  <span className="text-xs font-black text-[#B7F34A]">
                                    {team.name
                                      ?.slice(
                                        0,
                                        2
                                      )
                                      .toUpperCase()}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-white">
                                  {team.name}
                                </div>

                                <div className="mt-1 flex min-w-0 gap-2 text-xs text-[#8B95A7]">
                                  {team.country && (
                                    <span className="truncate">
                                      {
                                        team.country
                                      }
                                    </span>
                                  )}

                                  {team.short_name && (
                                    <>
                                      <span>
                                        •
                                      </span>
                                      <span>
                                        {
                                          team.short_name
                                        }
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#B7F34A] sm:text-xs">
                                Select
                              </span>
                            </button>
                          )
                        )}
                    </div>
                  )}
              </div>

              {/* SELECTED MATCHUP */}
              {selectedTeam1 && selectedTeam2 && (
                <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-[#B7F34A]/20 bg-[#111722] p-4 sm:p-5">
                  <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:gap-5">
                    <div className="flex w-full items-center justify-center gap-3 sm:w-auto sm:justify-start">
                      {selectedTeam1.logo_url && (
                        <img
                          src={
                            selectedTeam1.logo_url
                          }
                          alt=""
                          className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                        />
                      )}

                      <span className="max-w-[140px] truncate text-sm font-bold sm:max-w-none sm:text-base">
                        {selectedTeam1.name}
                      </span>
                    </div>

                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8B95A7] sm:text-xs">
                      VS
                    </span>

                    <div className="flex w-full items-center justify-center gap-3 sm:w-auto sm:justify-end">
                      <span className="max-w-[140px] truncate text-sm font-bold sm:max-w-none sm:text-base">
                        {selectedTeam2.name}
                      </span>

                      {selectedTeam2.logo_url && (
                        <img
                          src={
                            selectedTeam2.logo_url
                          }
                          alt=""
                          className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                        />
                      )}
                    </div>
                  </div>

                  <button
                    onClick={viewSelectedMatchup}
                    className="mt-5 w-full rounded-xl bg-[#B7F34A] px-6 py-3.5 text-sm font-black text-[#080B12] transition hover:brightness-110 active:scale-[0.99]"
                  >
                    VIEW HEAD-TO-HEAD
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* POPULAR MATCHUPS */}
        <section
          id="popular"
          className="border-t border-white/5"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:mb-10 sm:flex-row sm:items-end">
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#B7F34A]">
                  Explore
                </p>

                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Popular matchups
                </h2>
              </div>

              <p className="max-w-md text-sm leading-6 text-[#8B95A7]">
                Dive into some of football's most
                recognizable club rivalries and
                matchups.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {popularMatchups.map(
                (matchup) => (
                  <button
                    key={`${matchup.team1}-${matchup.team2}`}
                    onClick={() =>
                      openPopularMatchup(
                        matchup
                      )
                    }
                    className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#111722] p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-[#B7F34A]/30 hover:bg-[#151c29] sm:p-6"
                  >
                    <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#B7F34A]/5 blur-3xl transition group-hover:bg-[#B7F34A]/10" />

                    <div className="relative flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8B95A7]">
                          Head to head
                        </p>

                        <h3 className="truncate text-lg font-black sm:text-xl">
                          {matchup.team1}
                        </h3>

                        <div className="my-2 text-xs font-black tracking-[0.2em] text-[#B7F34A]">
                          VS
                        </div>

                        <h3 className="truncate text-lg font-black sm:text-xl">
                          {matchup.team2}
                        </h3>
                      </div>

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#8B95A7] transition group-hover:border-[#B7F34A]/30 group-hover:text-[#B7F34A] sm:h-11 sm:w-11">
                        →
                      </div>
                    </div>
                  </button>
                )
              )}
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section
          id="about"
          className="border-t border-white/5"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#B7F34A]">
                  About H2H Vault
                </p>

                <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
                  Football history,
                  <br />
                  without the noise.
                </h2>
              </div>

              <div className="space-y-5 text-sm leading-7 text-[#8B95A7]">
                <p>
                  H2H Vault is built for football
                  fans who want more than a
                  fixture list.
                </p>

                <p>
                  Search for two clubs and explore
                  the history behind their meetings:
                  wins, draws, goals, clean sheets,
                  and the numbers that tell the
                  story of a rivalry.
                </p>

                <p>
                  No complicated dashboards.
                  Just football history, organized
                  in one place.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B7F34A] text-sm font-black text-[#080B12]">
              H
            </div>

            <span className="text-xs font-bold tracking-[0.15em]">
              H2H VAULT
            </span>
          </div>

          <p className="text-xs text-[#596274]">
            The history behind every matchup.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;