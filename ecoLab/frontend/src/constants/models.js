
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

export const VALIDATION_MODES = [
  {
    value: "random",
    label: "Aleatória",
    description: "Divide os dados em 80% treino / 20% teste de forma aleatória (estratificada). Recomendado para uso geral.",
  },
  {
    value: "spatial",
    label: "Espacial",
    description: "Agrupa os pontos por coordenadas (K-means) em blocos geográficos e usa cada bloco como fold de teste. Reduz o otimismo causado por autocorrelação espacial — recomendado quando presenças e background estão espacialmente agrupados, ou para reproduzir estudos que usam essa abordagem.",
  },
];

export const BACKGROUND_SOURCES = [
  {
    value: "grid_random",
    label: "Grid aleatório",
    description: "O background é amostrado automaticamente do grid ambiental gerado para o país/área selecionada. Uso genérico, recomendado na maioria dos casos.",
  },
  {
    value: "provided",
    label: "Arquivo / background fornecido",
    description: "Usa a planilha ambiental enviada por você (etapa de Ambiente) como grid de background e de predição, em vez de gerar um grid automático. Útil para reproduzir um estudo específico com pontos de background já definidos.",
  },
];