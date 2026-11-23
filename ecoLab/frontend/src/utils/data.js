// Utilitários de dados compartilhados pelas etapas.

export function exportCSV(rows, filename) {
  if (!rows?.length) return;
  const keys = Object.keys(rows[0]).filter((k) => k !== "id");
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function downloadJSON(obj, filename) {
  downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }), filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function withId(rows) {
  return (rows ?? []).map((row, i) => ({ ...row, id: i }));
}

export function asRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.msg)) return result.msg;
  if (Array.isArray(result?.data)) return result.data;
  return Object.values(result ?? {});
}

// ── colunas de planilha: detecção automática pelo nome ───────────────────────
const strip = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const OCC_FIELD_ALIASES = {
  species: ["species", "scientificname", "especie", "nomecientifico", "taxon", "taxonname", "name", "nome"],
  latitude: ["latitude", "lat", "decimallatitude", "y"],
  longitude: ["longitude", "lon", "long", "lng", "decimallongitude", "x"],
  eventDate: ["eventdate", "date", "data", "datacoleta", "collectiondate"],
  presence: ["presence", "presenca", "pa", "presenceabsence", "occurrence"],
  bufferKm: ["bufferkm", "buffer", "bufferkms", "exclusionbufferkm"],
};

export const ENV_FIELD_ALIASES = {
  latitude: OCC_FIELD_ALIASES.latitude,
  longitude: OCC_FIELD_ALIASES.longitude,
};

/** Sugere o mapeamento campo → coluna a partir dos nomes das colunas. */
export function guessMapping(columns, aliases) {
  const used = new Set();
  const mapping = {};
  Object.entries(aliases).forEach(([field, names]) => {
    const hit = names
      .map((alias) => columns.find((c) => strip(c) === alias && !used.has(c)))
      .find(Boolean);
    if (hit) {
      mapping[field] = hit;
      used.add(hit);
    }
  });
  return mapping;
}

// ── ocorrências ──────────────────────────────────────────────────────────────
export const SPECIES_COLS = ["species", "scientificName", "taxon", "name"];

export function speciesColumn(rows) {
  const first = rows?.[0] ?? {};
  return SPECIES_COLS.find((c) => c in first) ?? null;
}

