import { useCallback, useState } from "react";
import { Alert, Box, Button, Chip, Divider, Tab, Tabs, TextField, Typography } from "@mui/material";
import AutocompleteInput from "./AutocompleteInput";
import TaxonomyTree from "./TaxonomyTree";
import CustomWarning from "../../components/CustomWarning";
import StepActions from "../../components/StepActions";
import { PERFORMANCE_WARNING_THRESHOLD } from "../../constants/taxonomy";
import taxonomyApi from "../../services/taxonomyApi";

function TabPanel({ children, value, index }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`species-tabpanel-${index}`}
      aria-labelledby={`species-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index && children}
    </Box>
  );
}

const TAB_SX = {
  color: "#0f1a00bd",
  textTransform: "none",
  fontSize: "0.85rem",
  "&.Mui-selected": { color: "#D95204" },
};

const LIST_INPUT_SX = {
  mt: 0,
  bgcolor: "rgba(255,255,255,0.95)",
  borderRadius: 1,
  "& .MuiOutlinedInput-root": {
    "&.Mui-focused fieldset": { borderColor: "#D95204" },
  },
  "& .MuiInputLabel-root.Mui-focused": { color: "#D95204" },
};

export default function SpeciesSearch({ selectedSpecies, setSelectedSpecies }) {
  const [activeTab, setActiveTab] = useState(0);
  const [speciesList, setSpeciesList] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState(null);

  const handleSelect = useCallback(
    (species) => {
      setSelectedSpecies((prev) => {
        const alreadyIn = prev.some((s) => s.key === species.key);

        if (alreadyIn) {
          return prev.filter((s) => s.key !== species.key);
        }
        return [...prev, species];
      });
    },
    [setSelectedSpecies]
  );

  const handleBulkAdd = async () => {
    const names = [...new Set(speciesList.split(/[\n,;]/).map((name) => name.trim()).filter(Boolean))];
    if (!names.length) return;
    if (names.length > 50) {
      setBulkMessage({ severity: "warning", text: "Envie no máximo 50 espécies por vez." });
      return;
    }

    setBulkLoading(true);
    setBulkMessage(null);
    const responses = await Promise.all(
      names.map(async (name) => {
        try {
          const matches = await taxonomyApi.autocomplete(name);
          const normalized = name.toLocaleLowerCase();
          return matches.find((item) => item.name?.toLocaleLowerCase() === normalized) ?? matches[0] ?? null;
        } catch {
          return null;
        }
      })
    );
    const found = responses.filter(Boolean);
    setSelectedSpecies((previous) => {
      const keys = new Set(previous.map((species) => species.key));
      return [...previous, ...found.filter((species) => !keys.has(species.key))];
    });
    const notFound = names.length - found.length;
    setBulkMessage({
      severity: notFound ? "warning" : "success",
      text: `${found.length} espécie(s) adicionada(s)${notFound ? `. ${notFound} não encontrada(s).` : "."}`,
    });
    setBulkLoading(false);
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Selecionar espécies
        </Typography>
        <Typography variant="body2" sx={{ color: "#0f1a00" }}>
          Busque pelo nome ou navegue pela árvore taxonômica para adicionar espécies à sua consulta.
        </Typography>
      </Box>

      <CustomWarning show={selectedSpecies.length > PERFORMANCE_WARNING_THRESHOLD} 
      msg={`Você selecionou ${selectedSpecies.length} espécies. Consultas com muitas espécies podem apresentar lentidão. Considere reduzir a seleção para melhores resultados.`} />

      <Box
        sx={{
          bgcolor: "rgba(255,255,255,0.04)",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.08)",
          p: 3,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_e, val) => setActiveTab(val)}
          aria-label="Modos de seleção de espécie"
          sx={{
            mb: 0,
            minHeight: 36,
            "& .MuiTabs-indicator": { bgcolor: "#D95204" },
          }}
        >
          <Tab label="Busca por nome" id="species-tab-0" aria-controls="species-tabpanel-0" sx={TAB_SX} />
          <Tab label="Adicionar lista" id="species-tab-1" aria-controls="species-tabpanel-1" sx={TAB_SX} />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                Árvore taxonômica
                <Chip label="Beta" size="small" sx={{ height: 16, fontSize: "0.55rem", bgcolor: "rgba(217,82,4,0.3)", color: "#ffb380" }} />
              </Box>
            }
            id="species-tab-2"
            aria-controls="species-tabpanel-2"
            sx={TAB_SX}
          />
        </Tabs>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

        <TabPanel value={activeTab} index={0}>
          <AutocompleteInput selectedSpecies={selectedSpecies} onSelect={handleSelect} />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.72)", mb: 1.5 }}>
            Cole nomes científicos, um por linha (ou separados por vírgula). O sistema procura e adiciona os nomes reconhecidos.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={6}
            value={speciesList}
            onChange={(event) => setSpeciesList(event.target.value)}
            placeholder={"Biomphalaria glabrata\nBiomphalaria straminea\nBiomphalaria tenagophila"}
            sx={LIST_INPUT_SX}
          />
          <Button
            variant="contained"
            onClick={handleBulkAdd}
            disabled={bulkLoading || !speciesList.trim()}
            sx={{ mt: 1.5, bgcolor: "#D95204", "&:hover": { bgcolor: "#b84303" } }}
          >
            {bulkLoading ? "Procurando espécies..." : "Adicionar espécies"}
          </Button>
          {bulkMessage && <Alert severity={bulkMessage.severity} sx={{ mt: 1.5 }}>{bulkMessage.text}</Alert>}
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <TaxonomyTree selectedSpecies={selectedSpecies} onSelect={handleSelect} />
        </TabPanel>
      </Box>

      <StepActions selectedSpecies={selectedSpecies}
        disableNext={selectedSpecies.length === 0}
        disableHint="Selecione ao menos uma espécie para continuar"
      />
    </Box>
  );
}
