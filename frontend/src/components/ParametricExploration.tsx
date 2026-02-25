import { useState } from "react";
import {
  Box, Typography, Button, TextField, Grid, Paper, Slider, CircularProgress,
} from "@mui/material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, ComposedChart, ReferenceArea,
} from "recharts";
import { parametricSweep } from "../api/client";

const FEATURES = [
  "cement", "blast_furnace_slag", "fly_ash", "water",
  "superplasticizer", "coarse_aggregate", "fine_aggregate", "age",
];

const DEFAULT_CONFIG: Record<string, number> = {
  cement: 300, blast_furnace_slag: 0, fly_ash: 100, water: 180,
  superplasticizer: 6, coarse_aggregate: 1000, fine_aggregate: 700, age: 28,
};

interface Props {
  modelId: string;
}

export default function ParametricExploration({ modelId }: Props) {
  const [baseConfig, setBaseConfig] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(DEFAULT_CONFIG).map(([k, v]) => [k, v.toString()]))
  );
  const [sweepFeature, setSweepFeature] = useState("fly_ash");
  const [range, setRange] = useState<[number, number]>([0, 200]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    points: { feature_value: number; prediction: number; lower_bound: number; upper_bound: number }[];
    optimal_region: { start: number; end: number; best_prediction: number };
  } | null>(null);

  const handleRun = async () => {
    setLoading(true);
    const config: Record<string, number> = {};
    for (const f of FEATURES) config[f] = parseFloat(baseConfig[f]) || 0;
    try {
      const res = await parametricSweep({
        model_id: modelId,
        base_config: config,
        sweep_feature: sweepFeature,
        min_val: range[0],
        max_val: range[1],
        steps: 30,
      });
      setResult(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Base Configuration
      </Typography>
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {FEATURES.map((f) => (
          <Grid key={f} size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label={f} type="number" size="small"
              value={baseConfig[f]}
              onChange={(e) => setBaseConfig((p) => ({ ...p, [f]: e.target.value }))}
            />
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              select fullWidth label="Sweep Feature" value={sweepFeature}
              onChange={(e) => setSweepFeature(e.target.value)}
              SelectProps={{ native: true }}
            >
              {FEATURES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <Typography variant="caption">Range: {range[0]} - {range[1]}</Typography>
            <Slider
              value={range}
              onChange={(_, v) => setRange(v as [number, number])}
              min={0} max={500} valueLabelDisplay="auto"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <Button variant="contained" fullWidth onClick={handleRun} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : "Run Sweep"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {result && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Optimal region: {result.optimal_region.start.toFixed(1)} - {result.optimal_region.end.toFixed(1)} (best: {result.optimal_region.best_prediction.toFixed(2)} MPa)
          </Typography>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={result.points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="feature_value" label={{ value: sweepFeature, position: "bottom" }} />
              <YAxis label={{ value: "Compressive Strength (MPa)", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <ReferenceArea
                x1={result.optimal_region.start}
                x2={result.optimal_region.end}
                fill="#4caf50" fillOpacity={0.1}
              />
              <Area
                type="monotone" dataKey="upper_bound" stroke="none"
                fill="#1976d2" fillOpacity={0.15} name="95% CI Upper"
              />
              <Area
                type="monotone" dataKey="lower_bound" stroke="none"
                fill="#fff" fillOpacity={1} name="95% CI Lower"
              />
              <Line type="monotone" dataKey="prediction" stroke="#1976d2" strokeWidth={2} dot={false} name="Prediction" />
            </ComposedChart>
          </ResponsiveContainer>
        </Paper>
      )}
    </Box>
  );
}
