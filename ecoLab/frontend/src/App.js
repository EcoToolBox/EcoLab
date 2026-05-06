import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import MainLayout from "./layout/MainLayout";
import SpeciesSearch from "./pages/SpeciesSearch";
import Occurrences from "./pages/Occurrences";
import Environment from "./pages/Environment";
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

  // ── Interaction config ──
  const [interactionConfig, setInteractionConfig] = useState({
    selectedInteractions: [],
    depth: 1,
    skip: false,
  });

  // ── Environment config ──
  const [selectedEnv, setSelectedEnv]   = useState([]);
  const [geeProject,  setGeeProject]    = useState("");

  // ── Models config ──
  const [modelsData, setModelsData] = useState({
    presenceType: "presence_only",
    selectedModels: [],
    selectedMetrics: [],
  });

  // ── Fetched data (populated by data screens) ──
  const [occurrenceData,  setOccurrenceData]  = useState([]);
  const [interactionData, setInteractionData] = useState([]);
  const [finalData,       setFinalData]       = useState([]);

  const sharedProps = { selectedSpecies, setSelectedSpecies };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout {...sharedProps} />}>

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
                configOnly
              />
            }
          />

          <Route path="models"
            element={
              <Models
                selectedSpecies={selectedSpecies}
                modelsData={modelsData}
                setModelsData={setModelsData}
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
                occurrenceData={occurrenceData}
                setOccurrenceData={setOccurrenceData}
              />
            }
          />

          <Route path="env-result"
            element={
              <EnvResult
                selectedSpecies={selectedSpecies}
                occurrenceData={occurrenceData}
                setOccurrenceData={setOccurrenceData}
                interactionConfig={interactionConfig}
                setInteractionData={setInteractionData}
                selectedEnv={selectedEnv}
                geeProject={geeProject}
                finalData={finalData}
                setFinalData={setFinalData}
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
              />
            }
          />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}
