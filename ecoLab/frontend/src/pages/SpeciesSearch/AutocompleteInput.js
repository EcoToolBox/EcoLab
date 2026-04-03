import {
  Autocomplete,
  TextField,
  CircularProgress,
  Typography,
  Box,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useSpeciesAutocomplete } from "../../hooks/useSpeciesAutocomplete";

const INPUT_SX = {
  bgcolor: "rgba(255,255,255,0.95)",
  borderRadius: 1,
  "& .MuiOutlinedInput-root": {
    "&.Mui-focused fieldset": { borderColor: "#D95204" },
  },
  "& .MuiInputLabel-root.Mui-focused": { color: "#D95204" },
};

export default function AutocompleteInput({ selectedSpecies, onSelect }) {
  const { query, setQuery, options, loading } = useSpeciesAutocomplete();

  const handleChange = (_event, newValue) => {
    if (!newValue) return;
    onSelect(newValue);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <SearchIcon sx={{ color: "#D95204", fontSize: 18 }} />
        <Typography
          variant="subtitle2"
          sx={{
            color: "rgba(255,255,255,0.7)",
            letterSpacing: 1,
            textTransform: "uppercase",
            fontSize: "0.7rem",
          }}
        >
          Busca por nome
        </Typography>
      </Box>

      <Autocomplete
        sx={INPUT_SX}
        options={options}
        getOptionLabel={(option) => option.name ?? ""}
        isOptionEqualToValue={(option, value) => option.key === value.key}
        loading={loading}
        value={null}
        inputValue={query}
        onInputChange={(_e, val) => setQuery(val)}
        onChange={handleChange}
        filterOptions={(x) => x} // filtering is done server-side
        noOptionsText={
          query.trim() ? "Nenhuma espécie encontrada" : "Digite para buscar"
        }
        renderOption={(props, option) => {
          const alreadySelected = selectedSpecies.some((s) => s.key === option.key);
          return (
            <li {...props} key={option.key} aria-disabled={alreadySelected}>
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontStyle: "italic",
                    color: alreadySelected ? "#aaa" : "inherit",
                  }}
                >
                  {option.name}
                  {alreadySelected && (
                    <Typography component="span" variant="caption" sx={{ ml: 1, color: "#D95204" }}>
                      já selecionada
                    </Typography>
                  )}
                </Typography>
                {option.family && (
                  <Typography variant="caption" color="text.secondary">
                    Família: {option.family}
                  </Typography>
                )}
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Buscar espécie"
            InputProps={{
              ...params.InputProps,
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
    </Box>
  );
}
