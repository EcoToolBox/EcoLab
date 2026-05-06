const API_BASE = "http://127.0.0.1:8000/api";

async function handleResponse(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const occurrenceApi = {
  checkIfKeyExists: (source) => {
    if (source === "gbif") {
      return fetch(`${API_BASE}/occurrence/gbif/check-key`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data);
    } else if (source === "specieslink") {
      return fetch(`${API_BASE}/occurrence/specieslink/check-key`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data);
    }
  },

   authenticateGbif: (gbif) =>
        fetch(`${API_BASE}/occurrence/gbif/authenticate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gbif),
        })
          .then(handleResponse)
          .then((data) => data.msg ?? data.results ?? data),

    authenticateSpeciesLink: (speciesLink) =>
        fetch(`${API_BASE}/occurrence/specieslink/authenticate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(speciesLink),
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
            sources: sources,
            speciesList: speciesList,
            country: country.label,
            year: year,
            points: points
          }),
        })
      .then(handleResponse)
      .then((data) => data.msg ?? data.results ?? data),
};
export default occurrenceApi;
