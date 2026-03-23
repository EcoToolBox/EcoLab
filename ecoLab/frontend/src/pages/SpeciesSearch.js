import { useState, useMemo } from "react";
import {
  Autocomplete,
  TextField,
  Typography,
  CircularProgress
} from "@mui/material";
import debounce from "lodash/debounce";


export default function SpeciesSearch({ selectedSpecies, setSelectedSpecies }) {
  const [options, setOptions] = useState([]);
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSpecies = async (value) => {
    if (!value) return;

    setLoading(true);
    const res = await fetch(
      `http://127.0.0.1:8000/api/autocomplete/?species_name=${value}`
    );
    const data = await res.json();
    setOptions(data.msg);
    setLoading(false);
  };

  const debouncedFetch = useMemo(
    () => debounce(fetchSpecies, 400),
    []
  );

  return (
    <>
      <Typography variant="h5" mb={3}>
        Buscar espécies
      </Typography>

      <Autocomplete
          style={{background:"#fff"}}
          sx={{
            "& .MuiOutlinedInput-root": {
              "&.Mui-focused fieldset": {
                borderColor: "#D95204",
              },
            },
              "& .MuiInputLabel-root.Mui-focused": {
                color: "#D95204",
            },
          }}
        multiple
        options={options || []}
        value={species}
        getOptionLabel={(option) => option.name || ""}
        loading={loading}
        renderTags={() => null}

        onInputChange={(event, newValue) => {
          debouncedFetch(newValue);
        }}

        onChange={(event, newValue) => {
          if (newValue.length === 0) return;

          const last = newValue[newValue.length - 1];

          if (!selectedSpecies.find((s) => s.key === last.key)) {
            setSelectedSpecies([...selectedSpecies, last]);
            setSpecies(species)
          }
        }}

        renderInput={(params) => (
          <TextField
            {...params}
            label="Buscar espécie"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress size={20} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    </>
  );
}