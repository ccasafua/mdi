import { useState } from "react";
import {
  Box, Typography, Button, TextField, Grid, Paper, CircularProgress, Alert,
} from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ErrorBar,
} from "recharts";
import { compareConfigurations, saveConfiguration } from "../api/client";

const FEATURES = [
  "cement", "blast_furnace_slag", "fly_ash", "water",
  "superplasticizer", "coarse_aggregate", "fine_aggregate", "age",
];

const DEFAULT_CONFIGS = [
  { label: "Config A", values: { cement: 350, blast_furnace_slag: 0, fly_ash: 50, water: 180, superplasticizer: 6, coarse_aggregate: 1000, fine_aggregate: 700, age: 28 } },
  { label: "Config B", values: { cement: 250, blast_furnace_slag: 0, fly_ash: 150, water: 170, superplasticizer: 10, coarse_aggregate: 1000, fine_aggregate: 700, age: 28 } },
];

interface ComparisonResult {
  label: string;
  prediction: number;
  lower_bound: number;
  upper_bound: number;
  top_shap: { feature: string; shap_value: number; feature_value: number }[];
}

interface Props {
  modelId: string;
}

export default function ConfigurationComparison({ modelId }: Props) {
  const [configs, setConfigs] = useState(
    DEFAULT_CONFIGS.map((c) => ({
      label: c.label,
      values: Object.fromEntries(
        Object.entries(c.values).map(([k, v]) => [k, v.toString()])
      ),
    }))
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [saved, setSaved] = useState("");

  const handleCompare = async () => {
    setLoading(true);
    setSaved("");
    const configurations = configs.map((c) => {
      const vals: Record<string, number> = {};
      for (const f of FEATURES) vals[f] = parseFloat(c.values[f]) || 0;
      return vals;
    });
    try {
      const res = await compareConfigurations({
        model_id: modelId,
        configurations,
        labels: configs.map((c) => c.label),
      });
      setResults(res.data.results);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleSave = async (idx: number) => {
    if (!results) return;
    const r = results[idx];
    const vals: Record<string, number> = {};
    for (const f of FEATURES) vals[f] = parseFloat(configs[idx].values[f]) || 0;
    try {
      await saveConfiguration({
        label: r.label,
        values: vals,
        model_id: modelId,
        predicted_strength: r.prediction,
        lower_bound: r.lower_bound,
        upper_bound: r.upper_bound,
      });
      setSaved(r.label);
    } catch { /* ignore */ }
  };

  const chartData = results?.map((r) => ({
    label: r.label,
    prediction: r.prediction,
    errorLow: r.prediction - r.lower_bound,
    errorHigh: r.upper_bound - r.prediction,
  }));

  return (
    <Box>
      <Grid container spacing={3} sx={{ mb: 2 }}>
        {configs.map((cfg, idx) => (
          <Grid key={idx} size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <TextField
                fullWidth label="Label" size="small" sx={{ mb: 1 }}
                value={cfg.label}
                onChange={(e) => {
                  const next = [...configs];
                  next[idx] = { ...next[idx], label: e.target.value };
                  setConfigs(next);
                }}
              />
              <Grid container spacing={1}>
                {FEATURES.map((f) => (
                  <Grid key={f} size={{ xs: 6 }}>
                    <TextField
                      fullWidth label={f} type="number" size="small"
                      value={cfg.values[f] ?? "0"}
                      onChange={(e) => {
                        const next = [...configs];
                        next[idx] = {
                          ...next[idx],
                          values: { ...next[idx].values, [f]: e.target.value },
                        };
                        setConfigs(next);
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Button variant="contained" onClick={handleCompare} disabled={loading} sx={{ mb: 2 }}>
        {loading ? <CircularProgress size={24} /> : "Compare"}
      </Button>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Saved "{saved}" as candidate</Alert>}

      {results && (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Predicted Strength Comparison</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis label={{ value: "MPa", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Bar dataKey="prediction" fill="#1976d2">
                  <ErrorBar dataKey="errorHigh" width={4} stroke="#333" direction="y" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          <Grid container spacing={2}>
            {results.map((r, idx) => (
              <Grid key={idx} size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {r.label}: {r.prediction.toFixed(1)} MPa [{r.lower_bound.toFixed(1)} &mdash; {r.upper_bound.toFixed(1)}]
                  </Typography>
                  <Typography variant="subtitle2" sx={{ mt: 1 }}>Top-3 SHAP Influences:</Typography>
                  {r.top_shap.map((s) => (
                    <Typography key={s.feature} variant="body2">
                      {s.feature} = {s.feature_value.toFixed(1)}: {s.shap_value > 0 ? "+" : ""}{s.shap_value.toFixed(2)} MPa
                    </Typography>
                  ))}
                  <Button
                    size="small" variant="outlined" sx={{ mt: 1 }}
                    onClick={() => handleSave(idx)}
                  >
                    Save as Candidate
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}
