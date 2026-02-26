import { useState } from "react";
import {
  Box, Typography, Tabs, Tab, Alert,
} from "@mui/material";
import ParametricExploration from "../components/ParametricExploration";
import MultivariableExploration from "../components/MultivariableExploration";
import ConfigurationComparison from "../components/ConfigurationComparison";
import MaterialVisualization from "../components/MaterialVisualization";
import { useModel } from "../contexts/ModelContext";

export default function ExplorationLab() {
  const { models, selectedModel } = useModel();
  const [tab, setTab] = useState(0);

  // Visualization tab doesn't need a model
  const needsModel = tab < 3;

  if (models.length === 0 && needsModel) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Material Exploration Lab</Typography>
        <Alert severity="info">
          No hay modelos entrenados. Ve a Model Training para entrenar un modelo primero.
        </Alert>
        <Tabs value={3} onChange={(_, v) => setTab(v)} sx={{ mt: 3, mb: 3 }}>
          <Tab label="Paramétrica" disabled />
          <Tab label="Multivariable" disabled />
          <Tab label="Comparación" disabled />
          <Tab label="Microestructura" />
        </Tabs>
        {tab === 3 && <MaterialVisualization />}
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Material Exploration Lab</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Paramétrica" />
        <Tab label="Multivariable" />
        <Tab label="Comparación" />
        <Tab label="Microestructura" />
      </Tabs>

      {tab === 0 && selectedModel && <ParametricExploration modelId={selectedModel} />}
      {tab === 1 && selectedModel && <MultivariableExploration modelId={selectedModel} />}
      {tab === 2 && selectedModel && <ConfigurationComparison modelId={selectedModel} />}
      {tab === 3 && <MaterialVisualization />}
    </Box>
  );
}
