import { useEffect, useRef, useState } from "react";
import { searchTeams, importTeam } from "../api/teams";

export default function TeamSearch({
  onTeamSelect,
  selectedTeam = null,
  placeholder = "Search for a football club...",
}) {
  const [query, setQuery] = useState(
    selectedTeam?.name || ""
  );

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] =
    useState(null);
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] =
    useState(false);

  const timeoutRef = useRef(null);

  useEffect(() => {
    if (selectedTeam?.name) {
      setQuery(selectedTeam.name);
    }
  }, [selectedTeam]);

  useEffect(() => {
    const value = query.trim();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value.length < 2) {
      setTeams([]);
      setShowSuggestions(false);
      setLoading(false);
      setError("");
      return;
    }

    timeoutRef.current = setTimeout(
      async () => {
        setLoading(true);
        setError("");
        setShowSuggestions(true);

        try {
          const data = await searchTeams(value);

          if (data?.status === "success") {
            setTeams(data.teams || []);
          } else {
            setTeams([]);
            setError(
              data?.message ||
                "Unable to search clubs."
            );
          }
        } catch (err) {
          console.error(
            "Team search failed:",
            err
          );

          setTeams([]);
          setError(
            "Unable to search clubs right now."
          );
        } finally {
          setLoading(false);
        }
      },
      300
    );

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  async function handleImport(team) {
    const teamId =
      team.thesportsdb_id ||
      team.external_id;

    if (!teamId) {
      setError("This team has no valid ID.");
      return;
    }

    try {
      setImportingId(teamId);
      setError("");

      const result = await importTeam(teamId);

      if (result?.status === "error") {
        throw new Error(
          result.message ||
            "Team import failed"
        );
      }

      /*
       * Search again after importing so the team
       * changes from "Import Team" to "Already imported".
       */
      const refreshed =
        await searchTeams(query.trim());

      const refreshedTeams =
        refreshed?.teams || [];

      setTeams(refreshedTeams);

      /*
       * Find the newly imported team.
       */
      const importedTeam =
        refreshedTeams.find(
          (item) =>
            Number(
              item.thesportsdb_id
            ) === Number(teamId)
        ) ||
        refreshedTeams.find(
          (item) =>
            item.name?.toLowerCase() ===
            team.name?.toLowerCase()
        );

      if (importedTeam && onTeamSelect) {
        onTeamSelect(importedTeam);
      }

      alert(
        result?.message ||
          `${team.name} imported successfully`
      );
    } catch (err) {
      console.error(
        "Team import failed:",
        err
      );

      setError(
        err.message ||
          "Unable to import this team."
      );
    } finally {
      setImportingId(null);
    }
  }

  function handleSelect(team) {
    setQuery(team.name);
    setShowSuggestions(false);
    setError("");

    if (onTeamSelect) {
      onTeamSelect(team);
    }
  }

  function handleBlur() {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);

          if (
            event.target.value.trim().length >= 2
          ) {
            setShowSuggestions(true);
          }
        }}
        onFocus={() => {
          if (teams.length > 0) {
            setShowSuggestions(true);
          }
        }}
        onBlur={handleBlur}
        style={{
          width: "100%",
          padding: "12px",
          boxSizing: "border-box",
          border: "1px solid #ccc",
          borderRadius: "6px",
        }}
      />

      {showSuggestions &&
        query.trim().length >= 2 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: "6px",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.12)",
              zIndex: 1000,
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            {loading && (
              <div
                style={{
                  padding: "14px",
                }}
              >
                Searching clubs...
              </div>
            )}

            {!loading &&
              !error &&
              teams.length === 0 && (
                <div
                  style={{
                    padding: "14px",
                    color: "#666",
                  }}
                >
                  No clubs found.
                </div>
              )}

            {!loading &&
              teams.map((team) => {
                const teamId =
                  team.thesportsdb_id ||
                  team.api_football_id ||
                  team.id ||
                  team.external_id;

                const isStored =
                  Boolean(team.isStored) ||
                  Boolean(team.id);

                const isImporting =
                  Number(importingId) ===
                  Number(teamId);

                return (
                  <div
                    key={`${teamId}-${team.name}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px",
                      borderBottom:
                        "1px solid #eee",
                    }}
                  >
                    <button
                      type="button"
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
                      onClick={() =>
                        handleSelect(team)
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flex: 1,
                        border: "none",
                        background:
                          "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        padding: 0,
                      }}
                    >
                      {team.logo_url ? (
                        <img
                          src={team.logo_url}
                          alt=""
                          width="42"
                          height="42"
                          style={{
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            display: "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            background: "#eee",
                            borderRadius: "50%",
                          }}
                        >
                          ⚽
                        </div>
                      )}

                      <div>
                        <strong>
                          {team.name}
                        </strong>

                        <div
                          style={{
                            fontSize: "13px",
                            color: "#777",
                            marginTop: "3px",
                          }}
                        >
                          {team.country ||
                            "Country unknown"}
                        </div>
                      </div>
                    </button>

                    {isStored ? (
                      <span
                        style={{
                          fontSize: "12px",
                          color: "green",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Already imported
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isImporting}
                        onClick={() =>
                          handleImport(team)
                        }
                      >
                        {isImporting
                          ? "Importing..."
                          : "Import Team"}
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}

      {error && (
        <p
          style={{
            color: "red",
            marginTop: "8px",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}