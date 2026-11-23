// Todos os tipos da API do GloBI (lista em
// https://api.globalbioticinteractions.org/interactionTypes), com rótulo em
// português. Use só valores dessa lista: um tipo que a API não conhece derruba
// a busca inteira com erro 500, mesmo junto de outros válidos (foi o que
// acontecia com "competitorOf", que não existe no GloBI).
const GLOBI_INTERACTIONS = [
  { value: "eats", label: "Come (consumidor → alimento)" },
  { value: "eatenBy", label: "É comido por (alimento → consumidor)" },
  { value: "preysOn", label: "Preda (predador → presa)" },
  { value: "preyedUponBy", label: "É predado por (presa → predador)" },
  { value: "kills", label: "Mata (agente → vítima)" },
  { value: "killedBy", label: "É morto por (vítima → agente)" },
  { value: "acquiresNutrientsFrom", label: "Obtém nutrientes de" },
  { value: "providesNutrientsFor", label: "Fornece nutrientes para" },
  { value: "parasiteOf", label: "Parasita (parasita → hospedeiro)" },
  { value: "hasParasite", label: "Tem parasita (hospedeiro → parasita)" },
  { value: "endoparasiteOf", label: "Endoparasita (endoparasita → hospedeiro)" },
  { value: "hasEndoparasite", label: "Tem endoparasita (hospedeiro → endoparasita)" },
  { value: "ectoparasiteOf", label: "Ectoparasita (ectoparasita → hospedeiro)" },
  { value: "hasEctoparasite", label: "Tem ectoparasita (hospedeiro → ectoparasita)" },
  { value: "parasitoidOf", label: "Parasitoide (parasitoide → hospedeiro)" },
  { value: "hasParasitoid", label: "Tem parasitoide (hospedeiro → parasitoide)" },
  { value: "hemiparasiteOf", label: "Hemiparasita de (planta semiparasita → hospedeira)" },
  { value: "rootparasiteOf", label: "Parasita de raiz de" },
  { value: "hostOf", label: "Hospedeiro de (hospedeiro → simbionte)" },
  { value: "hasHost", label: "Tem hospedeiro (simbionte → hospedeiro)" },
  { value: "pathogenOf", label: "Patógeno de (patógeno → hospedeiro)" },
  { value: "hasPathogen", label: "Tem patógeno (hospedeiro → patógeno)" },
  { value: "vectorOf", label: "Vetor de (vetor → patógeno)" },
  { value: "hasVector", label: "Tem vetor (patógeno → vetor)" },
  { value: "pollinates", label: "Poliniza (polinizador → planta)" },
  { value: "pollinatedBy", label: "É polinizado por (planta → polinizador)" },
  { value: "visitsFlowersOf", label: "Visita flores de (visitante → planta)" },
  { value: "flowersVisitedBy", label: "Tem flores visitadas por (planta → visitante)" },
  { value: "visits", label: "Visita (visitante → visitado)" },
  { value: "visitedBy", label: "É visitado por (visitado → visitante)" },
  { value: "dispersalVectorOf", label: "Dispersor de (dispersor → planta/semente)" },
  { value: "hasDispersalVector", label: "Tem dispersor (planta/semente → dispersor)" },
  { value: "symbiontOf", label: "Simbionte de" },
  { value: "mutualistOf", label: "Mutualista de" },
  { value: "commensalistOf", label: "Comensal de" },
  { value: "epiphyteOf", label: "Epífita de (epífita → planta suporte)" },
  { value: "hasEpiphyte", label: "Tem epífita (planta suporte → epífita)" },
  { value: "arbuscularMycorrhizalHostOf", label: "Hospedeiro de micorriza arbuscular (planta → fungo)" },
  { value: "hasArbuscularMycorrhizalHost", label: "Tem hospedeiro de micorriza arbuscular (fungo → planta)" },
  { value: "ectomycorrhizalHostOf", label: "Hospedeiro de ectomicorriza (planta → fungo)" },
  { value: "hasEctomycorrhizalHost", label: "Tem hospedeiro de ectomicorriza (fungo → planta)" },
  { value: "allelopathOf", label: "Alelopático para (inibe outra planta quimicamente)" },
  { value: "createsHabitatFor", label: "Cria habitat para" },
  { value: "hasHabitat", label: "Tem como habitat" },
  { value: "coOccursWith", label: "Ocorre junto com" },
  { value: "coRoostsWith", label: "Abriga-se/repousa junto com" },
  { value: "adjacentTo", label: "Vive ao lado de" },
  { value: "interactsWith", label: "Interage com (qualquer tipo de interação)" },
  { value: "ecologicallyRelatedTo", label: "Relacionado ecologicamente com" },
];

export default GLOBI_INTERACTIONS;

// Grupos usados na etapa Ambiente (antes eram 49 caixas soltas).
export const INTERACTION_GROUPS = [
  { key: "feeding", types: ["eats", "eatenBy", "preysOn", "preyedUponBy", "kills", "killedBy", "acquiresNutrientsFrom", "providesNutrientsFor"] },
  { key: "pollination", types: ["pollinates", "pollinatedBy", "visitsFlowersOf", "flowersVisitedBy", "visits", "visitedBy"] },
  { key: "parasitism", types: ["parasiteOf", "hasParasite", "endoparasiteOf", "hasEndoparasite", "ectoparasiteOf", "hasEctoparasite", "parasitoidOf", "hasParasitoid", "hemiparasiteOf", "rootparasiteOf", "hostOf", "hasHost", "pathogenOf", "hasPathogen", "vectorOf", "hasVector"] },
  { key: "mutualism", types: ["symbiontOf", "mutualistOf", "commensalistOf", "epiphyteOf", "hasEpiphyte", "arbuscularMycorrhizalHostOf", "hasArbuscularMycorrhizalHost", "ectomycorrhizalHostOf", "hasEctomycorrhizalHost", "allelopathOf"] },
  { key: "dispersal", types: ["dispersalVectorOf", "hasDispersalVector"] },
  { key: "habitat", types: ["createsHabitatFor", "hasHabitat", "coOccursWith", "coRoostsWith", "adjacentTo"] },
  { key: "general", types: ["interactsWith", "ecologicallyRelatedTo"] },
];

/** Rótulo do tipo de interação: português da lista acima; em inglês, o nome do GloBI legível. */
export function interactionLabel(value, lang) {
  if (lang === "pt") return GLOBI_INTERACTIONS.find((i) => i.value === value)?.label ?? value;
  return value.replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

