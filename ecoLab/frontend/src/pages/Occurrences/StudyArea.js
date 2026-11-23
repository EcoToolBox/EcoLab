import { useEffect, useState } from "react";
import { Autocomplete, Box, Checkbox, FormControlLabel, Slider, TextField, Typography } from "@mui/material";
import { useI18n } from "../../i18n";
import api from "../../services/api";

const MIN_YEAR = 1900;
const THIS_YEAR = new Date().getFullYear();

let countriesCache = null;

export function useCountries() {
  const [countries, setCountries] = useState(countriesCache ?? []);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (countriesCache) return;
    api
      .countries()
      .then((list) => {
        countriesCache = Array.isArray(list) ? list : [];
        setCountries(countriesCache);
      })
      .catch((e) => setError(e.message));
  }, []);
  return { countries, error };
}

export const countryLabel = (c, lang) => (c ? (lang === "en" ? c.name_en : c.name_pt) ?? c.name_en ?? c.iso3 : "");

/** País (sempre) e intervalo de anos (só quando busca nas bases). */
export default function StudyArea({ country, years, showYears, onCountry, onYears }) {
  const { t, lang } = useI18n();
  const { countries, error } = useCountries();
  const allYears = years?.[0] <= MIN_YEAR;

  return (
    <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: showYears ? "1fr 1fr" : "1fr" } }}>
      <Box>
        <Autocomplete
          options={countries}
          value={country ? countries.find((c) => c.iso3 === country.iso3) ?? country : null}
          onChange={(_e, v) => onCountry(v ? { iso3: v.iso3, name_en: v.name_en, name_pt: v.name_pt } : null)}
          getOptionLabel={(c) => countryLabel(c, lang)}
          isOptionEqualToValue={(a, b) => a.iso3 === b.iso3}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("occ.area.country")}
              helperText={error ? t("occ.area.countriesError") : t("occ.area.countryHelp")}
              error={!!error}
            />
          )}
        />
      </Box>

      {showYears && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            {t("occ.area.years")}: {allYears ? t("occ.area.allYears") : `${years[0]} – ${years[1]}`}
          </Typography>
          <Box sx={{ px: 1.5 }}>
            <Slider
              value={years}
              min={MIN_YEAR}
              max={THIS_YEAR}
              onChange={(_e, v) => onYears(v)}
              valueLabelDisplay="auto"
              disabled={allYears}
              marks={[
                { value: MIN_YEAR, label: String(MIN_YEAR) },
                { value: THIS_YEAR, label: String(THIS_YEAR) },
              ]}
              getAriaLabel={() => t("occ.area.years")}
            />
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={allYears}
                onChange={(e) => onYears(e.target.checked ? [MIN_YEAR, THIS_YEAR] : [THIS_YEAR - 50, THIS_YEAR])}
              />
            }
            label={<Typography variant="body2">{t("occ.area.allYearsCheck")}</Typography>}
          />
        </Box>
      )}
    </Box>
  );
}
