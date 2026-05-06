import { Box, Typography, Alert } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useEffect, useState, useRef } from "react";
import StepActions from "../../components/StepActions";
import LoadingOverlay from "../../components/LoadingOverlay";
import occurrenceApi from "../../services/occurrenceApi";

const LOADING_MESSAGES = [
  "Autenticando nas fontes de dados...",
  "Buscando ocorrências no GBIF...",
  "Buscando ocorrências no iNaturalist...",
  "Buscando ocorrências no SpeciesLink...",
  "Consolidando os registros encontrados...",
  "Quase lá! Organizando os dados de ocorrência...",
];

function withId(data) {
  return data.map((row, i) => ({ id: i, ...row }));
}

export default function OccurrenceResults({
  selectedSpecies,
  selectedSources,
  sourceConfig,
  place,
  years,
  occurrenceData,
  setOccurrenceData,
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    // If we already have data (navigating back), skip refetch
    if (occurrenceData.length > 0) return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      // Authenticate sources that need credentials
      const authPromises = [];
      if (selectedSources.includes("gbif") && !sourceConfig.gbif.alreadyExists) {
        authPromises.push(
          occurrenceApi.authenticateGbif(sourceConfig.gbif).then((res) => {
            if (!res?.success) console.warn("GBIF authentication issue:", res);
          })
        );
      }
      if (selectedSources.includes("specieslink") && !sourceConfig.specieslink.alreadyExists) {
        authPromises.push(
          occurrenceApi.authenticateSpeciesLink(sourceConfig.specieslink).then((res) => {
            if (!res?.success) console.warn("SpeciesLink authentication issue:", res);
          })
        );
      }
      await Promise.all(authPromises);

      const result = await occurrenceApi.getOccurrences(
        selectedSources,
        selectedSpecies,
        place.country,
        years,
        place.points
      );

      const raw = result?.msg ?? result ?? result?.results ?? [];
      const data = Array.isArray(raw) ? raw : Object.values(raw);
      setOccurrenceData(withId(data));
    } catch (err) {
      console.error("Erro ao buscar ocorrências:", err);
      setError(err.message ?? "Erro desconhecido ao buscar ocorrências.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" color="#555" fontWeight={600} gutterBottom>
            Buscando Ocorrências
          </Typography>
          <Typography variant="body2" sx={{ color: "#333" }}>
            Consultando as fontes selecionadas para as {selectedSpecies.length} espécie(s).
            Isso pode levar alguns minutos.
          </Typography>
        </Box>
        <LoadingOverlay messages={LOADING_MESSAGES} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <StepActions selectedSpecies={selectedSpecies} />
      </Box>
    );
  }

  const columns =
    occurrenceData.length > 0
      ? Object.keys(occurrenceData[0])
          .filter((k) => k !== "id")
          .map((k) => ({ field: k, headerName: k, flex: 1, minWidth: 150 }))
      : [];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom color="#555">
          Ocorrências Encontradas
        </Typography>
        <Typography variant="body2" sx={{ color: "#333" }}>
          {occurrenceData.length > 0
            ? `${occurrenceData.length} registros encontrados para ${selectedSpecies.length} espécie(s).`
            : `Nenhuma ocorrência encontrada para os filtros selecionados.`}
        </Typography>
      </Box>

      {occurrenceData.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Nenhuma ocorrência encontrada. Tente ajustar os filtros de busca.
        </Alert>
      ) : (
        <Box sx={{ height: 500, width: "100%" }}>
          <DataGrid rows={occurrenceData} columns={columns} />
        </Box>
      )}

      <StepActions selectedSpecies={selectedSpecies} />
    </Box>
  );
}
