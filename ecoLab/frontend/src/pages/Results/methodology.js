// Texto de metodologia pronto para colar num artigo, gerado a partir da
// configuração real da análise (PT ou EN).
import { MODEL_LABELS, METRIC_LABELS } from "../../constants/models";
import { analysisSpecies, selectedRows, summarizeOccurrences } from "../../utils/data";
import { modelAllowed } from "../Models";

const SOURCE_LABELS = { gbif: "GBIF", inaturalist: "iNaturalist", specieslink: "speciesLink" };

function list(items, lang) {
  const and = lang === "pt" ? " e " : " and ";
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + and + items[items.length - 1];
}

export function methodologyText(state, lang, t) {
  const { occ, env, models, results } = state;
  const pt = lang === "pt";
  const nf = new Intl.NumberFormat(pt ? "pt-BR" : "en-US");
  const species = analysisSpecies(occ).map((s) => s.name);
  const summary = summarizeOccurrences(selectedRows(occ, env.finalData.length ? env.finalData : occ.data));
  const country = occ.country ? (pt ? occ.country.name_pt : occ.country.name_en) : "–";
  const selected = models.selectedModels.filter((k) => modelAllowed(k, models)).map((k) => MODEL_LABELS[k]);
  const metrics = models.selectedMetrics.map((k) => METRIC_LABELS[k]);
  const ensembleOn = models.ensemble.enabled && models.presenceType !== "presence_only" && selected.length >= 2;
  const parts = [];

  // Ocorrências
  const speciesTxt = species.length <= 5 ? list(species, lang) : `${species.length} ${pt ? "espécies" : "species"}`;
  const sources = occ.mode !== "upload" ? list(occ.sources.map((s) => SOURCE_LABELS[s] ?? s), lang) : null;
  const years = occ.years?.[0] > 1900 ? `${occ.years[0]}–${occ.years[1]}` : null;
  if (pt) {
    parts.push(
      `Registros de ocorrência de ${speciesTxt} em ${country} foram obtidos ` +
        (sources ? `das bases ${sources}${years ? ` (${years})` : ""}` : "") +
        (occ.mode === "both" ? " e de uma planilha própria" : occ.mode === "upload" ? "de uma planilha própria" : "") +
        `. Após remover coordenadas inválidas e duplicadas, restaram ${nf.format(summary.unique)} pontos de presença únicos.`
    );
  } else {
    parts.push(
      `Occurrence records of ${speciesTxt} in ${country} were obtained ` +
        (sources ? `from ${sources}${years ? ` (${years})` : ""}` : "") +
        (occ.mode === "both" ? " and from the authors' own dataset" : occ.mode === "upload" ? "from the authors' own dataset" : "") +
        `. After removing invalid and duplicated coordinates, ${nf.format(summary.unique)} unique presence points remained.`
    );
  }

  // Ambiente
  const nVars = env.variables.length;
  if (env.mode === "rasters" && env.rasterGrid) {
    parts.push(
      pt
        ? `${nVars} variáveis ambientais foram extraídas de rasters (GeoTIFF) no ponto de cada ocorrência; os rasters foram reamostrados para um grid de ${env.rasterGrid.resolution}° (${nf.format(env.rasterGrid.rows)} células), usado para amostrar o background e projetar os modelos.`
        : `${nVars} environmental variables were extracted from GeoTIFF rasters at each occurrence; rasters were resampled to a ${env.rasterGrid.resolution}° grid (${nf.format(env.rasterGrid.rows)} cells) used to sample background points and project the models.`
    );
  } else if (env.mode === "upload") {
    parts.push(
      pt
        ? `${nVars} variáveis ambientais foram fornecidas em uma planilha de pontos, associadas a cada ocorrência pelo ponto mais próximo.`
        : `${nVars} environmental variables were provided as a point table and assigned to each occurrence by nearest neighbour.`
    );
  } else {
    parts.push(
      pt
        ? `${nVars} variáveis ambientais (${list(env.vars, lang)}) foram obtidas do Google Earth Engine${env.mode === "both" ? " e de uma planilha própria" : ""}.`
        : `${nVars} environmental variables (${list(env.vars, lang)}) were obtained from Google Earth Engine${env.mode === "both" ? " and from a user-provided table" : ""}.`
    );
  }
  if (env.interactions.enabled) {
    parts.push(
      pt
        ? `Interações bióticas (${env.interactions.types.length} tipos, profundidade ${env.interactions.depth}) foram obtidas do GloBI e incluídas como densidade de ocorrência das espécies interatoras.`
        : `Biotic interactions (${env.interactions.types.length} types, depth ${env.interactions.depth}) were retrieved from GloBI and included as occurrence density of interacting species.`
    );
  }

  // Modelagem
  if (models.presenceType === "presence_only") {
    parts.push(pt ? "Os modelos foram ajustados com dados apenas de presença." : "Models were fitted with presence-only data.");
  } else {
    const buffer = models.backgroundBufferKm > 0 ? (pt ? `, a pelo menos ${models.backgroundBufferKm} km das presenças` : `, at least ${models.backgroundBufferKm} km from presences`) : "";
    parts.push(
      pt
        ? `Pseudo-ausências foram sorteadas aleatoriamente no grid na proporção de ${models.backgroundRatio} por presença${buffer}.`
        : `Pseudo-absences were randomly sampled from the grid at a ratio of ${models.backgroundRatio} per presence${buffer}.`
    );
  }
  if (models.kdeTarget?.enabled) {
    parts.push(pt ? "A variável resposta foi a densidade de kernel (KDE) das ocorrências." : "The response variable was the kernel density (KDE) of occurrences.");
  }
  const validation = {
    random: pt
      ? `uma divisão aleatória estratificada (${100 - models.testSize}% treino / ${models.testSize}% teste)`
      : `a stratified random split (${100 - models.testSize}% training / ${models.testSize}% test)`,
    repeated: pt
      ? `${models.nRepeats} repetições de divisão aleatória (${100 - models.testSize}% / ${models.testSize}%)`
      : `${models.nRepeats} repeated random splits (${100 - models.testSize}% / ${models.testSize}%)`,
    spatial: pt ? `validação cruzada espacial em ${models.nFolds} blocos (K-means)` : `spatial block cross-validation with ${models.nFolds} folds (K-means)`,
  }[models.validationMode];
  const tss = models.tssMode === "max" ? (pt ? "limiar que maximiza o TSS" : "threshold maximising TSS") : (pt ? "limiar fixo de 0,5" : "fixed 0.5 threshold");
  parts.push(
    pt
      ? `Foram ajustados os algoritmos ${list(selected, lang)}, avaliados por ${validation} com as métricas ${list(metrics, lang)} (${tss}).`
      : `The algorithms ${list(selected, lang)} were fitted and evaluated with ${validation} using ${list(metrics, lang)} (${tss}).`
  );
  if (ensembleOn) {
    const m = METRIC_LABELS[models.ensemble.metric];
    parts.push(
      pt
        ? `Um modelo de consenso (ensemble) foi obtido pela média ponderada pelo ${m} dos modelos${models.ensemble.threshold > 0 ? ` com ${m} ≥ ${models.ensemble.threshold}` : ""}.`
        : `An ensemble was built as the ${m}-weighted mean of the models${models.ensemble.threshold > 0 ? ` with ${m} ≥ ${models.ensemble.threshold}` : ""}.`
    );
  }
  parts.push(
    pt
      ? "A adequabilidade foi classificada em inadequada (0–0,2), baixa (0,2–0,4), moderada (0,4–0,6) e alta (0,6–1). As análises foram feitas no EcoLab."
      : "Suitability was classified as unsuitable (0–0.2), low (0.2–0.4), moderate (0.4–0.6) and high (0.6–1). Analyses were performed in EcoLab."
  );
  if (!results.maps) parts.push(t("results.methodPending"));
  return parts.join(" ");
}
