const API_BASE = "http://127.0.0.1:8000/api";

async function handleResponse(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const occurrenceApi = {
   authenticateGbif: (gbif) =>
        fetch(`${API_BASE}/ocurrence/gbif/authenticate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({gbif}),
        })
          .then(handleResponse)
          .then((data) => data.msg ?? data.results ?? data),

    authenticateSpeciesLink: (speciesLink) =>
        fetch(`${API_BASE}/ocurrence/specieslink/authenticate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            ApiKey: speciesLink.apiKey,
        }),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),
  
    getOccurrences: async (sources, speciesList, country, year, points) =>
       await fetch(`${API_BASE}/occurrence/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sources,
            speciesList,
            country,
            year,
            points
          }),
        })
      .then(handleResponse)
      .then((data) => data.msg ?? data.results ?? data),
};
export default occurrenceApi;
