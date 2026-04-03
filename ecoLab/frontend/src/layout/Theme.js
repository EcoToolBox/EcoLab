
import { createTheme, ThemeProvider } from '@mui/material/styles';

import '@fontsource/poppins/300.css'; // Light
import '@fontsource/poppins/400.css'; // Regular
import '@fontsource/poppins/500.css'; // Medium
import '@fontsource/poppins/700.css'; // Bold


const theme = createTheme({
  typography: {
    fontFamily: [
      'Poppins',
      'sans-serif',
    ].join(','),
  },
});
export default function Theme({ children, ...props }) {
  return (
    
  <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
}