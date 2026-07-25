import { useEffect, useState } from "react";
import {
  Box, Typography, Select, MenuItem, FormControl, InputLabel,
  Stack, Alert, Checkbox, TextField, CircularProgress, Divider,
} from "@mui/material";
import StepActions from "../../components/StepActions";
import { readSpreadsheetHeaders } from "../../utils/parseSpreadsheetHeaders";

export default function EnvColumnMapping({ selectedSpecies, envUpload, setEnvUpload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!envUpload.file || envUpload.columns.length > 0) return;
    setLoading(true);
    setError(null);
    readSpreadsheetHeaders(envUpload.file)
      .then(({ columns }) => {
        setEnvUpload((prev) => ({
          ...prev,
          columns,
          variables: columns
            .filter((c) => c !== prev.mapping.latitude && c !== prev.mapping.longitude)
            .map((c) => ({ column: c, name: c, selected: false })),
        }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envUpload.file]);

  const handleCoordMap = (field) => (event) => {
    const column = event.target.value;
    setEnvUpload((prev) => ({
      ...prev,
      mapping: { ...prev.mapping, [field]: column },
      variables: prev.variables.filter((v) => v.column !== column),
    }));
  };

  const toggleVariable = (column) => (event) => {
    const checked = event.target.checked;
    setEnvUpload((prev) => ({
      ...prev,
      variables: prev.variables.map((v) =>
        v.column === column ? { ...v, selected: checked } : v
      ),
    }));
  };

  const renameVariable = (column) => (event) => {
    const name = event.target.value;
    setEnvUpload((prev) => ({
      ...prev,
      variables: prev.variables.map((v) =>
        v.column === column ? { ...v, name } : v
      ),
    }));
  };

  if (!envUpload.file) {
    return (
      <Box>
        <Alert severity="warning">
          Nenhuma planilha foi selecionada. Volte para a etapa anterior e selecione um arquivo.
        </Alert>
        <StepActions backOverride="/environment" nextOverride="/environment" disableNext />
      </Box>
    );
  }

  const selectedVariables = envUpload.variables.filter((v) => v.selected);
  const hasEmptyName = selectedVariables.some((v) => !v.name.trim());
  const missingRequired =
    !envUpload.mapping.latitude ||
    !envUpload.mapping.longitude ||
    selectedVariables.length === 0 ||
    hasEmptyName;

  const availableColumns = envUpload.columns.filter(
    (c) => c !== envUpload.mapping.latitude && c !== envUpload.mapping.longitude
  );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} color="#555" gutterBottom>
          Mapeamento de Colunas — Variáveis Ambientais
        </Typography>
        <Typography variant="body2" sx={{ color: "#333" }}>
          Indique a latitude e a longitude, e selecione quais colunas representam variáveis
          ambientais na planilha ({envUpload.fileName}). Os nomes dados serão usados nos modelos.
        </Typography>
      </Box>

      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && (
        <>
          <Stack direction="row" spacing={2} sx={{ width: "70%", mb: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Latitude *</InputLabel>
              <Select
                value={envUpload.mapping.latitude || ""}
                label="Latitude *"
                onChange={handleCoordMap("latitude")}
              >
                <MenuItem value=""><em>Não mapear</em></MenuItem>
                {envUpload.columns.map((col) => (
                  <MenuItem key={col} value={col}>{col}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Longitude *</InputLabel>
              <Select
                value={envUpload.mapping.longitude || ""}
                label="Longitude *"
                onChange={handleCoordMap("longitude")}
              >
                <MenuItem value=""><em>Não mapear</em></MenuItem>
                {envUpload.columns.map((col) => (
                  <MenuItem key={col} value={col}>{col}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Divider sx={{ mb: 2, opacity: 0.6 }} />

          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: "#333" }}>
            Selecione e nomeie as variáveis ambientais
          </Typography>

          <Stack spacing={1.5} sx={{ width: "85%" }}>
            {availableColumns.map((col) => {
              const variable = envUpload.variables.find((v) => v.column === col);
              return (
                <Stack key={col} direction="row" spacing={2} alignItems="center">
                  <Checkbox
                    checked={!!variable?.selected}
                    onChange={toggleVariable(col)}
                  />
                  <Typography sx={{ minWidth: 160, color: "#333" }}>{col}</Typography>
                  <TextField
                    size="small"
                    label="Nome da variável"
                    value={variable?.name ?? col}
                    onChange={renameVariable(col)}
                    disabled={!variable?.selected}
                    sx={{ minWidth: 240 }}
                  />
                </Stack>
              );
            })}
          </Stack>
        </>
      )}

      <StepActions
        selectedSpecies={selectedSpecies}
        backOverride="/environment"
        nextOverride="/models"
        disableNext={missingRequired}
        disableHint="Mapeie latitude, longitude e nomeie ao menos uma variável ambiental para prosseguir."
      />
    </Box>
  );
}
