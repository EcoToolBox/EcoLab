import {
    Box, Typography, Checkbox, FormControlLabel, FormGroup, Divider, Tooltip, IconButton,
    RadioGroup, Radio, TextField, Alert, Button, CircularProgress,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StepActions from "../../components/StepActions";
import { useState, useEffect } from "react";
import { MODELS, PRESENCE_TYPES, METRICS, VALIDATION_MODES, BACKGROUND_SOURCES } from "../../constants/models";
import modelApi from "../../services/modelApi";

export default function Models({ selectedSpecies, modelsData, setModelsData, envGridData, environmentMode, envUpload, rasterEnv }) {
    // A planilha ambiental só é processada depois desta tela (etapa de
    // resultado), então aqui olhamos se ela foi SELECIONADA na etapa de
    // Ambiente, e não se envGridData já foi preenchido.
    const usesEnvUpload = environmentMode === "upload" || environmentMode === "both";
    const usesRasters = environmentMode === "rasters" && (rasterEnv?.files?.length ?? 0) > 0;
    const hasEnvSpreadsheet = usesRasters || (usesEnvUpload && !!envUpload?.file) || (envGridData?.length ?? 0) > 0;
    const [presenceType, setPresenceType] = useState("presence_only");
    const [selectedModels, setSelectedModels] = useState([]);
    const [selectedMetrics, setSelectedMetrics] = useState([]);

    // Validação (aleatória continua sendo o padrão para uso genérico;
    // espacial é uma escolha explícita).
    const [validationMode, setValidationMode] = useState(modelsData?.validationMode ?? "random");
    const [nFolds, setNFolds] = useState(modelsData?.nFolds ?? 10);
    const [backgroundRatio, setBackgroundRatio] = useState(modelsData?.backgroundRatio ?? 2);
    const [backgroundSource, setBackgroundSource] = useState(modelsData?.backgroundSource ?? "grid_random");
    const [nRepeats, setNRepeats] = useState(modelsData?.nRepeats ?? 5);
    const [backgroundBufferKm, setBackgroundBufferKm] = useState(modelsData?.backgroundBufferKm ?? 0);
    // TSS no limiar que maximiza o TSS (padrão do biomod2) ou em 0,5
    const [tssMode, setTssMode] = useState(modelsData?.tssMode ?? "max");
    // Modo experimental: resposta = densidade das ocorrências (KDE) em vez de 1/0
    const [kdeTarget, setKdeTarget] = useState(modelsData?.kdeTarget ?? { enabled: false, bandwidthKm: 0 });
    const KDE_MODELS = ["gam", "random_forest", "brt"];

    // Grid de predição (opcional): grid regular cobrindo a área, usado só
    // para desenhar o mapa. O arquivo fica salvo no backend; aqui guardamos
    // só o id e um resumo.
    const [predictionGrid, setPredictionGrid] = useState(modelsData?.predictionGrid ?? null);

    // Ensemble por média ponderada (como o EMwmean do biomod2): entram os
    // modelos com a métrica >= mínimo, cada um com peso proporcional à métrica.
    const [ensemble, setEnsemble] = useState(
        modelsData?.ensemble ?? { enabled: false, metric: "tss", threshold: 0 }
    );
    const [gridUploading, setGridUploading] = useState(false);
    const [gridError, setGridError] = useState(null);

    useEffect(() => {
      setModelsData({
        presenceType, selectedModels, selectedMetrics,
        validationMode, nFolds, nRepeats, backgroundRatio, backgroundSource, backgroundBufferKm, tssMode, kdeTarget,
        predictionGrid,
        predictionGridId: predictionGrid?.gridId ?? null,
        ensemble,
      });
    }, [presenceType, selectedModels, selectedMetrics, validationMode, nFolds, nRepeats, backgroundRatio, backgroundSource, backgroundBufferKm, tssMode, kdeTarget, predictionGrid, ensemble, setModelsData]);

    const ensembleAvailable = presenceType !== "presence_only" && selectedModels.length >= 2;
    const updateEnsemble = (patch) => {
        const next = { ...ensemble, ...patch };
        setEnsemble(next);
        // A métrica usada como peso precisa ser calculada.
        if (next.enabled && !selectedMetrics.includes(next.metric)) {
            setSelectedMetrics((prev) => [...prev, next.metric]);
        }
    };

    const handlePredictionGridFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setGridUploading(true);
        setGridError(null);
        try {
            const result = await modelApi.uploadPredictionGrid(file);
            setPredictionGrid({
                gridId: result.gridId,
                fileName: file.name,
                rows: result.rows,
                variables: result.variables ?? [],
            });
        } catch (err) {
            setPredictionGrid(null);
            setGridError(err.message ?? "Falha ao enviar o grid de predição.");
        } finally {
            setGridUploading(false);
        }
    };

    const handlePresenceType = (value) => {
        setPresenceType(value);
        if (value === "presence_only") {
            setSelectedModels((prev) => prev.filter((m) => m === "maxent"));
            setKdeTarget((prev) => ({ ...prev, enabled: false }));
        }
    };

    const toggleKde = (enabled) => {
        setKdeTarget((prev) => ({ ...prev, enabled }));
        if (enabled) setSelectedModels((prev) => prev.filter((m) => KDE_MODELS.includes(m)));
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
        if (kdeTarget.enabled && !KDE_MODELS.includes(value)) return true;
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

            {presenceType !== "presence_only" && (
                <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                        <FormControlLabel
                            control={<Checkbox checked={kdeTarget.enabled} onChange={(e) => toggleKde(e.target.checked)} />}
                            label={
                                <Typography variant="body2" sx={{ color: "#333" }}>
                                    Resposta contínua: densidade das ocorrências (KDE) em vez de 1/0 (experimental)
                                </Typography>
                            }
                        />
                        <Tooltip
                            title="Em vez de presença = 1 e pseudo-ausência = 0, cada ponto de treino recebe a densidade de kernel das ocorrências (0 a 1). Os modelos viram regressões (GAM, Random Forest e BRT; MaxEnt e SVM não se aplicam). AUC, TSS e Boyce continuam calculados contra a presença 1/0 dos dados de teste. A densidade também reflete onde se coletou mais; prefira a validação espacial."
                            placement="right"
                            arrow
                        >
                            <IconButton size="small" sx={{ color: "#888" }}>
                                <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    {kdeTarget.enabled && (
                        <TextField
                            label="Largura do kernel (km)"
                            type="number"
                            size="small"
                            value={kdeTarget.bandwidthKm}
                            onChange={(e) => setKdeTarget((prev) => ({ ...prev, bandwidthKm: Math.max(0, parseFloat(e.target.value) || 0) }))}
                            inputProps={{ min: 0, step: 5 }}
                            sx={{ ml: 4, mt: 1, width: 260 }}
                            helperText="0 = automática (regra de Silverman), calculada por espécie."
                        />
                    )}
                </Box>
            )}

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

            {/* Validação */}
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "#333" }}>
                Validação
            </Typography>
            <RadioGroup
                value={validationMode}
                onChange={(e) => setValidationMode(e.target.value)}
                sx={{ mb: 1 }}
            >
                {VALIDATION_MODES.map((mode) => (
                    <Box key={mode.value} sx={{ display: "flex", alignItems: "center", color: "#555" }}>
                        <FormControlLabel
                            value={mode.value}
                            control={<Radio />}
                            label={
                                <Typography variant="body2" sx={{ color: "#333" }}>
                                    {mode.label}
                                </Typography>
                            }
                        />
                        <Tooltip title={mode.description} placement="right" arrow>
                            <IconButton size="small" sx={{ color: "#888" }}>
                                <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ))}
            </RadioGroup>

            {validationMode === "spatial" && (
                <TextField
                    label="Número de folds espaciais"
                    type="number"
                    size="small"
                    value={nFolds}
                    onChange={(e) => setNFolds(Math.max(2, parseInt(e.target.value, 10) || 10))}
                    inputProps={{ min: 2, max: 30 }}
                    sx={{ mb: 2, width: 260 }}
                    helperText="Grupos geográficos formados por K-means nas coordenadas (padrão: 10)."
                />
            )}

            {validationMode === "repeated" && (
                <TextField
                    label="Número de repetições"
                    type="number"
                    size="small"
                    value={nRepeats}
                    onChange={(e) => setNRepeats(Math.max(2, Math.min(50, parseInt(e.target.value, 10) || 5)))}
                    inputProps={{ min: 2, max: 50 }}
                    sx={{ mb: 2, width: 260 }}
                />
            )}

            <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField
                    label="Buffer de exclusão (km)"
                    type="number"
                    size="small"
                    value={backgroundBufferKm}
                    onChange={(e) => setBackgroundBufferKm(Math.max(0, parseFloat(e.target.value) || 0))}
                    inputProps={{ min: 0, step: 1 }}
                    sx={{ width: 260 }}
                    helperText="Não sorteia background a menos dessa distância das presenças. 0 = sem buffer."
                />
                <TextField
                    label="Proporção de background"
                    type="number"
                    size="small"
                    value={backgroundRatio}
                    onChange={(e) => setBackgroundRatio(Math.max(0.1, parseFloat(e.target.value) || 2))}
                    inputProps={{ min: 0.1, max: 10, step: 0.5 }}
                    sx={{ width: 260 }}
                    helperText="Pontos de background por presença (padrão: 2 por presença)."
                />
            </Box>

            <Typography variant="body2" sx={{ color: "#555", mb: 0.5 }}>
                Origem do background
            </Typography>
            <RadioGroup
                value={backgroundSource}
                onChange={(e) => setBackgroundSource(e.target.value)}
                sx={{ mb: 1 }}
            >
                {BACKGROUND_SOURCES.map((source) => (
                    <Box key={source.value} sx={{ display: "flex", alignItems: "center", color: "#555" }}>
                        <FormControlLabel
                            value={source.value}
                            control={<Radio />}
                            label={
                                <Typography variant="body2" sx={{ color: "#333" }}>
                                    {source.label}
                                </Typography>
                            }
                        />
                        <Tooltip title={source.description} placement="right" arrow>
                            <IconButton size="small" sx={{ color: "#888" }}>
                                <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ))}
            </RadioGroup>
            {backgroundSource === "provided" && !hasEnvSpreadsheet && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Nenhuma planilha ambiental foi enviada na etapa de Ambiente. Sem ela, o sistema
                    vai usar o grid gerado automaticamente mesmo com essa opção selecionada.
                </Alert>
            )}
            {backgroundSource === "provided" && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Se a planilha de ocorrências tiver a coluna de presença mapeada (1 = presença,
                    0 = background), as linhas com 0 são usadas como background exatamente como vieram
                    e a proporção acima é ignorada.
                </Alert>
            )}

            <Divider sx={{ my: 2, opacity: 0.6 }} />

            {/* Grid de predição */}
            <Box sx={{ display: "flex", alignItems: "center" }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#333" }}>
                    Grid de predição para o mapa (opcional)
                </Typography>
                <Tooltip
                    title="Grid regular cobrindo toda a área (ex.: uma célula a cada 0,1°), com as MESMAS variáveis e nomes de coluna usados no treino. O modelo é treinado com as ocorrências e o background e depois aplicado em cada célula deste grid para desenhar o mapa. Sem ele, o mapa é interpolado a partir dos pontos da planilha ambiental."
                    placement="right"
                    arrow
                >
                    <IconButton size="small" sx={{ color: "#888" }}>
                        <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, mt: 1 }}>
                <Button variant="outlined" component="label" disabled={gridUploading}>
                    {predictionGrid ? "Trocar grid de predição" : "Selecionar grid de predição (CSV)"}
                    <input hidden type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={handlePredictionGridFile} />
                </Button>
                {gridUploading && <CircularProgress size={20} />}
                {predictionGrid && !gridUploading && (
                    <Button size="small" color="inherit" onClick={() => setPredictionGrid(null)}>
                        Remover
                    </Button>
                )}
            </Box>
            {gridError && <Alert severity="error" sx={{ mb: 2 }}>{gridError}</Alert>}
            {usesRasters && !predictionGrid && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Como as variáveis vêm de rasters, o grid do mapa (e do background) será montado
                    automaticamente a partir deles, na resolução de {rasterEnv.resolution}°. Só envie um grid
                    aqui se quiser usar outro.
                </Alert>
            )}
            {predictionGrid && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {predictionGrid.fileName}: {predictionGrid.rows.toLocaleString("pt-BR")} células,
                    variáveis {predictionGrid.variables.join(", ")}. O mapa será gerado neste grid.
                </Alert>
            )}

            <Divider sx={{ my: 2, opacity: 0.6 }} />

            {/* Ensemble */}
            <Box sx={{ display: "flex", alignItems: "center" }}>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={ensemble.enabled && ensembleAvailable}
                            disabled={!ensembleAvailable}
                            onChange={(e) => updateEnsemble({ enabled: e.target.checked })}
                        />
                    }
                    label={
                        <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#333" }}>
                            Gerar ensemble (média ponderada)
                        </Typography>
                    }
                />
                <Tooltip
                    title="Combina os modelos selecionados numa média ponderada, como o EMwmean do biomod2. Entram só os modelos com a métrica escolhida acima do mínimo, e cada um pesa proporcionalmente a essa métrica. O ensemble é avaliado nos mesmos dados de teste dos modelos individuais e aparece numa aba própria no resultado."
                    placement="right"
                    arrow
                >
                    <IconButton size="small" sx={{ color: "#888" }}>
                        <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            {!ensembleAvailable && (
                <Typography variant="body2" sx={{ color: "#888", mb: 1 }}>
                    Selecione pelo menos 2 modelos (com dados de presença/ausência) para gerar o ensemble.
                </Typography>
            )}
            {ensemble.enabled && ensembleAvailable && (
                <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", mb: 2, ml: 4, flexWrap: "wrap" }}>
                    <Box>
                        <Typography variant="body2" sx={{ color: "#555" }}>Peso dos modelos</Typography>
                        <RadioGroup
                            row
                            value={ensemble.metric}
                            onChange={(e) => updateEnsemble({ metric: e.target.value })}
                        >
                            <FormControlLabel value="tss" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ color: "#333" }}>TSS</Typography>} />
                            <FormControlLabel value="auc" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ color: "#333" }}>AUC</Typography>} />
                        </RadioGroup>
                    </Box>
                    <TextField
                        label={`${ensemble.metric.toUpperCase()} mínimo para entrar`}
                        type="number"
                        size="small"
                        value={ensemble.threshold}
                        onChange={(e) => updateEnsemble({ threshold: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })}
                        inputProps={{ min: 0, max: 1, step: 0.05 }}
                        helperText="Zhao et al. (2025) usou TSS > 0,7 e Santos et al. (2022) TSS > 0,8. Use 0 para incluir todos."
                        sx={{ width: 260 }}
                    />
                </Box>
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

            {selectedMetrics.includes("tss") && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ color: "#555" }}>Limiar do TSS</Typography>
                    <RadioGroup row value={tssMode} onChange={(e) => setTssMode(e.target.value)}>
                        <FormControlLabel value="max" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ color: "#333" }}>Ótimo (máximo TSS, como no biomod2)</Typography>} />
                        <FormControlLabel value="0.5" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ color: "#333" }}>Fixo em 0,5</Typography>} />
                    </RadioGroup>
                </Box>
            )}

            <StepActions
                selectedSpecies={selectedSpecies}
                disableNext={selectedModels.length === 0}
                disableHint="Selecione ao menos um modelo para prosseguir."
            />
        </Box>
    );
}
