import { Box, Typography, CircularProgress } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useEffect, useState } from "react";
import StepActions from "../../components/StepActions";
import occurrenceApi from "../../services/occurrenceApi";

export default function Results({ selectedSpecies, setSelectedSpecies, selectedSources, setSelectedSources, sourceConfig, setSourceConfig, place, setPlace, years, setYears}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
    const sendData = async(event) => {
      if(selectedSources.includes("gbif")){
        occurrenceApi.authenticateGbif(sourceConfig.gbif).then((res) => {
          if(res.success) {
            console.log("GBIF authentication successful");
          }
          else{
            console.error("GBIF authentication failed:", res);
          }
        });
    }
    if(selectedSources.includes("specieslink")){
       occurrenceApi.authenticateSpeciesLink(sourceConfig.specieslink).then((res) => {
          if(res.success) {
            console.log("SpeciesLink authentication successful");
          } 
        });
    }
    
    occurrenceApi.getOccurrences(
      selectedSources,
      selectedSpecies,
      place.country,
      years,
      place.points
    )

  };
  useEffect(() => {
    setLoading(true);
    async function fetchData() {
      try {
        const result = await sendData();

        const withId = result.map((row, index) => ({
          id: row.id || index,
          ...row,
        }));

        setRows(withId);
        setLoading(false);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedSpecies]);

  if (loading) {
    return (
      <Box sx={{ height: "60vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // gera colunas automaticamente baseado no JSON
  const columns =
    rows.length > 0
      ? Object.keys(rows[0]).map((key) => ({
          field: key,
          headerName: key,
          flex: 1,
        }))
      : [];

  return (
    <Box>
        <Box sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight={600} gutterBottom>
            Resultados
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>
            Ocorrências encontradas para as {selectedSpecies.length} espécie(s) selecionada(s).
            </Typography>
        </Box>

        <Box sx={{ height: 500, width: "100%" }}>
            <DataGrid rows={rows} columns={columns} />
        </Box>
      <StepActions selectedSpecies={selectedSpecies} />
    </Box>
  );
}