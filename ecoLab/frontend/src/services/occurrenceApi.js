let BASE_URL = "http://localhost:8000"; // fallback dev

export async function initConfig() {
    try {
        const res = await fetch("/api/config");
        const data = await res.json();
        BASE_URL = `http://localhost:${data.port}`;
    } catch (e) {
        console.warn("Usando porta padrão 8000");
    }
}

export function getBaseURL() {
    return BASE_URL + "/api";
}

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? body.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

const occurrenceApi = {
  checkIfKeyExists: (source) => {
    if (source === "gbif") {
      return fetch(`${getBaseURL()}/occurrence/gbif/check-key`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data);
    } else if (source === "specieslink") {
      return fetch(`${getBaseURL()}/occurrence/specieslink/check-key`, {
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
        fetch(`${getBaseURL()}/occurrence/gbif/authenticate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gbif),
        })
          .then(handleResponse)
          .then((data) => data.msg ?? data.results ?? data),

    authenticateSpeciesLink: (speciesLink) =>
        fetch(`${getBaseURL()}/occurrence/specieslink/authenticate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(speciesLink),
        })
        .then(handleResponse)
        .then((data) => data.msg ?? data.results ?? data),
  
    getOccurrences: async (sources, speciesList, country, year, points) =>
       await fetch(`${getBaseURL()}/occurrence/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sources: sources,
            speciesList: speciesList,
            country: country.ingles ?? country.label,
            year: year,
            points: points
          }),
        })
      .then(handleResponse)
      .then((data) => data.msg ?? data.results ?? data),

    uploadOccurrences: (file, mapping) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mapping", JSON.stringify(mapping));
        return fetch(`${getBaseURL()}/occurrence/upload`, {
            method: "POST",
            body: formData,
        })
            .then(handleResponse)
            .then((data) => data.msg ?? data.results ?? data);
    },
};
export default occurrenceApi;
