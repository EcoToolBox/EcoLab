// Nomes próprios dos modelos e métricas (iguais nos dois idiomas).
// Descrições e rótulos traduzidos ficam em i18n (models.desc.*, metrics.desc.*).
export const MODEL_LABELS = {
  random_forest: "Random Forest",
  brt: "BRT",
  gam: "GAM",
  maxent: "MaxEnt",
  svm: "SVM",
  ensemble: "Ensemble",
};

export const MODEL_KEYS = ["random_forest", "brt", "gam", "maxent", "svm"];
export const KDE_MODELS = ["gam", "random_forest", "brt"];

export const METRIC_LABELS = { auc: "AUC", tss: "TSS", boyce: "Boyce" };
export const METRIC_KEYS = ["auc", "tss", "boyce"];

/**
 * Faixas de interpretação das métricas (Swets 1988 para AUC; Allouche et al.
 * 2006 para TSS; Hirzel et al. 2006 para Boyce). Usadas só para colorir os
 * resultados e sinalizar modelos fracos.
 */
export const METRIC_BANDS = {
  auc: [
    { min: 0.9, level: "excellent" },
    { min: 0.8, level: "good" },
    { min: 0.7, level: "fair" },
    { min: -Infinity, level: "poor" },
  ],
  tss: [
    { min: 0.8, level: "excellent" },
    { min: 0.6, level: "good" },
    { min: 0.4, level: "fair" },
    { min: -Infinity, level: "poor" },
  ],
  boyce: [
    { min: 0.8, level: "excellent" },
    { min: 0.5, level: "good" },
    { min: 0.0, level: "fair" },
    { min: -Infinity, level: "poor" },
  ],
};

export function metricLevel(metric, value) {
  if (value == null || Number.isNaN(value)) return null;
  return (METRIC_BANDS[metric] ?? METRIC_BANDS.auc).find((b) => value >= b.min)?.level ?? null;
}

export const LEVEL_COLORS = {
  excellent: { bg: "#e3f1dc", fg: "#2f5d12" },
  good: { bg: "#eef5e3", fg: "#4f7a1f" },
  fair: { bg: "#fdf1dc", fg: "#8a5a00" },
  poor: { bg: "#fbe4df", fg: "#a3271b" },
};

// Classes de adequabilidade (mesmas do backend e de Zhao et al. 2025).
export const SUITABILITY_CLASSES = [
  { key: "unsuitable", range: "0–0,2", color: "#ffffcc" },
  { key: "low", range: "0,2–0,4", color: "#fed976" },
  { key: "moderate", range: "0,4–0,6", color: "#fd8d3c" },
  { key: "high", range: "0,6–1", color: "#bd0026" },
];

// Escala de cor do mapa (a mesma do backend, faixas de 0,1).
export const HEAT_COLORS = [
  "#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c",
  "#fc4e2a", "#e31a1c", "#bd0026", "#9e0026", "#800026",
];
