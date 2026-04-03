import { Alert, Collapse } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

export default function CustomWarning({ show, msg }) {

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
        {msg}
      </Alert>
    </Collapse>
  );
}
