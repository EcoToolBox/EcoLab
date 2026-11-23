import { useState } from "react";
import {
  Alert, Box, Button, Checkbox, Collapse, FormControlLabel, InputAdornment, Switch, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useI18n } from "../../i18n";
import api from "../../services/api";
import { autoResolution, estimateCells, MAX_GRID_CELLS, rasterExtent } from "../../utils/data";

export function effectiveResolution(raster) {
  const extent = rasterExtent(raster.available, raster.files);
  return raster.autoResolution ? autoResolution(extent) : Number(raster.resolution) || 0.1;
}

/** Pasta com rasters (.tif): escolher a pasta, marcar os arquivos, resolução automática. */
export default function RasterPicker({ raster, onChange }) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const [advanced, setAdvanced] = useState(!raster.autoResolution);
  const set = (patch) => onChange({ ...raster, ...patch });
  const nf = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US");

  const scan = async (folder) => {
    setBusy(true);
    setErrors([]);
    try {
      const r = await api.scanRasters(folder);
      const available = r.files ?? [];
      const keep = raster.folder === (r.folder ?? folder) ? raster.files.filter((f) => available.some((a) => a.relativePath === f)) : [];
      set({ folder: r.folder ?? folder, available, files: keep.length ? keep : available.map((f) => f.relativePath) });
      setErrors(r.errors ?? []);
    } catch (e) {
      set({ folder, available: [], files: [] });
      setErrors([e.message]);
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    setBusy(true);
    setErrors([]);
    try {
      const { folder } = await api.pickFolder(raster.folder);
      if (folder) await scan(folder);
      else setBusy(false);
    } catch (e) {
      setErrors([e.message]);
      setBusy(false);
    }
  };

  const all = raster.available.map((f) => f.relativePath);
  const allOn = all.length > 0 && all.every((f) => raster.files.includes(f));
  const toggle = (f) => set({ files: raster.files.includes(f) ? raster.files.filter((x) => x !== f) : [...raster.files, f] });

  const extent = rasterExtent(raster.available, raster.files);
  const res = effectiveResolution(raster);
  const cells = estimateCells(extent, res);

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Button variant="contained" color="secondary" startIcon={<FolderOpenIcon />} onClick={pick} disabled={busy}>
          {raster.folder ? t("env.raster.change") : t("env.raster.pick")}
        </Button>
        <TextField
          size="small"
          sx={{ flex: 1, minWidth: 260 }}
          placeholder={t("env.raster.pathPlaceholder")}
          value={raster.folder}
          onChange={(e) => set({ folder: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && raster.folder && scan(raster.folder)}
          helperText={t("env.raster.pathHelp")}
        />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => scan(raster.folder)} disabled={busy || !raster.folder}>
          {t("env.raster.read")}
        </Button>
      </Box>

      {errors.map((e, i) => (
        <Alert key={i} severity="warning" sx={{ mt: 1.5 }}>
          {e}
        </Alert>
      ))}

      {raster.available.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allOn}
                    indeterminate={raster.files.length > 0 && !allOn}
                    onChange={(e) => set({ files: e.target.checked ? all : [] })}
                    inputProps={{ "aria-label": t("env.raster.all") }}
                  />
                </TableCell>
                <TableCell>{t("env.raster.file")}</TableCell>
                <TableCell>{t("env.raster.resolution")}</TableCell>
                <TableCell align="right">{t("env.raster.size")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {raster.available.map((f) => (
                <TableRow key={f.relativePath} hover onClick={() => toggle(f.relativePath)} sx={{ cursor: "pointer" }}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={raster.files.includes(f.relativePath)} />
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{f.relativePath}</TableCell>
                  <TableCell>{f.resolution ? `${+f.resolution[0].toPrecision(3)}°` : "–"}</TableCell>
                  <TableCell align="right">{f.sizeMB != null ? `${nf.format(f.sizeMB)} MB` : "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            {t("env.raster.selected", { n: raster.files.length, total: raster.available.length })}
          </Typography>

          {raster.files.length > 0 && !extent && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {t("env.raster.noOverlap")}
            </Alert>
          )}

          {extent && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">
                {t("env.raster.gridInfo", { res, cells: nf.format(cells) })}
              </Typography>
              <Button
                size="small"
                color="inherit"
                sx={{ mt: 0.5 }}
                onClick={() => setAdvanced((a) => !a)}
                endIcon={<ExpandMoreIcon sx={{ transform: advanced ? "rotate(180deg)" : "none" }} />}
              >
                {t("env.raster.adjust")}
              </Button>
              <Collapse in={advanced}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mt: 1 }}>
                  <FormControlLabel
                    control={<Switch checked={raster.autoResolution} onChange={(e) => set({ autoResolution: e.target.checked, resolution: res })} />}
                    label={<Typography variant="body2">{t("env.raster.auto")}</Typography>}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label={t("env.raster.manual")}
                    value={raster.autoResolution ? res : raster.resolution}
                    disabled={raster.autoResolution}
                    onChange={(e) => set({ resolution: e.target.value })}
                    inputProps={{ step: 0.01, min: 0.001 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">°</InputAdornment> }}
                    sx={{ width: 180 }}
                  />
                </Box>
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 1, maxWidth: 680 }}>
                  {t("env.raster.resHelp")}
                </Typography>
                {cells > MAX_GRID_CELLS && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {t("env.raster.tooManyCells", { cells: nf.format(cells) })}
                  </Alert>
                )}
              </Collapse>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
