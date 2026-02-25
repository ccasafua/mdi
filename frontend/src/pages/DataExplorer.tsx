import { useEffect, useState } from "react";
import {
  Box, Typography, CircularProgress, Grid, Paper, Card, CardContent,
  TextField, MenuItem,
} from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  listDatasets, getDatasetSummary, getDatasetSample,
  getDatasetDistributions, getCorrelations,
} from "../api/client";
import DataTable from "../components/DataTable";
import CorrelationMatrix from "../components/CorrelationMatrix";

interface FeatureStat {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
}

interface Distribution {
  feature: string;
  bins: { bin_start: number; bin_end: number; count: number }[];
}

interface DatasetOption {
  name: string;
  description: string;
  num_samples: number;
}

export default function DataExplorer() {
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("concrete");
  const [summary, setSummary] = useState<{
    num_samples: number;
    num_features: number;
    feature_stats: FeatureStat[];
    correlations: Record<string, Record<string, number>>;
  } | null>(null);
  const [sample, setSample] = useState<Record<string, number>[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [corrData, setCorrData] = useState<{
    columns: string[];
    matrix: Record<string, Record<string, number>>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDatasets().then((res) => setDatasets(res.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDatasetSummary(selectedDataset),
      getDatasetSample(selectedDataset, 100, 0),
      getDatasetDistributions(selectedDataset),
      getCorrelations(selectedDataset),
    ]).then(([sumRes, sampleRes, distRes, corrRes]) => {
      setSummary(sumRes.data);
      setSample(sampleRes.data);
      setDistributions(distRes.data);
      setCorrData(corrRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedDataset]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  const columns = summary
    ? summary.feature_stats.map((s) => s.name)
    : [];

  const currentDs = datasets.find((d) => d.name === selectedDataset);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Data Explorer
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          select
          label="Dataset"
          value={selectedDataset}
          onChange={(e) => setSelectedDataset(e.target.value)}
          sx={{ minWidth: 300 }}
        >
          {datasets.map((ds) => (
            <MenuItem key={ds.name} value={ds.name}>
              {ds.name} - {ds.description} ({ds.num_samples} samples)
            </MenuItem>
          ))}
        </TextField>
      </Paper>

      <Typography variant="body1" color="text.secondary" gutterBottom>
        {currentDs?.description}: {summary?.num_samples} samples, {summary?.num_features} features
      </Typography>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>
        Descriptive Statistics
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summary?.feature_stats.map((stat) => (
          <Grid key={stat.name} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  {stat.name}
                </Typography>
                <Typography variant="body2">
                  Mean: {stat.mean.toFixed(2)} | Std: {stat.std.toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  Range: [{stat.min.toFixed(1)}, {stat.max.toFixed(1)}]
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {corrData && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <CorrelationMatrix columns={corrData.columns} matrix={corrData.matrix} />
        </Paper>
      )}

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>
        Feature Distributions
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {distributions.map((dist) => (
          <Grid key={dist.feature} size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {dist.feature}
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={dist.bins.map((b) => ({
                    range: ((b.bin_start + b.bin_end) / 2).toFixed(1),
                    count: b.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>
        Data Sample
      </Typography>
      <DataTable data={sample} columns={columns} />
    </Box>
  );
}
