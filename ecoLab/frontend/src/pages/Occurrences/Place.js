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

import { useState, useEffect } from "react";
import MapSelector from "./Map";


export default function PlaceCountryOrMap({ value, setValue }) {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchCountries = async () => {
            setLoading(true);
            try {
                const res = await fetch("https://servicodados.ibge.gov.br/api/v1/paises");
                const data = await res.json();

                const formatted = data
                    .map((c) => ({
                        label: c.nome.abreviado,
                        code: c.id?.M49 || c.id,
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

                setOptions(formatted);
            } catch (err) {
                setOptions([]);
            }
            setLoading(false);
        };

        fetchCountries();
    }, []);

  const handleModeChange = (_, newMode) => {
    if (!newMode) return;

    setValue({
      ...value,
      type: newMode,
    });
  };

  return (
    <Box>
       <Typography gutterBottom sx={{ color: "#333", fontWeight: 600 }}>
         País
        </Typography>
      {value.type === "country" && (
        <Autocomplete
            options={options}
            loading={loading}
            value={value.country || null}
            getOptionLabel={(option) => option.label || ""}
            isOptionEqualToValue={(option, val) => option.code === val.code}
            onChange={(_, newValue) => {
                setValue({
                ...value,
                country: newValue,
                });
            }}
            renderInput={(params) => (
                <TextField
                {...params}
                label="Buscar país"
                placeholder="Digite o nome do país"
                InputProps={{
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
    </Box>
  );
}