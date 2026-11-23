import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { I18nProvider } from "./i18n";
import { AnalysisProvider } from "./state/AnalysisContext";
import Theme from "./layout/Theme";
import MainLayout from "./layout/MainLayout";
import Home from "./pages/Home";
import Occurrences from "./pages/Occurrences";
import Environment from "./pages/Environment";
import Models from "./pages/Models";
import Results from "./pages/Results";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow });

// Fluxo: Início → 1. Ocorrências → 2. Ambiente → 3. Modelos → 4. Resultados.
// Todo o estado da análise fica em AnalysisContext (salvo automaticamente).
export default function App() {
  return (
    <I18nProvider>
      <AnalysisProvider>
        <Theme>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Home />} />
                <Route path="occurrences" element={<Occurrences />} />
                <Route path="environment" element={<Environment />} />
                <Route path="models" element={<Models />} />
                <Route path="results" element={<Results />} />
                {/* endereços antigos */}
                <Route path="species" element={<Navigate to="/occurrences" replace />} />
                <Route path="models-results" element={<Navigate to="/results" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </Theme>
      </AnalysisProvider>
    </I18nProvider>
  );
}
