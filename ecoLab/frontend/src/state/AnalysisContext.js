import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/*
 * Estado de uma análise do EcoLab.
 *
 * - config de cada etapa (ocorrências, ambiente, modelagem) + os dados que
 *   cada etapa buscou;
 * - salvo sozinho no navegador (F5 não perde nada; se os dados não couberem,
 *   salva só a configuração e avisa que é preciso buscar de novo);
 * - cada etapa guarda a "assinatura" (hash) da configuração usada na busca.
 *   Se a configuração muda depois, a etapa fica desatualizada e as seguintes
 *   não deixam avançar até buscar de novo. Assim voltar e avançar NÃO refaz
 *   nada, e uma mudança real nunca passa despercebida.
 */

const STORAGE_KEY = "ecolab.analysis.v1";
export const STATE_VERSION = 1;

const currentYear = new Date().getFullYear();

export const DEFAULT_MODELS = {
  presenceType: "presence_pseudoabsence",
  selectedModels: ["random_forest", "brt", "gam", "maxent"],
  selectedMetrics: ["auc", "tss"],
  validationMode: "random",
  testSize: 20,
  nFolds: 10,
  nRepeats: 5,
  backgroundRatio: 2,
  backgroundSource: "grid_random",
  backgroundBufferKm: 0,
  tssMode: "max",
  kdeTarget: { enabled: false, bandwidthKm: 0 },
  ensemble: { enabled: true, metric: "tss", threshold: 0 },
  customGrid: null,
  rankBy: "tss",
};

export function emptyAnalysis() {
  return {
    version: STATE_VERSION,
    createdAt: new Date().toISOString(),
    savedAt: null,
    dataDropped: false,
    occ: {
      mode: "sources",
      species: [],
      sources: ["gbif"],
      credentials: {
        gbif: { alreadyExists: null, email: "", userId: "", apiKey: "" },
        specieslink: { alreadyExists: null, apiKey: "" },
      },
      country: null,
      years: [currentYear - 50, currentYear],
      upload: { fileName: "", columns: [], preview: [], mapping: {} },
      data: [],
      excludedSpecies: [],
      fetchedHash: null,
    },
    env: {
      mode: "rasters",
      vars: [],
      geeProject: "",
      upload: { fileName: "", columns: [], mapping: {}, variables: [], acknowledged: false },
      raster: { folder: "", available: [], files: [], autoResolution: true, resolution: 0.1 },
      interactions: { enabled: false, types: [], depth: 1 },
      finalData: [],
      gridData: [],
      interactionData: [],
      rasterGrid: null,
      variables: [],
      fetchedHash: null,
    },
    models: { ...DEFAULT_MODELS },
    results: { maps: null, warnings: [], configHash: null, ranAt: null },
  };
}

// ── hashes ────────────────────────────────────────────────────────────────────
function stableHash(value) {
  const text = JSON.stringify(value);
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `${text.length}-${(h >>> 0).toString(36)}`;
}

export function occHash(occ) {
  const usesSources = occ.mode !== "upload";
  const usesUpload = occ.mode !== "sources";
  return stableHash({
    mode: occ.mode,
    species: usesSources ? occ.species.map((s) => s.key ?? s.name) : [],
    sources: usesSources ? [...occ.sources].sort() : [],
    country: occ.country?.iso3 ?? null,
    years: usesSources ? occ.years : null,
    upload: usesUpload ? { f: occ.upload.fileName, m: occ.upload.mapping } : null,
  });
}

export function envHash(env, occFetchedHash, excludedSpecies = []) {
  const m = env.mode;
  return stableHash({
    occ: occFetchedHash,
    excluded: [...excludedSpecies].sort(),
    mode: m,
    vars: m === "sources" || m === "both" ? [...env.vars].sort() : [],
    upload:
      m === "upload" || m === "both"
        ? { f: env.upload.fileName, m: env.upload.mapping, v: env.upload.variables.filter((v) => v.selected) }
        : null,
    raster:
      m === "rasters"
        ? { d: env.raster.folder, f: [...env.raster.files].sort(), a: env.raster.autoResolution, r: env.raster.resolution }
        : null,
    inter: env.interactions.enabled ? { t: [...env.interactions.types].sort(), d: env.interactions.depth } : null,
  });
}

export function stamp(hash) {
  return `${hash}@${Date.now()}`;
}

export function modelsHash(models, envFetchedHash, excludedSpecies = []) {
  const { rankBy, ...rest } = models; // ordenar a tabela não muda os modelos
  return stableHash({ env: envFetchedHash, models: rest, excluded: [...excludedSpecies].sort() });
}

// ── persistência ──────────────────────────────────────────────────────────────
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.version !== STATE_VERSION) return null;
    const base = emptyAnalysis();
    return {
      ...base,
      ...saved,
      occ: { ...base.occ, ...saved.occ },
      env: { ...base.env, ...saved.env },
      models: { ...base.models, ...saved.models },
      results: { ...base.results, ...saved.results },
    };
  } catch {
    return null;
  }
}

function stripData(state) {
  return {
    ...state,
    dataDropped: true,
    occ: { ...state.occ, data: [], fetchedHash: null },
    env: { ...state.env, finalData: [], gridData: [], interactionData: [], fetchedHash: null },
    results: { maps: null, warnings: [], configHash: null, ranAt: null },
  };
}

