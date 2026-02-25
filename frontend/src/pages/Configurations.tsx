import { useState, useEffect } from "react";
import {
  Box, Typography, Paper, Button, Checkbox, IconButton, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  listConfigurations, markValidationCandidate,
  deleteConfiguration, exportConfigurations,
} from "../api/client";

interface ConfigItem {
  id: string;
  label: string;
  values: Record<string, number>;
  model_id: string;
  predicted_strength: number;
  lower_bound: number | null;
  upper_bound: number | null;
  is_candidate: boolean;
}

const VALUE_COLS = [
  "cement", "fly_ash", "water", "superplasticizer",
  "fine_aggregate", "coarse_aggregate", "age",
];

export default function Configurations() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [message, setMessage] = useState("");

  const load = () => {
    listConfigurations().then((res) => setConfigs(res.data));
  };

  useEffect(load, []);

  const handleToggleCandidate = async (id: string) => {
    await markValidationCandidate(id);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteConfiguration(id);
    load();
  };

  const handleExport = async (onlyCandidates: boolean) => {
    try {
      const res = await exportConfigurations(onlyCandidates);
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = onlyCandidates ? "candidates.csv" : "configurations.csv";
      a.click();
      URL.revokeObjectURL(url);
      setMessage("CSV exported successfully");
    } catch {
      setMessage("Export failed");
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Saved Configurations</Typography>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
        <Button variant="contained" onClick={() => handleExport(false)}>
          Export All CSV
        </Button>
        <Button variant="outlined" onClick={() => handleExport(true)}>
          Export Candidates Only
        </Button>
      </Box>

      {configs.length === 0 ? (
        <Alert severity="info">
          No saved configurations yet. Use the Exploration Lab to create and save configurations.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Label</TableCell>
                {VALUE_COLS.map((c) => (
                  <TableCell key={c} align="right">{c}</TableCell>
                ))}
                <TableCell align="right">Prediction</TableCell>
                <TableCell align="right">95% CI</TableCell>
                <TableCell align="center">Candidate</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((cfg) => (
                <TableRow
                  key={cfg.id}
                  sx={cfg.is_candidate ? { backgroundColor: "#e8f5e9" } : {}}
                >
                  <TableCell>{cfg.label}</TableCell>
                  {VALUE_COLS.map((c) => (
                    <TableCell key={c} align="right">
                      {cfg.values[c] !== undefined ? cfg.values[c].toFixed(1) : "-"}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    {cfg.predicted_strength.toFixed(1)} MPa
                  </TableCell>
                  <TableCell align="right">
                    {cfg.lower_bound != null && cfg.upper_bound != null
                      ? `[${cfg.lower_bound.toFixed(1)} - ${cfg.upper_bound.toFixed(1)}]`
                      : "-"}
                  </TableCell>
                  <TableCell align="center">
                    <Checkbox
                      checked={cfg.is_candidate}
                      onChange={() => handleToggleCandidate(cfg.id)}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => handleDelete(cfg.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
