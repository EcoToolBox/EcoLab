import { Autocomplete, Box, CircularProgress, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";

export default function PlaceCountryOrMap({ value, setValue }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("https://servicodados.ibge.gov.br/api/v1/paises")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setOptions(
          data
            .map((country) => ({
              label: country.nome.abreviado,
              code: country.id?.M49 || country.id,
              ingles: country.nome["abreviado-EN"],
            }))
            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
        );
      })
      .catch(() => active && setOptions([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <Box sx={{ maxWidth: 520 }}>
      <Typography variant="subtitle1" gutterBottom sx={{ color: "#333", fontWeight: 600 }}>
        País onde pesquisar
      </Typography>
      <Typography variant="body2" sx={{ color: "#666", mb: 1.5 }}>
        Escolha o país para limitar a busca nas fontes de ocorrência.
      </Typography>
      <Autocomplete
        options={options}
        loading={loading}
        value={value.country || null}
        getOptionLabel={(option) => option.label || ""}
        isOptionEqualToValue={(option, selected) => option.code === selected.code}
        onChange={(_, country) => setValue({ ...value, type: "country", country })}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Buscar país"
            placeholder="Ex.: Brasil"
            InputProps={{
              ...params.InputProps,
              endAdornment: <>{loading ? <CircularProgress size={20} /> : null}{params.InputProps.endAdornment}</>,
            }}
          />
        )}
      />
    </Box>
  );
}
