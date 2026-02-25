import { useState, useEffect } from "react";
import {
  Box, Typography, Button, TextField, Grid, CircularProgress,
  Paper, MenuItem, Alert, Divider,
} from "@mui/material";
import Plot from "react-plotly.js";
import {
  listModels, computeShap, getShapSummary, getFeatureImportance,
  explainPrediction, getDependenceData,
} from "../api/client";
import FeatureImportance from "../components/FeatureImportance";
import ShapSummary from "../components/ShapSummary";
import ShapWaterfall from "../components/ShapWaterfall";

const FEATURES = [
  "cement", "blast_furnace_slag", "fly_ash", "water",
  "superplasticizer", "coarse_aggregate", "fine_aggregate", "age",
];

interface ModelInfo {
  model_id: string;
  algorithm: string;
  r2: number;
}

export default function Explanations() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [computing, setComputing] = useState(false);
  const [shapReady, setShapReady] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    points: { feature: string; shap_value: number; feature_value: number }[];
    feature_names: string[];
  } | null>(null);
  const [importanceData, setImportanceData] = useState<
    { feature: string; importance: number }[] | null
  >(null);
  const [predInput, setPredInput] = useState<Record<string, string>>(
    Object.fromEntries(FEATURES.map((f) => [f, ""]))
  );
  const [explanation, setExplanation] = useState<{
    prediction: number;
    base_value: number;
    waterfall: { feature: string; shap_value: number; feature_value: number }[];
    interpretation: string;
  } | null>(null);
  const [selectedFeature, setSelectedFeature] = useState(FEATURES[0]);
  const [depData, setDepData] = useState<{
    feature: string;
    color_feature: string;
    points: { feature_value: number; shap_value: number; color_value: number }[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listModels().then((res) => {
      setModels(res.data);
      if (res.data.length > 0) setSelectedModel(res.data[0].model_id);
    });
  }, []);

  const handleComputeShap = async () => {
    if (!selectedModel) return;
    setComputing(true);
    setError("");
    try {
      await computeShap(selectedModel);
      const [sumRes, impRes] = await Promise.all([
        getShapSummary(selectedModel),
        getFeatureImportance(selectedModel),
      ]);
      setSummaryData(sumRes.data);
      setImportanceData(impRes.data.importances);
      setShapReady(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to compute SHAP");
    }
    setComputing(false);
  };

  const handleExplain = async () => {
    if (!selectedModel) return;
    const input: Record<string, number> = {};
    for (const f of FEATURES) input[f] = parseFloat(predInput[f]) || 0;
    try {
      const res = await explainPrediction(selectedModel, input);
      setExplanation(res.data);
    } catch {
      setError("Explanation failed");
    }
  };

  const handleDependence = async () => {
    if (!selectedModel || !shapReady) return;
    try {
      const res = await getDependenceData(selectedModel, selectedFeature);
      setDepData(res.data);
    } catch {
      setError("Failed to load dependence data");
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Explainable AI (SHAP)
      </Typography>

      {models.length === 0 ? (
        <Alert severity="info">
          No trained models yet. Go to Model Training to train a model first.
        </Alert>
      ) : (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  select fullWidth label="Select Model" value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setShapReady(false);
                    setSummaryData(null);
                    setImportanceData(null);
                  }}
                >
                  {models.map((m) => (
                    <MenuItem key={m.model_id} value={m.model_id}>
                      {m.algorithm} ({m.model_id}) - R²: {m.r2.toFixed(3)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Button
                  variant="contained" fullWidth onClick={handleComputeShap}
                  disabled={computing || !selectedModel} sx={{ height: 56 }}
                >
                  {computing ? <CircularProgress size={24} /> : "Compute SHAP"}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {shapReady && summaryData && importanceData && (
            <>
              <Paper sx={{ p: 3, mb: 3 }}>
                <FeatureImportance data={importanceData} />
              </Paper>

              <Paper sx={{ p: 3, mb: 3 }}>
                <ShapSummary
                  points={summaryData.points}
                  featureNames={summaryData.feature_names}
                />
              </Paper>

              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Dependence Plot
                </Typography>
                <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      select fullWidth label="Feature" value={selectedFeature}
                      onChange={(e) => setSelectedFeature(e.target.value)}
                    >
                      {FEATURES.map((f) => (
                        <MenuItem key={f} value={f}>{f}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Button variant="outlined" onClick={handleDependence}>
                      Load Dependence Plot
                    </Button>
                  </Grid>
                </Grid>
                {depData && (
                  <Plot
                    data={[
                      {
                        x: depData.points.map((p) => p.feature_value),
                        y: depData.points.map((p) => p.shap_value),
                        mode: "markers" as const,
                        type: "scatter" as const,
                        marker: {
                          size: 5,
                          color: depData.points.map((p) => p.color_value),
                          colorscale: "Viridis" as const,
                          showscale: true,
                          colorbar: { title: depData.color_feature },
                        },
                      },
                    ]}
                    layout={{
                      height: 400,
                      xaxis: { title: depData.feature },
                      yaxis: { title: `SHAP value for ${depData.feature}` },
                      margin: { l: 60, r: 40, t: 20, b: 60 },
                    }}
                    config={{ responsive: true }}
                    style={{ width: "100%" }}
                  />
                )}
              </Paper>

              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Individual Prediction Explanation
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {FEATURES.map((f) => (
                    <Grid key={f} size={{ xs: 6, sm: 3 }}>
                      <TextField
                        fullWidth label={f} type="number" size="small"
                        value={predInput[f]}
                        onChange={(e) =>
                          setPredInput((prev) => ({ ...prev, [f]: e.target.value }))
                        }
                      />
                    </Grid>
                  ))}
                  <Grid size={{ xs: 12 }}>
                    <Button variant="contained" onClick={handleExplain}>
                      Explain Prediction
                    </Button>
                  </Grid>
                </Grid>
                {explanation && (
                  <Box sx={{ mt: 3 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      {explanation.interpretation}
                    </Alert>
                    <ShapWaterfall
                      waterfall={explanation.waterfall}
                      baseValue={explanation.base_value}
                      prediction={explanation.prediction}
                    />
                  </Box>
                )}
              </Paper>
            </>
          )}
        </>
      )}
    </Box>
  );
}
