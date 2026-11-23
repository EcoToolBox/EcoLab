import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Select,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarIcon from "@mui/icons-material/Star";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import { useAnalysis, exportParams } from "../../state/AnalysisContext";
import { PageHeader, Section, StepFooter, ProgressPanel } from "../../components/ui";
import EcoMap from "../../components/EcoMap";
import { BRAND } from "../../layout/Theme";
import { MODEL_LABELS, METRIC_LABELS, METRIC_KEYS, metricLevel, LEVEL_COLORS, SUITABILITY_CLASSES, HEAT_COLORS } from "../../constants/models";
import { analysisSpecies, downloadJSON, occurrencePoints, selectedRows } from "../../utils/data";
import { modelAllowed } from "../Models";
import { methodologyText } from "./methodology";
import api, { fileUrl } from "../../services/api";

/** Monta a requisição para o backend a partir do estado da análise. */
function buildPayload(state) {
  const { occ, env, models } = state;
  const selectedModels = models.selectedModels.filter((k) => modelAllowed(k, models));
  const ensembleOn = models.ensemble.enabled && models.presenceType !== "presence_only" && selectedModels.length >= 2;
  const metrics = [...models.selectedMetrics];
  if (ensembleOn && !metrics.includes(models.ensemble.metric)) metrics.push(models.ensemble.metric);
  const { customGrid, rankBy, ...rest } = models;
  return {
    finalData: env.finalData,
    interactionData: env.interactionData,
    selectedSpecies: analysisSpecies(occ),
    country: { ingles: occ.country?.name_en, iso3: occ.country?.iso3, label: occ.country?.name_pt },
    points: [],
    geeProject: env.geeProject,
    envGridData: env.gridData,
    modelsData: {
      ...rest,
      selectedModels,
      selectedMetrics: metrics,
      ensemble: { ...models.ensemble, enabled: ensembleOn },
      predictionGridId: customGrid?.gridId ?? env.rasterGrid?.gridId ?? null,
    },
  };
}

/** {maps} do backend → lista de {model, species, ...dados do mapa}. */
function normalize(maps, fallbackSpecies) {
  return Object.entries(maps ?? {}).map(([key, data]) => {
    const [model, species] = key.split("::");
    return { key, model, species: species ?? fallbackSpecies ?? "", ...(data ?? {}) };
  });
}

function importanceList(vi) {
  if (!vi) return [];
  const pairs = Array.isArray(vi) ? vi.map((x) => [x.feature ?? x.name ?? x[0], x.importance ?? x.value ?? x[1]]) : Object.entries(vi);
  const list = pairs.filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => ({ name: k, value: Number(v) }));
  const max = Math.max(...list.map((x) => Math.abs(x.value)), 0) || 1;
  return list.sort((a, b) => b.value - a.value).slice(0, 12).map((x) => ({ ...x, pct: (100 * Math.abs(x.value)) / max }));
}

function MetricCell({ metric, value, std, lang }) {
  const loc = lang === "pt" ? "pt-BR" : "en-US";
  const fmt = (v, d) => Number(v).toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const nf = (v) => (v == null ? "–" : fmt(v, 3));
  const level = metricLevel(metric, value);
  const color = level ? LEVEL_COLORS[level] : null;
  return (
    <TableCell align="right">
      <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: color?.bg, color: color?.fg, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
        {nf(value)}
        {std != null && <Box component="span" sx={{ fontWeight: 400, opacity: 0.75 }}> ± {fmt(std, 2)}</Box>}
      </Box>
    </TableCell>
  );
}

