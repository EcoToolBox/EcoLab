// Cliente único da API do EcoLab.
//
// Em produção o frontend é servido pelo próprio backend, então os caminhos
// são relativos ("/api/..."): funcionam em qualquer porta que o app escolher.
// Em desenvolvimento (npm start, porta 3000) o backend roda na 8000.
const ROOT = process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";
const API = `${ROOT}/api`;

/** URL de um arquivo gerado pelo backend (mapas, GeoTIFF, CSV). */
export function fileUrl(path) {
  if (!path) return null;
  const clean = String(path).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${ROOT}/${clean.split("/").map(encodeURIComponent).join("/")}`;
}

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = Array.isArray(body.detail)
      ? body.detail.map((d) => d.msg ?? JSON.stringify(d)).join("; ")
      : body.detail;
    throw new Error(detail ?? body.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data?.msg ?? data?.results ?? data;
}

const get = (path) => fetch(`${API}${path}`).then(handle);
const post = (path, body) =>
  fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).then(handle);
const postForm = (path, fields) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, typeof v === "string" || v instanceof Blob ? v : JSON.stringify(v)));
  return fetch(`${API}${path}`, { method: "POST", body: form }).then(handle);
};

const api = {
  // países (embutidos no backend, funcionam sem internet)
  countries: () => get("/countries"),
  countryGeometry: (iso3) => get(`/countries/${encodeURIComponent(iso3)}/geometry`),

  // espécies
  autocomplete: (name) => get(`/autocomplete/?species_name=${encodeURIComponent(name)}`).then((r) => r ?? []),

  // ocorrências
  checkKey: (source) => get(`/occurrence/${source}/check-key`),
  authenticateGbif: (gbif) => post("/occurrence/gbif/authenticate", gbif),
  authenticateSpeciesLink: (cfg) => post("/occurrence/specieslink/authenticate", cfg),
  searchOccurrences: ({ sources, species, country, years }) =>
    post("/occurrence/search", {
      sources,
      speciesList: species,
      country: country?.name_en ?? country?.iso3 ?? "",
      year: years,
      points: [],
    }),
  uploadOccurrences: (file, mapping) => postForm("/occurrence/upload", { file, mapping }),

  // ambiente
  checkEarthEngine: () => get("/environment/check-ee-keys"),
  authenticateEarthEngine: (project) => post(`/environment/authenticate/${encodeURIComponent(project)}`),
  environmentVariables: (payload) => post("/environment/variables", payload),
  uploadEnvironment: (file, mapping, variables) => postForm("/environment/upload", { file, mapping, variables }),
  attachGrid: (occurrences, grid) => post("/environment/attach-grid", { occurrences, grid }),
  pickFolder: (initial) => post("/system/pick-folder", { initial: initial || null }),
  scanRasters: (folder) => post("/rasters/scan", { folder }),
  sampleRasters: (folder, files, occurrences) => post("/rasters/sample", { folder, files, occurrences }),
  buildRasterGrid: (folder, files, resolution) => post("/rasters/grid", { folder, files, resolution }),

  // interações
  searchInteractions: (payload) => post("/interactions", payload),
  interactionsAtOccurrences: (payload) => post("/interactions/occurrence", payload),

  // modelos
  runModels: (payload) => post("/models", payload),
  uploadPredictionGrid: (file) => postForm("/prediction-grid/upload", { file }),
};

export default api;
