
import {
  MapContainer,
  TileLayer,
  useMapEvents,
  Marker,
  Polygon,
} from "react-leaflet";
import {
  Box,
  Typography,
  Button,
} from "@mui/material";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

import "leaflet/dist/leaflet.css";

function FixMapSize() {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);

  return null;
}
function MapClickHandler({ points, setPoints }) {
    
  useMapEvents({
    click(e) {
      if (points.length >= 4) return;

      const newPoints = [...points, [e.latlng.lat, e.latlng.lng]];
      setPoints(newPoints);
    },
  });

  return null;
}
export default function MapSelector({ value, setValue }) {

  const points = value.points || [];

  const setPoints = (newPoints) => {
    setValue({
      ...value,
      points: newPoints,
    });
  };

  const getRectangle = () => {
  if (points.length < 2) return null;

  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return [
    [minLat, minLng],
    [minLat, maxLng],
    [maxLat, minLng],
    [maxLat, maxLng],
  ];
};

  return (
    <Box>
      <MapContainer
          center={[-15, -55]}
            zoom={4}
            style={{ height: "400px", width: "100%" }}>
        <FixMapSize />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <MapClickHandler points={points} setPoints={setPoints} />

        {/* Pontos */}
        {points.map((p, i) => (
          <Marker key={i} position={p} />
        ))}

        {points.length === 4 && (
          <Polygon positions={getRectangle()} />
        )}
      </MapContainer>

      <Box sx={{ mt: 1, display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" sx={{ color: "#666" }}>
          Clique em 2 pontos para definir a área
        </Typography>

        <Button size="small" onClick={() => setPoints([])}>
          Limpar
        </Button>
      </Box>
    </Box>
  );
}
