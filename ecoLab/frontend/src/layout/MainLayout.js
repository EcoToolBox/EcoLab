import {
  Box, Typography, List, ListItem, ListItemText,
  IconButton, Chip, Tooltip, Stepper, Step, StepLabel,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { Outlet, useLocation } from "react-router-dom";
import { PERFORMANCE_WARNING_THRESHOLD } from "../constants/taxonomy";
import { STEPS } from "../constants/steps";
import Theme from "./Theme";
import logo from "../assets/EcoLab.png";

// Skip the Home step in the stepper — it's not a real workflow step
const STEPPER_STEPS = STEPS.filter((s) => s.path !== "/");

export default function MainLayout({ selectedSpecies = [], setSelectedSpecies }) {
  const overLimit = selectedSpecies.length > PERFORMANCE_WARNING_THRESHOLD;
  const { pathname } = useLocation();
  const activeStep = STEPPER_STEPS.findIndex((s) => s.path === pathname);

  const removeSpecies = (key) =>
    setSelectedSpecies((prev) => prev.filter((s) => s.key !== key));

  const clearAll = () => {
    setSelectedSpecies([]);
    localStorage.removeItem("Selected Species"); // remove rather than writing stale data
  };

  return (
    <Theme>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", color: "white" }}>

        {/* Header / stepper */}
        <Box
          component="header"
          sx={{
            bgcolor: "#0f1a00",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            px: 4,
            py: 1.5,
          }}
        >
          <img
            src={logo}
            alt="EcoLab Logo"
            style={{ width: "20%", marginBottom: "-2%", marginLeft: "-5.5%" }}
          />
          <Stepper
            activeStep={activeStep}
            sx={{
              maxWidth: 700,
              mx: "auto",
              "& .MuiStepLabel-label": { color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" },
              "& .MuiStepLabel-label.Mui-active": { color: "#D95204", fontWeight: 600 },
              "& .MuiStepLabel-label.Mui-completed": { color: "rgba(255,255,255,0.6)" },
              "& .MuiStepIcon-root": { color: "rgba(255,255,255,0.15)" },
              "& .MuiStepIcon-root.Mui-active": { color: "#D95204" },
              "& .MuiStepIcon-root.Mui-completed": { color: "#6a9a2a" },
              "& .MuiStepConnector-line": { borderColor: "rgba(255,255,255,0.12)" },
            }}
          >
            {STEPPER_STEPS.map((step) => (
              <Step key={step.path}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Body */}
        <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Sidebar */}
          <Box
            component="aside"
            aria-label="Espécies selecionadas"
            sx={{
              width: "28%",
              minWidth: 220,
              maxWidth: 320,
              display: "flex",
              flexDirection: "column",
              bgcolor: "#172601",
              borderRight: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Box
              sx={{
                p: 2.5,
                pb: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Selecionadas
                </Typography>
                <Chip
                  label={selectedSpecies.length}
                  size="small"
                  sx={{
                    bgcolor: overLimit ? "rgba(217,82,4,0.8)" : "rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontWeight: 700,
                    height: 20,
                    fontSize: "0.7rem",
                  }}
                />
              </Box>

              {selectedSpecies.length > 0 && (
                <Tooltip title="Limpar todas">
                  <IconButton
                    size="small"
                    onClick={clearAll}
                    aria-label="Remover todas as espécies"
                    sx={{ color: "rgba(255,255,255,0.4)", "&:hover": { color: "#f44336" } }}
                  >
                    <DeleteSweepIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <List
              sx={{ flex: 1, overflowY: "auto", px: 1, py: 0.5 }}
              aria-label="Lista de espécies selecionadas"
            >
              {selectedSpecies.length === 0 && (
                <Box sx={{ p: 2, textAlign: "center" }}>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
                    Nenhuma espécie selecionada
                  </Typography>
                </Box>
              )}

              {selectedSpecies.map((item) => (
                <ListItem
                  key={item.key}
                  dense
                  sx={{
                    borderRadius: 1,
                    mb: 0.25,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
                  }}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => removeSpecies(item.key)}
                      aria-label={`Remover ${item.name}`}
                      sx={{ color: "rgba(255,255,255,0.3)", "&:hover": { color: "#f44336" } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{ fontStyle: "italic", pr: 3, lineHeight: 1.3 }}
                      >
                        {item.canonicalName ?? item.name}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Main content */}
          <Box component="main" sx={{ flex: 1, p: 4, overflowY: "auto" }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Theme>
  );
}
