import {
  Box, Typography, Alert, Grid, Divider, Accordion,
  AccordionSummary, AccordionDetails, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, LinearProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DownloadIcon from "@mui/icons-material/Download";
import { useEffect, useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import StepActions from "../../components/StepActions";
import LoadingOverlay from "../../components/LoadingOverlay";
import modelApi from "../../services/modelApi";


let BASE_URL = "http://localhost:8000";

export async function initConfig() {
    try {
        const res = await fetch("/api/config");
        const data = await res.json();
        BASE_URL = `http://localhost:${data.port}`;
    } catch (e) {
        console.warn("Usando porta padrão 8000");
    }
}

export function getBaseURL() {
    return BASE_URL;
}

const MODEL_LABELS = {
  maxent: "MaxEnt",
  gam: "GAM",
  random_forest: "Random Forest",
  svm: "SVM",
  brt: "BRT",
};

const METRIC_LABELS = { auc: "AUC", tss: "TSS", boyce: "Boyce Index" };
const METRIC_COLOR  = { auc: "#4caf50", tss: "#2196f3", boyce: "#ff9800" };

/**
 * Normaliza a resposta da API para o formato { [species]: { [model]: modelData } }.
 *
 * Suporta dois formatos vindos do backend:
 *   - Uma espécie:  { random_forest: {...}, maxent: {...} }
 *   - N espécies:   { "random_forest::Espécie A": {...}, "maxent::Espécie A": {...}, "maxent::Espécie B": {...} }
 */
function normalizeMaps(raw) {
  if (!raw || typeof raw !== "object") return {};

  const hasNamespace = Object.keys(raw).some((k) => k.includes("::"));

  if (!hasNamespace) {
    // Caso de espécie única — agrupa tudo sob a chave "_single_"
    // que será substituída pelo nome real da espécie se disponível
    return { _single_: raw };
  }

  // Caso multi-espécie: "model::species" → { species: { model: data } }
  const grouped = {};
  for (const [key, data] of Object.entries(raw)) {
    const separatorIndex = key.indexOf("::");
    const model   = key.slice(0, separatorIndex);
    const species = key.slice(separatorIndex + 2);
    if (!grouped[species]) grouped[species] = {};
    grouped[species][model] = data;
  }
  return grouped;
}

const LOADING_MESSAGES = [
  "Preparando os dados para modelagem...",
  "Treinando os modelos de distribuição...",
  "Avaliando as métricas de performance...",
  "Gerando os mapas de adequabilidade...",
  "Quase pronto! Compilando os resultados...",
];

function MetricsChart({ metrics }) {
  if (!metrics || !Object.keys(metrics).length) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: "#999" }}>
        <Typography variant="body2">Nenhuma métrica disponível.</Typography>
      </Box>
    );
  }

  const data = Object.entries(metrics)
    .filter(([, v]) => v != null)
    .map(([key, value]) => ({
      name: METRIC_LABELS[key] ?? key,
      value: parseFloat(value.toFixed(4)),
      key,
    }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v) => v.toFixed(4)} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={METRIC_COLOR[entry.key] ?? "#7c3aed"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function exportToCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
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

function VariableImportanceTable({ variableImportance }) {
  if (!variableImportance || !Object.keys(variableImportance).length) return null;

  const sorted = Object.entries(variableImportance)
    .filter(([, v]) => v != null)
    .map(([variable, importance]) => ({ variable, importance: parseFloat(importance) }))
    .sort((a, b) => b.importance - a.importance);

  const max = sorted[0]?.importance ?? 1;

  return (
    <Box sx={{ mt: 2, border: "1px solid #ddd", borderRadius: 2, overflow: "hidden" }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid #ddd", backgroundColor: "#f9f9f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Importância das Variáveis
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => exportToCSV(sorted, "importancia_variaveis.csv")}
        >
          Exportar CSV
        </Button>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#444" }}>Variável</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#444" }}>Importância</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#444", minWidth: 160 }}>Contribuição Relativa</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map(({ variable, importance }, idx) => {
              const pct = (importance / max) * 100;
              const barColor = idx === 0 ? "#7c3aed" : idx === 1 ? "#2196f3" : idx === 2 ? "#4caf50" : "#90a4ae";
              return (
                <TableRow
                  key={variable}
                  sx={{
                    "&:nth-of-type(odd)": { backgroundColor: "#fafafa" },
                    "&:hover": { backgroundColor: "#f0f0ff" },
                    transition: "background 0.15s",
                  }}
                >
                  <TableCell sx={{ fontSize: "0.8rem", fontFamily: "monospace", color: "#333" }}>
                    {variable}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#111" }}>
                    {importance.toFixed(4)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          flex: 1,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#e0e0e0",
                          "& .MuiLinearProgress-bar": {
                            backgroundColor: barColor,
                            borderRadius: 4,
                          },
                        }}
                      />
                      <Typography variant="caption" sx={{ minWidth: 36, color: "#666" }}>
                        {pct.toFixed(1)}%
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

/** Accordion interno: um modelo dentro de uma espécie */
function ModelAccordion({ model, modelData, index }) {
  const path          = modelData?.path ?? modelData;
  const metrics       = modelData?.metrics ?? {};
  const label         = MODEL_LABELS[model] ?? model;
  const hasMetrics    = Object.keys(metrics).length > 0;
  const varImportance = modelData?.variable_importance ?? modelData?.variableImportance ?? {};

  return (
    <Accordion
      key={model}
      defaultExpanded={index === 0}
      disableGutters
      sx={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px !important",
        mb: 1,
        "&:before": { display: "none" },
        boxShadow: "none",
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography fontWeight={600} fontSize="0.95rem">{label}</Typography>
          {hasMetrics &&
            Object.entries(metrics).map(([key, value]) =>
              value != null ? (
                <Chip
                  key={key}
                  label={`${METRIC_LABELS[key] ?? key}: ${value.toFixed(3)}`}
                  size="small"
                  sx={{
                    backgroundColor: METRIC_COLOR[key] ?? "#7c3aed",
                    color: "#fff",
                    fontWeight: 600,
                  }}
                />
              ) : null
            )}
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0 }}>
        <Grid container spacing={2} alignItems="stretch" sx={{ mb: 0 }}>
          {/* Mapa */}
          <Grid item xs={12} md={8}>
            {path ? (
              <Box
                component="img"
                src={`${getBaseURL()}/${path.replace(/\\/g, "/")}`}
                alt={`Mapa ${label}`}
                sx={{
                  width: "100%",
                  maxHeight: 360,
                  borderRadius: 2,
                  border: "1px solid #ddd",
                  display: "block",
                  objectFit: "contain",
                  objectPosition: "center",
                }}
              />
            ) : (
              <Box
                sx={{
                  p: 4, textAlign: "center", border: "1px solid #ddd",
                  borderRadius: 2, color: "#999", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  minHeight: 260,
                }}
              >
                <Typography variant="body2">Mapa não disponível para este modelo.</Typography>
              </Box>
            )}
          </Grid>

          {/* Métricas */}
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                border: "1px solid #ddd", borderRadius: 2, p: 2,
                height: "100%", display: "flex", flexDirection: "column",
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Métricas de Avaliação
              </Typography>
              <MetricsChart metrics={metrics} />
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {Object.entries(metrics).map(([key, value]) =>
                  value != null ? (
                    <Box key={key} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" sx={{ color: "#555", fontSize: "0.8rem" }}>
                        {METRIC_LABELS[key] ?? key}
                      </Typography>
                      <Chip
                        label={value.toFixed(4)}
                        size="small"
                        sx={{
                          backgroundColor: METRIC_COLOR[key] ?? "#7c3aed",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          height: 22,
                        }}
                      />
                    </Box>
                  ) : null
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>

        <VariableImportanceTable variableImportance={varImportance} />
      </AccordionDetails>
    </Accordion>
  );
}

/** Accordion externo: uma espécie */
function SpeciesAccordion({ species, modelsMap, index }) {
  const modelEntries = Object.entries(modelsMap ?? {});

  // Coleta melhor AUC entre os modelos para exibir no header da espécie
  const bestAuc = modelEntries.reduce((best, [, md]) => {
    const auc = md?.metrics?.auc ?? null;
    return auc != null && (best === null || auc > best) ? auc : best;
  }, null);

  return (
    <Accordion
      defaultExpanded={index === 0}
      disableGutters
      sx={{
        border: "1px solid #c8b8f0",
        borderRadius: "12px !important",
        mb: 2,
        "&:before": { display: "none" },
        boxShadow: "0 2px 8px rgba(124,58,237,0.07)",
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          backgroundColor: "#f5f0ff",
          borderRadius: "12px 12px 0 0",
          minHeight: 56,
          "&.Mui-expanded": { borderRadius: index === 0 ? "12px 12px 0 0" : "12px 12px 0 0" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography fontWeight={700} fontSize="1rem" sx={{ color: "#4a148c", fontStyle: "italic" }}>
            {species}
          </Typography>
          <Chip
            label={`${modelEntries.length} modelo${modelEntries.length !== 1 ? "s" : ""}`}
            size="small"
            sx={{ backgroundColor: "#7c3aed", color: "#fff", fontWeight: 600 }}
          />
          {bestAuc !== null && (
            <Chip
              label={`Melhor AUC: ${bestAuc.toFixed(3)}`}
              size="small"
              sx={{ backgroundColor: "#4caf50", color: "#fff", fontWeight: 600 }}
            />
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ p: 2 }}>
        {modelEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhum modelo disponível para esta espécie.
          </Typography>
        ) : (
          modelEntries.map(([model, modelData], modelIndex) => (
            <ModelAccordion
              key={model}
              model={model}
              modelData={modelData}
              index={modelIndex}
            />
          ))
        )}
      </AccordionDetails>
    </Accordion>
  );
}

export default function ModelResults({
  selectedSpecies,
  interactionData,
  finalData,
  modelsData,
  place,
  geeProject
}) {
  const [loading, setLoading] = useState(false);
  const [maps,    setMaps]    = useState({});
  const [error,   setError]   = useState(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (Object.keys(maps).length > 0) return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    setLoading(true);
    console.log("finalData")
    console.log(finalData)
    modelApi
      .runModels({
        finalData,
        interactionData,
        selectedSpecies,
        country: place.country,
        points: place.points,
        modelsData,
        geeProject
      })
      .then((result) => {
        setMaps(result?.maps ?? result ?? {});
      })
      .catch((err) => {
        console.error("Erro ao executar modelos:", err);
        setError(err.message ?? "Erro desconhecido");
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom color="#555">
            Executando Modelos
          </Typography>
          <Typography variant="body2" sx={{ color: "#333" }}>
            Modelagem de distribuição de espécies em andamento. Este processo pode demorar.
          </Typography>
        </Box>
        <LoadingOverlay messages={LOADING_MESSAGES} interval={4000} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        <StepActions selectedSpecies={selectedSpecies} />
      </Box>
    );
  }

  const normalized = normalizeMaps(maps);

  // selectedSpecies pode ser array de strings ou de objetos {key, name}
  const resolveSpeciesName = (item) =>
    typeof item === "string" ? item : (item?.name ?? item?.key ?? "Espécie");

  // Se só há uma espécie sem namespace, usa o nome real de selectedSpecies[0]
  const speciesEntries = Object.entries(normalized).map(([species, modelsMap]) => [
    species === "_single_" ? resolveSpeciesName(selectedSpecies?.[0]) : species,
    modelsMap,
  ]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Resultados dos Modelos
        </Typography>
        <Typography variant="body2" sx={{ color: "#333" }}>
          Resultados para as {selectedSpecies?.length} espécie(s) selecionada(s).
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {speciesEntries.map(([species, modelsMap], index) => (
          <SpeciesAccordion
            key={species}
            species={species}
            modelsMap={modelsMap}
            index={index}
          />
        ))}
      </Box>

      <Box sx={{ mt: 3 }}>
        <StepActions selectedSpecies={selectedSpecies} />
      </Box>
    </Box>
  );
}
