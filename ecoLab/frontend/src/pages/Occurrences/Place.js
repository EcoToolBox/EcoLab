import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Typography,
  Button,
  Autocomplete,
  CircularProgress 
} from "@mui/material";

import {  useState } from "react";
import MapSelector from "./Map";


export default function PlaceCountryOrMap({ value, setValue }) {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    
    const fetchCountries = async (query) => {
    if (!query || query.length < 2) return;

    setLoading(true);

    try {
        const res = await fetch(
        `https://restcountries.com/v3.1/name/${query}`
        );

        const data = await res.json();

        const formatted = data.map((c) => ({
        label: c.name.common,
        code: c.cca2,
        }));

        setOptions(formatted);
    } catch (err) {
        setOptions([]);
    }

    setLoading(false);
    };
  const handleModeChange = (_, newMode) => {
    if (!newMode) return;

    setValue({
      ...value,
      type: newMode,
    });
  };

  return (
    <Box>
      <Typography sx={{ fontWeight: 600, mb: 2 }}>
        Localização
      </Typography>

      <ToggleButtonGroup
        value={value.type}
        exclusive
        onChange={handleModeChange}
        sx={{ mb: 2 }}
        fullWidth
      >
        <ToggleButton value="country">País</ToggleButton>
        <ToggleButton value="map">Mapa</ToggleButton>
      </ToggleButtonGroup>

      {value.type === "country" && (
        <Autocomplete
            options={options}
            loading={loading}
            value={value.country || null}
            getOptionLabel={(option) => option.label || ""}
            onChange={(_, newValue) => {
                setValue({
                ...value,
                country: newValue,
                });
            }}
            onInputChange={(_, newInputValue) => {
                fetchCountries(newInputValue);
            }}
            renderInput={(params) => (
                <TextField
                {...params}
                label="Buscar país"
                Input={{
                    ...params.InputProps,
                    endAdornment: (
                    <>
                        {loading ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                    </>
                    ),
                }}
                />
            )}
            />
      )}

      {value.type === "map" && (
        <MapSelector value={value} setValue={setValue} />
      )}
    </Box>
  );
}