import { useEffect, useState } from "react";
import {
  Box, Typography, Select, MenuItem, FormControl, InputLabel,
  Stack, Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress,
} from "@mui/material";
import StepActions from "../../components/StepActions";
import { readSpreadsheetHeaders } from "../../utils/parseSpreadsheetHeaders";

const REQUIRED_FIELDS = [
  { key: "species",   label: "Espécie",          required: true },
  { key: "latitude",  label: "Latitude",         required: true },
  { key: "longitude", label: "Longitude",        required: true },
  { key: "eventDate", label: "Data do registro", required: false },
];

export default function OccurrenceColumnMapping({ selectedSpecies, occurrenceUpload, setOccurrenceUpload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!occurrenceUpload.file || occurrenceUpload.columns.length > 0) return;
    setLoading(true);
    setError(null);
    readSpreadsheetHeaders(occurrenceUpload.file)
      .then(({ columns, preview }) => {
        setOccurrenceUpload((prev) => ({ ...prev, columns, preview }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occurrenceUpload.file]);

  const handleMap = (field) => (event) => {
    setOccurrenceUpload((prev) => ({
      ...prev,
      mapping: { ...prev.mapping, [field]: event.target.value },
    }));
  };

  const missingRequired = REQUIRED_FIELDS
    .filter((f) => f.required)
    .some((f) => !occurrenceUpload.mapping[f.key]);

  if (!occurrenceUpload.file) {
    return (
      <Box>
        <Alert severity="warning">
          Nenhuma planilha foi selecionada. Volte para a etapa anterior e selecione um arquivo.
        </Alert>
        <StepActions backOverride="/occurrences" nextOverride="/occurrences" disableNext />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} color="#555" gutterBottom>
          Mapeamento de Colunas — Ocorrências
        </Typography>
        <Typography variant="body2" sx={{ color: "#333" }}>
          Indique qual coluna da sua planilha ({occurrenceUpload.fileName}) corresponde a cada campo obrigatório.
        </Typography>
      </Box>

      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && (
        <>
          <Stack spacing={2} sx={{ width: "60%", mb: 3 }}>
            {REQUIRED_FIELDS.map(({ key, label, required }) => (
              <FormControl key={key} fullWidth size="small">
                <InputLabel>{label}{required ? " *" : " (opcional)"}</InputLabel>
                <Select
                  value={occurrenceUpload.mapping[key] || ""}
                  label={`${label}${required ? " *" : " (opcional)"}`}
                  onChange={handleMap(key)}
                >
                  <MenuItem value=""><em>Não mapear</em></MenuItem>
                  {occurrenceUpload.columns.map((col) => (
                    <MenuItem key={col} value={col}>{col}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
          </Stack>

          {occurrenceUpload.preview?.length > 0 && (
            <TableContainer component={Paper} sx={{ maxWidth: "100%", mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {occurrenceUpload.columns.map((col) => (
                      <TableCell key={col}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {occurrenceUpload.preview.map((row, i) => (
                    <TableRow key={i}>
                      {occurrenceUpload.columns.map((col) => (
                        <TableCell key={col}>{row[col]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      <StepActions
        selectedSpecies={selectedSpecies}
        backOverride="/occurrences"
        nextOverride="/interactions"
        disableNext={missingRequired}
        disableHint="Mapeie ao menos Espécie, Latitude e Longitude para prosseguir."
      />
    </Box>
  );
}
