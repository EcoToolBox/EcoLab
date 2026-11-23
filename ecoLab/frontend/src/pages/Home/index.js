import { useRef, useState } from "react";
import { Box, Button, Typography, Paper, Stack, Alert } from "@mui/material";
import PlaceIcon from "@mui/icons-material/Place";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import TuneIcon from "@mui/icons-material/Tune";
import MapIcon from "@mui/icons-material/Map";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import { useAnalysis, applyParams } from "../../state/AnalysisContext";
import { summarizeOccurrences, speciesName } from "../../utils/data";
import { BRAND } from "../../layout/Theme";

const PHASES = [
  { key: "occurrences", icon: <PlaceIcon /> },
  { key: "environment", icon: <ThermostatIcon /> },
  { key: "models", icon: <TuneIcon /> },
  { key: "results", icon: <MapIcon /> },
];

export default function Home() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { state, reset, replace, occReady, envReady, resultsReady } = useAnalysis();
  const [error, setError] = useState(null);
  const importRef = useRef(null);

  const hasProgress = state.occ.species.length > 0 || state.occ.data.length > 0 || !!state.occ.upload.fileName;
  const species = state.occ.data.length
    ? summarizeOccurrences(state.occ.data).species.map((s) => s.name)
    : state.occ.species.map(speciesName);
  const resumePath = resultsReady ? "/results" : envReady ? "/models" : occReady ? "/environment" : "/occurrences";
  const savedAt = state.savedAt ? new Date(state.savedAt).toLocaleString(lang === "pt" ? "pt-BR" : "en-US") : null;

  const start = () => {
    if (hasProgress && !window.confirm(t("menu.confirmNew"))) return;
    reset();
    navigate("/occurrences");
  };

  const onImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      replace(applyParams(state, JSON.parse(await file.text())));
      navigate("/occurrences");
    } catch {
      setError(t("menu.importError"));
    }
  };

  return (
    <Box sx={{ py: { xs: 2, md: 4 } }}>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        {t("home.title")}
      </Typography>
      <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 720, mb: 4 }}>
        {t("home.subtitle")}
      </Typography>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" }, mb: 4 }}>
        {PHASES.map((p, i) => (
          <Paper key={p.key} variant="outlined" sx={{ p: 2.5, borderColor: BRAND.border }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, color: "secondary.main" }}>
              {p.icon}
              <Typography variant="overline" sx={{ color: "text.secondary", lineHeight: 1 }}>
                {t("home.stepN", { n: i + 1 })}
              </Typography>
            </Box>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              {t(`steps.${p.key}`)}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t(`home.phase.${p.key}`)}
            </Typography>
          </Paper>
        ))}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {hasProgress && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderColor: "primary.main", maxWidth: 720 }}>
          <Typography variant="subtitle1">{t("home.resumeTitle")}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
            {species.length ? species.slice(0, 4).join(", ") + (species.length > 4 ? ` ${t("summary.andMore", { n: species.length - 4 })}` : "") : t("summary.noSpecies")}
            {savedAt && ` · ${t("home.savedAt", { date: savedAt })}`}
          </Typography>
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => navigate(resumePath)}>
            {t("home.resume")}
          </Button>
        </Paper>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <Button variant={hasProgress ? "outlined" : "contained"} size="large" startIcon={<AddIcon />} onClick={start}>
          {t("home.new")}
        </Button>
        <Button variant="text" size="large" startIcon={<FileUploadIcon />} onClick={() => importRef.current?.click()}>
          {t("home.import")}
        </Button>
        <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={onImport} />
      </Stack>
      <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 1.5, maxWidth: 640 }}>
        {t("home.importHint")}
      </Typography>
    </Box>
  );
}
