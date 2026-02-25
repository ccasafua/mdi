import { useState, useEffect } from "react";
import {
  Box, Typography, Button, TextField, MenuItem, Grid,
  CircularProgress, Paper, Alert, Divider,
} from "@mui/material";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { trainModel, listModels, getModelMetrics, predictWithUncertainty } from "../api/client";
import MetricsCard from "../components/MetricsCard";

interface ModelInfo {
  model_id: string;
  algorithm: string;
  r2: number;
  mae: number;
  rmse: number;
}

const FEATURES = [
  "cement", "blast_furnace_slag", "fly_ash", "water",
  "superplasticizer", "coarse_aggregate", "fine_aggregate", "age",
];

export default function ModelTraining() {
  const [algorithm, setAlgorithm] = useState("random_forest");
  const [nEstimators, setNEstimators] = useState(100);
  const [maxDepth, setMaxDepth] = useState<string>("");
  const [learningRate, setLearningRate] = useState(0.1);
  const [training, setTraining] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [metrics, setMetrics] = useState<{
    r2: number; mae: number; rmse: number;
    actual: number[]; predicted: number[];
  } | null>(null);
  const [predictionInput, setPredictionInput] = useState<Record<string, string>>(
    Object.fromEntries(FEATURES.map((f) => [f, ""]))
  );
  const [predictionResult, setPredictionResult] = useState<{
    prediction: number;
    lower: number;
    upper: number;
  } | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    listModels().then((res) => setModels(res.data));
  }, []);

  const handleTrain = async () => {
    setTraining(true);
    setError("");
    try {
      const params: Record<string, unknown> = {
        algorithm,
        n_estimators: nEstimators,
      };
      if (maxDepth) params.max_depth = parseInt(maxDepth);
      if (algorithm === "gradient_boosting")
        params.learning_rate = learningRate;

      const res = await trainModel(params as Parameters<typeof trainModel>[0]);
      const newModel = res.data;
      setModels((prev) => [...prev, newModel]);
      setSelectedModel(newModel.model_id);
      const metricsRes = await getModelMetrics(newModel.model_id);
      setMetrics(metricsRes.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Training failed");
    }
    setTraining(false);
  };

  const handleSelectModel = async (modelId: string) => {
    setSelectedModel(modelId);
    const res = await getModelMetrics(modelId);
    setMetrics(res.data);
  };

  const handlePredict = async () => {
    if (!selectedModel) return;
    const input: Record<string, number> = {};
    for (const f of FEATURES) {
      input[f] = parseFloat(predictionInput[f]) || 0;
    }
    try {
      const res = await predictWithUncertainty(selectedModel, input);
      setPredictionResult({
        prediction: res.data.prediction,
        lower: res.data.uncertainty.lower_bound,
        upper: res.data.uncertainty.upper_bound,
      });
    } catch {
      setError("Prediction failed");
    }
  };

  const scatterData = metrics
    ? metrics.actual.map((a, i) => ({ actual: a, predicted: metrics.predicted[i] }))
    : [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Predictive Modeling
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Train New Model
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              select fullWidth label="Algorithm" value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
            >
              <MenuItem value="random_forest">Random Forest</MenuItem>
              <MenuItem value="gradient_boosting">Gradient Boosting</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 2 }}>
            <TextField
              fullWidth label="n_estimators" type="number"
              value={nEstimators}
              onChange={(e) => setNEstimators(parseInt(e.target.value) || 100)}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 2 }}>
            <TextField
              fullWidth label="max_depth" type="number" placeholder="None"
              value={maxDepth}
              onChange={(e) => setMaxDepth(e.target.value)}
            />
          </Grid>
          {algorithm === "gradient_boosting" && (
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField
                fullWidth label="learning_rate" type="number"
                value={learningRate}
                onChange={(e) => setLearningRate(parseFloat(e.target.value) || 0.1)}
                inputProps={{ step: 0.01 }}
              />
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 2 }}>
            <Button
              variant="contained" fullWidth
              onClick={handleTrain} disabled={training}
              sx={{ height: 56 }}
            >
              {training ? <CircularProgress size={24} /> : "Train"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {models.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Trained Models
          </Typography>
          <Grid container spacing={1}>
            {models.map((m) => (
              <Grid key={m.model_id} size="auto">
                <Button
                  variant={selectedModel === m.model_id ? "contained" : "outlined"}
                  onClick={() => handleSelectModel(m.model_id)}
                  size="small"
                >
                  {m.algorithm} ({m.model_id}) - R²: {m.r2.toFixed(3)}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {metrics && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 4 }}>
              <MetricsCard title="R² Score" value={metrics.r2} color="#4caf50" />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <MetricsCard title="MAE (MPa)" value={metrics.mae} color="#ff9800" />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <MetricsCard title="RMSE (MPa)" value={metrics.rmse} color="#f44336" />
            </Grid>
          </Grid>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Actual vs Predicted
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="actual" name="Actual" unit=" MPa" />
                <YAxis dataKey="predicted" name="Predicted" unit=" MPa" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <ReferenceLine
                  segment={[{ x: 0, y: 0 }, { x: 80, y: 80 }]}
                  stroke="#999" strokeDasharray="5 5"
                />
                <Scatter data={scatterData} fill="#1976d2" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Individual Prediction
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {FEATURES.map((f) => (
                <Grid key={f} size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth label={f} type="number" size="small"
                    value={predictionInput[f]}
                    onChange={(e) =>
                      setPredictionInput((prev) => ({ ...prev, [f]: e.target.value }))
                    }
                  />
                </Grid>
              ))}
              <Grid size={{ xs: 12 }}>
                <Button variant="contained" onClick={handlePredict}>
                  Predict
                </Button>
                {predictionResult !== null && (
                  <Typography variant="h6" sx={{ ml: 2, display: "inline" }}>
                    {predictionResult.prediction.toFixed(1)} MPa [{predictionResult.lower.toFixed(1)} &mdash; {predictionResult.upper.toFixed(1)}] (95% CI)
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Paper>
        </>
      )}
    </Box>
  );
}
