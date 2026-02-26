import { useState } from "react";
import {
  Box, Typography, Button, TextField, MenuItem, Grid,
  CircularProgress, Paper, Alert, Divider,
} from "@mui/material";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { trainModel, getModelMetrics, predictWithUncertainty } from "../api/client";
import MetricsCard from "../components/MetricsCard";
import ModelConfidence from "../components/ModelConfidence";
import DesignInsights from "../components/DesignInsights";
import { useModel } from "../contexts/ModelContext";

const FEATURES = [
  "cement", "blast_furnace_slag", "fly_ash", "water",
  "superplasticizer", "coarse_aggregate", "fine_aggregate", "age",
];

const ALGORITHMS = [
  { value: "random_forest", label: "Random Forest" },
  { value: "gradient_boosting", label: "Gradient Boosting" },
  { value: "extra_trees", label: "Extra Trees" },
  { value: "adaboost", label: "AdaBoost" },
  { value: "ridge", label: "Ridge" },
  { value: "lasso", label: "Lasso" },
  { value: "svr", label: "SVR" },
  { value: "knn", label: "KNN" },
];

const ALGO_LABELS: Record<string, string> = Object.fromEntries(
  ALGORITHMS.map((a) => [a.value, a.label])
);

const HAS_N_ESTIMATORS = new Set(["random_forest", "gradient_boosting", "extra_trees", "adaboost"]);
const HAS_MAX_DEPTH = new Set(["random_forest", "gradient_boosting", "extra_trees"]);
const HAS_LEARNING_RATE = new Set(["gradient_boosting", "adaboost"]);
const HAS_ALPHA = new Set(["ridge", "lasso"]);

export default function ModelTraining() {
  const [algorithm, setAlgorithm] = useState("random_forest");
  const [nEstimators, setNEstimators] = useState(100);
  const [maxDepth, setMaxDepth] = useState<string>("");
  const [learningRate, setLearningRate] = useState(0.1);
  const [alpha, setAlpha] = useState(1.0);
  const [svrC, setSvrC] = useState(1.0);
  const [kernel, setKernel] = useState("rbf");
  const [nNeighbors, setNNeighbors] = useState(5);
  const { models, selectedModel, setSelectedModel, refreshModels } = useModel();
  const [training, setTraining] = useState(false);
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

  const handleTrain = async () => {
    setTraining(true);
    setError("");
    try {
      const params: Record<string, unknown> = { algorithm };
      if (HAS_N_ESTIMATORS.has(algorithm)) params.n_estimators = nEstimators;
      if (maxDepth && HAS_MAX_DEPTH.has(algorithm)) params.max_depth = parseInt(maxDepth);
      if (HAS_LEARNING_RATE.has(algorithm)) params.learning_rate = learningRate;
      if (HAS_ALPHA.has(algorithm)) params.alpha = alpha;
      if (algorithm === "svr") { params.C = svrC; params.kernel = kernel; }
      if (algorithm === "knn") params.n_neighbors = nNeighbors;

      const res = await trainModel(params as Parameters<typeof trainModel>[0]);
      const newModel = res.data;
      await refreshModels();
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
              {ALGORITHMS.map((a) => (
                <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {HAS_N_ESTIMATORS.has(algorithm) && (
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField
                fullWidth label="n_estimators" type="number"
                value={nEstimators}
                onChange={(e) => setNEstimators(parseInt(e.target.value) || 100)}
              />
            </Grid>
          )}

          {HAS_MAX_DEPTH.has(algorithm) && (
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField
                fullWidth label="max_depth" type="number" placeholder="None"
                value={maxDepth}
                onChange={(e) => setMaxDepth(e.target.value)}
              />
            </Grid>
          )}

          {HAS_LEARNING_RATE.has(algorithm) && (
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField
                fullWidth label="learning_rate" type="number"
                value={learningRate}
                onChange={(e) => setLearningRate(parseFloat(e.target.value) || 0.1)}
                inputProps={{ step: 0.01 }}
              />
            </Grid>
          )}

          {HAS_ALPHA.has(algorithm) && (
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField
                fullWidth label="alpha" type="number"
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value) || 1.0)}
                inputProps={{ step: 0.1 }}
              />
            </Grid>
          )}

          {algorithm === "svr" && (
            <>
              <Grid size={{ xs: 6, sm: 2 }}>
                <TextField
                  fullWidth label="C" type="number"
                  value={svrC}
                  onChange={(e) => setSvrC(parseFloat(e.target.value) || 1.0)}
                  inputProps={{ step: 0.1 }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <TextField
                  select fullWidth label="kernel" value={kernel}
                  onChange={(e) => setKernel(e.target.value)}
                >
                  <MenuItem value="rbf">RBF</MenuItem>
                  <MenuItem value="linear">Linear</MenuItem>
                  <MenuItem value="poly">Poly</MenuItem>
                </TextField>
              </Grid>
            </>
          )}

          {algorithm === "knn" && (
            <Grid size={{ xs: 6, sm: 2 }}>
              <TextField
                fullWidth label="n_neighbors" type="number"
                value={nNeighbors}
                onChange={(e) => setNNeighbors(parseInt(e.target.value) || 5)}
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
                  sx={{ textTransform: "none" }}
                >
                  {ALGO_LABELS[m.algorithm] || m.algorithm} ({m.model_id}) — R²: {m.r2.toFixed(3)}
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

          <ModelConfidence r2={metrics.r2} mae={metrics.mae} rmse={metrics.rmse} />

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
            {predictionResult !== null && (
              <DesignInsights
                prediction={predictionResult.prediction}
                features={Object.fromEntries(FEATURES.map((f) => [f, parseFloat(predictionInput[f]) || 0]))}
                lowerBound={predictionResult.lower}
                upperBound={predictionResult.upper}
              />
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
