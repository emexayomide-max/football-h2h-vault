
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function App() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
 

  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);

  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const searchTeams = async () => {
      try {
        setSearchLoading(true);

        const response = await fetch(
          `http://localhost:3001/api/teams/search?q=${encodeURIComponent(
            search
          )}`
        );

        const data = await response.json();

        if (data.status === "success") {
          setSearchResults(data.teams);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Team search failed:", error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    searchTeams();
  }, [search]);

  const popularMatchups = [
    {
      team1: "Arsenal",
      team2: "Chelsea",
      label: "Premier League",
    },
    {
      team1: "Liverpool",
      team2: "Manchester United",
      label: "Premier League",
    },
    {
      team1: "Barcelona",
      team2: "Real Madrid",
      label: "La Liga",
    },
    {
      team1: "Inter Milan",
      team2: "AC Milan",
      label: "Serie A",
    },
  ];

  const handleTeamSelect = (team) => {
    if (!selectedTeam) {
      setSelectedTeam(team);
    } else if (!selectedOpponent) {
      setSelectedOpponent(team);
    }

    setSearch("");
    setSearchResults([]);
  };

  const handleChangeTeam1 = () => {
    setSelectedTeam(null);
    setSelectedOpponent(null);
    setSearch("");
    setSearchResults([]);
  };

  const handleChangeTeam2 = () => {
    setSelectedOpponent(null);
    setSearch("");
    setSearchResults([]);
  };

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F5F7FA]">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#080B12]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B7F34A] text-lg font-black text-[#080B12]">
              ⚽
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Football H2H Vault
              </h1>

              <p className="hidden text-xs text-[#8B95A7] sm:block">
                The history behind every matchup.
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-[#8B95A7] md:flex">
            <a
              href="#matchups"
              className="transition hover:text-white"
            >
              Matchups
            </a>

            <a
              href="#leagues"
              className="transition hover:text-white"
            >
              Leagues
            </a>

            <a
              href="#about"
              className="transition hover:text-white"
            >
              About
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#B7F34A]/5 blur-3xl" />

          <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-24 text-center md:pb-28 md:pt-32">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-[#8B95A7]">
              <span className="h-2 w-2 rounded-full bg-[#B7F34A]" />
              Football history, stats &amp; H2H data
            </div>

            <h2 className="mx-auto max-w-4xl text-5xl font-black tracking-tight sm:text-6xl md:text-7xl">
              The history behind{" "}
              <span className="text-[#B7F34A]">every matchup.</span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[#8B95A7] md:text-lg">
              Explore football head-to-head history, results, goals,
              records and trends between teams across the years.
            </p>

            {/* Search Area */}
            <div className="relative mx-auto mt-10 max-w-2xl text-left">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder={
                      selectedTeam
                        ? "Search for your opponent..."
                        : "Search for a team..."
                    }
                    className="w-full rounded-2xl border border-white/10 bg-[#111722] px-5 py-4 text-white outline-none transition placeholder:text-[#596274] focus:border-[#B7F34A]/40"
                  />

                  {searchLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#8B95A7]">
                      Searching...
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="rounded-2xl bg-[#B7F34A] px-7 py-4 font-bold text-[#080B12] transition hover:brightness-110"
                >
                  Search
                </button>
              </div>

              <p className="mt-3 text-xs text-[#596274]">
                {selectedTeam
                  ? "Choose the team you want to compare against."
                  : "Try Arsenal, Chelsea, Barcelona or Real Madrid"}
              </p>

              {/* Search Results */}
              {search.trim().length >= 2 && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#111722]">
                  {searchLoading && (
                    <div className="px-5 py-4 text-sm text-[#8B95A7]">
                      Searching teams...
                    </div>
                  )}

                  {!searchLoading &&
                    searchResults.filter(
                      (team) =>
                        team.id !== selectedTeam?.id
                    ).length === 0 && (
                      <div className="px-5 py-4 text-sm text-[#8B95A7]">
                        No teams found.
                      </div>
                    )}

                  {!searchLoading &&
                    searchResults
                      .filter(
                        (team) =>
                          team.id !== selectedTeam?.id
                      )
                      .map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() =>
                            handleTeamSelect(team)
                          }
                          className="flex w-full items-center gap-4 border-b border-white/5 px-5 py-4 text-left transition last:border-b-0 hover:bg-white/5"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm font-bold text-[#B7F34A]">
                            {team.short_name ||
                              team.name
                                .slice(0, 3)
                                .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold text-white">
                              {team.name}
                            </p>

                            <p className="text-xs text-[#8B95A7]">
                              {team.short_name} ·{" "}
                              {team.country}
                            </p>
                          </div>
                        </button>
                      ))}
                </div>
              )}

              {/* Selected Teams */}
              {(selectedTeam || selectedOpponent) && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {/* Team 1 */}
                  {selectedTeam && (
                    <div className="rounded-2xl border border-[#B7F34A]/20 bg-[#B7F34A]/5 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-[#8B95A7]">
                            Team 1
                          </p>

                          <p className="mt-2 text-lg font-semibold text-white">
                            {selectedTeam.name}
                          </p>

                          <p className="text-sm text-[#8B95A7]">
                            {selectedTeam.short_name} ·{" "}
                            {selectedTeam.country}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleChangeTeam1}
                          className="rounded-lg px-3 py-2 text-sm text-[#8B95A7] transition hover:bg-white/5 hover:text-white"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Team 2 */}
                  {selectedOpponent && (
                    <div className="rounded-2xl border border-[#B7F34A]/20 bg-[#B7F34A]/5 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-[#8B95A7]">
                            Team 2
                          </p>

                          <p className="mt-2 text-lg font-semibold text-white">
                            {selectedOpponent.name}
                          </p>

                          <p className="text-sm text-[#8B95A7]">
                            {selectedOpponent.short_name} ·{" "}
                            {selectedOpponent.country}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleChangeTeam2}
                          className="rounded-lg px-3 py-2 text-sm text-[#8B95A7] transition hover:bg-white/5 hover:text-white"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* View H2H */}
              {selectedTeam && selectedOpponent && (
               <button
  type="button"
  onClick={() => {
    navigate(
      `/h2h/${selectedTeam.slug}-vs-${selectedOpponent.slug}`
    );
  }}
  className="mt-4 w-full rounded-2xl bg-[#B7F34A] px-6 py-4 font-bold text-[#080B12] transition hover:brightness-110"
>
  View {selectedTeam.name} vs{" "}
  {selectedOpponent.name} H2H
</button>
              )}
            </div>
          </div>
        </section>

        {/* Popular Matchups */}
        <section
          id="matchups"
          className="border-t border-white/5"
        >
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#B7F34A]">
                  Explore
                </p>

                <h3 className="text-3xl font-bold tracking-tight">
                  Popular matchups
                </h3>
              </div>

              <p className="max-w-md text-sm leading-6 text-[#8B95A7]">
                Discover some of football&apos;s most searched
                rivalries and historic matchups.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {popularMatchups.map((matchup) => (
                <div
                  key={`${matchup.team1}-${matchup.team2}`}
                  className="group rounded-3xl border border-white/5 bg-[#111722] p-6 transition hover:-translate-y-1 hover:border-[#B7F34A]/20"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#596274]">
                    {matchup.label}
                  </p>

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xl font-bold">
                        {matchup.team1}
                      </p>

                      <p className="mt-1 text-sm text-[#8B95A7]">
                        Home &amp; away history
                      </p>
                    </div>

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs font-black text-[#B7F34A]">
                      VS
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {matchup.team2}
                      </p>

                      <p className="mt-1 text-sm text-[#8B95A7]">
                        H2H history
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
                    <span className="text-[#8B95A7]">
                      View matchup
                    </span>

                    <span className="text-[#B7F34A] transition group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section
          id="about"
          className="border-t border-white/5"
        >
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="grid gap-12 md:grid-cols-2 md:items-center">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#B7F34A]">
                  About the Vault
                </p>

                <h3 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Football history,
                  <br />
                  made easier to explore.
                </h3>
              </div>

              <div>
                <p className="leading-7 text-[#8B95A7]">
                  Football H2H Vault brings historical matchup data
                  into one simple place. Instead of searching through
                  old results across different websites, explore
                  meetings, records, goals, trends and more from a
                  single football-focused experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Leagues */}
        <section
          id="leagues"
          className="border-t border-white/5"
        >
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="rounded-3xl border border-white/5 bg-[#111722] p-8 md:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B7F34A]">
                Coming soon
              </p>

              <h3 className="mt-4 text-3xl font-bold">
                Explore football by league
              </h3>

              <p className="mt-4 max-w-2xl leading-7 text-[#8B95A7]">
                Browse competitions, discover historic rivalries and
                explore H2H records across domestic leagues and
                international competitions.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-[#596274] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Football H2H Vault
          </p>

          <p>
            The history behind every matchup.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
