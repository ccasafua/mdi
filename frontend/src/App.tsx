import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import {
  AppBar, Toolbar, Typography, Box, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, CssBaseline, ThemeProvider, createTheme,
  ToggleButtonGroup, ToggleButton, Divider, TextField, MenuItem,
} from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import ModelTrainingIcon from "@mui/icons-material/Psychology";
import InsightsIcon from "@mui/icons-material/Insights";
import ScienceIcon from "@mui/icons-material/Science";
import ListAltIcon from "@mui/icons-material/ListAlt";
import DescriptionIcon from "@mui/icons-material/Description";
import ArchitectureIcon from "@mui/icons-material/Architecture";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DataExplorer from "./pages/DataExplorer";
import ModelTraining from "./pages/ModelTraining";
import Explanations from "./pages/Explanations";
import ExplorationLab from "./pages/ExplorationLab";
import Configurations from "./pages/Configurations";
import FichaTecnica from "./pages/FichaTecnica";
import DesignInterpretation from "./pages/DesignInterpretation";
import InverseDesign from "./pages/InverseDesign";
import { ModeProvider, useMode, type Mode } from "./contexts/ModeContext";
import { ModelProvider } from "./contexts/ModelContext";
import { DatasetProvider, useDataset } from "./contexts/DatasetContext";
import { MaterialPropertiesProvider } from "./contexts/MaterialPropertiesContext";

const drawerWidth = 240;

const theme = createTheme({
  palette: {
    primary: { main: "#1565c0" },
    background: { default: "#f5f5f5" },
  },
});

import type { ReactNode } from "react";

interface NavSection {
  header: string;
  items: { label: string; path: string; icon: ReactNode }[];
}

const navSections: NavSection[] = [
  {
    header: "Motor Cementicio",
    items: [
      { label: "Explorador de Datos", path: "/", icon: <StorageIcon /> },
      { label: "Modelado Predictivo", path: "/models", icon: <ModelTrainingIcon /> },
      { label: "Explicabilidad (SHAP)", path: "/explanations", icon: <InsightsIcon /> },
      { label: "Lab. de Exploracion", path: "/exploration", icon: <ScienceIcon /> },
      { label: "Configuraciones", path: "/configurations", icon: <ListAltIcon /> },
    ],
  },
  {
    header: "Diseno Inverso",
    items: [
      { label: "Diseno Inverso", path: "/inverse-design", icon: <SwapHorizIcon /> },
    ],
  },
  {
    header: "Evaluacion",
    items: [
      { label: "Ficha Tecnica", path: "/ficha-tecnica", icon: <DescriptionIcon /> },
      { label: "Aplicaciones", path: "/design-interpretation", icon: <ArchitectureIcon /> },
    ],
  },
];

function NavContent() {
  const location = useLocation();
  const { datasets, selectedDataset, setSelectedDataset } = useDataset();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {navSections.map((section, si) => (
        <Box key={section.header}>
          {si > 0 && <Divider />}
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ px: 2, pt: 1.5, pb: 0.5, display: "block", letterSpacing: 0.5, textTransform: "uppercase", fontSize: "0.65rem" }}
          >
            {section.header}
          </Typography>
          <List dense disablePadding>
            {section.items.map((item) => (
              <ListItemButton
                key={item.path}
                component={Link}
                to={item.path}
                selected={location.pathname === item.path}
                sx={{ py: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ))}
      <Divider sx={{ mt: "auto" }} />
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: "block" }}>
          Dataset Activo
        </Typography>
        {datasets.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
            Cargando...
          </Typography>
        ) : (
          <TextField
            select fullWidth size="small" value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
          >
            {datasets.map((ds) => (
              <MenuItem key={ds.name} value={ds.name}>
                {ds.name} ({ds.num_samples})
              </MenuItem>
            ))}
          </TextField>
        )}
      </Box>
    </Box>
  );
}

function ModeToggle() {
  const { mode, setMode } = useMode();
  return (
    <ToggleButtonGroup
      value={mode}
      exclusive
      onChange={(_, v: Mode | null) => { if (v) setMode(v); }}
      size="small"
      sx={{
        ml: "auto",
        "& .MuiToggleButton-root": {
          color: "rgba(255,255,255,0.7)",
          borderColor: "rgba(255,255,255,0.3)",
          "&.Mui-selected": { color: "#fff", bgcolor: "rgba(255,255,255,0.15)" },
        },
      }}
    >
      <ToggleButton value="technical">Tecnico</ToggleButton>
      <ToggleButton value="design">Diseno</ToggleButton>
    </ToggleButtonGroup>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ModeProvider>
      <DatasetProvider>
      <ModelProvider>
      <MaterialPropertiesProvider>
      <BrowserRouter>
        <Box sx={{ display: "flex" }}>
          <AppBar
            position="fixed"
            sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
          >
            <Toolbar>
              <Typography variant="h6" noWrap>
                Material Design Intelligence (MDI)
              </Typography>
              <ModeToggle />
            </Toolbar>
          </AppBar>
          <Drawer
            variant="permanent"
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              "& .MuiDrawer-paper": {
                width: drawerWidth,
                boxSizing: "border-box",
              },
            }}
          >
            <Toolbar />
            <NavContent />
          </Drawer>
          <Box
            component="main"
            sx={{ flexGrow: 1, p: 3, mt: 8, minHeight: "100vh" }}
          >
            <Routes>
              <Route path="/" element={<DataExplorer />} />
              <Route path="/models" element={<ModelTraining />} />
              <Route path="/explanations" element={<Explanations />} />
              <Route path="/exploration" element={<ExplorationLab />} />
              <Route path="/configurations" element={<Configurations />} />
              <Route path="/ficha-tecnica" element={<FichaTecnica />} />
              <Route path="/design-interpretation" element={<DesignInterpretation />} />
              <Route path="/inverse-design" element={<InverseDesign />} />
            </Routes>
          </Box>
        </Box>
      </BrowserRouter>
      </MaterialPropertiesProvider>
      </ModelProvider>
      </DatasetProvider>
      </ModeProvider>
    </ThemeProvider>
  );
}
