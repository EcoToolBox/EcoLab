import { Box, Typography, Alert, Button } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useEffect, useState, useRef } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import StepActions from "../../components/StepActions";
import LoadingOverlay from "../../components/LoadingOverlay";
import interactionApi from "../../services/interactionApi";
import environmentApi from "../../services/environmentApi";

const PHASE_MESSAGES = {
  interactions: [
    "Consultando o Global Biotic Interactions (GloBI)...",
    "Buscando interações bióticas para as espécies selecionadas...",
    "Percorrendo o grafo de interações ecológicas...",
  ],
  environment: [
    "Coletando variáveis ambientais das ocorrências...",
    "Consultando fontes de dados ambientais...",
    "Processando índices de vegetação e clima...",
    "Quase lá! Calculando as variáveis ambientais...",
  ],
  joining: [
    "Cruzando ocorrências com dados das espécies interatoras...",
    "Montando a tabela final de presença/ausência...",
    "Finalizando a integração dos dados...",
  ],
};

function buildColumns(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0])
    .filter((k) => k !== "id")
    .map((k) => ({ field: k, headerName: k, flex: 1, minWidth: 150 }));
}

function withId(data) {
  return data.map((row, i) => ({ id: i, ...row }));
}

function parseResult(result) {
  if (Array.isArray(result)) return result;
  if (result?.msg && Array.isArray(result.msg)) return result.msg;
  return Object.values(result ?? {});
}

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

export default function EnvResult({
  selectedSpecies,
  occurrenceData,
  setOccurrenceData,
  interactionConfig,
  setInteractionData,
  selectedEnv,
  finalData,
  setFinalData,
}) {
  const [phase, setPhase] = useState(null);
  const [error, setError] = useState(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    try {
      let fetchedInteractions = [];
      if (!interactionConfig.skip && interactionConfig.selectedInteractions.length > 0) {
        setPhase("interactions");
        const result = await interactionApi.searchInteractions({
          species: selectedSpecies,
          interaction_type: [...interactionConfig.selectedInteractions],
          depth: interactionConfig.depth,
        });
        fetchedInteractions = withId(parseResult(result));
        setInteractionData(fetchedInteractions);
      }

      let enrichedOccurrences = occurrenceData;
      if (selectedEnv.length > 0) {
        setPhase("environment");
        const result = await environmentApi.getEnvVariables({
          data: occurrenceData,
          index: selectedEnv,
        });
        enrichedOccurrences = withId(parseResult(result));
        setOccurrenceData(enrichedOccurrences);
      }

      setPhase("joining");
      if (!interactionConfig.skip) {
        const result = await interactionApi.searchInteractionOccurrence({
          occurrence: enrichedOccurrences,
          interactions: fetchedInteractions,
          selectedSpecies,
        });
        const final = withId(parseResult(result));
        setFinalData(final);
      } else {
        setFinalData(enrichedOccurrences);
      }

      setPhase("done");
    } catch (err) {
      console.error("Erro na etapa de dados:", err);
      setError(err.message ?? "Erro desconhecido");
      setPhase("done");
    }
  }

  if (phase && phase !== "done") {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom color="#333">
            Coletando Dados
          </Typography>
          <Typography variant="body2" sx={{ color: "#555" }}>
            Por favor aguarde. Este processo pode demorar alguns minutos.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap", color: "#333" }}>
          {[
            { key: "interactions", label: "Interações" },
            { key: "environment",  label: "Variáveis Ambientais" },
            { key: "joining",      label: "Tabela Final" },
          ].map(({ key, label }) => {
            const phases = ["interactions", "environment", "joining"];
            const currentIdx = phases.indexOf(phase);
            const stepIdx    = phases.indexOf(key);
            const isDone     = stepIdx < currentIdx;
            const isActive   = key === phase;
            return (
              <Box
                key={key}
                sx={{
                  fontFamily: "monospace",
                  px: 2, py: 0.5, borderRadius: 4, fontSize: "0.78rem", fontWeight: 600,
                  bgcolor: isActive ? "#D95204"
                         : isDone  ? "rgba(106,154,42,0.3)"
                         :           "rgba(188, 188, 188, 0.74)",
                  color: isActive ? "#dbd7d7e8"
                       : isDone   ? "#a3d45e"
                       :            "#716d6d",
                }}
              >
                {isDone ? "✓ " : ""}{label}
              </Box>
            );
          })}
        </Box>

        <LoadingOverlay sx={{ color: "#333" }} messages={PHASE_MESSAGES[phase] ?? ["Processando..."]} />
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

  const columns = buildColumns(finalData);

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom color="#555">
            Ocorrências com dados ambientais
          </Typography>
          <Typography variant="body2" sx={{ color: "#333" }}>
            Presença/ausência das espécies interatoras nas coordenadas de ocorrência da espécie alvo.
            {finalData.length > 0 && ` ${finalData.length} registros encontrados.`}
          </Typography>
        </Box>
        {finalData.length > 0 && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => exportToCSV(finalData, "ocorrencias_ambientais.csv")}
          >
            Exportar CSV
          </Button>
        )}
      </Box>

      {finalData.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Nenhum dado foi encontrado. Verifique as configurações e tente novamente.
        </Alert>
      ) : (
        <Box sx={{ height: 500, width: "100%", mb: 2 }}>
          <DataGrid rows={finalData} columns={columns} />
        </Box>
      )}

      <StepActions selectedSpecies={selectedSpecies} />
    </Box>
  );
}
