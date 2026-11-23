import { useMemo, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, FormControl, FormControlLabel,
  InputLabel, MenuItem, Select, Slider, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import { useAnalysis, DEFAULT_MODELS } from "../../state/AnalysisContext";
import { PageHeader, Section, StepFooter, InfoTip } from "../../components/ui";
import { BRAND } from "../../layout/Theme";
import { MODEL_KEYS, MODEL_LABELS, KDE_MODELS, METRIC_KEYS, METRIC_LABELS } from "../../constants/models";
import { selectedRows, summarizeOccurrences } from "../../utils/data";
import api from "../../services/api";
import { MIN_PRESENCES, FEW_PRESENCES } from "../Occurrences";

// Campos que ficam em "Avançado" (o resto aparece direto na tela).
const ADVANCED_KEYS = [
  "presenceType", "selectedMetrics", "validationMode", "nFolds", "nRepeats", "backgroundRatio", "backgroundSource",
  "backgroundBufferKm", "tssMode", "kdeTarget", "customGrid",
];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function modelAllowed(key, m) {
  if (m.presenceType === "presence_only") return key === "maxent";
  if (m.kdeTarget?.enabled) return KDE_MODELS.includes(key);
  return true;
}

export default function Models() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { state, update, envReady } = useAnalysis();
  const m = state.models;
  const { env } = state;
  const set = (patch) => update("models", patch);
  const [gridBusy, setGridBusy] = useState(false);
  const [gridError, setGridError] = useState(null);

  const summary = useMemo(() => summarizeOccurrences(selectedRows(state.occ, env.finalData)), [env.finalData, state.occ.excludedSpecies]); // eslint-disable-line react-hooks/exhaustive-deps
  const nf = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US");
  const blocked = summary.species.filter((s) => s.unique < MIN_PRESENCES);
  const runnable = summary.species.length - blocked.length;

  const models = m.selectedModels.filter((k) => modelAllowed(k, m));
  const ensembleAvailable = m.presenceType !== "presence_only" && models.length >= 2;
  const changed = ADVANCED_KEYS.filter((k) => !same(m[k], DEFAULT_MODELS[k]));
  const isPA = m.presenceType !== "presence_only";

  const setPresenceType = (presenceType) =>
    set({
      presenceType,
      ...(presenceType === "presence_only"
        ? { selectedModels: ["maxent"], kdeTarget: { ...m.kdeTarget, enabled: false } }
        : {}),
    });
  const toggleModel = (k) =>
    set({ selectedModels: m.selectedModels.includes(k) ? m.selectedModels.filter((x) => x !== k) : [...m.selectedModels, k] });
  const toggleMetric = (k) =>
    set({ selectedMetrics: m.selectedMetrics.includes(k) ? m.selectedMetrics.filter((x) => x !== k) : [...m.selectedMetrics, k] });
  const restore = () => {
    const patch = {};
    ADVANCED_KEYS.forEach((k) => (patch[k] = DEFAULT_MODELS[k]));
    set(patch);
  };

  const uploadGrid = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setGridBusy(true);
    setGridError(null);
    try {
      const r = await api.uploadPredictionGrid(file);
      set({ customGrid: { gridId: r.gridId, fileName: file.name, rows: r.rows, variables: r.variables ?? [] } });
    } catch (e) {
      setGridError(e.message);
    } finally {
      setGridBusy(false);
    }
  };

  const missing = !envReady
    ? t("models.need.env")
    : !models.length
      ? t("models.need.model")
      : runnable === 0
        ? t("models.need.presences", { n: MIN_PRESENCES })
        : !m.selectedMetrics.length
          ? t("models.need.metric")
          : null;

  if (!envReady) {
    return (
      <Box>
        <PageHeader step={t("common.stepOf", { n: 3, total: 4 })} title={t("models.title")} subtitle={t("models.subtitle")} />
        <Alert severity="info" action={<Button color="inherit" onClick={() => navigate("/environment")}>{t("models.goEnv")}</Button>}>
          {t("models.need.env")}
        </Alert>
      </Box>
    );
  }

  const field = (label, help, input) => (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 0.75 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <InfoTip text={help} />
      </Box>
      {input}
    </Box>
  );

  return (
    <Box>
      <PageHeader step={t("common.stepOf", { n: 3, total: 4 })} title={t("models.title")} subtitle={t("models.subtitle")} />

      {/* ── o que vai rodar ─────────────────────────────────────────────── */}
      <Section title={t("models.planTitle")} subtitle={t("models.planSubtitle")}>
        <Box sx={{ maxHeight: 300, overflow: "auto", mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{t("occ.table.species")}</TableCell>
                <TableCell align="right">{t("models.plan.presences")}</TableCell>
                {isPA && <TableCell align="right">{t("models.plan.background")}</TableCell>}
                <TableCell>{t("models.plan.status")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.species.map((s) => (
                <TableRow key={s.name}>
                  <TableCell sx={{ fontStyle: "italic" }}>{s.name}</TableCell>
                  <TableCell align="right">{nf.format(s.unique)}</TableCell>
                  {isPA && (
                    <TableCell align="right">
                      {summary.backgroundRows > 0 ? t("models.plan.provided") : `≈ ${nf.format(Math.round(s.unique * m.backgroundRatio))}`}
                    </TableCell>
                  )}
                  <TableCell>
                    {s.unique < MIN_PRESENCES ? (
                      <Chip size="small" color="error" variant="outlined" label={t("models.plan.skip")} />
                    ) : s.unique < FEW_PRESENCES ? (
                      <Chip size="small" color="warning" variant="outlined" label={t("models.plan.few")} />
                    ) : (
                      <Chip size="small" color="success" variant="outlined" label={t("models.plan.ok")} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("models.plan.variables", { n: env.variables.length })}{" "}
          <Box component="span" sx={{ fontFamily: "monospace", fontSize: 13 }}>
            {env.variables.slice(0, 12).join(", ")}
            {env.variables.length > 12 ? "…" : ""}
          </Box>
        </Typography>
        {blocked.length > 0 && runnable > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t("models.plan.skipped", { n: MIN_PRESENCES, list: blocked.map((s) => s.name).join(", ") })}
          </Alert>
        )}
      </Section>

      {/* ── modelos ─────────────────────────────────────────────────────── */}
      <Section title={t("models.algoTitle")} subtitle={t("models.algoSubtitle")}>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {MODEL_KEYS.map((k) => {
            const allowed = modelAllowed(k, m);
            const on = allowed && m.selectedModels.includes(k);
            return (
              <Box
                key={k}
                onClick={() => allowed && toggleModel(k)}
                sx={{
                  display: "flex",
                  gap: 1,
                  alignItems: "flex-start",
                  p: 1.5,
                  border: "1.5px solid",
                  borderColor: on ? "secondary.main" : BRAND.border,
                  borderRadius: 2,
                  cursor: allowed ? "pointer" : "not-allowed",
                  opacity: allowed ? 1 : 0.5,
                  bgcolor: "background.paper",
                }}
              >
                <Checkbox checked={on} disabled={!allowed} sx={{ p: 0.5 }} inputProps={{ "aria-label": MODEL_LABELS[k] }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ lineHeight: 1.3 }}>
                    {MODEL_LABELS[k]}
                    {DEFAULT_MODELS.selectedModels.includes(k) && (
                      <Chip size="small" label={t("models.recommended")} sx={{ ml: 1, height: 20, fontSize: 11 }} />
                    )}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {allowed ? t(`models.desc.${k}`) : t(m.presenceType === "presence_only" ? "models.onlyMaxent" : "models.notKde")}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ mt: 2.5, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={ensembleAvailable && m.ensemble.enabled}
                disabled={!ensembleAvailable}
                onChange={(e) => set({ ensemble: { ...m.ensemble, enabled: e.target.checked } })}
              />
            }
            label={<Typography variant="body1">{t("models.ensemble")}</Typography>}
          />
          <Typography variant="body2" sx={{ color: "text.secondary", flex: 1, minWidth: 260 }}>
            {ensembleAvailable ? t("models.ensembleHelp") : t("models.ensembleNeeds")}
          </Typography>
        </Box>

        <Box sx={{ mt: 2.5, maxWidth: 520 }}>
          {field(
            t("models.testSize", { n: m.testSize }),
            t("models.testSizeHelp"),
            <Box sx={{ px: 1 }}>
              <Slider
                value={m.testSize}
                min={10}
                max={50}
                step={5}
                marks={[{ value: 10, label: "10%" }, { value: 20, label: "20%" }, { value: 30, label: "30%" }, { value: 50, label: "50%" }]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
                onChange={(_e, v) => set({ testSize: v })}
                disabled={m.validationMode === "spatial"}
              />
            </Box>
          )}
          {m.validationMode === "spatial" && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("models.testSizeSpatial")}
            </Typography>
          )}
        </Box>
      </Section>

      {/* ── avançado ────────────────────────────────────────────────────── */}
      <Accordion disableGutters variant="outlined" sx={{ borderColor: BRAND.border, borderRadius: 2, "&:before": { display: "none" }, mb: 2.5 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="h6">{t("models.advanced")}</Typography>
            {changed.length > 0 ? (
              <Chip size="small" color="primary" label={t("models.changed", { n: changed.length })} />
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t("models.advancedHint")}
              </Typography>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
          {changed.length > 0 && (
            <Button size="small" startIcon={<RestartAltIcon />} onClick={restore} sx={{ mb: 2 }}>
              {t("models.restore")}
            </Button>
          )}
          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
            {field(
              t("models.adv.presenceType"),
              t("models.adv.presenceTypeHelp"),
              <FormControl size="small" fullWidth>
                <Select value={m.presenceType} onChange={(e) => setPresenceType(e.target.value)}>
                  <MenuItem value="presence_pseudoabsence">{t("models.presence.pa")}</MenuItem>
                  <MenuItem value="presence_only">{t("models.presence.po")}</MenuItem>
                </Select>
              </FormControl>
            )}

            {field(
              t("models.adv.metrics"),
              t("models.adv.metricsHelp"),
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {METRIC_KEYS.map((k) => (
                  <Chip
                    key={k}
                    label={METRIC_LABELS[k]}
                    title={t(`metrics.desc.${k}`)}
                    color={m.selectedMetrics.includes(k) ? "secondary" : "default"}
                    variant={m.selectedMetrics.includes(k) ? "filled" : "outlined"}
                    onClick={() => toggleMetric(k)}
                  />
                ))}
              </Box>
            )}

            {field(
              t("models.adv.validation"),
              t(`models.validation.${m.validationMode}Help`),
              <FormControl size="small" fullWidth>
                <Select value={m.validationMode} onChange={(e) => set({ validationMode: e.target.value })}>
                  {["random", "repeated", "spatial"].map((v) => (
                    <MenuItem key={v} value={v}>
                      {t(`models.validation.${v}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {m.validationMode === "spatial" &&
              field(
                t("models.adv.nFolds"),
                t("models.adv.nFoldsHelp"),
                <TextField size="small" type="number" value={m.nFolds} inputProps={{ min: 2, max: 20 }} onChange={(e) => set({ nFolds: Math.max(2, parseInt(e.target.value, 10) || 2) })} />
              )}
            {m.validationMode === "repeated" &&
              field(
                t("models.adv.nRepeats"),
                t("models.adv.nRepeatsHelp"),
                <TextField size="small" type="number" value={m.nRepeats} inputProps={{ min: 2, max: 50 }} onChange={(e) => set({ nRepeats: Math.max(2, parseInt(e.target.value, 10) || 2) })} />
              )}

            {isPA &&
              field(
                t("models.adv.ratio"),
                t("models.adv.ratioHelp"),
                <TextField size="small" type="number" value={m.backgroundRatio} inputProps={{ min: 0.1, max: 10, step: 0.5 }} onChange={(e) => set({ backgroundRatio: Math.max(0.1, parseFloat(e.target.value) || 2) })} />
              )}
            {isPA &&
              field(
                t("models.adv.buffer"),
                t("models.adv.bufferHelp"),
                <TextField size="small" type="number" value={m.backgroundBufferKm} inputProps={{ min: 0, step: 5 }} onChange={(e) => set({ backgroundBufferKm: Math.max(0, parseFloat(e.target.value) || 0) })} />
              )}
            {isPA &&
              field(
                t("models.adv.bgSource"),
                t("models.adv.bgSourceHelp"),
                <FormControl size="small" fullWidth>
                  <Select value={m.backgroundSource} onChange={(e) => set({ backgroundSource: e.target.value })}>
                    <MenuItem value="grid_random">{t("models.bg.grid_random")}</MenuItem>
                    <MenuItem value="provided">{t("models.bg.provided")}</MenuItem>
                  </Select>
                </FormControl>
              )}

            {field(
              t("models.adv.tss"),
              t("models.adv.tssHelp"),
              <FormControl size="small" fullWidth>
                <Select value={m.tssMode} onChange={(e) => set({ tssMode: e.target.value })}>
                  <MenuItem value="max">{t("models.tss.max")}</MenuItem>
                  <MenuItem value="0.5">{t("models.tss.fixed")}</MenuItem>
                </Select>
              </FormControl>
            )}

            {ensembleAvailable &&
              m.ensemble.enabled &&
              field(
                t("models.adv.ensembleMetric"),
                t("models.adv.ensembleMetricHelp"),
                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>{t("models.adv.weight")}</InputLabel>
                    <Select value={m.ensemble.metric} label={t("models.adv.weight")} onChange={(e) => set({ ensemble: { ...m.ensemble, metric: e.target.value } })}>
                      <MenuItem value="tss">TSS</MenuItem>
                      <MenuItem value="auc">AUC</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    type="number"
                    label={t("models.adv.threshold")}
                    value={m.ensemble.threshold}
                    inputProps={{ min: 0, max: 1, step: 0.05 }}
                    onChange={(e) => set({ ensemble: { ...m.ensemble, threshold: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)) } })}
                    sx={{ width: 150 }}
                  />
                </Box>
              )}

            {isPA &&
              field(
                t("models.adv.kde"),
                t("models.adv.kdeHelp"),
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!!m.kdeTarget?.enabled}
                        onChange={(e) => set({ kdeTarget: { bandwidthKm: 0, ...m.kdeTarget, enabled: e.target.checked } })}
                      />
                    }
                    label={<Typography variant="body2">{t("models.adv.kdeOn")}</Typography>}
                  />
                  {m.kdeTarget?.enabled && (
                    <TextField
                      size="small"
                      type="number"
                      label={t("models.adv.bandwidth")}
                      value={m.kdeTarget.bandwidthKm ?? 0}
                      onChange={(e) => set({ kdeTarget: { ...m.kdeTarget, bandwidthKm: Math.max(0, parseFloat(e.target.value) || 0) } })}
                      helperText={t("models.adv.bandwidthHelp")}
                      sx={{ width: 200 }}
                    />
                  )}
                </Box>
              )}

            <Box sx={{ gridColumn: "1 / -1" }}>
              {field(
                t("models.adv.grid"),
                t("models.adv.gridHelp"),
                <Box>
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                    <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={gridBusy}>
                      {m.customGrid ? t("models.adv.gridChange") : t("models.adv.gridChoose")}
                      <input type="file" accept=".csv,.tsv,.txt" hidden onChange={uploadGrid} />
                    </Button>
                    {m.customGrid && (
                      <>
                        <Typography variant="body2">
                          {t("models.adv.gridInfo", { file: m.customGrid.fileName, rows: nf.format(m.customGrid.rows ?? 0) })}
                        </Typography>
                        <Button size="small" color="inherit" onClick={() => set({ customGrid: null })}>
                          {t("models.adv.gridRemove")}
                        </Button>
                      </>
                    )}
                  </Box>
                  {!m.customGrid && env.rasterGrid && (
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
                      {t("models.adv.gridFromRasters", { res: env.rasterGrid.resolution })}
                    </Typography>
                  )}
                  {gridError && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {gridError}
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      <StepFooter
        onBack={() => navigate("/environment")}
        onNext={() => navigate("/results")}
        nextLabel={t("models.run")}
        nextIcon={<PlayArrowIcon />}
        nextDisabled={!!missing}
        reason={missing}
      />
    </Box>
  );
}
