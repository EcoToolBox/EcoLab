
export const MODELS = [
  { value: "maxent", label: "MaxEnt", description: "Maximum Entropy — funciona bem com presence only e poucos dados." },
  { value: "gam", label: "GAM", description: "Generalized Additive Model — modela relações não-lineares entre variáveis." },
  { value: "brt", label: "BRT", description: "Boosted Regression Trees — robusto e lida bem com interações entre variáveis." },
  { value: "random_forest", label: "Random Forest", description: "Ensemble de árvores de decisão — alta acurácia e resistente a overfitting." },
  { value: "svm", label: "SVM", description: "Support Vector Machine — eficaz em espaços de alta dimensionalidade." },
];

export const PRESENCE_TYPES = [
  {
    value: "presence_only",
    label: "Presence Only",
    description: "Usa apenas registros de presença da espécie. Indicado quando não há dados confiáveis de ausência. Modelos como MaxEnt foram desenvolvidos especificamente para esse cenário.",
  },
  {
    value: "presence_pseudoabsence",
    label: "Presence / Pseudoausência",
    description: "Combina registros de presença com pontos de pseudoausência gerados aleatoriamente na área de estudo. Permite usar modelos que requerem dados de ausência, geralmente com melhor performance discriminativa.",
  },
];

export const METRICS = [
  { value: "auc", label: "AUC", description: "Area Under the Curve — mede a capacidade discriminativa do modelo. Valores próximos de 1 indicam melhor desempenho." },
  { value: "tss", label: "TSS", description: "True Skill Statistic — independente da prevalência da espécie. Varia de -1 a 1, onde 1 é perfeito e 0 equivale a aleatoriedade." },
  { value: "boyce", label: "Boyce Index", description: "Avalia o modelo apenas com dados de presença, ideal para modelos presence only. Varia de -1 a 1." },
];