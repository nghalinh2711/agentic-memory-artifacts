import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#ff3a0d",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#213236",
    },
    background: {
      default: "#ffffff",
    },
    text: {
      primary: "#213236",
      secondary: "#5a6b6e",
    },
  },
  typography: {
    fontFamily: '"Josefin Sans", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    body1: { fontWeight: 400 },
    body2: { fontWeight: 400 },
    overline: {
      textTransform: "uppercase",
      fontSize: "0.75rem",
      letterSpacing: "0.1em",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 4,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          color: "#ffffff",
          borderRadius: 4,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "none",
        },
      },
    },
  },
});

export default theme;

