import { Box, Typography, OutlinedInput, InputLabel, FormControl, IconButton, Popover, Button, Radio, RadioGroup} from "@mui/material";
import {Visibility, VisibilityOff } from '@mui/icons-material';
import { useState, useEffect} from "react";
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import PopupsMsg from "./PopUp";
import occurrenceApi from "../../services/occurrenceApi";

const ALL_SOURCES = ["gbif", "inaturalist", "specieslink"];

export default function SourcesCheckBox({
    selectedSources, setSelectedSources, sourceConfig, setSourceConfig,
    occurrenceMode, setOccurrenceMode, occurrenceUpload, setOccurrenceUpload,
}) {
    const [showPassword, setShowPassword] = useState(false);

    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setOccurrenceUpload({
            file,
            fileName: file.name,
            columns: [],
            preview: [],
            mapping: { species: "", latitude: "", longitude: "", eventDate: "" },
        });
    };

    useEffect(() => {
        occurrenceApi.checkIfKeyExists("gbif")
            .then((result) => setSourceConfig((prev) => ({ ...prev, gbif: { ...prev.gbif, alreadyExists: !!result } })))
            .catch(() => setSourceConfig((prev) => ({ ...prev, gbif: { ...prev.gbif, alreadyExists: false } })));

        occurrenceApi.checkIfKeyExists("specieslink")
            .then((result) => setSourceConfig((prev) => ({ ...prev, specieslink: { ...prev.specieslink, alreadyExists: !!result } })))
            .catch(() => setSourceConfig((prev) => ({ ...prev, specieslink: { ...prev.specieslink, alreadyExists: false } })));
    }, []);

    const gbifReady = !selectedSources.includes("gbif") || sourceConfig.gbif.alreadyExists ||
        (sourceConfig.gbif.email && sourceConfig.gbif.userId && sourceConfig.gbif.apiKey);

    const speciesLinkReady = !selectedSources.includes("specieslink") || sourceConfig.specieslink.alreadyExists ||
        sourceConfig.specieslink.apiKey;

    const canProceed = gbifReady && speciesLinkReady;

    useEffect(() => {
    }, [canProceed]);

    const handleConfigChange = (source, field) => (event) => {
        const value = event.target.value;
        setSourceConfig((prev) => ({
            ...prev,
            [source]: {
                ...prev[source],
                [field]: value,
            },
        }));
    };

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMousePassword = (event) => event.preventDefault();

    const handleChangeSources = (event) => {
        const { name, checked } = event.target;
        setSelectedSources((prev) =>
            checked ? [...prev, name] : prev.filter((item) => item !== name)
        );
    };

    const allSelected = ALL_SOURCES.every((s) => selectedSources.includes(s));
    const someSelected = ALL_SOURCES.some((s) => selectedSources.includes(s)) && !allSelected;

    const handleSelectAll = (checked) => {
        setSelectedSources(checked ? [...ALL_SOURCES] : []);
    };

    return (
        <Box>
            <FormGroup label="Fontes de Dados" style={{ color: "#333" }}>
                <Typography gutterBottom style={{ fontWeight: 600 }}>
                    Como você quer fornecer os dados de ocorrência?
                </Typography>
                <RadioGroup
                    row
                    value={occurrenceMode}
                    onChange={(e) => setOccurrenceMode(e.target.value)}
                    sx={{ mb: 1 }}
                >
                    <FormControlLabel value="sources" control={<Radio />} label="Usar as fontes que fornecemos" />
                    <FormControlLabel value="upload" control={<Radio />} label="Subir minha própria planilha" />
                    <FormControlLabel value="both" control={<Radio />} label="Usar os dois" />
                </RadioGroup>

                {(occurrenceMode === "upload" || occurrenceMode === "both") && (
                    <Box sx={{ mb: 2 }}>
                        <Button variant="outlined" component="label">
                            {occurrenceUpload.fileName || "Selecionar planilha (CSV)"}
                            <input type="file" accept=".csv,.tsv,.txt" hidden onChange={handleFileSelect} />
                        </Button>
                        {occurrenceUpload.fileName && (
                            <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                                ✓ {occurrenceUpload.fileName} selecionado. Na próxima etapa você vai indicar quais colunas correspondem aos campos obrigatórios.
                            </Typography>
                        )}
                    </Box>
                )}

              {(occurrenceMode === "sources" || occurrenceMode === "both") && (
              <>
                <Typography gutterBottom style={{ fontWeight: 600 }}>
                    Selecione as fontes de dados
                </Typography>

                {/* Selecionar todas */}
                <FormControlLabel
                    sx={{ mb: 0.5 }}
                    control={
                        <Checkbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                    }
                    label={
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "#333" }}>
                            Selecionar todas
                        </Typography>
                    }
                />

                {/* GBIF */}
                <FormControlLabel
                    control={
                        <Checkbox
                            name="gbif"
                            checked={selectedSources.includes("gbif")}
                            onChange={handleChangeSources}
                        />
                    }
                    label="GBIF"
                />
                {selectedSources.includes("gbif") && sourceConfig.gbif.alreadyExists === false && (
                    <Box>
                        <FormControl sx={{ m: 1, width: '45ch' }} variant="outlined">
                            <InputLabel>Email</InputLabel>
                            <OutlinedInput
                                required
                                value={sourceConfig.gbif.email}
                                onChange={handleConfigChange("gbif", "email")}
                            />
                        </FormControl>
                        <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined">
                            <InputLabel>User ID</InputLabel>
                            <OutlinedInput
                                required
                                value={sourceConfig.gbif.userId}
                                onChange={handleConfigChange("gbif", "userId")}
                            />
                        </FormControl>
                        <FormControl sx={{ m: 1, width: '50ch', flexDirection: "row" }} variant="outlined">
                            <InputLabel>Password</InputLabel>
                            <OutlinedInput
                                required
                                type={showPassword ? "text" : "password"}
                                value={sourceConfig.gbif.apiKey}
                                onChange={handleConfigChange("gbif", "apiKey")}
                                endAdornment={
                                    <IconButton
                                        onClick={handleClickShowPassword}
                                        onMouseDown={handleMousePassword}
                                        onMouseUp={handleMousePassword}
                                        edge="end"
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                }
                                label="Password"
                            />
                            <PopupsMsg msg="Use as mesmas credenciais da sua conta GBIF" />
                        </FormControl>
                    </Box>
                )}
                {selectedSources.includes("gbif") && sourceConfig.gbif.alreadyExists === true && (
                    <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                        ✓ Credenciais GBIF já configuradas
                    </Typography>
                )}

                {/* iNaturalist */}
                <FormControlLabel
                    control={
                        <Checkbox
                            name="inaturalist"
                            checked={selectedSources.includes("inaturalist")}
                            onChange={handleChangeSources}
                        />
                    }
                    label="INaturalist"
                />

                {/* SpeciesLink */}
                <FormControlLabel
                    control={
                        <Checkbox
                            name="specieslink"
                            checked={selectedSources.includes("specieslink")}
                            onChange={handleChangeSources}
                        />
                    }
                    label="SpeciesLink"
                />
                {selectedSources.includes("specieslink") && sourceConfig.specieslink.alreadyExists === false && (
                    <FormControl sx={{ m: 1, width: '50ch', flexDirection: "row" }} variant="outlined">
                        <InputLabel>API key</InputLabel>
                        <OutlinedInput
                            required
                            value={sourceConfig.specieslink.apiKey}
                            onChange={handleConfigChange("specieslink", "apiKey")}
                            type={showPassword ? 'text' : 'password'}
                            endAdornment={
                                <IconButton
                                    onClick={handleClickShowPassword}
                                    onMouseDown={handleMousePassword}
                                    onMouseUp={handleMousePassword}
                                    edge="end"
                                >
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            }
                            label="API key"
                        />
                        <PopupsMsg msg={"Para adquirir a API key do SpeciesLink, acesse <a target='_blank' href='https://specieslink.net/aut/login/?next=/aut/profile/apikeys'>species link site</a>"} />
                    </FormControl>
                )}
                {selectedSources.includes("specieslink") && sourceConfig.specieslink.alreadyExists === true && (
                    <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                        ✓ API key SpeciesLink já configurada
                    </Typography>
                )}
              </>
              )}
            </FormGroup>
        </Box>
    );
}
