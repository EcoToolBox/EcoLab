import { useRef, useState } from "react";
import {
  Box, Typography, Stepper, Step, StepButton, StepLabel, IconButton, Tooltip, Menu, MenuItem,
  ListItemIcon, ToggleButtonGroup, ToggleButton, Divider, Snackbar, Alert, Chip,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import HomeIcon from "@mui/icons-material/Home";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { STEPS } from "../constants/steps";
import { useI18n, useNumber } from "../i18n";
import { useAnalysis, exportParams, applyParams } from "../state/AnalysisContext";
import { downloadJSON, summarizeOccurrences, speciesName } from "../utils/data";
import { MODEL_LABELS } from "../constants/models";
import { BRAND } from "./Theme";
import logo from "../assets/EcoLab.png";

function useStepAccess() {
  const { occReady, envReady, resultsReady, state } = useAnalysis();
  const done = { occurrences: occReady, environment: envReady, models: resultsReady, results: resultsReady };
  const reachable = {
    occurrences: true,
    environment: occReady,
    models: envReady,
    results: envReady && (resultsReady || !!state.results.maps),
  };
  return { done, reachable };
}

function SummaryItem({ status, title, lines }) {
  const icon =
    status === "done" ? (
      <CheckCircleIcon sx={{ color: BRAND.greenLight, fontSize: 18 }} />
    ) : status === "stale" ? (
      <WarningAmberIcon sx={{ color: "#f0a04b", fontSize: 18 }} />
    ) : (
      <RadioButtonUncheckedIcon sx={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }} />
    );
  return (
    <Box sx={{ display: "flex", gap: 1.25, py: 1.25, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <Box sx={{ pt: 0.25 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "#fff" }}>
          {title}
        </Typography>
        {lines.filter(Boolean).map((l, i) => (
          <Typography key={i} variant="caption" component="div" sx={{ color: "rgba(255,255,255,0.68)", lineHeight: 1.45, wordBreak: "break-word" }}>
            {l}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

function SummaryPanel() {
  const { t } = useI18n();
  const fmt = useNumber();
  const { state, occReady, occStale, envReady, envStale, resultsReady, resultsStale } = useAnalysis();
  const { occ, env, models, results } = state;

  const occSummary = occ.data.length ? summarizeOccurrences(occ.data) : null;
  const speciesList = occSummary?.species.map((s) => s.name) ?? occ.species.map(speciesName);
  const speciesLine =
    speciesList.length > 3
      ? `${speciesList.slice(0, 3).join(", ")} ${t("summary.andMore", { n: speciesList.length - 3 })}`
      : speciesList.join(", ");

  const best = (() => {
    if (!results.maps) return null;
    let top = null;
    Object.entries(results.maps).forEach(([key, data]) => {
      const v = data?.metrics?.[models.rankBy] ?? data?.metrics?.auc;
      if (v != null && (!top || v > top.v)) top = { k: key.split("::")[0], v };
    });
    return top;
  })();

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <SummaryItem
        status={occReady ? "done" : occStale ? "stale" : "todo"}
        title={t("steps.occurrences")}
        lines={[
          speciesLine || t("summary.noSpecies"),
          occSummary && t("summary.occCount", { n: fmt(occSummary.unique) }),
          occStale && t("summary.stale"),
        ]}
      />
      <SummaryItem
        status={envReady ? "done" : envStale ? "stale" : "todo"}
        title={t("steps.environment")}
        lines={[
          env.finalData.length ? t("summary.envVars", { n: env.variables.length }) : t(`env.mode.${env.mode}.title`),
          env.interactions.enabled && t("summary.withInteractions"),
          envStale && t("summary.stale"),
        ]}
      />
      <SummaryItem
        status={resultsReady ? "done" : "todo"}
        title={t("steps.models")}
        lines={[models.selectedModels.map((m) => MODEL_LABELS[m] ?? m).join(", ")]}
      />
      <SummaryItem
        status={resultsReady ? "done" : resultsStale ? "stale" : "todo"}
        title={t("steps.results")}
        lines={[
          best && t("summary.best", { model: MODEL_LABELS[best.k] ?? best.k, metric: models.rankBy.toUpperCase(), value: fmt(best.v, 3) }),
          resultsStale && t("summary.resultsStale"),
        ]}
      />
    </Box>
  );
}

export default function MainLayout() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state, reset, replace, saveStatus } = useAnalysis();
  const { done, reachable } = useStepAccess();
  const [menuEl, setMenuEl] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [toast, setToast] = useState(null);
  const importRef = useRef(null);

  const activeStep = STEPS.findIndex((s) => s.path === pathname);
  const isHome = pathname === "/";

  const newAnalysis = () => {
    setMenuEl(null);
    if (window.confirm(t("menu.confirmNew"))) {
      reset();
      navigate("/occurrences");
    }
  };

  const exportJson = () => {
    setMenuEl(null);
    downloadJSON(exportParams(state), "ecolab-parametros.json");
  };

  const onImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const params = JSON.parse(await file.text());
      replace(applyParams(state, params));
      setToast({ severity: "success", text: t("menu.imported") });
      navigate("/occurrences");
    } catch {
      setToast({ severity: "error", text: t("menu.importError") });
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "background.default" }}>
      {/* Cabeçalho */}
      <Box
        component="header"
        sx={{
          bgcolor: BRAND.dark,
          color: "#fff",
          px: { xs: 2, md: 3 },
          py: 1,
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Box
          component="button"
          onClick={() => navigate("/")}
          aria-label={t("menu.home")}
          sx={{ border: 0, bgcolor: "transparent", p: 0, cursor: "pointer", display: "flex" }}
        >
          <img src={logo} alt="EcoLab" style={{ height: 34, display: "block" }} />
        </Box>

        <Box sx={{ flex: 1, display: "flex", justifyContent: "center" }}>
          {!isHome && (
            <Stepper
              nonLinear
              activeStep={activeStep}
              sx={{
                width: "100%",
                maxWidth: 640,
                "& .MuiStepLabel-label": { color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" },
                "& .MuiStepLabel-label.Mui-active": { color: "#fff", fontWeight: 600 },
                "& .MuiStepLabel-label.Mui-completed": { color: "rgba(255,255,255,0.9)" },
                "& .MuiStepLabel-label.Mui-disabled": { color: "rgba(255,255,255,0.4)" },
                "& .MuiStepIcon-root": { color: "rgba(255,255,255,0.22)" },
                "& .MuiStepIcon-root.Mui-active": { color: BRAND.orange },
                "& .MuiStepIcon-root.Mui-completed": { color: BRAND.greenLight },
                "& .MuiStepConnector-line": { borderColor: "rgba(255,255,255,0.18)" },
                "& .MuiStepButton-root": { borderRadius: 1 },
              }}
            >
              {STEPS.map((step, i) => (
                <Step key={step.path} completed={done[step.key] && i !== activeStep} disabled={!reachable[step.key]}>
                  <StepButton onClick={() => navigate(step.path)} disabled={!reachable[step.key]}>
                    <StepLabel>{t(`steps.${step.key}`)}</StepLabel>
                  </StepButton>
                </Step>
              ))}
            </Stepper>
          )}
        </Box>

        <Tooltip title={saveStatus === "full" ? t("menu.savedFull") : saveStatus === "config" ? t("menu.savedConfig") : t("menu.savedNone")}>
          <Chip
            size="small"
            label={saveStatus === "none" ? t("menu.notSaved") : t("menu.saved")}
            sx={{
              display: { xs: "none", md: "flex" },
              bgcolor: "rgba(255,255,255,0.08)",
              color: saveStatus === "none" ? "#f0a04b" : "rgba(255,255,255,0.75)",
            }}
          />
        </Tooltip>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={lang}
          onChange={(_e, v) => v && setLang(v)}
          aria-label={t("menu.language")}
          sx={{
            "& .MuiToggleButton-root": { color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)", px: 1.25, py: 0.25, fontWeight: 600 },
            "& .Mui-selected": { color: "#fff !important", bgcolor: "rgba(217,82,4,0.6) !important" },
          }}
        >
          <ToggleButton value="pt">PT</ToggleButton>
          <ToggleButton value="en">EN</ToggleButton>
        </ToggleButtonGroup>

        <IconButton onClick={(e) => setMenuEl(e.currentTarget)} sx={{ color: "#fff" }} aria-label={t("menu.analysis")}>
          <MoreVertIcon />
        </IconButton>
        <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
          <MenuItem onClick={() => { setMenuEl(null); navigate("/"); }}>
            <ListItemIcon><HomeIcon fontSize="small" /></ListItemIcon>
            {t("menu.home")}
          </MenuItem>
          <MenuItem onClick={newAnalysis}>
            <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
            {t("menu.new")}
          </MenuItem>
          <Divider />
          <MenuItem onClick={exportJson}>
            <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
            {t("menu.export")}
          </MenuItem>
          <MenuItem onClick={() => { setMenuEl(null); importRef.current?.click(); }}>
            <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
            {t("menu.import")}
          </MenuItem>
        </Menu>
        <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={onImport} />
      </Box>

      {/* Corpo */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {!isHome && (
          <Box
            component="aside"
            aria-label={t("summary.title")}
            sx={{
              display: { xs: "none", md: "flex" },
              flexDirection: "column",
              width: panelOpen ? 260 : 44,
              flexShrink: 0,
              bgcolor: BRAND.darkAlt,
              color: "#fff",
              transition: "width .2s",
              overflow: "hidden",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", px: panelOpen ? 2 : 0.5, pt: 1.5, pb: 0.5 }}>
              {panelOpen && (
                <Typography variant="overline" sx={{ flex: 1, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>
                  {t("summary.title")}
                </Typography>
              )}
              <IconButton
                size="small"
                onClick={() => setPanelOpen((o) => !o)}
                sx={{ color: "rgba(255,255,255,0.7)" }}
                aria-label={panelOpen ? t("summary.collapse") : t("summary.expand")}
              >
                {panelOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </IconButton>
            </Box>
            {panelOpen && (
              <Box sx={{ overflowY: "auto" }}>
                <SummaryPanel />
              </Box>
            )}
          </Box>
        )}

        <Box component="main" sx={{ flex: 1, overflowY: "auto", px: { xs: 2, md: 4 }, pt: { xs: 2, md: 3.5 } }}>
          <Box sx={{ maxWidth: 1180, mx: "auto", minHeight: "100%", display: "flex", flexDirection: "column" }}>
            {state.dataDropped && !isHome && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t("menu.dataDropped")}
              </Alert>
            )}
            <Outlet />
          </Box>
        </Box>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)}>{toast.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
