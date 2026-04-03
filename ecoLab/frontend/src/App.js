import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import MainLayout from "./layout/MainLayout";
import SpeciesSearch from "./pages/SpeciesSearch";
import Occurrences from "./pages/Occurrences";
import Results from "./pages/Occurrences/Results";
import Home from "./pages/Home";


import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
export const STEPS = [
  { path: "/",        label: "Home"  },
  { path: "/species", label: "Espécies"  },
  { path: "/occurrences", label: "Ocorrências"   },
  { path: "/results", label: "Resultados"},
];
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
export default function App() {
  const [selectedSpecies, setSelectedSpecies] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [sourceConfig, setSourceConfig] = useState({
    gbif: {
      email: "",
      userId: "",
      apiKey: "",
    },
    specieslink: {
      apiKey: "",
    },
  });
  const [place, setPlace] = useState({
    type: "country",
    country: "",
    points: [],
  });

      
  const currentYear = new Date().getFullYear();
  const [years, setYears] = useState([1800, currentYear]);

  const sharedProps = { selectedSpecies, setSelectedSpecies };
  const sharedPropsOccurrences = { selectedSpecies, setSelectedSpecies, selectedSources, setSelectedSources, sourceConfig, setSourceConfig, place, setPlace, years, setYears };

  return (

    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout {...sharedProps} />}>
          <Route index            element={<Home {...sharedProps} />} />
          <Route path="species"  element={<SpeciesSearch {...sharedProps} />} />
          <Route path="occurrences"  element={<Occurrences       {...sharedPropsOccurrences} />} />
          <Route path="results"  element={<Results       {...sharedPropsOccurrences} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
