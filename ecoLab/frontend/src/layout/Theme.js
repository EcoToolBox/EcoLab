import { useMemo } from "react";
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import { ptBR as corePtBR, enUS as coreEnUS } from "@mui/material/locale";
import { ptBR as gridPtBR, enUS as gridEnUS } from "@mui/x-data-grid/locales";
import { useI18n } from "../i18n";

import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";

// Cores da marca (logo): verde-escuro + laranja. Definidas uma vez aqui para
// todo componente do MUI (rádios, caixas, botões, links) usar a mesma paleta.
export const BRAND = {
  dark: "#0f1a00",
  darkAlt: "#172601",
  green: "#4f7a1f",
  greenLight: "#6a9a2a",
  orange: "#D95204",
  orangeDark: "#b84303",
  paper: "#ffffff",
  background: "#f5f6f1",
  text: "#1f2617",
  textMuted: "#5b6352",
  border: "#e1e4da",
};

function buildTheme(lang) {
  const locales = lang === "pt" ? [corePtBR, gridPtBR] : [coreEnUS, gridEnUS];
  return createTheme(
    {
      palette: {
        mode: "light",
        primary: { main: BRAND.orange, dark: BRAND.orangeDark, contrastText: "#fff" },
        secondary: { main: BRAND.green, light: BRAND.greenLight, contrastText: "#fff" },
        success: { main: "#2e7d32" },
        background: { default: BRAND.background, paper: BRAND.paper },
        text: { primary: BRAND.text, secondary: BRAND.textMuted },
        divider: BRAND.border,
      },
      shape: { borderRadius: 8 },
      typography: {
        fontFamily: ["Poppins", "sans-serif"].join(","),
        h4: { fontWeight: 600, fontSize: "1.6rem" },
        h5: { fontWeight: 600, fontSize: "1.3rem" },
        h6: { fontWeight: 600, fontSize: "1.05rem" },
        subtitle1: { fontWeight: 600 },
        button: { textTransform: "none", fontWeight: 600 },
      },
      components: {
        MuiButton: { defaultProps: { disableElevation: true } },
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
        MuiAccordion: {
          defaultProps: { disableGutters: true, elevation: 0 },
          styleOverrides: {
            root: { border: `1px solid ${BRAND.border}`, borderRadius: 8, "&:before": { display: "none" } },
          },
        },
        MuiTooltip: { defaultProps: { arrow: true } },
      },
    },
    ...locales
  );
}

export default function Theme({ children }) {
  const { lang } = useI18n();
  const theme = useMemo(() => buildTheme(lang), [lang]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
