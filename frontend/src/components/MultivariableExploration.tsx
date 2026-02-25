import { useState } from "react";
import {
  Box, Typography, Button, TextField, Grid, Paper, Slider, CircularProgress,
} from "@mui/material";
import Plot from "react-plotly.js";
import { multivariableExploration } from "../api/client";

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

export default function MultivariableExploration({ modelId }: Props) {
  const [baseConfig, setBaseConfig] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(DEFAULT_CONFIG).map(([k, v]) => [k, v.toString()]))
  );
  const [var1, setVar1] = useState("fly_ash");
  const [var2, setVar2] = useState("water");
  const [range1, setRange1] = useState<[number, number]>([0, 200]);
  const [range2, setRange2] = useState<[number, number]>([120, 240]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    axes: Record<string, number[]>;
    predictions: number[][];
    variable_names: string[];
  } | null>(null);

  const handleRun = async () => {
    setLoading(true);
    const config: Record<string, number> = {};
    for (const f of FEATURES) config[f] = parseFloat(baseConfig[f]) || 0;
    try {
      const res = await multivariableExploration({
        model_id: modelId,
        base_config: config,
        variable_ranges: [
          { feature: var1, min_val: range1[0], max_val: range1[1], steps: 20 },
          { feature: var2, min_val: range2[0], max_val: range2[1], steps: 20 },
        ],
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
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              select fullWidth label="Variable 1" value={var1}
              onChange={(e) => setVar1(e.target.value)}
              SelectProps={{ native: true }}
            >
              {FEATURES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </TextField>
            <Typography variant="caption">Range: {range1[0]} - {range1[1]}</Typography>
            <Slider
              value={range1}
              onChange={(_, v) => setRange1(v as [number, number])}
              min={0} max={500} valueLabelDisplay="auto"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              select fullWidth label="Variable 2" value={var2}
              onChange={(e) => setVar2(e.target.value)}
              SelectProps={{ native: true }}
            >
              {FEATURES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </TextField>
            <Typography variant="caption">Range: {range2[0]} - {range2[1]}</Typography>
            <Slider
              value={range2}
              onChange={(_, v) => setRange2(v as [number, number])}
              min={0} max={1200} valueLabelDisplay="auto"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <Button variant="contained" fullWidth onClick={handleRun} disabled={loading} sx={{ mt: 2 }}>
              {loading ? <CircularProgress size={24} /> : "Generate Surface"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {result && (
        <Paper sx={{ p: 2 }}>
          <Plot
            data={[
              {
                z: result.predictions,
                x: result.axes[result.variable_names[0]],
                y: result.axes[result.variable_names[1]],
                type: "heatmap" as const,
                colorscale: "YlOrRd" as const,
                colorbar: { title: { text: "MPa" } },
              },
            ]}
            layout={{
              height: 500,
              xaxis: { title: { text: result.variable_names[0] } },
              yaxis: { title: { text: result.variable_names[1] } },
              margin: { l: 80, r: 40, t: 20, b: 60 },
            }}
            config={{ responsive: true }}
            style={{ width: "100%" }}
          />
        </Paper>
      )}
    </Box>
  );
}
