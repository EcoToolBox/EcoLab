import { Box, Typography, Checkbox, FormControlLabel, FormGroup, Divider, Tooltip, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StepActions from "../../components/StepActions";
import { useState, useEffect } from "react";
import { MODELS, PRESENCE_TYPES, METRICS } from "../../constants/models";

export default function Models({ selectedSpecies, modelsData, setModelsData }) {
    const [presenceType, setPresenceType] = useState("presence_only");
    const [selectedModels, setSelectedModels] = useState([]);
    const [selectedMetrics, setSelectedMetrics] = useState([]);

    useEffect(() => {
      setModelsData({ presenceType, selectedModels, selectedMetrics });
    }, [presenceType, selectedModels, selectedMetrics, setModelsData]);

    const handlePresenceType = (value) => {
        setPresenceType(value);
        if (value === "presence_only") {
            setSelectedModels((prev) => prev.filter((m) => m === "maxent"));
        }
    };

    const handleMetricChange = (event) => {
        const { name, checked } = event.target;
        setSelectedMetrics((prev) =>
            checked ? [...prev, name] : prev.filter((m) => m !== name)
        );
    };

    const handleModelChange = (event) => {
        const { name, checked } = event.target;
        setSelectedModels((prev) =>
            checked ? [...prev, name] : prev.filter((m) => m !== name)
        );
    };

    const isModelDisabled = (value) => {
        if (presenceType === "presence_only" && value !== "maxent") return true;
        return false;
    };

    // Select all models (only enabled ones)
    const enabledModels = MODELS.filter((m) => !isModelDisabled(m.value)).map((m) => m.value);
    const allModelsSelected = enabledModels.length > 0 && enabledModels.every((v) => selectedModels.includes(v));
    const someModelsSelected = enabledModels.some((v) => selectedModels.includes(v)) && !allModelsSelected;

    const handleSelectAllModels = (checked) => {
        setSelectedModels(checked ? enabledModels : []);
    };

    // Select all metrics
    const allMetricValues = METRICS.map((m) => m.value);
    const allMetricsSelected = allMetricValues.length > 0 && allMetricValues.every((v) => selectedMetrics.includes(v));
    const someMetricsSelected = allMetricValues.some((v) => selectedMetrics.includes(v)) && !allMetricsSelected;

    const handleSelectAllMetrics = (checked) => {
        setSelectedMetrics(checked ? allMetricValues : []);
    };

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" fontWeight={600} gutterBottom>
                    Modelos
                </Typography>
                <Typography variant="body2" sx={{ color: "#333" }}>
                    Configure o tipo de dado e os modelos a serem utilizados na modelagem de distribuição de espécies.
                </Typography>
            </Box>

            {/* Tipo de presença */}
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "#333" }}>
                Tipo de dado
            </Typography>
            <FormGroup sx={{ mb: 3 }}>
                {PRESENCE_TYPES.map((type) => (
                    <Box key={type.value} sx={{ display: "flex", alignItems: "center", color: "#555" }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    name={type.value}
                                    checked={presenceType === type.value}
                                    onChange={() => handlePresenceType(type.value)}
                                />
                            }
                            label={type.label}
                        />
                        <Tooltip title={type.description} placement="right" arrow>
                            <IconButton size="small" sx={{ color: "#888" }}>
                                <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ))}
            </FormGroup>

            <Divider sx={{ my: 2, opacity: 0.6 }} />

            {/* Modelos */}
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "#333" }}>
                Modelos disponíveis
            </Typography>
            {/* Selecionar todos os modelos */}
            <FormControlLabel
                sx={{ mb: 0.5 }}
                control={
                    <Checkbox
                        checked={allModelsSelected}
                        indeterminate={someModelsSelected}
                        onChange={(e) => handleSelectAllModels(e.target.checked)}
                        disabled={enabledModels.length === 0}
                    />
                }
                label={
                    <Typography variant="body2" sx={{ color: "#333", fontWeight: 600 }}>
                        Selecionar todos
                    </Typography>
                }
            />
            <FormGroup sx={{ mb: 3 }}>
                {MODELS.map((model) => (
                    <Box key={model.value} sx={{ display: "flex", alignItems: "center", color: "#555" }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    name={model.value}
                                    checked={selectedModels.includes(model.value)}
                                    onChange={handleModelChange}
                                    disabled={isModelDisabled(model.value)}
                                />
                            }
                            label={
                                <Typography
                                    variant="body2"
                                    sx={{ color: isModelDisabled(model.value) ? "#aaa" : "#333" }}
                                >
                                    {model.label}
                                </Typography>
                            }
                        />
                        <Tooltip title={model.description} placement="right" arrow>
                            <IconButton size="small" sx={{ color: "#888" }} disabled={isModelDisabled(model.value)}>
                                <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ))}
            </FormGroup>

            {presenceType === "presence_only" && (
                <Typography variant="body2" sx={{ color: "#888", mb: 2 }}>
                    * MaxEnt é o único modelo recomendado para dados de presença apenas, devido à sua capacidade de lidar com esse tipo de dado.
                </Typography>
            )}

            <Divider sx={{ my: 2, opacity: 0.6 }} />

            {/* Métricas */}
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "#333" }}>
                Métricas de avaliação
            </Typography>
            {/* Selecionar todas as métricas */}
            <FormControlLabel
                sx={{ mb: 0.5 }}
                control={
                    <Checkbox
                        checked={allMetricsSelected}
                        indeterminate={someMetricsSelected}
                        onChange={(e) => handleSelectAllMetrics(e.target.checked)}
                    />
                }
                label={
                    <Typography variant="body2" sx={{ color: "#333", fontWeight: 600 }}>
                        Selecionar todas
                    </Typography>
                }
            />
            <FormGroup sx={{ mb: 3 }}>
                {METRICS.map((metric) => (
                    <Box key={metric.value} sx={{ display: "flex", alignItems: "center", color: "#555" }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    name={metric.value}
                                    checked={selectedMetrics.includes(metric.value)}
                                    onChange={handleMetricChange}
                                />
                            }
                            label={
                                <Typography variant="body2" sx={{ color: "#333" }}>
                                    {metric.label}
                                </Typography>
                            }
                        />
                        <Tooltip title={metric.description} placement="right" arrow>
                            <IconButton size="small" sx={{ color: "#888" }}>
                                <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ))}
            </FormGroup>

            <StepActions
                selectedSpecies={selectedSpecies}
                disableNext={selectedModels.length === 0}
                disableHint="Selecione ao menos um modelo para prosseguir."
            />
        </Box>
    );
}