/** Nome da espécie de uma linha (bases e planilha usam colunas diferentes). */
export function rowSpecies(r) {
  for (const c of SPECIES_COLS) {
    const v = r?.[c];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Resumo das ocorrências: total, coordenadas válidas, pontos únicos por espécie. */
export function summarizeOccurrences(rows) {
  const bySpecies = new Map();
  let invalid = 0;
  let backgroundRows = 0;
  (rows ?? []).forEach((r) => {
    const lat = num(r.latitude);
    const lon = num(r.longitude);
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      invalid += 1;
      return;
    }
    if (r.presence != null && Number(r.presence) === 0) {
      backgroundRows += 1;
      return;
    }
    const sp = rowSpecies(r) || "–";
    if (!bySpecies.has(sp)) bySpecies.set(sp, { records: 0, coords: new Set() });
    const entry = bySpecies.get(sp);
    entry.records += 1;
    entry.coords.add(`${lat.toFixed(5)},${lon.toFixed(5)}`);
  });
  const species = [...bySpecies.entries()]
    .map(([name, e]) => ({ name, records: e.records, unique: e.coords.size }))
    .sort((a, b) => b.unique - a.unique);
  return {
    total: rows?.length ?? 0,
    invalid,
    backgroundRows,
    species,
    unique: species.reduce((s, x) => s + x.unique, 0),
  };
}

/** Pontos válidos para desenhar no mapa (limita a quantidade para não travar). */
export function occurrencePoints(rows, limit = 6000) {
  const pts = [];
  for (const r of rows ?? []) {
    const lat = num(r.latitude);
    const lon = num(r.longitude);
    if (lat == null || lon == null) continue;
    if (r.presence != null && Number(r.presence) === 0) continue;
    pts.push({ lat, lon, species: rowSpecies(r) });
    if (pts.length >= limit) break;
  }
  return pts;
}

// ── variáveis ambientais ─────────────────────────────────────────────────────
/** Estatísticas de cada variável nas ocorrências (faltantes, mín., máx.). */
export function variableStats(rows, variables) {
  return variables.map((name) => {
    let missing = 0;
    let min = Infinity;
    let max = -Infinity;
    (rows ?? []).forEach((r) => {
      const v = num(r[name]);
      if (v == null) {
        missing += 1;
        return;
      }
      if (v < min) min = v;
      if (v > max) max = v;
    });
    const total = rows?.length ?? 0;
    return {
      name,
      missing,
      missingPct: total ? (100 * missing) / total : 0,
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null,
    };
  });
}

/** Colunas acrescentadas pela etapa de ambiente (= as variáveis do modelo). */
export function addedColumns(before, after) {
  const old = new Set(Object.keys(before?.[0] ?? {}));
  const ignore = new Set(["id", "year", "month", "day", "eventDate", "geometry"]);
  return Object.keys(after?.[0] ?? {}).filter((k) => !old.has(k) && !ignore.has(k));
}

// ── grid dos rasters: resolução automática ───────────────────────────────────
const NICE_STEPS = [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1];
export const MAX_GRID_CELLS = 2_000_000;
export const TARGET_GRID_CELLS = 200_000;

export function rasterExtent(available, selected) {
  const files = (available ?? []).filter((f) => selected.includes(f.relativePath));
  if (!files.length) return null;
  const b = files.reduce(
    (acc, f) => ({
      lonMin: Math.max(acc.lonMin, f.bounds.lonMin),
      latMin: Math.max(acc.latMin, f.bounds.latMin),
      lonMax: Math.min(acc.lonMax, f.bounds.lonMax),
      latMax: Math.min(acc.latMax, f.bounds.latMax),
    }),
    { lonMin: -180, latMin: -90, lonMax: 180, latMax: 90 }
  );
  return b.lonMin < b.lonMax && b.latMin < b.latMax ? b : null;
}

export function estimateCells(extent, resolution) {
  if (!extent || !resolution) return 0;
  return (
    Math.ceil((extent.lonMax - extent.lonMin) / resolution) *
    Math.ceil((extent.latMax - extent.latMin) / resolution)
  );
}

/** Resolução "redonda" que deixa o grid perto de ~200 mil células. */
export function autoResolution(extent) {
  if (!extent) return 0.1;
  const area = (extent.lonMax - extent.lonMin) * (extent.latMax - extent.latMin);
  const ideal = Math.sqrt(area / TARGET_GRID_CELLS);
  let best = NICE_STEPS[0];
  NICE_STEPS.forEach((s) => {
    if (Math.abs(Math.log(s / ideal)) < Math.abs(Math.log(best / ideal))) best = s;
  });
  // Sobe de degrau até caber no limite de células.
  const coarser = [...NICE_STEPS.filter((s) => s >= best), 2, 5, 10];
  return coarser.find((s) => estimateCells(extent, s) <= MAX_GRID_CELLS) ?? coarser[coarser.length - 1];
}

// ── espécie: nome a partir do objeto ou string ───────────────────────────────
export const speciesName = (s) => (typeof s === "string" ? s : s?.canonicalName ?? s?.name ?? "");

/**
 * Espécies da análise no formato que o backend espera ([{key, name}]).
 * Com planilha, os nomes vêm dos próprios dados (não há lista digitada).
 */
/** Espécies que o usuário tirou da modelagem (comparação sem diferenciar maiúsculas). */
export function isExcluded(occ, name) {
  const key = String(name ?? "").trim().toLowerCase();
  return (occ?.excludedSpecies ?? []).some((n) => n.toLowerCase() === key);
}

/** Linhas das espécies que vão para a modelagem. */
export function selectedRows(occ, rows) {
  if (!occ?.excludedSpecies?.length) return rows ?? [];
  return (rows ?? []).filter((r) => !isExcluded(occ, rowSpecies(r)));
}

/**
 * Espécies da análise no formato que o backend espera ([{key, name}]):
 * as escolhidas por nome mais as da planilha, menos as desmarcadas pelo usuário.
 */
export function analysisSpecies(occ) {
  const picked = occ.mode === "upload" ? [] : (occ.species ?? []).map((s) => ({ key: s.key ?? speciesName(s), name: speciesName(s) }));
  const known = new Set(picked.map((s) => s.name.toLowerCase()));
  const sheetRows = occ.mode === "sources" ? [] : (occ.data ?? []).filter((r) => occ.mode === "upload" || r.source === "user_upload");
  const fromSheet = summarizeOccurrences(sheetRows)
    .species.map((s) => s.name)
    .filter((n) => n && n !== "–" && !known.has(n.toLowerCase()))
    .map((n) => ({ key: n, name: n }));
  // Nas bases o nome vem com autor ("Melipona seminigra Friese, 1903"): a espécie
  // escolhida sai quando todas as variações dela foram desmarcadas na tabela.
  const allNames = summarizeOccurrences(occ.data).species.map((s) => s.name);
  const pickedOut = (name) => {
    if (isExcluded(occ, name)) return true;
    const lower = name.toLowerCase();
    const variants = allNames.filter((n) => n.toLowerCase() === lower || n.toLowerCase().startsWith(lower + " "));
    return variants.length > 0 && variants.every((n) => isExcluded(occ, n));
  };
  return [...picked.filter((s) => !pickedOut(s.name)), ...fromSheet.filter((s) => !isExcluded(occ, s.name))];
}
