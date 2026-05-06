import { Box, Typography, LinearProgress } from "@mui/material";
import { useEffect, useState } from "react";

/**
 * Full-area loading overlay with animated progress bar and rotating messages.
 *
 * Props:
 *   messages  – string[]  rotating phrases shown every `interval` ms
 *   interval  – number    ms between phrase changes (default 3000)
 */
export default function LoadingOverlay({
  messages = ["Carregando..."],
  interval = 100000,
}) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Rotate messages
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, interval);
    return () => clearInterval(id);
  }, [messages, interval]);

  // Animate progress bar (indeterminate feel but visually richer)
  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) return p; // stall near end so it never completes prematurely
        return p + Math.random() * 4;
      });
    }, 800);
    return () => clearInterval(id);
  }, []);

  return (
    <Box
      sx={{
        height: "60vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 3,
        px: 4,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 480 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.1)",
            "& .MuiLinearProgress-bar": {
              bgcolor: "#D95204",
              borderRadius: 3,
            },
          }}
        />
      </Box>

      <Typography
        key={msgIndex}
        variant="body2"
        sx={{
          color: "#333",
          textAlign: "center",
          animation: "fadeIn 0.5s ease",
          "@keyframes fadeIn": {
            from: { opacity: 0, transform: "translateY(6px)" },
            to:   { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        {messages[msgIndex]}
      </Typography>
    </Box>
  );
}
