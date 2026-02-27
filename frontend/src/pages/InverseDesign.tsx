import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Grid, TextField, Button, Alert,
  CircularProgress, Divider, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, LinearProgress,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import ArchitectureIcon from "@mui/icons-material/Architecture";
import SaveIcon from "@mui/icons-material/Save";
import { useModel } from "../contexts/ModelContext";
import { useMaterialProperties } from "../contexts/MaterialPropertiesContext";
import { predictWithUncertainty, saveConfiguration, getModelMetrics } from "../api/client";
import { searchCandidateMixes, type InverseConstraints, type CandidateMix } from "../utils/inverseDesign";

const COMP_LABELS: Record<string, string> = {
  cement: "Cemento",
  blast_furnace_slag: "Escoria",
  fly_ash: "Ceniza Volante",
  water: "Agua",
  superplasticizer: "SP",
  coarse_aggregate: "Ar. Grueso",
  fine_aggregate: "Ar. Fino",
  age: "Edad",
};

export default function InverseDesign() {
  const { selectedModel, models } = useModel();
  const { setProperties } = useMaterialProperties();
  const navigate = useNavigate();

  const [constraints, setConstraints] = useState<InverseConstraints>({
    minCompression: 25,
    maxCompression: 50,
    minTensile: 2.0,
    maxTensile: 6.0,
    minFlexural: 2.0,
    maxFlexural: 8.0,
    minElasticModulus: 20,
    maxElasticModulus: 45,
    age: 28,
    maxFlyAshPercent: 70,
    maxSettingTimeMinutes: 240,
  });

  const [results, setResults] = useState<CandidateMix[]>([]);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const updateConstraint = (field: keyof InverseConstraints, value: string) => {
    setConstraints((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleSearch = async () => {
    if (!selectedModel) {
      setError("Selecciona un modelo entrenado primero");
      return;
    }

    setSearching(true);
    setError("");
    setResults([]);
    setProgress(0);

    // Get model metrics for confidence info
    let r2: number | null = null;
    let mae: number | null = null;
    try {
      const mRes = await getModelMetrics(selectedModel);
      r2 = mRes.data.r2;
      mae = mRes.data.mae;
    } catch { /* use null */ }

    const predictFn = async (composition: Record<string, number>) => {
      const res = await predictWithUncertainty(selectedModel, composition);
      return {
        prediction: res.data.prediction,
        lower: res.data.uncertainty.lower_bound,
        upper: res.data.uncertainty.upper_bound,
      };
    };

    try {
      const candidates = await searchCandidateMixes(
        constraints,
        predictFn,
        selectedModel,
        r2,
        mae,
        (pct) => setProgress(pct),
      );
      setResults(candidates);
      if (candidates.length === 0) {
        setError("No se encontraron mezclas que cumplan todas las restricciones. Intenta ampliar los rangos.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en la busqueda");
    }

    setSearching(false);
  };

  const handleSaveCandidate = async (candidate: CandidateMix, index: number) => {
    if (!selectedModel) return;
    try {
      await saveConfiguration({
        label: `InvDesign-${index + 1}-${Date.now().toString(36)}`,
        values: candidate.composition as unknown as Record<string, number>,
        model_id: selectedModel,
        predicted_strength: candidate.properties.mechanical.compressiveStrength,
        lower_bound: candidate.properties.mechanical.confidenceInterval?.lower,
        upper_bound: candidate.properties.mechanical.confidenceInterval?.upper,
      });
      setSaveMsg(`Mezcla ${index + 1} guardada`);
      setTimeout(() => setSaveMsg(""), 3000);
    } catch {
      setError("Error al guardar configuracion");
    }
  };

  const navigateWithCandidate = (candidate: CandidateMix, target: string) => {
    setProperties(candidate.properties);
    navigate(target);
  };

  const modelInfo = models.find((m) => m.model_id === selectedModel);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Diseno Inverso</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Define requisitos estructurales y el sistema maximizara el contenido de ceniza volante manteniendo las restricciones.
      </Typography>

      {/* Constraints Input */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Restricciones de Diseno</Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle2" color="text.secondary">Propiedades mecanicas</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="Compresion min (MPa)" type="number" size="small"
              value={constraints.minCompression}
              onChange={(e) => updateConstraint("minCompression", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="Compresion max (MPa)" type="number" size="small"
              value={constraints.maxCompression}
              onChange={(e) => updateConstraint("maxCompression", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="Traccion min (MPa)" type="number" size="small"
              value={constraints.minTensile}
              onChange={(e) => updateConstraint("minTensile", e.target.value)}
              inputProps={{ step: 0.5 }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="Traccion max (MPa)" type="number" size="small"
              value={constraints.maxTensile}
              onChange={(e) => updateConstraint("maxTensile", e.target.value)}
              inputProps={{ step: 0.5 }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="Flexion min (MPa)" type="number" size="small"
              value={constraints.minFlexural}
              onChange={(e) => updateConstraint("minFlexural", e.target.value)}
              inputProps={{ step: 0.5 }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="Flexion max (MPa)" type="number" size="small"
              value={constraints.maxFlexural}
              onChange={(e) => updateConstraint("maxFlexural", e.target.value)}
              inputProps={{ step: 0.5 }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="E min (GPa)" type="number" size="small"
              value={constraints.minElasticModulus}
              onChange={(e) => updateConstraint("minElasticModulus", e.target.value)}
              inputProps={{ step: 1 }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="E max (GPa)" type="number" size="small"
              value={constraints.maxElasticModulus}
              onChange={(e) => updateConstraint("maxElasticModulus", e.target.value)}
              inputProps={{ step: 1 }}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Restricciones de mezcla</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="Edad de curado (dias)" type="number" size="small"
              value={constraints.age}
              onChange={(e) => updateConstraint("age", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="Max ceniza volante (%)" type="number" size="small"
              value={constraints.maxFlyAshPercent}
              onChange={(e) => updateConstraint("maxFlyAshPercent", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth label="Max fraguado (min)" type="number" size="small"
              value={constraints.maxSettingTimeMinutes}
              onChange={(e) => updateConstraint("maxSettingTimeMinutes", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Button
              variant="contained" fullWidth
              onClick={handleSearch}
              disabled={searching || !selectedModel}
              sx={{ height: 40 }}
            >
              {searching ? <CircularProgress size={24} /> : "Buscar Mezclas"}
            </Button>
          </Grid>
        </Grid>

        {!selectedModel && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Entrena un modelo en Modelado Predictivo antes de usar Diseno Inverso.
          </Alert>
        )}

        {searching && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Explorando espacio de mezclas... {progress}%
            </Typography>
          </Box>
        )}
      </Paper>

      {error && <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>}
      {saveMsg && <Alert severity="success" sx={{ mb: 2 }}>{saveMsg}</Alert>}

      {/* Results */}
      {results.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>
            {results.length} Mezcla{results.length > 1 ? "s" : ""} Candidata{results.length > 1 ? "s" : ""}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ordenadas por mayor % de ceniza volante y menor uso de cemento.
            {modelInfo && ` Modelo: ${modelInfo.algorithm} (R²: ${modelInfo.r2.toFixed(3)})`}
          </Typography>

          {results.map((candidate, idx) => {
            const p = candidate.properties;
            const comp = p.composition;
            return (
              <Paper key={idx} sx={{ p: 3, mb: 2, border: idx === 0 ? 2 : 0, borderColor: "primary.main" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Typography variant="h6" fontWeight={700}>
                    Mezcla Candidata #{idx + 1}
                    {idx === 0 && <Chip label="Recomendada" color="primary" size="small" sx={{ ml: 1 }} />}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip label={`Ceniza: ${candidate.flyAshContent.toFixed(0)} kg/m³`} color="success" size="small" />
                    <Chip label={`Sustitucion: ${candidate.flyAshSubstitution.toFixed(1)}%`} color="success" size="small" variant="outlined" />
                    <Chip label={`Cemento: ${candidate.cementUsage.toFixed(0)} kg/m³`} color="warning" size="small" variant="outlined" />
                  </Box>
                </Box>

                {/* Composition table */}
                <TableContainer sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {Object.keys(COMP_LABELS).map((k) => (
                          <TableCell key={k} align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                            {COMP_LABELS[k]}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        {Object.keys(COMP_LABELS).map((k) => (
                          <TableCell key={k} align="right">
                            {(comp[k as keyof typeof comp] ?? 0).toFixed(1)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Predicted properties */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">Compresion</Typography>
                    <Typography variant="body1" fontWeight={700} color="primary.main">
                      {p.mechanical.compressiveStrength.toFixed(1)} MPa
                    </Typography>
                    <Chip label="ML" size="small" sx={{ fontSize: "0.6rem", height: 16 }} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">Traccion</Typography>
                    <Typography variant="body1">{p.mechanical.tensileStrength.toFixed(2)} MPa</Typography>
                    <Chip label="Derivada" size="small" variant="outlined" sx={{ fontSize: "0.6rem", height: 16 }} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">Flexion</Typography>
                    <Typography variant="body1">{p.mechanical.flexuralStrength.toFixed(2)} MPa</Typography>
                    <Chip label="Derivada" size="small" variant="outlined" sx={{ fontSize: "0.6rem", height: 16 }} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">Mod. Elasticidad</Typography>
                    <Typography variant="body1">{(p.mechanical.elasticModulus / 1000).toFixed(1)} GPa</Typography>
                    <Chip label="Derivada" size="small" variant="outlined" sx={{ fontSize: "0.6rem", height: 16 }} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">W/C</Typography>
                    <Typography variant="body1">{p.physical.waterCementRatio.toFixed(2)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">W/B</Typography>
                    <Typography variant="body1">{p.physical.waterBinderRatio.toFixed(2)}</Typography>
                  </Grid>
                </Grid>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">Ceniza Volante</Typography>
                    <Typography variant="body1" fontWeight={700} color="success.main">{candidate.flyAshContent.toFixed(0)} kg/m³</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">% Sustitucion</Typography>
                    <Typography variant="body1" fontWeight={700} color="success.main">{candidate.flyAshSubstitution.toFixed(1)}%</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">Sostenibilidad</Typography>
                    <Typography variant="body1">{candidate.sustainabilityScore}/100</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">Fraguado est.</Typography>
                    <Typography variant="body2">{p.physical.settingTime}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="caption" color="text.secondary">IC 95%</Typography>
                    <Typography variant="body2">
                      {p.mechanical.confidenceInterval
                        ? `[${p.mechanical.confidenceInterval.lower.toFixed(1)} - ${p.mechanical.confidenceInterval.upper.toFixed(1)}]`
                        : "-"}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Domain warnings */}
                {p.confidence.domainWarnings.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2, py: 0 }}>
                    <Typography variant="caption">
                      Fuera de dominio: {p.confidence.domainWarnings.join("; ")}
                    </Typography>
                  </Alert>
                )}

                {/* Actions */}
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button size="small" variant="outlined" startIcon={<SaveIcon />}
                    onClick={() => handleSaveCandidate(candidate, idx)}>
                    Guardar
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<DescriptionIcon />}
                    onClick={() => navigateWithCandidate(candidate, "/ficha-tecnica")}>
                    Ficha Tecnica
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<ArchitectureIcon />}
                    onClick={() => navigateWithCandidate(candidate, "/design-interpretation")}>
                    Aplicaciones
                  </Button>
                </Box>
              </Paper>
            );
          })}
        </>
      )}
    </Box>
  );
}
