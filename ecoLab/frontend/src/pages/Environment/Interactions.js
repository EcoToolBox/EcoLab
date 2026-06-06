import {
  Box, Typography, Checkbox, FormControlLabel, FormGroup,
  TextField, Alert, Button, CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useState, useEffect } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import StepActions from "../../components/StepActions";
import LoadingOverlay from "../../components/LoadingOverlay";
import interactionApi from "../../services/interactionApi";
import GLOBI_INTERACTIONS from "../../constants/interactions";

const LOADING_MESSAGES = [
  "Consultando o Global Biotic Interactions (GloBI)...",
  "Buscando interações bióticas para as espécies selecionadas...",
  "Percorrendo o grafo de interações...",
  "Quase lá! Montando os resultados...",
];

function exportToCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]).filter((k) => k !== "id");
  const header = keys.join(",");
  const body = rows.map((row) =>
    keys.map((k) => {
      const val = row[k] ?? "";
      return typeof val === "string" && (val.includes(",") || val.includes('"'))
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(",")
  );
  const csv = [header, ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Config-only view (questionnaire step) ────────────────────────────────────
function InteractionsConfig({ selectedSpecies, interactionConfig, setInteractionConfig }) {
  const { selectedInteractions, depth, skip } = interactionConfig;

  const allValues = GLOBI_INTERACTIONS.map((i) => i.value);
  const allSelected = allValues.every((v) => selectedInteractions.includes(v));
  const someSelected = allValues.some((v) => selectedInteractions.includes(v)) && !allSelected;

  const handleSelectAll = (checked) => {
    setInteractionConfig((prev) => ({
      ...prev,
      selectedInteractions: checked ? allValues : [],
    }));
  };

  const handleInteractionChange = (event) => {
    const { name, checked } = event.target;
    setInteractionConfig((prev) => ({
      ...prev,
      selectedInteractions: checked
        ? [...prev.selectedInteractions, name]
        : prev.selectedInteractions.filter((i) => i !== name),
    }));
  };

  const handleDepthChange = (event) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 1) {
      setInteractionConfig((prev) => ({ ...prev, depth: value }));
    }
  };

  const handleSkip = (checked) => {
    setInteractionConfig((prev) => ({ ...prev, skip: checked }));
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Interações Bióticas (GloBI)
      </Typography>
      <Typography variant="body2" sx={{ color: "#333", mb: 2 }}>
        Selecione os tipos de interação a serem buscados no Global Biotic Interactions.
        A busca será realizada automaticamente na etapa de coleta de dados.
      </Typography>

      <FormControlLabel
        sx={{ mb: 2 }}
        control={
          <Checkbox
            checked={skip}
            onChange={(e) => handleSkip(e.target.checked)}
          />
        }
        label={<Typography sx={{ color: "#555" }}>Pular busca de interações</Typography>}
      />

      {!skip && (
        <>
          {/* Selecionar todos */}
          <FormControlLabel
            sx={{ mb: 1 }}
            control={
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: "#333", fontWeight: 600 }}>
                Selecionar todas as interações
              </Typography>
            }
          />

          <FormGroup sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, mb: 3 }}>
            {GLOBI_INTERACTIONS.map((interaction) => (
              <FormControlLabel
                key={interaction.value}
                control={
                  <Checkbox
                    name={interaction.value}
                    checked={selectedInteractions.includes(interaction.value)}
                    onChange={handleInteractionChange}
                    size="small"
                  />
                }
                label={
                  <Typography style={{ color: "#555" }} variant="body2">
                    {interaction.label}
                  </Typography>
                }
              />
            ))}
          </FormGroup>

          <Box sx={{ maxWidth: 300, mb: 2 }}>
            <TextField
              label="Profundidade da busca"
              type="number"
              value={depth}
              onChange={handleDepthChange}
              inputProps={{ min: 1 }}
              fullWidth
              helperText="Valores maiores retornam interações indiretas. Acima de 3 pode causar lentidão."
            />
            {depth > 3 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Profundidade maior que 3 pode causar lentidão e travamento.
              </Alert>
            )}
          </Box>
        </>
      )}

      <StepActions
        selectedSpecies={selectedSpecies}
        disableNext={!skip && selectedInteractions.length === 0}
        disableHint="Selecione ao menos um tipo de interação ou marque 'Pular'."
      />
    </Box>
  );
}

// ─── Data-fetching view (results step — called from EnvResult) ────────────────
export function InteractionsFetch({ selectedSpecies, interactionConfig, setInteractionData }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [rows, setRows]       = useState([]);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (interactionConfig.skip) {
      setInteractionData([]);
      setDone(true);
      return;
    }
    if (!interactionConfig.selectedInteractions.length) return;

    setLoading(true);
    interactionApi
      .searchInteractions({
        species: selectedSpecies,
        interaction_type: [...interactionConfig.selectedInteractions],
        depth: interactionConfig.depth,
      })
      .then((result) => {
        const data = Array.isArray(result) ? result : Object.values(result ?? {});
        const withId = data.map((row, i) => ({ id: i, ...row }));
        setRows(withId);
        setInteractionData(withId);
        setDone(true);
      })
      .catch((err) => {
        console.error("Erro ao buscar interações:", err);
        setError(err.message ?? "Erro desconhecido");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoadingOverlay messages={LOADING_MESSAGES} />;
  if (error)   return <Alert severity="error">Erro: {error}</Alert>;
  if (!done)   return null;

  if (interactionConfig.skip || rows.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Nenhuma interação carregada.
      </Alert>
    );
  }

  const columns = Object.keys(rows[0])
    .filter((k) => k !== "id")
    .map((k) => ({ field: k, headerName: k, flex: 1, minWidth: 150 }));

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Interações encontradas ({rows.length} registros)
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => exportToCSV(rows, "interacoes.csv")}
        >
          Exportar CSV
        </Button>
      </Box>
      <Box sx={{ height: 400, width: "100%" }}>
        <DataGrid rows={rows} columns={columns} />
      </Box>
    </Box>
  );
}

// ─── Default export: config step ─────────────────────────────────────────────
export default function Interactions(props) {
  return <InteractionsConfig {...props} />;
}
