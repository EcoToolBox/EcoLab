import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import MainLayout from "./layout/MainLayout";
import SpeciesSearch from "./pages/SpeciesSearch";

export default function App() {
  const [selectedSpecies, setSelectedSpecies] = useState([]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <MainLayout
              selectedSpecies={selectedSpecies}
              setSelectedSpecies={setSelectedSpecies}
            />
          }
        >
          <Route
            index
            element={
              <SpeciesSearch
                selectedSpecies={selectedSpecies}
                setSelectedSpecies={setSelectedSpecies}
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}