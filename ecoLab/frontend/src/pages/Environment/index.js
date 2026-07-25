import {
  Box, Typography, Checkbox, FormControlLabel, FormGroup,
  Button, Alert, TextField, CircularProgress, Radio, RadioGroup,
} from "@mui/material";
import { useEffect, useState } from "react";
import StepActions from "../../components/StepActions";
import environmentApi from "../../services/environmentApi";

const ENV_VARS = [
  { name: "ndvi",          label: "NDVI (Índice de Vegetação por Diferença Normalizada)" },
  { name: "ndwi",          label: "NDWI (Índice de Água por Diferença Normalizada)" },
  { name: "temperature",   label: "Temperatura" },
  { name: "precipitation", label: "Precipitação" },
];
const GEE_VARS = ["ndvi", "ndwi", "temperature", "precipitation"];
const GEE_PROJECT_CACHE_KEY = "geeProject";

export default function Environment({
  selectedSpecies,
  selectedEnv,
  setSelectedEnv,
  geeProject,
  setGeeProject,
  environmentMode,
  setEnvironmentMode,
  envUpload,
  setEnvUpload,
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading,   setAuthLoading]   = useState(false);
  const [authError,     setAuthError]     = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEnvUpload({
      file,
      fileName: file.name,
      columns: [],
      mapping: { latitude: "", longitude: "" },
      variables: [],
      acknowledged: false,
    });
  };

  useEffect(() => {
    const cached = localStorage.getItem(GEE_PROJECT_CACHE_KEY);
    if (cached && !geeProject) setGeeProject(cached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    environmentApi
      .checkEEKey()
      .then((result) => setAuthenticated(result === true || result?.success === true))
      .catch(() => setAuthenticated(false));
  }, []);

  const authenticate = (project) => {
    setAuthLoading(true);
    setAuthError(null);
    environmentApi
      .authenticateEE(project)
      .then((result) => {
        if (!result?.success) {
          throw new Error(result?.message ?? "Não foi possível autenticar no Earth Engine.");
        }
        setAuthenticated(true);
        localStorage.setItem(GEE_PROJECT_CACHE_KEY, project);
      })
      .catch((err) => {
        setAuthenticated(false);
        setAuthError(err?.message ?? "Erro ao autenticar. Verifique o nome do projeto.");
      })
      .finally(() => setAuthLoading(false));
  };

  const handleChange = (event) => {
    const { name, checked } = event.target;
    setSelectedEnv((prev) =>
      checked ? [...prev, name] : prev.filter((item) => item !== name)
    );
  };

  const handleProjectChange = (e) => {
    setGeeProject(e.target.value);
    setAuthError(null);
  };

  // Select all
  const allVarNames = ENV_VARS.map((v) => v.name);
  const allSelected = allVarNames.every((v) => selectedEnv.includes(v));
  const someSelected = allVarNames.some((v) => selectedEnv.includes(v)) && !allSelected;

  const handleSelectAll = (checked) => {
    setSelectedEnv(checked ? [...allVarNames] : []);
  };

  const usesSources = environmentMode === "sources" || environmentMode === "both";
  const usesUpload  = environmentMode === "upload" || environmentMode === "both";

  const needsEE    = usesSources && selectedEnv.some((e) => GEE_VARS.includes(e));
  const hasSelection = selectedEnv.length > 0;
  const sourcesReady = !usesSources || (hasSelection && (!needsEE || authenticated));
  const uploadReady  = !usesUpload || (!!envUpload.file && !!envUpload.acknowledged);
  const canProceed = sourcesReady && uploadReady;

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Variáveis Ambientais
      </Typography>
      <Typography variant="body2" sx={{ color: "#333", mb: 2 }}>
        Selecione as variáveis ambientais a serem incluídas na análise.
        A busca será executada automaticamente na etapa de coleta de dados.
      </Typography>

      <Typography gutterBottom style={{ fontWeight: 600, color: "#333" }}>
        Como você quer fornecer as variáveis ambientais?
      </Typography>
      <RadioGroup
        row
        value={environmentMode}
        onChange={(e) => setEnvironmentMode(e.target.value)}
        sx={{ mb: 1, color: "#555"  }}
      >
        <FormControlLabel value="sources" control={<Radio />} label="Usar as fontes que fornecemos" />
        <FormControlLabel value="upload" control={<Radio />} label="Subir minha própria planilha" />
        <FormControlLabel value="both" control={<Radio />} label="Usar os dois" />
      </RadioGroup>

      {usesUpload && (
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" component="label">
            {envUpload.fileName || "Selecionar planilha de variáveis (CSV)"}
            <input type="file" accept=".csv,.tsv,.txt" hidden onChange={handleFileSelect} />
          </Button>
          {envUpload.fileName && (
            <>
              <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                ✓ {envUpload.fileName} selecionado. Na próxima etapa você vai indicar latitude, longitude e as variáveis.
              </Typography>
              <FormControlLabel
                sx={{ mt: 1, alignItems: "flex-start" }}
                control={
                  <Checkbox
                    checked={!!envUpload.acknowledged}
                    onChange={(e) =>
                      setEnvUpload((prev) => ({ ...prev, acknowledged: e.target.checked }))
                    }
                    sx={{ pt: 0 }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: "#333" }}>
                    Entendo que sou responsável pela qualidade e cobertura dos dados ambientais
                    enviados, e que problemas nesses dados podem gerar resultados que não refletem
                    a realidade.
                  </Typography>
                }
              />
            </>
          )}
        </Box>
      )}

      {usesSources && (
      <>
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

      <FormGroup style={{ color: "#333" }}>
        {ENV_VARS.map(({ name, label }) => (
          <FormControlLabel
            key={name}
            control={
              <Checkbox
                name={name}
                checked={selectedEnv.includes(name)}
                onChange={handleChange}
              />
            }
            label={label}
          />
        ))}
      </FormGroup>

      {needsEE && !authenticated && (
        <Box sx={{ mt: 3, p: 2, border: "1px solid #ccc", borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom color="#333">
            Autenticação no Google Earth Engine
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            NDVI, NDWI, Temperatura e Precipitação requerem acesso ao Google Earth Engine (GEE).
          </Alert>

          <Typography variant="body2" sx={{ color: "#333", mb: 1 }}>
            1. Acesse{" "}
            <a href="https://earthengine.google.com/" target="_blank" rel="noreferrer">
              earthengine.google.com
            </a>{" "}
            e registre-se.
          </Typography>
          <Typography variant="body2" sx={{ color: "#333", mb: 1 }}>
            2. Informe o nome do projeto GEE vinculado à sua conta.
          </Typography>

          <TextField
            label="Nome do Projeto GEE"
            variant="outlined"
            size="small"
            value={geeProject}
            onChange={handleProjectChange}
            placeholder="ex: my-gee-project"
            disabled={authLoading}
            error={!!authError}
            helperText={authError ?? ""}
            sx={{ mb: 2, width: "40ch", display: "block" }}
          />

          <Typography variant="body2" sx={{ color: "#333", mb: 1 }}>
            3. Clique abaixo para autenticar — uma janela do navegador será aberta.
          </Typography>
          <Typography variant="body2" sx={{ color: "#333", mb: 2 }}>
            4. Copie o token gerado e cole quando solicitado.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            disabled={!geeProject.trim() || authLoading}
            onClick={() => authenticate(geeProject.trim())}
            startIcon={authLoading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {authLoading ? "Autenticando..." : "Autenticar no Earth Engine"}
          </Button>
        </Box>
      )}

      {needsEE && authenticated && (
        <Alert severity="success" sx={{ mt: 2 }}>
          ✓ Google Earth Engine autenticado com sucesso.
        </Alert>
      )}
      </>
      )}

      <StepActions
        selectedSpecies={selectedSpecies}
        disableNext={!canProceed}
        disableHint={
          !uploadReady
            ? !envUpload.file
              ? "Selecione uma planilha com as variáveis ambientais para prosseguir."
              : "Marque a confirmação de responsabilidade pelos dados para prosseguir."
            : !hasSelection
            ? "Selecione ao menos uma variável ambiental."
            : "Autentique no Google Earth Engine para prosseguir."
        }
        nextOverride={usesUpload ? "/environment-mapping" : undefined}
      />
    </Box>
  );
}
