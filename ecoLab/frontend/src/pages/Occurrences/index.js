import { Box, Typography, Divider} from "@mui/material";
import StepActions from "../../components/StepActions";
import { useState, useEffect} from "react";
import PlaceCountryOrMap from "./Place";
import SourcesCheckBox from "./Sources";
import YearSlider from "./Year";
import occurrenceApi from "../../services/occurrenceApi";

export default function Occurrences({ selectedSpecies, setSelectedSpecies, selectedSources, setSelectedSources, sourceConfig, setSourceConfig, place, setPlace, years, setYears }) {
  
  const disable = () => {
    if(selectedSources.length == 0) return true;
    if (selectedSources.includes("gbif") && (sourceConfig.gbif.apiKey=="")) return true;
    if (selectedSources.includes("specieslink") && (sourceConfig.specieslink.apiKey=="")) return true;
    return false;
  }

    useEffect(() => {
    if (!selectedSpecies || selectedSpecies.length === 0) {
      const cached = localStorage.getItem("Selected Species");

      if (cached) {
        try {
          setSelectedSpecies(JSON.parse(cached));
        } catch {
          setSelectedSpecies([]);
        }
      }
    }
  }, [selectedSpecies]);



  return (
    <Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Filtros
        </Typography>
        <Typography variant="body2" sx={{ color: "#333" }}>
          Configure os filtros para a busca de ocorrências das {selectedSpecies.length} espécie(s) selecionada(s).
        </Typography>
      </Box>
      <Box sx={{ width: "70%"}}>
        <SourcesCheckBox selectedSources={selectedSources} setSelectedSources={setSelectedSources} sourceConfig={sourceConfig} setSourceConfig={setSourceConfig} />
        <Divider sx={{ my: 2, opacity: 0.6 }} />
        <YearSlider value={years} setValue={setYears} />
        <Divider sx={{ my: 2, opacity: 0.6 }} />
        <PlaceCountryOrMap value={place} setValue={setPlace} />
        <Typography sx={{ mb: 1, color: "#555" }}>
        {place.points}
      </Typography>
      </Box>
      <StepActions 
        selectedSpecies={selectedSpecies} 
        disableNext={disable()} 
        disableHint="Selecione ao menos uma fonte de dados (e as credenciais necessárias) para prosseguir."
      />
    </Box>
  );
}
