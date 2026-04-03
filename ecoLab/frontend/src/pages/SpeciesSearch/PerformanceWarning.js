import { Alert, Collapse } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { PERFORMANCE_WARNING_THRESHOLD } from "../../constants/taxonomy";

export default function PerformanceWarning({ count }) {
  const show = count > PERFORMANCE_WARNING_THRESHOLD;

  return (
    <Collapse in={show} unmountOnExit>
      <Alert
        severity="warning"
        icon={<WarningAmberIcon fontSize="small" />}
        sx={{
          mb: 2,
          bgcolor: "rgba(217,82,4,0.15)",
          color: "#3a342c",
          border: "1px solid rgba(217,82,4,0.4)",
          "& .MuiAlert-icon": { color: "#D95204" },
        }}
      >
        Você selecionou {count} espécies. Consultas com muitas espécies podem
        apresentar lentidão. Considere reduzir a seleção para melhores resultados.
      </Alert>
    </Collapse>
  );
}
