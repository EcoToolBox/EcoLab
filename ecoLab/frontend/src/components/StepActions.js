import { Box, Button, Tooltip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useStepNavigation } from "../hooks/useStepNavigation";

const NEXT_BTN_SX = {
  bgcolor: "#D95204",
  color: "#fff",
  fontWeight: 600,
  px: 3,
  "&:hover": { bgcolor: "#b84303" },
  "&.Mui-disabled": { bgcolor: "rgba(217,82,4,0.3)", color: "rgba(255,255,255,0.3)" },
};

const BACK_BTN_SX = {
  color: "rgba(255,255,255,0.5)",
  borderColor: "rgba(255,255,255,0.15)",
  "&:hover": { borderColor: "rgba(255,255,255,0.4)", color: "#fff" },
};

/**
 * Renders Back / Next navigation buttons for the wizard flow.
 *
 * @param {boolean} disableNext  - disables the Next button (e.g. validation not met)
 * @param {string}  disableHint  - tooltip shown when Next is disabled
 */
export default function StepActions({ disableNext = false, disableHint = "", selectedSpecies}) {
  const { goNext, goBack, isFirst, isLast } = useStepNavigation();

    const handleNext = () => {
    localStorage.setItem(
      "Selected Species",
      JSON.stringify(selectedSpecies)
    );

    goNext();
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
      {!isFirst ? (
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={goBack}
          sx={BACK_BTN_SX}
        >
          Voltar
        </Button>
      ) : (
        <span />
      )}

      {!isLast && (
        <Tooltip title={disableNext ? disableHint : ""} placement="top">
          <span>
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={handleNext}
              disabled={disableNext}
              sx={NEXT_BTN_SX}
            >
              Próximo
            </Button>
          </span>
        </Tooltip>
      )}
    </Box>
  );
}
