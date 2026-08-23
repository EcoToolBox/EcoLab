import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import MainLayout from "./layout/MainLayout";
import SpeciesSearch from "./pages/SpeciesSearch";
import Occurrences from "./pages/Occurrences";
import OccurrenceColumnMapping from "./pages/Occurrences/ColumnMapping";
import Environment from "./pages/Environment";
import EnvColumnMapping from "./pages/Environment/ColumnMapping";
import Interactions from "./pages/Environment/Interactions";
import Models from "./pages/Models";
import OccurrenceResults from "./pages/Occurrences/Results";
import EnvResult from "./pages/Environment/EnvResult";
import ModelResults from "./pages/Models/ResultsModel";
import Home from "./pages/Home";
import { STEPS } from "./constants/steps";

import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow });

// All questionnaires first, then data-fetching screens.

export default function App() {

  const currentYear = new Date().getFullYear();

  // ── Species ──
  const [selectedSpecies, setSelectedSpecies] = useState([]);

  // ── Occurrence config ──
  const [selectedSources, setSelectedSources] = useState([]);
  const [sourceConfig, setSourceConfig] = useState({
    gbif:        { alreadyExists: false, email: "", userId: "", apiKey: "" },
    specieslink: { alreadyExists: false, apiKey: "" },
  });
  const [place, setPlace] = useState({ type: "country", country: "", points: [] });
  const [years, setYears] = useState([1800, currentYear]);

  // ── Occurrence data source mode ("sources" | "upload" | "both") ──
  const [occurrenceMode, setOccurrenceMode] = useState("sources");
  const [occurrenceUpload, setOccurrenceUpload] = useState({
    file: null,
    fileName: "",
    columns: [],
    preview: [],
    mapping: { species: "", latitude: "", longitude: "", eventDate: "" },
  });

  // ── Interaction config ──
  const [interactionConfig, setInteractionConfig] = useState({
    selectedInteractions: [],
    depth: 1,
    skip: false,
  });

  // ── Environment config ──
  const [selectedEnv, setSelectedEnv]   = useState([]);
  const [geeProject,  setGeeProject]    = useState("");

  // ── Environment data source mode ("sources" | "upload" | "both") ──
  const [environmentMode, setEnvironmentMode] = useState("sources");
  const [envUpload, setEnvUpload] = useState({
    file: null,
    fileName: "",
    columns: [],
    mapping: { latitude: "", longitude: "" },
    variables: [],
  });

  // ── Models config ──
  const [modelsData, setModelsData] = useState({
    presenceType: "presence_only",
    selectedModels: [],
    selectedMetrics: [],
    // Validação: "random" (padrão, uso genérico) ou "spatial" (K-means por
    // coordenadas). nFolds só é usado no modo espacial. backgroundRatio é
    // quantos pontos de background por presença (padrão 2:1).
    // backgroundSource indica se o background vem do grid gerado
    // automaticamente ou de uma planilha fornecida pelo usuário.
    validationMode: "random",
    nFolds: 10,
    backgroundRatio: 2,
    backgroundSource: "grid_random",
  });

  // ── Fetched data (populated by data screens) ──
  const [occurrenceData,  setOccurrenceData]  = useState([]);
  const [interactionData, setInteractionData] = useState([]);
  const [finalData,       setFinalData]       = useState([]);
  // Grid ambiental vindo da planilha do usuário (lat/long + variáveis cobrindo
  // a área de interesse), usado como background/grid de predição no lugar do
  // grid do país + GEE.
  const [envGridData,     setEnvGridData]     = useState([]);

  const sharedProps = { selectedSpecies, setSelectedSpecies };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout {...sharedProps} place={place} setPlace={setPlace} />}>

          <Route index element={<Home {...sharedProps} />} />

          <Route path="species"
            element={<SpeciesSearch {...sharedProps} />}
          />

          <Route path="occurrences"
            element={
              <Occurrences
                selectedSpecies={selectedSpecies}
                setSelectedSpecies={setSelectedSpecies}
                selectedSources={selectedSources}
                setSelectedSources={setSelectedSources}
                sourceConfig={sourceConfig}
                setSourceConfig={setSourceConfig}
                place={place}
                setPlace={setPlace}
                years={years}
                setYears={setYears}
                occurrenceMode={occurrenceMode}
                setOccurrenceMode={setOccurrenceMode}
                occurrenceUpload={occurrenceUpload}
                setOccurrenceUpload={setOccurrenceUpload}
              />
            }
          />

          <Route path="occurrence-mapping"
            element={
              <OccurrenceColumnMapping
                selectedSpecies={selectedSpecies}
                occurrenceUpload={occurrenceUpload}
                setOccurrenceUpload={setOccurrenceUpload}
              />
            }
          />

          <Route path="interactions"
            element={
              <Interactions
                selectedSpecies={selectedSpecies}
                interactionConfig={interactionConfig}
                setInteractionConfig={setInteractionConfig}
                configOnly
              />
            }
          />

          <Route path="environment"
            element={
              <Environment
                selectedSpecies={selectedSpecies}
                selectedEnv={selectedEnv}
                setSelectedEnv={setSelectedEnv}
                geeProject={geeProject}
                setGeeProject={setGeeProject}
                environmentMode={environmentMode}
                setEnvironmentMode={setEnvironmentMode}
                envUpload={envUpload}
                setEnvUpload={setEnvUpload}
                configOnly
              />
            }
          />

          <Route path="environment-mapping"
            element={
              <EnvColumnMapping
                selectedSpecies={selectedSpecies}
                envUpload={envUpload}
                setEnvUpload={setEnvUpload}
              />
            }
          />

          <Route path="models"
            element={
              <Models
                selectedSpecies={selectedSpecies}
                modelsData={modelsData}
                setModelsData={setModelsData}
                envGridData={envGridData}
              />
            }
          />

          <Route path="results"
            element={
              <OccurrenceResults
                selectedSpecies={selectedSpecies}
                selectedSources={selectedSources}
                sourceConfig={sourceConfig}
                place={place}
                years={years}
                occurrenceMode={occurrenceMode}
                occurrenceUpload={occurrenceUpload}
                occurrenceData={occurrenceData}
                setOccurrenceData={setOccurrenceData}
              />
            }
          />

          <Route path="env-result"
            element={
              <EnvResult
                selectedSpecies={selectedSpecies}
                selectedSources={selectedSources}
                occurrenceData={occurrenceData}
                setOccurrenceData={setOccurrenceData}
                interactionConfig={interactionConfig}
                setInteractionData={setInteractionData}
                selectedEnv={selectedEnv}
                geeProject={geeProject}
                finalData={finalData}
                setFinalData={setFinalData}
                environmentMode={environmentMode}
                envUpload={envUpload}
                setEnvGridData={setEnvGridData}
              />
            }
          />

          <Route path="models-results"
            element={
              <ModelResults
                selectedSpecies={selectedSpecies}
                interactionData={interactionData}
                finalData={finalData}
                modelsData={modelsData}
                place={place}
                geeProject={geeProject}
                envGridData={envGridData}
              />
            }
          />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}
