import {
  Box, Typography, Checkbox, FormControlLabel, FormGroup,
  Button, Alert, TextField, CircularProgress,
} from "@mui/material";
import { useEffect, useState } from "react";
import StepActions from "../../components/StepActions";
import environmentApi from "../../services/environmentApi";

const GEE_VARS = ["ndvi", "ndwi", "temperature", "precipitation"];
const GEE_PROJECT_CACHE_KEY = "geeProject";

export default function Environment({
  selectedSpecies,
  selectedEnv,
  setSelectedEnv,
  geeProject,
  setGeeProject,
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading,   setAuthLoading]   = useState(false);
  const [authError,     setAuthError]     = useState(null);

  // Carrega projeto salvo em cache
  useEffect(() => {
    const cached = localStorage.getItem(GEE_PROJECT_CACHE_KEY);
    if (cached && !geeProject) setGeeProject(cached);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    environmentApi
      .checkEEKey()
      .then((result) => setAuthenticated(!!result))
      .catch(() => setAuthenticated(false));
  }, []);

  const authenticate = (project) => {
    setAuthLoading(true);
    setAuthError(null);
    environmentApi
      .authenticateEE(project)
      .then(() => {
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

  const needsEE    = selectedEnv.some((e) => GEE_VARS.includes(e));
  const hasSelection = selectedEnv.length > 0;
  const canProceed = hasSelection && (!needsEE || authenticated);

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Variáveis Ambientais
      </Typography>
      <Typography variant="body2" sx={{ color: "#333", mb: 2 }}>
        Selecione as variáveis ambientais a serem incluídas na análise.
        A busca será executada automaticamente na etapa de coleta de dados.
      </Typography>

      <FormGroup style={{ color: "#333" }}>
        {[
          { name: "ndvi",          label: "NDVI (Índice de Vegetação por Diferença Normalizada)" },
          { name: "ndwi",          label: "NDWI (Índice de Água por Diferença Normalizada)" },
          { name: "temperature",   label: "Temperatura" },
          { name: "precipitation", label: "Precipitação" },
        ].map(({ name, label }) => (
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

      <StepActions
        selectedSpecies={selectedSpecies}
        disableNext={!canProceed}
        disableHint={
          !hasSelection
            ? "Selecione ao menos uma variável ambiental."
            : "Autentique no Google Earth Engine para prosseguir."
        }
      />
    </Box>
  );
}
