import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from "@mui/material";
import LayersIcon from "@mui/icons-material/Layers";
import SatelliteAltIcon from "@mui/icons-material/SatelliteAlt";
import TableChartIcon from "@mui/icons-material/TableChart";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import { useAnalysis, stamp } from "../../state/AnalysisContext";
import { PageHeader, Section, OptionCards, StepFooter, ProgressPanel, DataTable, Stat } from "../../components/ui";
import SpreadsheetPicker from "../../components/SpreadsheetPicker";
import RasterPicker, { effectiveResolution } from "./RasterPicker";
import Interactions from "./Interactions";
import api from "../../services/api";
import { ENV_FIELD_ALIASES, addedColumns, analysisSpecies, asRows, rasterExtent, selectedRows, variableStats, withId } from "../../utils/data";

export const GEE_VARS = ["ndvi", "ndwi", "temperature", "precipitation"];

export default function Environment() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { state, update, files, envHash, occReady, envReady, envStale } = useAnalysis();
  const { env, occ } = state;
  const [phase, setPhase] = useState(null);
  const [error, setError] = useState(null);
  const [gee, setGee] = useState({ checked: false, ok: false, busy: false, error: null });

  const set = (patch) => update("env", patch);
  const usesGee = env.mode === "sources" || env.mode === "both";
  const usesUpload = env.mode === "upload" || env.mode === "both";
  const usesRasters = env.mode === "rasters";

  useEffect(() => {
    if (!usesGee || gee.checked) return;
    api
      .checkEarthEngine()
      .then((r) => setGee((g) => ({ ...g, checked: true, ok: r === true || r?.success === true })))
      .catch(() => setGee((g) => ({ ...g, checked: true, ok: false })));
  }, [usesGee, gee.checked]);

  const connectGee = async () => {
    setGee((g) => ({ ...g, busy: true, error: null }));
    try {
      await api.authenticateEarthEngine(env.geeProject.trim());
      setGee((g) => ({ ...g, ok: true, busy: false }));
    } catch (e) {
      setGee((g) => ({ ...g, ok: false, busy: false, error: e.message }));
    }
  };

  // Variáveis da planilha: todas as colunas que não são lat/lon.
  const setEnvUpload = (patch) => {
    const next = { ...env.upload, ...patch };
    const used = new Set([next.mapping?.latitude, next.mapping?.longitude].filter(Boolean));
    const prev = new Map((env.upload.variables ?? []).map((v) => [v.column, v]));
    next.variables = (next.columns ?? [])
      .filter((c) => !used.has(c))
      .map((c) => prev.get(c) ?? { column: c, name: c, selected: true });
    set({ upload: next });
  };
  const toggleVar = (column) =>
    set({ upload: { ...env.upload, variables: env.upload.variables.map((v) => (v.column === column ? { ...v, selected: !v.selected } : v)) } });

  // ── o que falta ────────────────────────────────────────────────────────────
  const missing = (() => {
    if (!occReady) return t("env.need.occ");
    if (usesGee) {
      if (!env.vars.length) return t("env.need.vars");
      if (!gee.ok) return t("env.need.gee");
    }
    if (usesUpload) {
      if (!env.upload.fileName || !files.current.envUpload) return t("env.need.file");
      if (!env.upload.mapping?.latitude || !env.upload.mapping?.longitude) return t("env.need.columns");
      if (!env.upload.variables.some((v) => v.selected)) return t("env.need.uploadVars");
      if (!env.upload.acknowledged) return t("env.need.ack");
    }
    if (usesRasters) {
      if (!env.raster.folder || !env.raster.available.length) return t("env.need.folder");
      if (!env.raster.files.length) return t("env.need.rasters");
      if (!rasterExtent(env.raster.available, env.raster.files)) return t("env.raster.noOverlap");
    }
    if (env.interactions.enabled && !env.interactions.types.length) return t("env.need.interTypes");
    return null;
  })();

  // ── leitura das variáveis ──────────────────────────────────────────────────
  const run = async () => {
    setError(null);
    const species = analysisSpecies(occ);
    try {
      let interactionData = [];
      if (env.interactions.enabled) {
        setPhase("interactions");
        interactionData = withId(
          asRows(await api.searchInteractions({ species, interaction_type: env.interactions.types, depth: env.interactions.depth }))
        );
      }

      // Só as espécies marcadas na etapa Ocorrências (evita consultar milhares de pontos à toa).
      const baseRows = selectedRows(occ, occ.data);
      let rows = baseRows;
      let gridData = [];
      let rasterGrid = null;

      if (usesGee) {
        setPhase("environment");
        rows = withId(asRows(await api.environmentVariables({ data: rows, index: env.vars, geeProject: env.geeProject })));
      }

      if (usesUpload) {
        setPhase("grid");
        const vars = env.upload.variables.filter((v) => v.selected).map((v) => ({ column: v.column, name: v.name.trim() || v.column }));
        const res = await api.uploadEnvironment(files.current.envUpload, env.upload.mapping, vars);
        if (res?.success === false || !res?.data?.length) throw new Error((res?.errors ?? []).join(" ") || t("env.err.upload"));
        gridData = res.data;
        rows = withId(asRows(await api.attachGrid(rows, gridData)));
      }

      if (usesRasters) {
        setPhase("rasters");
        rows = withId(asRows(await api.sampleRasters(env.raster.folder, env.raster.files, rows)));
        const resolution = effectiveResolution(env.raster);
        const g = await api.buildRasterGrid(env.raster.folder, env.raster.files, resolution);
        rasterGrid = { gridId: g.gridId, rows: g.rows, variables: g.variables ?? [], resolution };
      }

      if (env.interactions.enabled) {
        setPhase("joining");
        rows = withId(
          asRows(
            await api.interactionsAtOccurrences({
              occurrence: rows,
              interactions: interactionData,
              selectedSpecies: species,
              selectedSources: occ.mode === "upload" ? [] : occ.sources,
            })
          )
        );
      }

      const variables = addedColumns(baseRows, rows);
      set({ finalData: rows, gridData, interactionData, rasterGrid, variables, fetchedHash: stamp(envHash) });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setPhase(null);
    }
  };

  const stats = useMemo(() => variableStats(env.finalData, env.variables), [env.finalData, env.variables]);
  const badVars = stats.filter((s) => s.missingPct >= 50);
  const nf = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 3 });

  let n = 0;
  const num = () => {
    n += 1;
    return `${n}. `;
  };

  if (!occReady) {
    return (
      <Box>
        <PageHeader step={t("common.stepOf", { n: 2, total: 4 })} title={t("env.title")} subtitle={t("env.subtitle")} />
        <Alert severity="info" action={<Button color="inherit" onClick={() => navigate("/occurrences")}>{t("env.goOcc")}</Button>}>
          {t("env.need.occ")}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader step={t("common.stepOf", { n: 2, total: 4 })} title={t("env.title")} subtitle={t("env.subtitle")} />

      <Section title={num() + t("env.modeTitle")}>
        <OptionCards
          value={env.mode}
          onChange={(mode) => set({ mode })}
          columns={4}
          options={[
            { value: "rasters", title: t("env.mode.rasters.title"), description: t("env.mode.rasters.desc"), icon: <LayersIcon /> },
            { value: "sources", title: t("env.mode.sources.title"), description: t("env.mode.sources.desc"), icon: <SatelliteAltIcon /> },
            { value: "upload", title: t("env.mode.upload.title"), description: t("env.mode.upload.desc"), icon: <TableChartIcon /> },
            { value: "both", title: t("env.mode.both.title"), description: t("env.mode.both.desc"), icon: <MergeTypeIcon /> },
          ]}
        />
      </Section>

      {usesRasters && (
        <Section title={num() + t("env.rastersTitle")} subtitle={t("env.rastersSubtitle")}>
          <RasterPicker raster={env.raster} onChange={(raster) => set({ raster })} />
        </Section>
      )}

      {usesGee && (
        <Section title={num() + t("env.geeTitle")} subtitle={t("env.geeSubtitle")}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap", mb: 2 }}>
            <TextField
              size="small"
              label={t("env.gee.project")}
              value={env.geeProject}
              onChange={(e) => set({ geeProject: e.target.value })}
              helperText={gee.error ?? t("env.gee.projectHelp")}
              error={!!gee.error}
              sx={{ minWidth: 300 }}
            />
            <Button variant="outlined" onClick={connectGee} disabled={gee.busy || !env.geeProject.trim()}>
              {gee.busy ? <CircularProgress size={20} /> : t("env.gee.connect")}
            </Button>
            {gee.ok && <Chip color="success" variant="outlined" label={t("env.gee.connected")} sx={{ mt: 0.5 }} />}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {GEE_VARS.map((v) => {
              const on = env.vars.includes(v);
              return (
                <Chip
                  key={v}
                  label={t(`env.var.${v}`)}
                  color={on ? "secondary" : "default"}
                  variant={on ? "filled" : "outlined"}
                  onClick={() => set({ vars: on ? env.vars.filter((x) => x !== v) : [...env.vars, v] })}
                />
              );
            })}
          </Box>
        </Section>
      )}

      {usesUpload && (
        <Section title={num() + t("env.uploadTitle")} subtitle={t("env.uploadSubtitle")}>
          <SpreadsheetPicker
            upload={env.upload}
            file={files.current.envUpload}
            fields={[
              { key: "latitude", label: t("occ.field.latitude"), required: true },
              { key: "longitude", label: t("occ.field.longitude"), required: true },
            ]}
            aliases={ENV_FIELD_ALIASES}
            onFile={(file, upload) => {
              files.current.envUpload = file;
              setEnvUpload({ ...upload, acknowledged: false });
            }}
            onMapping={(mapping) => setEnvUpload({ mapping })}
          >
            {env.upload.variables.length > 0 && (
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t("env.upload.varsTitle")}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {env.upload.variables.map((v) => (
                    <Chip
                      key={v.column}
                      label={v.column}
                      color={v.selected ? "secondary" : "default"}
                      variant={v.selected ? "filled" : "outlined"}
                      onClick={() => toggleVar(v.column)}
                    />
                  ))}
                </Box>
                <FormControlLabel
                  sx={{ mt: 2, alignItems: "flex-start" }}
                  control={<Checkbox checked={env.upload.acknowledged} onChange={(e) => set({ upload: { ...env.upload, acknowledged: e.target.checked } })} sx={{ mt: -0.75 }} />}
                  label={<Typography variant="body2">{t("env.upload.ack")}</Typography>}
                />
              </Box>
            )}
          </SpreadsheetPicker>
        </Section>
      )}

      <Section title={num() + t("env.interTitle")} subtitle={t("env.interSubtitle")}>
        <Interactions value={env.interactions} onChange={(interactions) => set({ interactions })} />
      </Section>

      {!phase && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", my: 3 }}>
          <Button variant="contained" size="large" startIcon={env.finalData.length ? <RefreshIcon /> : <PlayArrowIcon />} onClick={run} disabled={!!missing}>
            {env.finalData.length ? t("env.runAgain") : t("env.run")}
          </Button>
          {missing && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {missing}
            </Typography>
          )}
        </Box>
      )}
      {phase && <ProgressPanel title={t(`env.phase.${phase}`)} messages={t(`env.progress.${phase}`)} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!phase && env.finalData.length > 0 && (
        <Section title={t("env.resultTitle")} sx={{ borderColor: envStale ? "warning.main" : undefined }}>
          {envStale && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t("env.stale")}
            </Alert>
          )}
          <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", mb: 2 }}>
            <Stat value={env.variables.length} label={t("env.stat.vars")} />
            <Stat value={new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US").format(env.finalData.length)} label={t("env.stat.rows")} />
            {env.rasterGrid && (
              <Stat value={new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US").format(env.rasterGrid.rows)} label={t("env.stat.grid", { res: env.rasterGrid.resolution })} />
            )}
            {env.interactionData.length > 0 && <Stat value={env.interactionData.length} label={t("env.stat.interactions")} />}
          </Box>
          {env.variables.length === 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {t("env.noVars")}
            </Alert>
          )}
          {badVars.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t("env.badVars", { list: badVars.map((v) => v.name).join(", ") })}
            </Alert>
          )}
          {stats.length > 0 && (
            <Box sx={{ maxHeight: 360, overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t("env.table.variable")}</TableCell>
                    <TableCell align="right">{t("env.table.min")}</TableCell>
                    <TableCell align="right">{t("env.table.max")}</TableCell>
                    <TableCell align="right">{t("env.table.missing")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{s.name}</TableCell>
                      <TableCell align="right">{s.min == null ? "–" : nf.format(s.min)}</TableCell>
                      <TableCell align="right">{s.max == null ? "–" : nf.format(s.max)}</TableCell>
                      <TableCell align="right" sx={{ color: s.missingPct >= 50 ? "error.main" : s.missingPct > 0 ? "warning.dark" : undefined }}>
                        {s.missing ? `${s.missing} (${s.missingPct.toFixed(0)}%)` : "0"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          <DataTable rows={env.finalData} filename="ecolab-dados-ambientais.csv" label={t("env.showAll")} />
          {env.interactionData.length > 0 && (
            <DataTable rows={env.interactionData} filename="ecolab-interacoes.csv" label={t("env.showInteractions")} />
          )}
        </Section>
      )}

      <StepFooter
        onBack={() => navigate("/occurrences")}
        onNext={() => navigate("/models")}
        nextDisabled={!envReady || env.variables.length === 0}
        reason={envStale ? t("env.reason.stale") : t("env.reason.run")}
      />
    </Box>
  );
}
