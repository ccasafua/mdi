import {
  Box, Typography, Paper, Chip, Alert, Grid, Divider,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useNavigate } from "react-router-dom";
import { useMaterialProperties } from "../contexts/MaterialPropertiesContext";
import { recommendApplications, type ApplicationEvaluation } from "../utils/designInterpretation";

const suitabilityColor: Record<string, "success" | "warning" | "error"> = {
  Alta: "success",
  Media: "warning",
  Baja: "error",
};

function ApplicationCard({ evaluation }: { evaluation: ApplicationEvaluation }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>{evaluation.category}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={evaluation.suitability}
            color={suitabilityColor[evaluation.suitability]}
            size="small"
          />
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {evaluation.score}/100
          </Typography>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {evaluation.justification}
      </Typography>
      <Grid container spacing={2}>
        {evaluation.advantages.length > 0 && (
          <Grid size={{ xs: 12, sm: 6 }}>
            {evaluation.advantages.map((a, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, mb: 0.5 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 16, color: "success.main", mt: 0.3 }} />
                <Typography variant="body2">{a}</Typography>
              </Box>
            ))}
          </Grid>
        )}
        {evaluation.risks.length > 0 && (
          <Grid size={{ xs: 12, sm: 6 }}>
            {evaluation.risks.map((r, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, mb: 0.5 }}>
                <WarningAmberIcon sx={{ fontSize: 16, color: "warning.main", mt: 0.3 }} />
                <Typography variant="body2">{r}</Typography>
              </Box>
            ))}
          </Grid>
        )}
      </Grid>
    </Paper>
  );
}

export default function DesignInterpretation() {
  const { properties } = useMaterialProperties();
  const navigate = useNavigate();

  if (!properties) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Interpretacion de Diseno</Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          No hay datos disponibles. Genera una prediccion en el{" "}
          <Typography
            component="span" sx={{ cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
            onClick={() => navigate("/models")}
          >
            Motor Cementicio
          </Typography>{" "}
          primero.
        </Alert>
      </Box>
    );
  }

  const evaluations = recommendApplications(properties);
  const topApps = evaluations.filter((e) => e.suitability === "Alta");

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Interpretacion de Diseno</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Evaluacion de 8 categorias de aplicacion estructural basada en compresion ({properties.mechanical.compressiveStrength.toFixed(1)} MPa),
        traccion ({properties.mechanical.tensileStrength.toFixed(2)} MPa), flexion ({properties.mechanical.flexuralStrength.toFixed(2)} MPa)
        y modulo de elasticidad ({(properties.mechanical.elasticModulus / 1000).toFixed(1)} GPa).
      </Typography>

      {/* Summary */}
      {topApps.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: "success.50", border: 1, borderColor: "success.light" }}>
          <Typography variant="subtitle2" gutterBottom>
            Aplicaciones mejor evaluadas
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {topApps.map((e) => (
              <Chip key={e.category} label={`${e.category} (${e.score})`} color="success" variant="outlined" />
            ))}
          </Box>
        </Paper>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Application Cards */}
      <Grid container spacing={2}>
        {evaluations.map((evaluation) => (
          <Grid key={evaluation.category} size={{ xs: 12 }}>
            <ApplicationCard evaluation={evaluation} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
