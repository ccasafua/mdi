import { useState, useEffect } from "react";
import {
  Box, Typography, Paper, TextField, MenuItem, Tabs, Tab, Alert,
} from "@mui/material";
import { listModels } from "../api/client";
import ParametricExploration from "../components/ParametricExploration";
import MultivariableExploration from "../components/MultivariableExploration";
import ConfigurationComparison from "../components/ConfigurationComparison";
import MaterialVisualization from "../components/MaterialVisualization";

interface ModelInfo {
  model_id: string;
  algorithm: string;
  r2: number;
}

export default function ExplorationLab() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [tab, setTab] = useState(0);

  useEffect(() => {
    listModels().then((res) => {
      setModels(res.data);
      if (res.data.length > 0) setSelectedModel(res.data[0].model_id);
    });
  }, []);

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

      {needsModel && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <TextField
            select fullWidth label="Seleccionar Modelo" value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            sx={{ maxWidth: 500 }}
          >
            {models.map((m) => (
              <MenuItem key={m.model_id} value={m.model_id}>
                {m.algorithm} ({m.model_id}) - R²: {m.r2.toFixed(3)}
              </MenuItem>
            ))}
          </TextField>
        </Paper>
      )}

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
