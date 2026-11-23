import { useEffect, useState } from "react";
import {
  Box, Button, Typography, Paper, Tooltip, IconButton, LinearProgress, Collapse, Stack,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useT } from "../i18n";
import { BRAND } from "../layout/Theme";
import { exportCSV } from "../utils/data";

/** Título e subtítulo de cada etapa (sempre visíveis, mesma posição em todas). */
export function PageHeader({ step, title, subtitle, actions }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 3 }}>
      <Box sx={{ flex: 1 }}>
        {step && (
          <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 600, letterSpacing: 1 }}>
            {step}
          </Typography>
        )}
        <Typography variant="h4" component="h1" sx={{ color: "text.primary" }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" sx={{ color: "text.secondary", mt: 0.5, maxWidth: 760 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions}
    </Box>
  );
}

/** Bloco com título; agrupa uma parte da etapa. */
export function Section({ title, subtitle, action, children, sx }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 2.5, borderColor: BRAND.border, ...sx }}>
      {(title || action) && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: subtitle ? 0.5 : 2 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            {title}
          </Typography>
          {action}
        </Box>
      )}
      {subtitle && (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Paper>
  );
}

export function InfoTip({ text }) {
  if (!text) return null;
  return (
    <Tooltip title={text} placement="top">
      <IconButton size="small" sx={{ color: "text.secondary", p: 0.25, ml: 0.25 }} aria-label={text}>
        <InfoOutlinedIcon sx={{ fontSize: 17 }} />
      </IconButton>
    </Tooltip>
  );
}

/** Escolha exclusiva em cartões (no lugar de rádios soltos). */
export function OptionCards({ value, onChange, options, columns = 3 }) {
  return (
    <Box
      role="radiogroup"
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: `repeat(${columns}, 1fr)` },
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Box
            key={opt.value}
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(opt.value)}
            sx={{
              cursor: "pointer",
              border: "1.5px solid",
              borderColor: selected ? "primary.main" : BRAND.border,
              bgcolor: selected ? "rgba(217,82,4,0.06)" : "background.paper",
              borderRadius: 2,
              p: 2,
              position: "relative",
              transition: "border-color .15s, background-color .15s",
              "&:hover": { borderColor: selected ? "primary.main" : "#c9cdbf" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              {opt.icon && <Box sx={{ color: selected ? "primary.main" : "secondary.main", display: "flex" }}>{opt.icon}</Box>}
              <Typography variant="subtitle1" sx={{ flex: 1, lineHeight: 1.3 }}>
                {opt.title}
              </Typography>
              {selected && <CheckCircleIcon sx={{ color: "primary.main", fontSize: 20 }} />}
            </Box>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {opt.description}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Rodapé fixo da etapa: Voltar / Próximo. Quando o Próximo está bloqueado, o
 * motivo aparece escrito ao lado dele (antes ficava escondido num tooltip).
 */
export function StepFooter({ onBack, onNext, nextLabel, nextDisabled, reason, nextIcon }) {
  const t = useT();
  return (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        zIndex: 5,
        mt: 4,
        mx: { xs: -2, md: -4 },
        px: { xs: 2, md: 4 },
        py: 1.5,
        bgcolor: "rgba(245,246,241,0.94)",
        backdropFilter: "blur(6px)",
        borderTop: `1px solid ${BRAND.border}`,
        display: "flex",
        alignItems: "center",
        gap: 2,
      }}
    >
      {onBack ? (
        <Button variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ borderColor: BRAND.border }}>
          {t("common.back")}
        </Button>
      ) : (
        <span />
      )}
      <Box sx={{ flex: 1 }} />
      {nextDisabled && reason && (
        <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "right", maxWidth: 520 }} role="status">
          {reason}
        </Typography>
      )}
      {onNext && (
        <Button
          variant="contained"
          size="large"
          endIcon={nextIcon ?? <ArrowForwardIcon />}
          onClick={onNext}
          disabled={nextDisabled}
        >
          {nextLabel ?? t("common.next")}
        </Button>
      )}
    </Box>
  );
}

/** Tela de espera com barra de progresso, fase atual e tempo decorrido. */
export function ProgressPanel({ title, messages = [], interval = 4000 }) {
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % messages.length), interval);
    return () => clearInterval(id);
  }, [messages, interval]);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <Paper variant="outlined" sx={{ p: 4, my: 2, textAlign: "center", borderColor: BRAND.border }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <LinearProgress sx={{ maxWidth: 480, mx: "auto", height: 6, borderRadius: 3, mb: 2 }} />
      <Typography variant="body2" key={i} sx={{ color: "text.secondary", minHeight: 22 }}>
        {messages[i]}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {mm}:{ss}
      </Typography>
    </Paper>
  );
}

/** Tabela recolhível com exportação para CSV. */
export function DataTable({ rows, filename, label, defaultOpen = false, columnLabels = {}, height = 420 }) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  if (!rows?.length) return null;
  const columns = Object.keys(rows[0])
    .filter((k) => k !== "id")
    .map((k) => ({ field: k, headerName: columnLabels[k] ?? k, flex: 1, minWidth: 130 }));
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          size="small"
          color="inherit"
          onClick={() => setOpen((o) => !o)}
          endIcon={<ExpandMoreIcon sx={{ transform: open ? "rotate(180deg)" : "none", transition: ".2s" }} />}
        >
          {open ? t("common.hideTable") : label ?? t("common.showTable")}
        </Button>
        <Button size="small" startIcon={<DownloadIcon />} onClick={() => exportCSV(rows, filename)}>
          {t("common.exportCsv")}
        </Button>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ height, mt: 1, bgcolor: "background.paper" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            density="compact"
            disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
            pageSizeOptions={[25, 50, 100]}
          />
        </Box>
      </Collapse>
    </Box>
  );
}

/** Número em destaque com rótulo (resumos das etapas). */
export function Stat({ value, label, tone }) {
  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography
        sx={{ fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.2, color: tone === "warn" ? "warning.dark" : "text.primary" }}
      >
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
    </Box>
  );
}
