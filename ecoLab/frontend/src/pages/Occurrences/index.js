import { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import { useAnalysis, stamp } from "../../state/AnalysisContext";
import { PageHeader, Section, OptionCards, StepFooter, ProgressPanel, DataTable, Stat } from "../../components/ui";
import SpreadsheetPicker from "../../components/SpreadsheetPicker";
import EcoMap from "../../components/EcoMap";
import SpeciesPicker from "./SpeciesPicker";
import Sources, { sourceReady, SOURCES } from "./Sources";
import StudyArea from "./StudyArea";
import api from "../../services/api";
import { OCC_FIELD_ALIASES, asRows, isExcluded, occurrencePoints, rowSpecies, selectedRows, speciesName, summarizeOccurrences, withId } from "../../utils/data";

export const MIN_PRESENCES = 5;
export const FEW_PRESENCES = 10;

export default function Occurrences() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { state, update, files, occHash, occReady, occStale } = useAnalysis();
  const occ = state.occ;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const usesSources = occ.mode !== "upload";
  const usesUpload = occ.mode !== "sources";
  const set = (patch) => update("occ", patch);
  const setCredentials = (key, patch) =>
    update("occ", (o) => ({ credentials: { ...o.credentials, [key]: { ...o.credentials[key], ...patch } } }));

  // ── o que falta para buscar ────────────────────────────────────────────────
  const missing = (() => {
    if (usesSources) {
      if (!occ.species.length) return t("occ.need.species");
      if (!occ.sources.length) return t("occ.need.source");
      const notReady = occ.sources.find((s) => !sourceReady(s, occ.credentials));
      if (notReady) return t("occ.need.login", { source: SOURCES.find((s) => s.key === notReady).label });
    }
    if (usesUpload) {
      if (!occ.upload.fileName || !files.current.occUpload) return t("occ.need.file");
      const req = ["species", "latitude", "longitude"].filter((k) => !occ.upload.mapping?.[k]);
      if (req.length) return t("occ.need.columns", { cols: req.map((k) => t(`occ.field.${k}`)).join(", ") });
    }
    if (!occ.country) return t("occ.need.country");
    return null;
  })();

  // ── busca ──────────────────────────────────────────────────────────────────
  const fetchOccurrences = async () => {
    setRunning(true);
    setError(null);
    const notices = [];
    try {
      let fromSources = [];
      if (usesSources) {
        const auth = [];
        const cred = occ.credentials;
        if (occ.sources.includes("gbif") && !cred.gbif.alreadyExists) {
          auth.push(
            api.authenticateGbif({ email: cred.gbif.email, userId: cred.gbif.userId, apiKey: cred.gbif.apiKey }).then((r) => {
              if (r?.success === false || r?.error) throw new Error(t("occ.err.gbifLogin", { msg: r.message ?? r.error }));
              setCredentials("gbif", { alreadyExists: true, apiKey: "" });
            })
          );
        }
        if (occ.sources.includes("specieslink") && !cred.specieslink.alreadyExists) {
          auth.push(
            api.authenticateSpeciesLink({ apiKey: cred.specieslink.apiKey }).then((r) => {
              if (r?.success === false || r?.error) throw new Error(t("occ.err.splinkLogin", { msg: r.message ?? r.error }));
              setCredentials("specieslink", { alreadyExists: true, apiKey: "" });
            })
          );
        }
        await Promise.all(auth);
        fromSources = asRows(
          await api.searchOccurrences({
            sources: occ.sources,
            species: occ.species.map((s) => ({ key: s.key, name: s.name ?? s.canonicalName })),
            country: occ.country,
            years: occ.years,
          })
        );
      }

      let fromUpload = [];
      if (usesUpload) {
        const res = await api.uploadOccurrences(files.current.occUpload, occ.upload.mapping);
        if (res?.success === false) throw new Error((res.errors ?? []).join(" ") || t("occ.err.upload"));
        (res?.errors ?? []).forEach((e) => notices.push(e));
        fromUpload = res?.data ?? [];
      }

      // Em "as duas", só as espécies escolhidas por nome entram marcadas; as
      // outras espécies da planilha ficam desmarcadas (dá para marcar na tabela).
      let excludedSpecies = [];
      if (occ.mode === "both") {
        const picked = occ.species.map((s) => speciesName(s).toLowerCase());
        const matches = (n) => picked.some((p) => n.toLowerCase() === p || n.toLowerCase().startsWith(p + " "));
        excludedSpecies = [...new Set(fromUpload.map(rowSpecies).filter((n) => n && !matches(n)))];
      }
      set({ data: withId([...fromSources, ...fromUpload]), excludedSpecies, fetchedHash: stamp(occHash), notices });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  const summary = useMemo(() => summarizeOccurrences(occ.data), [occ.data]);
  const excluded = occ.excludedSpecies ?? [];
  const points = useMemo(() => occurrencePoints(selectedRows(occ, occ.data)), [occ.data, excluded]); // eslint-disable-line react-hooks/exhaustive-deps
  const tooFew = summary.species.filter((s) => s.unique < MIN_PRESENCES && !isExcluded(occ, s.name));
  const nSelected = summary.species.filter((s) => !isExcluded(occ, s.name)).length;
  const toggleSpecies = (name) =>
    set({ excludedSpecies: isExcluded(occ, name) ? excluded.filter((n) => n.toLowerCase() !== name.toLowerCase()) : [...excluded, name] });
  const allOn = nSelected === summary.species.length;
  const nf = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US");

  const occFields = [
    { key: "species", label: t("occ.field.species"), required: true },
    { key: "latitude", label: t("occ.field.latitude"), required: true },
    { key: "longitude", label: t("occ.field.longitude"), required: true },
    { key: "eventDate", label: t("occ.field.eventDate"), optional: true },
    { key: "presence", label: t("occ.field.presence"), optional: true, helper: t("occ.field.presenceHelp") },
    { key: "bufferKm", label: t("occ.field.bufferKm"), optional: true, helper: t("occ.field.bufferKmHelp") },
  ];

  let n = 0;
  const num = () => {
    n += 1;
    return `${n}. `;
  };

  return (
    <Box>
      <PageHeader step={t("common.stepOf", { n: 1, total: 4 })} title={t("occ.title")} subtitle={t("occ.subtitle")} />

      <Section title={num() + t("occ.modeTitle")}>
        <OptionCards
          value={occ.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: "sources", title: t("occ.mode.sources.title"), description: t("occ.mode.sources.desc"), icon: <CloudDownloadIcon /> },
            { value: "upload", title: t("occ.mode.upload.title"), description: t("occ.mode.upload.desc"), icon: <UploadFileIcon /> },
            { value: "both", title: t("occ.mode.both.title"), description: t("occ.mode.both.desc"), icon: <MergeTypeIcon /> },
          ]}
        />
      </Section>

      {usesSources && (
        <Section title={num() + t("occ.speciesTitle")} subtitle={t("occ.speciesSubtitle")}>
          <SpeciesPicker species={occ.species} onChange={(species) => set({ species })} />
        </Section>
      )}

      {usesSources && (
        <Section title={num() + t("occ.sourcesTitle")} subtitle={t("occ.sourcesSubtitle")}>
          <Sources sources={occ.sources} credentials={occ.credentials} onSources={(sources) => set({ sources })} onCredentials={setCredentials} />
        </Section>
      )}

      {usesUpload && (
        <Section title={num() + t("occ.uploadTitle")} subtitle={t("occ.uploadSubtitle")}>
          <SpreadsheetPicker
            upload={occ.upload}
            file={files.current.occUpload}
            fields={occFields}
            aliases={OCC_FIELD_ALIASES}
            onFile={(file, upload) => {
              files.current.occUpload = file;
              set({ upload });
            }}
            onMapping={(mapping) => set({ upload: { ...occ.upload, mapping } })}
          />
        </Section>
      )}

      <Section title={num() + t("occ.areaTitle")} subtitle={usesSources ? t("occ.areaSubtitle") : t("occ.areaSubtitleUpload")}>
        <StudyArea
          country={occ.country}
          years={occ.years}
          showYears={usesSources}
          onCountry={(country) => set({ country })}
          onYears={(years) => set({ years })}
        />
      </Section>

      {/* ── ação principal ─────────────────────────────────────────────────── */}
      {!running && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", my: 3 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={occ.data.length ? <RefreshIcon /> : <SearchIcon />}
            onClick={fetchOccurrences}
            disabled={!!missing}
          >
            {occ.data.length ? t("occ.fetchAgain") : usesSources ? t("occ.fetch") : t("occ.read")}
          </Button>
          {missing && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {missing}
            </Typography>
          )}
        </Box>
      )}

      {running && <ProgressPanel title={t("occ.progressTitle")} messages={t(usesSources ? "occ.progress" : "occ.progressUpload")} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── resultado ─────────────────────────────────────────────────────── */}
      {!running && occ.data.length > 0 && (
        <Section title={t("occ.resultTitle")} sx={{ borderColor: occStale ? "warning.main" : undefined }}>
          {occStale && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t("occ.stale")}
            </Alert>
          )}
          <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", mb: 2.5 }}>
            <Stat value={nf.format(summary.total)} label={t("occ.stat.records")} />
            <Stat value={nf.format(summary.unique)} label={t("occ.stat.unique")} />
            <Stat
              value={nSelected === summary.species.length ? nf.format(summary.species.length) : `${nf.format(nSelected)}/${nf.format(summary.species.length)}`}
              label={nSelected === summary.species.length ? t("occ.stat.species") : t("occ.stat.speciesSelected")}
            />
            {summary.invalid > 0 && <Stat value={nf.format(summary.invalid)} label={t("occ.stat.invalid")} tone="warn" />}
            {summary.backgroundRows > 0 && <Stat value={nf.format(summary.backgroundRows)} label={t("occ.stat.background")} />}
          </Box>

          {(occ.notices ?? []).map((msg, i) => (
            <Alert key={i} severity="info" sx={{ mb: 1 }}>
              {msg}
            </Alert>
          ))}
          {tooFew.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t("occ.tooFew", { n: MIN_PRESENCES, list: tooFew.map((s) => s.name).join(", ") })}
            </Alert>
          )}

          {summary.species.length > 1 && (
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
              {t("occ.table.selectHint")}
            </Typography>
          )}
          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 2fr) 3fr" }, alignItems: "start" }}>
            <Box sx={{ maxHeight: 420, overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={allOn}
                        indeterminate={nSelected > 0 && !allOn}
                        onChange={(e) => set({ excludedSpecies: e.target.checked ? [] : summary.species.map((s) => s.name) })}
                        inputProps={{ "aria-label": t("occ.table.selectAll") }}
                      />
                    </TableCell>
                    <TableCell>{t("occ.table.species")}</TableCell>
                    <TableCell align="right">{t("occ.table.records")}</TableCell>
                    <TableCell align="right">{t("occ.table.unique")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.species.map((s) => (
                    <TableRow key={s.name} hover sx={{ opacity: isExcluded(occ, s.name) ? 0.5 : 1 }}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={!isExcluded(occ, s.name)} onChange={() => toggleSpecies(s.name)} inputProps={{ "aria-label": s.name }} />
                      </TableCell>
                      <TableCell sx={{ fontStyle: "italic" }}>{s.name}</TableCell>
                      <TableCell align="right">{nf.format(s.records)}</TableCell>
                      <TableCell align="right">
                        {s.unique < MIN_PRESENCES ? (
                          <Chip size="small" color="error" variant="outlined" label={s.unique} title={t("occ.table.tooFewTip")} />
                        ) : s.unique < FEW_PRESENCES ? (
                          <Chip size="small" color="warning" variant="outlined" label={s.unique} title={t("occ.table.fewTip")} />
                        ) : (
                          nf.format(s.unique)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <EcoMap iso3={occ.country?.iso3} points={points} height={380} />
          </Box>
          <DataTable rows={occ.data} filename="ecolab-ocorrencias.csv" label={t("occ.showAll")} />
        </Section>
      )}

      {!running && occ.fetchedHash && occ.data.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("occ.empty")}
        </Alert>
      )}

      <StepFooter
        onBack={() => navigate("/")}
        onNext={() => navigate("/environment")}
        nextDisabled={!occReady || summary.unique === 0 || nSelected === 0}
        reason={occStale ? t("occ.reason.stale") : occReady && nSelected === 0 ? t("occ.reason.noneSelected") : t("occ.reason.fetch")}
      />
    </Box>
  );
}
