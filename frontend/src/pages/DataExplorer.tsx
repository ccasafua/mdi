import { useEffect, useState, useRef } from "react";
import {
  Box, Typography, CircularProgress, Grid, Paper, Card, CardContent,
  TextField, MenuItem, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, IconButton, Alert,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  getDatasetSummary, getDatasetSample,
  getDatasetDistributions, getCorrelations, uploadDataset, deleteDataset,
} from "../api/client";
import DataTable from "../components/DataTable";
import CorrelationMatrix from "../components/CorrelationMatrix";
import { useDataset } from "../contexts/DatasetContext";

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

const BUILTIN_DATASETS = new Set(["concrete", "concrete_xai", "geopolymer"]);

export default function DataExplorer() {
  const { datasets, selectedDataset, setSelectedDataset, refreshDatasets } = useDataset();
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadTarget, setUploadTarget] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);


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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    setDetectedHeaders([]);
    setUploadTarget("");
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const firstLine = text.split("\n")[0];
        const headers = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        setDetectedHeaders(headers);
        if (headers.length > 0) setUploadTarget(headers[headers.length - 1]);
      };
      reader.readAsText(file.slice(0, 4096));
    }
  };

  const handleUpload = async () => {
    if (!uploadName.trim()) {
      setUploadError("Name is required");
      return;
    }
    if (tabIndex === 0 && !uploadFile) {
      setUploadError("Please select a CSV file");
      return;
    }
    if (tabIndex === 1 && !uploadUrl.trim()) {
      setUploadError("Please enter a URL");
      return;
    }

    setUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("name", uploadName.trim());
    formData.append("description", uploadDesc.trim());
    if (uploadTarget.trim()) formData.append("target", uploadTarget.trim());
    if (tabIndex === 0 && uploadFile) {
      formData.append("file", uploadFile);
    } else {
      formData.append("url", uploadUrl.trim());
    }

    try {
      const res = await uploadDataset(formData);
      const newName = res.data.dataset.name;
      await refreshDatasets();
      setSelectedDataset(newName);
      resetDialog();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Upload failed";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete dataset "${name}"?`)) return;
    try {
      await deleteDataset(name);
      await refreshDatasets();
      if (selectedDataset === name) setSelectedDataset("concrete");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Delete failed");
    }
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setTabIndex(0);
    setUploadName("");
    setUploadDesc("");
    setUploadTarget("");
    setUploadFile(null);
    setUploadUrl("");
    setDetectedHeaders([]);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (loading && datasets.length === 0) {
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

      <Paper sx={{ p: 2, mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
        <TextField
          select
          label="Dataset"
          value={selectedDataset}
          onChange={(e) => setSelectedDataset(e.target.value)}
          sx={{ minWidth: 300 }}
        >
          {datasets.map((ds) => (
            <MenuItem key={ds.name} value={ds.name}>
              <Box sx={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
                <span>{ds.name} - {ds.description} ({ds.num_samples} samples)</span>
                {!BUILTIN_DATASETS.has(ds.name) && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ds.name);
                    }}
                    sx={{ ml: 1 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add Dataset
        </Button>
      </Paper>

      {/* Upload Dialog */}
      <Dialog open={dialogOpen} onClose={resetDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add Dataset</DialogTitle>
        <DialogContent>
          {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}
          <TextField
            label="Name (slug)"
            fullWidth
            margin="normal"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase())}
            helperText="Lowercase letters, numbers, and underscores only"
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            value={uploadDesc}
            onChange={(e) => setUploadDesc(e.target.value)}
          />
          <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mt: 2 }}>
            <Tab label="Upload File" />
            <Tab label="From URL" />
          </Tabs>
          {tabIndex === 0 && (
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" component="label">
                Select CSV File
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
              {uploadFile && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {uploadFile.name}
                </Typography>
              )}
              {detectedHeaders.length > 0 && (
                <TextField
                  select
                  label="Target column"
                  fullWidth
                  margin="normal"
                  value={uploadTarget}
                  onChange={(e) => setUploadTarget(e.target.value)}
                >
                  {detectedHeaders.map((h) => (
                    <MenuItem key={h} value={h}>{h}</MenuItem>
                  ))}
                </TextField>
              )}
            </Box>
          )}
          {tabIndex === 1 && (
            <Box sx={{ mt: 2 }}>
              <TextField
                label="CSV URL"
                fullWidth
                margin="normal"
                value={uploadUrl}
                onChange={(e) => setUploadUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/..."
              />
              <TextField
                label="Target column name"
                fullWidth
                margin="normal"
                value={uploadTarget}
                onChange={(e) => setUploadTarget(e.target.value)}
                helperText="Leave empty to use the last numeric column"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={resetDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload} disabled={uploading}>
            {uploading ? <CircularProgress size={24} /> : "Upload"}
          </Button>
        </DialogActions>
      </Dialog>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
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
        </>
      )}
    </Box>
  );
}
