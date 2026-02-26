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
import DataExplorer from "./pages/DataExplorer";
import ModelTraining from "./pages/ModelTraining";
import Explanations from "./pages/Explanations";
import ExplorationLab from "./pages/ExplorationLab";
import Configurations from "./pages/Configurations";
import { ModeProvider, useMode, type Mode } from "./contexts/ModeContext";
import { ModelProvider } from "./contexts/ModelContext";
import { DatasetProvider, useDataset } from "./contexts/DatasetContext";

const drawerWidth = 220;

const theme = createTheme({
  palette: {
    primary: { main: "#1565c0" },
    background: { default: "#f5f5f5" },
  },
});

const navItems = [
  { label: "Data Explorer", path: "/", icon: <StorageIcon /> },
  { label: "Model Training", path: "/models", icon: <ModelTrainingIcon /> },
  { label: "Explanations", path: "/explanations", icon: <InsightsIcon /> },
  { label: "Exploration Lab", path: "/exploration", icon: <ScienceIcon /> },
  { label: "Configurations", path: "/configurations", icon: <ListAltIcon /> },
];

function NavContent() {
  const location = useLocation();
  const { datasets, selectedDataset, setSelectedDataset } = useDataset();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <List>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={Link}
            to={item.path}
            selected={location.pathname === item.path}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
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
            </Routes>
          </Box>
        </Box>
      </BrowserRouter>
      </ModelProvider>
      </DatasetProvider>
      </ModeProvider>
    </ThemeProvider>
  );
}
