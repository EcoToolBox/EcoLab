import { useState } from "react";
import {
  Box, Button, Checkbox, Collapse, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useI18n } from "../../i18n";
import { BRAND } from "../../layout/Theme";
import { INTERACTION_GROUPS, interactionLabel } from "../../constants/interactions";
import { InfoTip } from "../../components/ui";

/** Interações bióticas (GloBI): opcional, agrupadas por tipo. */
export default function Interactions({ value, onChange }) {
  const { t, lang } = useI18n();
  const [openGroup, setOpenGroup] = useState(null);
  const types = value.types ?? [];
  const set = (patch) => onChange({ ...value, ...patch });

  const toggleGroup = (group, checked) => {
    const rest = types.filter((x) => !group.types.includes(x));
    set({ types: checked ? [...rest, ...group.types] : rest });
  };
  const toggleType = (type) => set({ types: types.includes(type) ? types.filter((x) => x !== type) : [...types, type] });

  return (
    <Box>
      <FormControlLabel
        control={<Switch checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} />}
        label={<Typography variant="body1">{t("env.inter.enable")}</Typography>}
      />
      <Typography variant="body2" sx={{ color: "text.secondary", ml: 6, mt: -0.5 }}>
        {t("env.inter.help")}
      </Typography>

      <Collapse in={value.enabled}>
        <Box sx={{ mt: 2, display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {INTERACTION_GROUPS.map((g) => {
            const n = g.types.filter((x) => types.includes(x)).length;
            const open = openGroup === g.key;
            return (
              <Box key={g.key} sx={{ border: `1px solid ${BRAND.border}`, borderRadius: 2, bgcolor: "background.paper" }}>
                <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
                  <Checkbox
                    checked={n === g.types.length}
                    indeterminate={n > 0 && n < g.types.length}
                    onChange={(e) => toggleGroup(g, e.target.checked)}
                    inputProps={{ "aria-label": t(`env.inter.group.${g.key}`) }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {t(`env.inter.group.${g.key}`)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {t("env.inter.groupCount", { n, total: g.types.length })}
                    </Typography>
                  </Box>
                  <Button size="small" color="inherit" onClick={() => setOpenGroup(open ? null : g.key)} endIcon={<ExpandMoreIcon sx={{ transform: open ? "rotate(180deg)" : "none" }} />}>
                    {t("env.inter.details")}
                  </Button>
                </Box>
                <Collapse in={open}>
                  <Box sx={{ px: 2, pb: 1.5, display: "flex", flexDirection: "column" }}>
                    {g.types.map((type) => (
                      <FormControlLabel
                        key={type}
                        control={<Checkbox size="small" checked={types.includes(type)} onChange={() => toggleType(type)} />}
                        label={<Typography variant="body2">{interactionLabel(type, lang)}</Typography>}
                      />
                    ))}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>{t("env.inter.depth")}</InputLabel>
            <Select value={value.depth ?? 1} label={t("env.inter.depth")} onChange={(e) => set({ depth: e.target.value })}>
              {[1, 2, 3].map((d) => (
                <MenuItem key={d} value={d}>
                  {t(`env.inter.depth${d}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <InfoTip text={t("env.inter.depthHelp")} />
        </Box>
      </Collapse>
    </Box>
  );
}
