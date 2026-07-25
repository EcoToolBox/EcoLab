import { Box, Typography, Divider, Alert } from "@mui/material";
import StepActions from "../../components/StepActions";
import { useEffect } from "react";
import SourcesCheckBox from "./Sources";
import YearSlider from "./Year";
import PlaceCountryOrMap from "./Place";

export default function Occurrences({
  selectedSpecies,
  setSelectedSpecies,
  selectedSources,
  setSelectedSources,
  sourceConfig,
  setSourceConfig,
  place,
  setPlace,
  years,
  setYears,
  occurrenceMode,
  setOccurrenceMode,
  occurrenceUpload,
  setOccurrenceUpload,
}) {
  // Restore species from localStorage if state was lost (e.g. page refresh)
  useEffect(() => {
    if (selectedSpecies.length > 0) return;
    try {
      const cached = localStorage.getItem("Selected Species");
      if (cached) setSelectedSpecies(JSON.parse(cached));
    } catch {
      // ignore malformed cache
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usesSources = occurrenceMode === "sources" || occurrenceMode === "both";
  const usesUpload = occurrenceMode === "upload" || occurrenceMode === "both";

  const disable = () => {
    if (usesSources) {
      if (selectedSources.length === 0) return true;
      if (
        selectedSources.includes("gbif") &&
        !sourceConfig.gbif.alreadyExists &&
        (sourceConfig.gbif.apiKey === "" ||
          sourceConfig.gbif.email === "" ||
          sourceConfig.gbif.userId === "")
      )
        return true;
      if (
        selectedSources.includes("specieslink") &&
        !sourceConfig.specieslink.alreadyExists &&
        sourceConfig.specieslink.apiKey === ""
      )
        return true;
      if (!place.country && !place.map)
        return true;
    }
    if (usesUpload && !occurrenceUpload.file) return true;
    return false;
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} color="#555" gutterBottom>
          Filtros de Busca
        </Typography>
        <Typography variant="body2" sx={{ color: "#333" }}>
          Configure os filtros para a busca de ocorrências das {selectedSpecies.length}{" "}
          espécie(s) selecionada(s).
        </Typography>
      </Box>

      <Box sx={{ width: "70%" }}>
        <SourcesCheckBox
          selectedSources={selectedSources}
          setSelectedSources={setSelectedSources}
          sourceConfig={sourceConfig}
          setSourceConfig={setSourceConfig}
          occurrenceMode={occurrenceMode}
          setOccurrenceMode={setOccurrenceMode}
          occurrenceUpload={occurrenceUpload}
          setOccurrenceUpload={setOccurrenceUpload}
        />
        {usesSources && (
          <>
            <Divider sx={{ my: 2, opacity: 0.6 }} />
            <PlaceCountryOrMap value={place} setValue={setPlace} />
            <Divider sx={{ my: 2, opacity: 0.6 }} />
            <YearSlider value={years} setValue={setYears} />
            <Divider sx={{ my: 2, opacity: 0.6 }} />
            {!place.country && !place.map && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Selecione o país na coluna à esquerda, junto da seleção de espécies.
              </Alert>
            )}
          </>
        )}
      </Box>

      <StepActions
        selectedSpecies={selectedSpecies}
        disableNext={disable()}
        disableHint={
          usesUpload && !occurrenceUpload.file
            ? "Selecione uma planilha com os dados de ocorrência para prosseguir."
            : "Selecione ao menos uma fonte de dados (e as credenciais necessárias) para prosseguir."
        }
        nextOverride={usesUpload ? "/occurrence-mapping" : undefined}
      />
    </Box>
  );
}
