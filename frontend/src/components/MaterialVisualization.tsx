import { useState } from "react";
import {
  Box, Typography, TextField, Grid, Paper, Chip, Divider,
} from "@mui/material";
import MicrostructureCanvas from "./MicrostructureCanvas";

const FEATURES = [
  "cement", "blast_furnace_slag", "fly_ash", "water",
  "superplasticizer", "coarse_aggregate", "fine_aggregate", "age",
];

const PRESETS: Record<string, Record<string, number>> = {
  "Concreto convencional": {
    cement: 350, blast_furnace_slag: 0, fly_ash: 0, water: 175,
    superplasticizer: 0, coarse_aggregate: 1050, fine_aggregate: 700, age: 28,
  },
  "Alta ceniza volante": {
    cement: 200, blast_furnace_slag: 0, fly_ash: 200, water: 160,
    superplasticizer: 8, coarse_aggregate: 1000, fine_aggregate: 700, age: 28,
  },
  "Alta resistencia": {
    cement: 500, blast_furnace_slag: 0, fly_ash: 30, water: 140,
    superplasticizer: 15, coarse_aggregate: 1100, fine_aggregate: 650, age: 90,
  },
  "Bajo cemento / ecológico": {
    cement: 150, blast_furnace_slag: 0, fly_ash: 250, water: 150,
    superplasticizer: 12, coarse_aggregate: 950, fine_aggregate: 750, age: 56,
  },
  "Joven (3 días)": {
    cement: 350, blast_furnace_slag: 0, fly_ash: 50, water: 180,
    superplasticizer: 5, coarse_aggregate: 1000, fine_aggregate: 700, age: 3,
  },
  "Alta relación a/c": {
    cement: 250, blast_furnace_slag: 0, fly_ash: 0, water: 225,
    superplasticizer: 0, coarse_aggregate: 900, fine_aggregate: 700, age: 28,
  },
};

export default function MaterialVisualization() {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(PRESETS["Concreto convencional"]).map(([k, v]) => [k, v.toString()])
    )
  );

  const composition: Record<string, number> = {};
  for (const f of FEATURES) composition[f] = parseFloat(values[f]) || 0;

  const binderTotal = composition.cement + composition.fly_ash + 0.001;
  const wcRatio = composition.water / binderTotal;
  const aggFraction = (composition.coarse_aggregate + composition.fine_aggregate) /
    (composition.cement + composition.fly_ash + composition.water +
     composition.coarse_aggregate + composition.fine_aggregate + 0.001);
  const faRatio = composition.fly_ash / binderTotal;

  const applyPreset = (name: string) => {
    const preset = PRESETS[name];
    setValues(Object.fromEntries(Object.entries(preset).map(([k, v]) => [k, v.toString()])));
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Visualización de Microestructura
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Sección transversal 2D procedural del concreto. La distribución de agregados, poros y
        ceniza volante se calcula según la composición ingresada.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Presets de mezcla:</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          {Object.keys(PRESETS).map((name) => (
            <Chip
              key={name}
              label={name}
              onClick={() => applyPreset(name)}
              variant="outlined"
              clickable
            />
          ))}
        </Box>

        <Grid container spacing={1}>
          {FEATURES.map((f) => (
            <Grid key={f} size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth label={f} type="number" size="small"
                value={values[f]}
                onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <MicrostructureCanvas composition={composition} width={550} height={550} />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Propiedades derivadas
            </Typography>
            <Divider sx={{ mb: 1 }} />

            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Relación agua/cementante (w/c):</strong> {wcRatio.toFixed(3)}
            </Typography>
            <Typography variant="body2" color={wcRatio > 0.55 ? "error" : wcRatio < 0.35 ? "success.main" : "text.primary"} sx={{ mb: 1.5 }}>
              {wcRatio > 0.55 ? "Alta — mayor porosidad, menor resistencia esperada"
                : wcRatio < 0.35 ? "Baja — alta resistencia, posible dificultad de trabajabilidad"
                : "Moderada — balance entre resistencia y trabajabilidad"}
            </Typography>

            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Fracción de agregados:</strong> {(aggFraction * 100).toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {aggFraction > 0.72 ? "Alta concentración de agregados"
                : aggFraction < 0.6 ? "Baja fracción — mezcla rica en pasta"
                : "Proporción típica"}
            </Typography>

            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Reemplazo de ceniza volante:</strong> {(faRatio * 100).toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {faRatio > 0.4 ? "Alto reemplazo — resistencia temprana menor, ganancia a largo plazo"
                : faRatio > 0.15 ? "Moderado — buena durabilidad y sustentabilidad"
                : faRatio > 0 ? "Bajo reemplazo de cemento"
                : "Sin ceniza volante"}
            </Typography>

            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Edad:</strong> {composition.age} días
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {composition.age < 7 ? "Temprana — hidratación incompleta, granos de cemento visibles"
                : composition.age < 28 ? "Intermedia — hidratación en progreso"
                : composition.age < 90 ? "Estándar — buena hidratación"
                : "Avanzada — pasta densa y madura"}
            </Typography>

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" gutterBottom>
              Guía visual
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Agregado grueso:</strong> Polígonos grises irregulares con zona de transición interfacial (ITZ) en el borde.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              <strong>Agregado fino:</strong> Círculos pequeños color arena.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              <strong>Ceniza volante:</strong> Esferas oscuras perfectas (forma característica vítrea).
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              <strong>Poros:</strong> Manchas oscuras. Más numerosos con alta relación w/c. El superplastificante reduce el aire atrapado.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              <strong>Pasta:</strong> Color de fondo. Más oscura con mayor edad (hidratación) y mayor contenido de cemento.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
