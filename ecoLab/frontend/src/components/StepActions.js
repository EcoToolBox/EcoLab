import { Box, Button, Tooltip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate } from "react-router-dom";
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
 * @param {boolean} disableNext  – disables the Next button
 * @param {string}  disableHint  – tooltip shown when Next is disabled
 * @param {Array}   selectedSpecies – persisted to localStorage on Next
 * @param {string}  [nextOverride] – path to navigate to instead of the default next STEPS entry.
 *                                   Needed for pages (like the column-mapping screens) that sit
 *                                   outside the main STEPS array.
 * @param {string}  [backOverride] – path to navigate to instead of the default previous STEPS entry.
 */
export default function StepActions({
  disableNext = false,
  disableHint = "",
  selectedSpecies,
  nextOverride,
  backOverride,
}) {
  const { goNext, goBack, isFirst, isLast } = useStepNavigation();
  const navigate = useNavigate();

  const handleNext = () => {
    if (selectedSpecies) {
      localStorage.setItem("Selected Species", JSON.stringify(selectedSpecies));
    }
    if (nextOverride) navigate(nextOverride);
    else goNext();
  };

  const handleBack = () => {
    if (backOverride) navigate(backOverride);
    else goBack();
  };

  const showBack = backOverride ? true : !isFirst;
  const showNext = nextOverride ? true : !isLast;

  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
      {showBack ? (
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={BACK_BTN_SX}
        >
          Voltar
        </Button>
      ) : (
        <span />
      )}

      {showNext && (
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
