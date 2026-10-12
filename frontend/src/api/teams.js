const API_URL = "http://localhost:3001/api";

export async function searchTeams(query) {
  const response = await fetch(
    `${API_URL}/teams/search?q=${query}`
  );

  return response.json();
}


export async function importTeam(externalId) {
  const response = await fetch(
    `${API_URL}/teams/import/${externalId}`,
    {
      method: "POST",
    }
  );

  return response.json();
}


export async function getTeams() {
  const response = await fetch(
    `${API_URL}/teams`
  );

  return response.json();
}