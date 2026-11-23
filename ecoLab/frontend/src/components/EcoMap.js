import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, GeoJSON, ImageOverlay, Pane, Tooltip, useMap } from "react-leaflet";
import { Box, FormControlLabel, Switch, Typography } from "@mui/material";
import "leaflet/dist/leaflet.css";
import { useT } from "../i18n";
import { BRAND } from "../layout/Theme";
import api from "../services/api";

export const SPECIES_COLORS = ["#D95204", "#4f7a1f", "#2b6cb0", "#8e44ad", "#c0392b", "#16a085", "#b7950b", "#5d6d7e"];

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => {
      map.invalidateSize();
      if (bounds) map.fitBounds(bounds, { padding: [16, 16] });
    }, 50);
    return () => clearTimeout(id);
  }, [map, bounds]);
  return null;
}

function geoBounds(geojson) {
  let latMin = 90, latMax = -90, lonMin = 180, lonMax = -180;
  const walk = (c) => {
    if (typeof c[0] === "number") {
      lonMin = Math.min(lonMin, c[0]); lonMax = Math.max(lonMax, c[0]);
      latMin = Math.min(latMin, c[1]); latMax = Math.max(latMax, c[1]);
    } else c.forEach(walk);
  };
  (geojson?.features ?? [geojson]).forEach((f) => f?.geometry?.coordinates && walk(f.geometry.coordinates));
  return latMin <= latMax ? [[latMin, lonMin], [latMax, lonMax]] : null;
}

/** Contorno do país (vem do backend, funciona sem internet). */
export function useCountryShape(iso3) {
  const [shape, setShape] = useState(null);
  useEffect(() => {
    setShape(null);
    if (!iso3) return undefined;
    let active = true;
    api.countryGeometry(iso3).then((g) => active && setShape(g)).catch(() => {});
    return () => {
      active = false;
    };
  }, [iso3]);
  return shape;
}

/**
 * Mapa único do EcoLab: contorno do país, pontos de ocorrência e (nos
 * resultados) a camada de adequabilidade. O fundo de ruas (OpenStreetMap)
 * precisa de internet; sem ele o mapa continua legível pelo contorno.
 */
export default function EcoMap({ iso3, points = [], overlay, height = 420, legend }) {
  const t = useT();
  const shape = useCountryShape(iso3);
  const [basemap, setBasemap] = useState(true);
  const [tilesFailed, setTilesFailed] = useState(false);
  const showTiles = basemap && !tilesFailed;

  const speciesList = useMemo(() => [...new Set(points.map((p) => p.species))], [points]);
  const colorOf = (sp) => SPECIES_COLORS[Math.max(0, speciesList.indexOf(sp)) % SPECIES_COLORS.length];

  const bounds = useMemo(() => {
    if (overlay?.bounds) return overlay.bounds;
    const fromShape = shape ? geoBounds(shape) : null;
    if (fromShape) return fromShape;
    if (!points.length) return null;
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
  }, [overlay, shape, points]);

  return (
    <Box>
      <Box sx={{ height, borderRadius: 2, overflow: "hidden", border: `1px solid ${BRAND.border}`, bgcolor: "#eef1ea" }}>
        <MapContainer center={[-15, -55]} zoom={3} style={{ height: "100%", width: "100%", background: "#eef1ea" }} preferCanvas worldCopyJump>
          {basemap && (
            <TileLayer
              eventHandlers={{ tileerror: () => setTilesFailed(true) }}
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
              opacity={overlay ? 0.6 : 1}
            />
          )}
          {shape && (
            <Pane name="country" style={{ zIndex: 350 }}>
              <GeoJSON
                key={iso3}
                data={shape}
                style={{ color: BRAND.dark, weight: 1.2, fill: !showTiles && !overlay, fillColor: "#ffffff", fillOpacity: 0.7 }}
              />
            </Pane>
          )}
          {overlay?.url && overlay?.bounds && <ImageOverlay url={overlay.url} bounds={overlay.bounds} opacity={overlay.opacity ?? 0.85} />}
          {points.map((p, i) => (
            <CircleMarker
              key={i}
              center={[p.lat, p.lon]}
              radius={overlay ? 2.5 : 3.5}
              pathOptions={{ color: overlay ? "#111" : colorOf(p.species), weight: overlay ? 0.6 : 1, fillOpacity: 0.8 }}
            >
              {p.species && (
                <Tooltip>
                  <i>{p.species}</i>
                </Tooltip>
              )}
            </CircleMarker>
          ))}
          <FitBounds bounds={bounds} />
        </MapContainer>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2, mt: 1 }}>
        {!overlay &&
          speciesList.length > 1 &&
          speciesList.slice(0, 8).map((sp) => (
            <Box key={sp} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colorOf(sp) }} />
              <Typography variant="caption" sx={{ fontStyle: "italic" }}>
                {sp}
              </Typography>
            </Box>
          ))}
        {legend}
        <Box sx={{ flex: 1 }} />
        {tilesFailed && basemap && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {t("map.offline")}
          </Typography>
        )}
        <FormControlLabel
          control={<Switch size="small" checked={basemap} onChange={(e) => setBasemap(e.target.checked)} />}
          label={<Typography variant="caption">{t("map.basemap")}</Typography>}
        />
      </Box>
    </Box>
  );
}