function withoutSecrets(state) {
  // senhas e chaves nunca vão para o localStorage
  const creds = state.occ.credentials;
  return {
    ...state,
    occ: {
      ...state.occ,
      credentials: {
        gbif: { ...creds.gbif, apiKey: "" },
        specieslink: { ...creds.specieslink, apiKey: "" },
      },
    },
  };
}

function save(state) {
  const clean = withoutSecrets({ ...state, savedAt: new Date().toISOString() });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return "full";
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripData(clean)));
      return "config";
    } catch {
      return "none";
    }
  }
}

export function hasSavedAnalysis() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

// ── parâmetros exportáveis (para reproduzir um artigo) ────────────────────────
export function exportParams(state) {
  const { occ, env, models } = state;
  return {
    ecolab: "parameters",
    version: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    occurrences: {
      mode: occ.mode,
      species: occ.species.map((s) => s.name),
      sources: occ.sources,
      country: occ.country,
      years: occ.years,
      uploadFile: occ.upload.fileName || null,
      uploadMapping: occ.upload.mapping,
    },
    environment: {
      mode: env.mode,
      variables: env.vars,
      uploadFile: env.upload.fileName || null,
      uploadMapping: env.upload.mapping,
      uploadVariables: env.upload.variables.filter((v) => v.selected),
      rasterFolder: env.raster.folder || null,
      rasterFiles: env.raster.files,
      rasterResolution: env.raster.autoResolution ? "auto" : env.raster.resolution,
      interactions: env.interactions,
    },
    models: { ...models, customGrid: null },
  };
}

export function applyParams(state, params) {
  if (params?.ecolab !== "parameters") throw new Error("invalid");
  const base = emptyAnalysis();
  const o = params.occurrences ?? {};
  const e = params.environment ?? {};
  return {
    ...base,
    occ: {
      ...base.occ,
      mode: o.mode ?? base.occ.mode,
      species: (o.species ?? []).map((name) => ({ key: name, name, canonicalName: name })),
      sources: o.sources ?? base.occ.sources,
      country: o.country ?? null,
      years: o.years ?? base.occ.years,
      upload: { ...base.occ.upload, fileName: "", mapping: o.uploadMapping ?? {} },
    },
    env: {
      ...base.env,
      mode: e.mode ?? base.env.mode,
      vars: e.variables ?? [],
      upload: { ...base.env.upload, mapping: e.uploadMapping ?? {}, variables: (e.uploadVariables ?? []).map((v) => ({ ...v, selected: true })) },
      raster: {
        ...base.env.raster,
        folder: e.rasterFolder ?? "",
        files: e.rasterFiles ?? [],
        autoResolution: e.rasterResolution === "auto" || e.rasterResolution == null,
        resolution: typeof e.rasterResolution === "number" ? e.rasterResolution : base.env.raster.resolution,
      },
      interactions: { ...base.env.interactions, ...(e.interactions ?? {}) },
    },
    models: { ...DEFAULT_MODELS, ...(params.models ?? {}), customGrid: null },
  };
}

// ── contexto ──────────────────────────────────────────────────────────────────
const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  const [state, setState] = useState(() => load() ?? emptyAnalysis());
  const [saveStatus, setSaveStatus] = useState("full");
  // Arquivos escolhidos (File) não podem ir para o localStorage: ficam aqui.
  const files = useRef({ occUpload: null, envUpload: null });

  useEffect(() => {
    const id = setTimeout(() => setSaveStatus(save(state)), 600);
    return () => clearTimeout(id);
  }, [state]);

  const update = useCallback((section, patch) => {
    setState((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...(typeof patch === "function" ? patch(prev[section]) : patch) },
    }));
  }, []);

  const reset = useCallback(() => {
    files.current = { occUpload: null, envUpload: null };
    setState(emptyAnalysis());
  }, []);

  const replace = useCallback((next) => setState(next), []);

  const derived = useMemo(() => {
    // fetchedHash = "<hash da config>@<momento da busca>": buscar de novo,
    // mesmo com a mesma config, invalida as etapas seguintes.
    const prefix = (h) => (h ? String(h).split("@")[0] : null);
    const currentOcc = occHash(state.occ);
    const occReady = state.occ.data.length > 0 && prefix(state.occ.fetchedHash) === currentOcc;
    const currentEnv = envHash(state.env, state.occ.fetchedHash, state.occ.excludedSpecies ?? []);
    const envReady = occReady && state.env.finalData.length > 0 && prefix(state.env.fetchedHash) === currentEnv;
    const currentModels = modelsHash(state.models, state.env.fetchedHash, state.occ.excludedSpecies ?? []);
    const resultsReady = envReady && !!state.results.maps && state.results.configHash === currentModels;
    return {
      occHash: currentOcc,
      envHash: currentEnv,
      modelsHash: currentModels,
      occReady,
      occStale: state.occ.data.length > 0 && !occReady,
      envReady,
      envStale: state.env.finalData.length > 0 && !envReady,
      resultsReady,
      resultsStale: !!state.results.maps && !resultsReady,
    };
  }, [state]);

  const value = useMemo(
    () => ({ state, update, reset, replace, files, saveStatus, ...derived }),
    [state, update, reset, replace, saveStatus, derived]
  );
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis fora do AnalysisProvider");
  return ctx;
}
