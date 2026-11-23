import { useState } from "react";
import {
  Autocomplete, Box, Button, Chip, CircularProgress, Tab, Tabs, TextField, Typography, Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useT } from "../../i18n";
import { useSpeciesAutocomplete } from "../../hooks/useSpeciesAutocomplete";
import api from "../../services/api";
import { speciesName } from "../../utils/data";

export const MANUAL_SPECIES_LIMIT = 50;

/** Escolha das espécies: busca por nome ou lista colada. */
export default function SpeciesPicker({ species, onChange }) {
  const t = useT();
  const [tab, setTab] = useState(0);
  const { query, setQuery, options, loading } = useSpeciesAutocomplete();
  const [list, setList] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg, setBulkMsg] = useState(null);

  const add = (items) => {
    const keys = new Set(species.map((s) => s.key));
    onChange([...species, ...items.filter((s) => !keys.has(s.key))]);
  };
  const remove = (key) => onChange(species.filter((s) => s.key !== key));

  const addList = async () => {
    const names = [...new Set(list.split(/[\n,;]/).map((n) => n.trim()).filter(Boolean))];
    if (!names.length) return;
    setBulkLoading(true);
    setBulkMsg(null);
    const found = await Promise.all(
      names.map(async (name) => {
        try {
          const hits = await api.autocomplete(name);
          const lower = name.toLowerCase();
          return hits.find((h) => h.name?.toLowerCase() === lower) ?? hits[0] ?? null;
        } catch {
          return null;
        }
      })
    );
    const ok = found.filter(Boolean);
    add(ok);
    const missing = names.filter((_, i) => !found[i]);
    setBulkMsg({
      severity: missing.length ? "warning" : "success",
      text: missing.length
        ? t("occ.species.bulkPartial", { ok: ok.length, missing: missing.join(", ") })
        : t("occ.species.bulkOk", { n: ok.length }),
    });
    if (!missing.length) setList("");
    setBulkLoading(false);
  };

  return (
    <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, minHeight: 40 }}>
        <Tab label={t("occ.species.byName")} sx={{ minHeight: 40 }} />
        <Tab label={t("occ.species.paste")} sx={{ minHeight: 40 }} />
      </Tabs>

      {tab === 0 && (
        <Autocomplete
          options={options}
          loading={loading}
          value={null}
          inputValue={query}
          onInputChange={(_e, v, reason) => reason !== "reset" && setQuery(v)}
          onChange={(_e, v) => {
            if (v) {
              add([v]);
              setQuery("");
            }
          }}
          filterOptions={(x) => x}
          getOptionLabel={(o) => o?.name ?? ""}
          isOptionEqualToValue={(o, v) => o.key === v.key}
          noOptionsText={query.trim().length < 3 ? t("occ.species.typeMore") : t("occ.species.none")}
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            const already = species.some((s) => s.key === option.key);
            return (
              <Box component="li" key={key} {...rest} sx={{ display: "flex", gap: 1 }}>
                <Typography sx={{ fontStyle: "italic", flex: 1 }}>{option.name}</Typography>
                {already && <Chip size="small" label={t("occ.species.added")} />}
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("occ.species.searchLabel")}
              placeholder={t("occ.species.searchPlaceholder")}
              InputProps={{
                ...params.InputProps,
                startAdornment: <SearchIcon sx={{ color: "text.secondary", mr: 0.5 }} />,
                endAdornment: (
                  <>
                    {loading && <CircularProgress size={18} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      )}

      {tab === 1 && (
        <Box>
          <TextField
            fullWidth
            multiline
            minRows={4}
            value={list}
            onChange={(e) => setList(e.target.value)}
            placeholder={"Melipona seminigra\nPlebeia remota"}
            helperText={t("occ.species.pasteHelp")}
          />
          <Button variant="outlined" sx={{ mt: 1 }} onClick={addList} disabled={bulkLoading || !list.trim()}>
            {bulkLoading ? t("occ.species.searching") : t("occ.species.addList")}
          </Button>
          {bulkMsg && (
            <Alert severity={bulkMsg.severity} sx={{ mt: 1.5 }}>
              {bulkMsg.text}
            </Alert>
          )}
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
          {species.length ? t("occ.species.selected", { n: species.length }) : t("occ.species.noneSelected")}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {species.map((s) => (
            <Chip key={s.key} label={speciesName(s)} onDelete={() => remove(s.key)} sx={{ fontStyle: "italic" }} />
          ))}
          {species.length > 1 && (
            <Button size="small" color="inherit" onClick={() => onChange([])}>
              {t("occ.species.clear")}
            </Button>
          )}
        </Box>
        {species.length > MANUAL_SPECIES_LIMIT && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            {t("occ.species.tooMany", { n: species.length })}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
