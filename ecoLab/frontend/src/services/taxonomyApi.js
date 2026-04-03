const API_BASE = "http://127.0.0.1:8000/api";

async function handleResponse(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const taxonomyApi = {
  getRoots: () =>
    fetch(`${API_BASE}/taxonomy/roots`).then(handleResponse).then(data => data.msg),

  getChildren: (key, limit = 1500, offset = 0) =>
    fetch(`${API_BASE}/taxonomy/${key}/children?limit=${limit}&offset=${offset}`).then(handleResponse)
    .then(data => data.msg ?? data.results ?? data),

  autocomplete: (speciesName) =>
    fetch(`${API_BASE}/autocomplete/?species_name=${encodeURIComponent(speciesName)}`)
      .then(handleResponse)
      .then((data) => data.msg ?? []),
};

export default taxonomyApi;
