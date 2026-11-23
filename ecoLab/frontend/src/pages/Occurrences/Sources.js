import { useEffect, useState } from "react";
import { Box, Checkbox, Chip, IconButton, InputAdornment, Link, TextField, Typography } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useT } from "../../i18n";
import { BRAND } from "../../layout/Theme";
import api from "../../services/api";

export const SOURCES = [
  { key: "gbif", label: "GBIF", needs: ["email", "userId", "apiKey"] },
  { key: "inaturalist", label: "iNaturalist", needs: [] },
  { key: "specieslink", label: "speciesLink", needs: ["apiKey"] },
];

/** Fonte pronta para buscar: dispensa credenciais ou já tem as que precisa. */
export function sourceReady(key, credentials) {
  const src = SOURCES.find((s) => s.key === key);
  const cred = credentials?.[key];
  if (!src?.needs.length) return true;
  if (cred?.alreadyExists) return true;
  return src.needs.every((f) => String(cred?.[f] ?? "").trim());
}

function SecretField({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={show ? "text" : "password"}
      autoComplete="off"
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => setShow((s) => !s)} edge="end" aria-label={label}>
              {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}

export default function Sources({ sources, credentials, onSources, onCredentials }) {
  const t = useT();

  // Já existem credenciais salvas nesta máquina? (então não pedimos de novo)
  useEffect(() => {
    ["gbif", "specieslink"].forEach((key) => {
      api
        .checkKey(key)
        .then((r) => onCredentials(key, { alreadyExists: r === true || r?.success === true }))
        .catch(() => onCredentials(key, { alreadyExists: false }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key) =>
    onSources(sources.includes(key) ? sources.filter((s) => s !== key) : [...sources, key]);

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {SOURCES.map((src) => {
        const on = sources.includes(src.key);
        const cred = credentials[src.key] ?? {};
        const ready = sourceReady(src.key, credentials);
        return (
          <Box
            key={src.key}
            sx={{
              border: "1.5px solid",
              borderColor: on ? "secondary.main" : BRAND.border,
              borderRadius: 2,
              p: 1.5,
              bgcolor: "background.paper",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Checkbox checked={on} onChange={() => toggle(src.key)} inputProps={{ "aria-label": src.label }} />
              <Box sx={{ flex: 1, cursor: "pointer" }} onClick={() => toggle(src.key)}>
                <Typography variant="subtitle1" sx={{ lineHeight: 1.3 }}>
                  {src.label}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {t(`occ.sources.${src.key}`)}
                </Typography>
              </Box>
              {on && src.needs.length > 0 && (
                <Chip
                  size="small"
                  icon={ready ? <CheckCircleIcon /> : undefined}
                  color={ready ? "success" : "warning"}
                  variant="outlined"
                  label={cred.alreadyExists ? t("occ.sources.saved") : ready ? t("occ.sources.filled") : t("occ.sources.needsLogin")}
                />
              )}
            </Box>

            {on && src.key === "gbif" && !cred.alreadyExists && (
              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, mt: 1.5, ml: { md: 6 } }}>
                <TextField size="small" label="E-mail" value={cred.email ?? ""} onChange={(e) => onCredentials("gbif", { email: e.target.value })} />
                <TextField size="small" label={t("occ.sources.gbifUser")} value={cred.userId ?? ""} onChange={(e) => onCredentials("gbif", { userId: e.target.value })} />
                <SecretField label={t("occ.sources.password")} value={cred.apiKey ?? ""} onChange={(v) => onCredentials("gbif", { apiKey: v })} />
                <Typography variant="caption" sx={{ color: "text.secondary", gridColumn: "1 / -1" }}>
                  {t("occ.sources.gbifHelp")}{" "}
                  <Link href="https://www.gbif.org/user/profile" target="_blank" rel="noreferrer">
                    gbif.org
                  </Link>
                </Typography>
              </Box>
            )}

            {on && src.key === "specieslink" && !cred.alreadyExists && (
              <Box sx={{ display: "grid", gap: 1, mt: 1.5, ml: { md: 6 }, maxWidth: 520 }}>
                <SecretField label="API key" value={cred.apiKey ?? ""} onChange={(v) => onCredentials("specieslink", { apiKey: v })} />
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {t("occ.sources.splinkHelp")}{" "}
                  <Link href="https://specieslink.net/aut/login/?next=/aut/profile/apikeys" target="_blank" rel="noreferrer">
                    specieslink.net
                  </Link>
                </Typography>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