export default function Results() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { state, update, envReady, resultsReady, modelsHash } = useAnalysis();
  const { results, models, occ, env } = state;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [species, setSpecies] = useState(null);
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await api.runModels(buildPayload(state));
      const maps = r?.maps ?? r;
      update("results", { maps, warnings: r?.warnings ?? [], configHash: modelsHash, ranAt: new Date().toISOString() });
      setSelected(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (started.current || !envReady || resultsReady) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envReady, resultsReady]);

  const speciesNames = analysisSpecies(occ).map((s) => s.name);
  const entries = useMemo(() => normalize(results.maps, speciesNames.length === 1 ? speciesNames[0] : ""), [results.maps]); // eslint-disable-line react-hooks/exhaustive-deps
  const speciesList = [...new Set(entries.map((e) => e.species))];
  const currentSpecies = species && speciesList.includes(species) ? species : speciesList[0];
  const rankBy = models.rankBy ?? "tss";
  const rows = entries
    .filter((e) => e.species === currentSpecies)
    .sort((a, b) => (b.metrics?.[rankBy] ?? -Infinity) - (a.metrics?.[rankBy] ?? -Infinity));
  const metricCols = METRIC_KEYS.filter((k) => rows.some((r) => r.metrics?.[k] != null));
  const best = rows.find((r) => r.model !== "ensemble") ?? rows[0];
  const ensemble = rows.find((r) => r.model === "ensemble");
  const current = rows.find((r) => r.key === selected) ?? ensemble ?? best;

  const points = useMemo(
    () =>
      occurrencePoints(selectedRows(occ, env.finalData)).filter(
        (p) => !currentSpecies || !p.species || p.species.toLowerCase().startsWith(currentSpecies.toLowerCase())
      ),
    [env.finalData, currentSpecies, occ.excludedSpecies] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const importance = importanceList(current?.variable_importance);
  const methodology = methodologyText(state, lang, t);

  const copyMethodology = async () => {
    try {
      await navigator.clipboard.writeText(methodology);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão de área de transferência */
    }
  };

  const header = (
    <PageHeader step={t("common.stepOf", { n: 4, total: 4 })} title={t("results.title")} subtitle={t("results.subtitle")} />
  );

  if (!envReady) {
    return (
      <Box>
        {header}
        <Alert severity="info" action={<Button color="inherit" onClick={() => navigate("/environment")}>{t("models.goEnv")}</Button>}>
          {t("models.need.env")}
        </Alert>
      </Box>
    );
  }

  if (running) {
    return (
      <Box>
        {header}
        <ProgressPanel title={t("results.running")} messages={t("results.progress")} interval={6000} />
        <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
          {t("results.runningHint")}
        </Typography>
      </Box>
    );
  }

  const download = (path, label) =>
    path && (
      <Button size="small" variant="outlined" startIcon={<DownloadIcon />} href={fileUrl(path)} target="_blank" rel="noreferrer" download>
        {label}
      </Button>
    );

  return (
    <Box>
      {header}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" onClick={() => navigate("/models")}>
                {t("results.adjust")}
              </Button>
              <Button color="inherit" size="small" onClick={run}>
                {t("results.retry")}
              </Button>
            </Stack>
          }
        >
          {error}
        </Alert>
      )}

      {!resultsReady && results.maps && !error && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" startIcon={<RefreshIcon />} onClick={run}>{t("results.rerun")}</Button>}>
          {t("results.stale")}
        </Alert>
      )}

      {entries.length > 0 && (
        <>
          {speciesList.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 320, mb: 2 }}>
              <InputLabel id="res-species">{t("occ.table.species")}</InputLabel>
              <Select labelId="res-species" value={currentSpecies} label={t("occ.table.species")} onChange={(e) => { setSpecies(e.target.value); setSelected(null); }}>
                {speciesList.map((s) => (
                  <MenuItem key={s} value={s} sx={{ fontStyle: "italic" }}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* ── comparação ───────────────────────────────────────────────── */}
          <Section
            title={t("results.compareTitle")}
            subtitle={t("results.compareSubtitle")}
            action={
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="res-rank">{t("results.rankBy")}</InputLabel>
                <Select labelId="res-rank" value={rankBy} label={t("results.rankBy")} onChange={(e) => update("models", { rankBy: e.target.value })}>
                  {metricCols.map((k) => (
                    <MenuItem key={k} value={k}>
                      {METRIC_LABELS[k]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            }
          >
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("results.model")}</TableCell>
                    {metricCols.map((k) => (
                      <TableCell key={k} align="right">
                        <Tooltip title={t(`metrics.desc.${k}`)}>
                          <span>{METRIC_LABELS[k]}</span>
                        </Tooltip>
                      </TableCell>
                    ))}
                    <TableCell align="right">{t("results.presences")}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => {
                    const isCurrent = r.key === current?.key;
                    return (
                      <TableRow
                        key={r.key}
                        hover
                        selected={isCurrent}
                        onClick={() => setSelected(r.key)}
                        sx={{ cursor: "pointer", "&.Mui-selected": { bgcolor: "rgba(217,82,4,0.07)" } }}
                      >
                        <TableCell sx={{ fontWeight: 500 }}>
                          {MODEL_LABELS[r.model] ?? r.model}
                          {r.key === best?.key && (
                            <Chip size="small" icon={<StarIcon />} label={t("results.best")} color="secondary" variant="outlined" sx={{ ml: 1, height: 22 }} />
                          )}
                        </TableCell>
                        {metricCols.map((k) => (
                          <MetricCell key={k} metric={k} value={r.metrics?.[k]} std={r.metrics_std?.[k]} lang={lang} />
                        ))}
                        <TableCell align="right">{r.n_presence ?? "–"}</TableCell>
                        <TableCell align="right">
                          <Button size="small" variant={isCurrent ? "contained" : "text"} onClick={(e) => { e.stopPropagation(); setSelected(r.key); }}>
                            {t("results.viewMap")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1.5 }}>
              {["excellent", "good", "fair", "poor"].map((lv) => (
                <Box key={lv} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: LEVEL_COLORS[lv].bg, border: `1px solid ${LEVEL_COLORS[lv].fg}` }} />
                  <Typography variant="caption">{t(`results.level.${lv}`)}</Typography>
                </Box>
              ))}
            </Box>
          </Section>

          {/* ── mapa ─────────────────────────────────────────────────────── */}
          {current && (
            <Section
              title={t("results.mapTitle", { model: MODEL_LABELS[current.model] ?? current.model })}
              subtitle={current.species ? <i>{current.species}</i> : null}
              action={
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {download(current.path, "PNG")}
                  {download(current.tif_path, "GeoTIFF")}
                  {download(current.cells_csv_path, "CSV")}
                </Stack>
              }
            >
              <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "3fr 1fr" }, alignItems: "start" }}>
                {current.overlay_path && current.bounds ? (
                  <EcoMap
                    iso3={occ.country?.iso3}
                    points={points}
                    overlay={{ url: fileUrl(current.overlay_path), bounds: current.bounds }}
                    height={460}
                    legend={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="caption">0</Typography>
                        <Box sx={{ width: 160, height: 10, borderRadius: 1, background: `linear-gradient(to right, ${HEAT_COLORS.join(",")})` }} />
                        <Typography variant="caption">1</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", ml: 1 }}>
                          {t("results.suitability")}
                        </Typography>
                      </Box>
                    }
                  />
                ) : current.path ? (
                  <Box component="img" src={fileUrl(current.path)} alt="" sx={{ width: "100%", borderRadius: 2, border: `1px solid ${BRAND.border}` }} />
                ) : (
                  <Alert severity="warning">{t("results.noMap")}</Alert>
                )}

                <Box>
                  {current.suitability_classes && (
                    <>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {t("results.classesTitle")}
                      </Typography>
                      {SUITABILITY_CLASSES.map((c) => {
                        const pct = current.suitability_classes[c.key] ?? 0;
                        return (
                          <Box key={c.key} sx={{ mb: 1.25 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="body2">
                                {t(`results.class.${c.key}`)} <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>({lang === "pt" ? c.range : c.range.replace(/,/g, ".")})</Typography>
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {pct.toLocaleString(lang === "pt" ? "pt-BR" : "en-US")}%
                              </Typography>
                            </Box>
                            <Box sx={{ height: 8, bgcolor: "#eef0e8", borderRadius: 1, overflow: "hidden" }}>
                              <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: c.color, borderRight: pct ? "1px solid rgba(0,0,0,.15)" : 0 }} />
                            </Box>
                          </Box>
                        );
                      })}
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {t("results.classesHelp")}
                      </Typography>
                    </>
                  )}
                  {current.ensemble_info?.members && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        {t("results.ensembleMembers")}
                      </Typography>
                      {current.ensemble_info.members.map((mb) => (
                        <Typography key={mb.model} variant="body2">
                          {MODEL_LABELS[mb.model] ?? mb.model}: {Number(mb.weight).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 2 })}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>

              {importance.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t("results.importance")}
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "minmax(120px, 220px) 1fr auto", gap: 0.75, alignItems: "center", maxWidth: 720 }}>
                    {importance.map((v) => (
                      <Box key={v.name} sx={{ display: "contents" }}>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.name}>
                          {v.name}
                        </Typography>
                        <Box sx={{ height: 10, bgcolor: "#eef0e8", borderRadius: 1 }}>
                          <Box sx={{ width: `${v.pct}%`, height: "100%", bgcolor: "secondary.main", borderRadius: 1 }} />
                        </Box>
                        <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums" }}>
                          {v.value.toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 3 })}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Section>
          )}

          {/* ── metodologia ──────────────────────────────────────────────── */}
          <Section
            title={t("results.methodTitle")}
            subtitle={t("results.methodSubtitle")}
            action={
              <Stack direction="row" spacing={1}>
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyMethodology}>
                  {copied ? t("results.copied") : t("results.copy")}
                </Button>
                <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadJSON(exportParams(state), "ecolab-parametros.json")}>
                  {t("results.exportParams")}
                </Button>
              </Stack>
            }
          >
            <Typography variant="body2" sx={{ whiteSpace: "pre-line", bgcolor: "#fafbf7", p: 2, borderRadius: 1.5, border: `1px solid ${BRAND.border}` }}>
              {methodology}
            </Typography>
          </Section>

          {results.warnings?.length > 0 && (
            <Accordion disableGutters variant="outlined" sx={{ borderColor: BRAND.border, borderRadius: 2, "&:before": { display: "none" }, mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">{t("results.warnings", { n: results.warnings.length })}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {results.warnings.map((w, i) => (
                  <Alert key={i} severity="warning" sx={{ mb: 1 }}>
                    {w}
                  </Alert>
                ))}
              </AccordionDetails>
            </Accordion>
          )}
        </>
      )}

      <StepFooter onBack={() => navigate("/models")} />
    </Box>
  );
}
