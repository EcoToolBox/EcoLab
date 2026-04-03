import { useCallback, useState } from "react";
import { Box, Typography, Divider, Tabs, Tab, Chip } from "@mui/material";
import AutocompleteInput from "./AutocompleteInput";
import TaxonomyTree from "./TaxonomyTree";
import CustomWarning from "../../components/CustomWarning";
import StepActions from "../../components/StepActions";
import { PERFORMANCE_WARNING_THRESHOLD } from "../../constants/taxonomy";

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

export default function SpeciesSearch({ selectedSpecies, setSelectedSpecies }) {
  const [activeTab, setActiveTab] = useState(0);

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
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                Árvore taxonômica
                <Chip label="Beta" size="small" sx={{ height: 16, fontSize: "0.55rem", bgcolor: "rgba(217,82,4,0.3)", color: "#ffb380" }} />
              </Box>
            }
            id="species-tab-1"
            aria-controls="species-tabpanel-1"
            sx={TAB_SX}
          />
        </Tabs>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

        <TabPanel value={activeTab} index={0}>
          <AutocompleteInput selectedSpecies={selectedSpecies} onSelect={handleSelect} />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
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
