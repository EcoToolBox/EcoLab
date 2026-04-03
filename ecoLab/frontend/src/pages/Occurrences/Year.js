import {
  FormControl,
  Typography,
  Slider,
  Box,
  TextField,
} from "@mui/material";

export default function YearSlider({ value, setValue }) {
  const currentYear = new Date().getFullYear();

  const handleSliderChange = (event, newValue) => {
    setValue(newValue);
  };

  const handleInputChange = (index) => (event) => {
    let newValue = [...value];
    newValue[index] = Number(event.target.value);
    if (newValue[0] > newValue[1]) return;

    setValue(newValue);
  };

  return (
    <Box>
      <FormControl fullWidth>
        <Typography gutterBottom sx={{ color: "#333", fontWeight: 600 }}>
          Intervalo de anos
        </Typography>

        {/* Inputs */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <TextField
            label="De"
            type="number"
            value={value[0]}
            onChange={handleInputChange(0)}
            Input={{ min: 1800, max: currentYear }}
            fullWidth
          />

          <TextField
            label="Até"
            type="number"
            value={value[1]}
            onChange={handleInputChange(1)}
            Input={{ min: 1800, max: currentYear }}
            fullWidth
          />
        </Box>

        {/* Slider */}
        <Slider
          value={value}
          onChange={handleSliderChange}
          valueLabelDisplay="auto"
          min={1800}
          max={currentYear}
          step={1}
          aria-label="Intervalo de anos"
        />
      </FormControl>
    </Box>
  );
}