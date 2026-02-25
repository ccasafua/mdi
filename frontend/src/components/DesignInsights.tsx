import { useState } from "react";
import {
  Paper, Typography, Chip, Box, TextField, MenuItem, Alert,
} from "@mui/material";
import { useMode } from "../contexts/ModeContext";
import {
  classifyApplication,
  APPLICATION_PRESETS,
  computeSafetyFactor,
  computeSustainability,
  checkDomainWarnings,
} from "../utils/designUtils";

interface Props {
  prediction: number;
  features: Record<string, number>;
  lowerBound?: number;
  upperBound?: number;
}

export default function DesignInsights({ prediction, features, lowerBound, upperBound }: Props) {
  const { mode } = useMode();
  const [selectedPreset, setSelectedPreset] = useState(0);

  if (mode !== "design") return null;

  const app = classifyApplication(prediction);
  const preset = APPLICATION_PRESETS[selectedPreset];
  const safety = computeSafetyFactor(prediction, preset.requiredMpa);
  const sustainability = computeSustainability(features);
  const domainWarnings = checkDomainWarnings(features);

  return (
    <Paper sx={{ p: 2, mt: 2, border: "1px solid #e0e0e0" }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
        Interpretacion de Diseno
      </Typography>

      {/* Application classification */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Aplicacion recomendada
        </Typography>
        <Chip
          label={`${app.label} (${prediction.toFixed(1)} MPa)`}
          sx={{ bgcolor: app.color, color: "#fff", fontWeight: 500 }}
        />
        {lowerBound != null && upperBound != null && (
          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "#888" }}>
            Rango: {lowerBound.toFixed(1)} - {upperBound.toFixed(1)} MPa
          </Typography>
        )}
      </Box>

      {/* Safety factor */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Factor de seguridad
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField
            select size="small" sx={{ minWidth: 200 }}
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(Number(e.target.value))}
          >
            {APPLICATION_PRESETS.map((p, i) => (
              <MenuItem key={i} value={i}>
                {p.label} ({p.requiredMpa} MPa)
              </MenuItem>
            ))}
          </TextField>
          <Chip
            label={`${safety.icon} ${safety.factor === Infinity ? "N/A" : safety.factor.toFixed(2)}x`}
            sx={{ bgcolor: safety.color, color: "#fff", fontWeight: 600 }}
          />
        </Box>
      </Box>

      {/* Sustainability */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Sustentabilidad (fly ash)
        </Typography>
        <Chip
          label={`${sustainability.label} (${sustainability.score.toFixed(0)}%)`}
          sx={{ bgcolor: sustainability.color, color: "#fff" }}
        />
      </Box>

      {/* Domain warnings */}
      {domainWarnings.length > 0 && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
            Valores fuera del dominio de entrenamiento:
          </Typography>
          {domainWarnings.map((w) => (
            <Typography key={w.feature} variant="body2">
              {w.feature}: {w.value} (rango dataset: {w.min} - {w.max})
            </Typography>
          ))}
        </Alert>
      )}
    </Paper>
  );
}
