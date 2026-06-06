
let BASE_URL = "http://localhost:8000";

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
    return BASE_URL+"/api";
}
async function handleResponse(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const taxonomyApi = {
  getRoots: () =>
    fetch(`${getBaseURL()}/taxonomy/roots`).then(handleResponse).then(data => data.msg),

  getChildren: (key, limit = 1500, offset = 0) =>
    fetch(`${getBaseURL()}/taxonomy/${key}/children?limit=${limit}&offset=${offset}`).then(handleResponse)
    .then(data => data.msg ?? data.results ?? data),

  autocomplete: (speciesName) =>
    fetch(`${getBaseURL()}/autocomplete/?species_name=${encodeURIComponent(speciesName)}`)
      .then(handleResponse)
      .then((data) => data.msg ?? []),
};

export default taxonomyApi;
