import { useState } from "react";
import {
  Box, Typography, Paper, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, Alert, Chip,
  Divider, TextField,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useNavigate } from "react-router-dom";
import { useMaterialProperties } from "../contexts/MaterialPropertiesContext";
import { generateAdvancedPDF } from "../utils/generatePDF";
import { recommendApplications } from "../utils/designInterpretation";

const COMPONENT_LABELS: Record<string, { name: string; unit: string }> = {
  cement: { name: "Cemento", unit: "kg/m\u00B3" },
  blast_furnace_slag: { name: "Escoria de Alto Horno", unit: "kg/m\u00B3" },
  fly_ash: { name: "Ceniza Volante", unit: "kg/m\u00B3" },
  water: { name: "Agua", unit: "kg/m\u00B3" },
  superplasticizer: { name: "Superplastificante", unit: "kg/m\u00B3" },
  coarse_aggregate: { name: "Arido Grueso", unit: "kg/m\u00B3" },
  fine_aggregate: { name: "Arido Fino", unit: "kg/m\u00B3" },
  age: { name: "Edad", unit: "dias" },
};

const suitabilityColor: Record<string, "success" | "warning" | "error"> = {
  Alta: "success",
  Media: "warning",
  Baja: "error",
};

function SectionHeader({ label }: { label: string }) {
  return (
    <Typography variant="h6" sx={{ mt: 3, mb: 1, color: "primary.main", fontWeight: 700 }}>
      {label}
    </Typography>
  );
}

export default function FichaTecnica() {
  const { properties } = useMaterialProperties();
  const navigate = useNavigate();

  // Experimental validation state
  const [measured, setMeasured] = useState({ compression: "", flexion: "", tensile: "" });

  if (!properties) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Ficha Tecnica Experimental</Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          No hay datos disponibles. Genera una prediccion en{" "}
          <Typography
            component="span" sx={{ cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
            onClick={() => navigate("/models")}
          >
            Modelado Predictivo
          </Typography>{" "}
          o usa{" "}
          <Typography
            component="span" sx={{ cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
            onClick={() => navigate("/inverse-design")}
          >
            Diseno Inverso
          </Typography>{" "}
          primero.
        </Alert>
      </Box>
    );
  }

  const p = properties;
  const comp = p.composition;
  const totalMass = Object.entries(comp)
    .filter(([k]) => k !== "age")
    .reduce((sum, [, v]) => sum + (v || 0), 0);
  const totalBinder = (comp.cement || 0) + (comp.fly_ash || 0) + (comp.blast_furnace_slag || 0);
  const substPct = totalBinder > 0 ? (((comp.fly_ash || 0) + (comp.blast_furnace_slag || 0)) / totalBinder * 100) : 0;

  const evaluations = recommendApplications(p);

  // Validation calculations
  const measuredCompression = parseFloat(measured.compression);
  const measuredFlexion = parseFloat(measured.flexion);
  const measuredTensile = parseFloat(measured.tensile);

  const calcError = (predicted: number, meas: number) => {
    if (isNaN(meas) || meas === 0) return null;
    return {
      absolute: Math.abs(predicted - meas),
      percentage: (Math.abs(predicted - meas) / meas) * 100,
      diff: predicted - meas,
    };
  };

  const compError = calcError(p.mechanical.compressiveStrength, measuredCompression);
  const flexError = calcError(p.mechanical.flexuralStrength, measuredFlexion);
  const tensError = calcError(p.mechanical.tensileStrength, measuredTensile);

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Ficha Tecnica Experimental</Typography>
        <Button
          variant="contained" startIcon={<PictureAsPdfIcon />}
          onClick={() => generateAdvancedPDF(p)}
        >
          Descargar PDF
        </Button>
      </Box>

      {/* 4.1 Identificacion */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <SectionHeader label="4.1 Identificacion" />
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Etiqueta</Typography>
            <Typography variant="body1" fontWeight={600}>{p.configLabel}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Fecha</Typography>
            <Typography variant="body1">{new Date(p.generatedAt).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Dataset</Typography>
            <Typography variant="body1">{p.datasetName}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Modelo</Typography>
            <Typography variant="body1" sx={{ wordBreak: "break-all" }}>{p.modelId}</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* 4.2 Formulacion completa */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <SectionHeader label="4.2 Formulacion Completa (Receta de Mezcla)" />
        <Divider sx={{ mb: 2 }} />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Componente</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell>Unidad</TableCell>
                <TableCell align="right">% Relativo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(COMPONENT_LABELS).map(([key, info]) => {
                const val = comp[key as keyof typeof comp] ?? 0;
                const pct = key !== "age" && totalMass > 0 ? ((val / totalMass) * 100).toFixed(1) : "-";
                return (
                  <TableRow key={key}>
                    <TableCell>{info.name}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{val.toFixed(1)}</TableCell>
                    <TableCell>{info.unit}</TableCell>
                    <TableCell align="right">{pct}{pct !== "-" ? "%" : ""}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Relacion A/C</Typography>
            <Typography variant="body1" fontWeight={600}>{p.physical.waterCementRatio.toFixed(2)}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">% Sustitucion de cemento</Typography>
            <Typography variant="body1" fontWeight={600}>{substPct.toFixed(1)}%</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Total aglomerantes</Typography>
            <Typography variant="body1" fontWeight={600}>{totalBinder.toFixed(1)} kg/m{"\u00B3"}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Total masa</Typography>
            <Typography variant="body1" fontWeight={600}>{totalMass.toFixed(1)} kg/m{"\u00B3"}</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* 4.3 Propiedades Estructurales Predichas */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <SectionHeader label="4.3 Propiedades Estructurales Predichas" />
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Compresion (f'c)</Typography>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              {p.mechanical.compressiveStrength.toFixed(1)} MPa
            </Typography>
            <Chip label="ML" size="small" color="primary" sx={{ fontSize: "0.6rem", height: 18 }} />
            {p.mechanical.confidenceInterval && (
              <Typography variant="caption" display="block" color="text.secondary">
                IC 95%: [{p.mechanical.confidenceInterval.lower.toFixed(1)} — {p.mechanical.confidenceInterval.upper.toFixed(1)}]
              </Typography>
            )}
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Traccion estimada</Typography>
            <Typography variant="h6">{p.mechanical.tensileStrength.toFixed(2)} MPa</Typography>
            <Chip label="Derivada: 0.10 x f'c" size="small" variant="outlined" sx={{ fontSize: "0.6rem", height: 18 }} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Flexion estimada</Typography>
            <Typography variant="h6">{p.mechanical.flexuralStrength.toFixed(2)} MPa</Typography>
            <Chip label="Derivada: 0.62 x sqrt(f'c)" size="small" variant="outlined" sx={{ fontSize: "0.6rem", height: 18 }} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Modulo de Elasticidad</Typography>
            <Typography variant="h6">{(p.mechanical.elasticModulus / 1000).toFixed(1)} GPa</Typography>
            <Chip label="Derivada: 4700 x sqrt(f'c)" size="small" variant="outlined" sx={{ fontSize: "0.6rem", height: 18 }} />
          </Grid>
        </Grid>
      </Paper>

      {/* 4.4 Propiedades Fisicas */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <SectionHeader label="4.4 Propiedades Fisicas" />
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 6, sm: 2.4 }}>
            <Typography variant="caption" color="text.secondary">Relacion A/C</Typography>
            <Typography variant="h6">{p.physical.waterCementRatio.toFixed(2)}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 2.4 }}>
            <Typography variant="caption" color="text.secondary">Porosidad estimada</Typography>
            <Typography variant="h6">{p.physical.porosity.toFixed(1)}%</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 2.4 }}>
            <Typography variant="caption" color="text.secondary">Densidad estimada</Typography>
            <Typography variant="h6">{p.physical.density.toFixed(0)} kg/m{"\u00B3"}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 2.4 }}>
            <Typography variant="caption" color="text.secondary">Fraguado estimado</Typography>
            <Typography variant="body2">{p.physical.settingTime}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 2.4 }}>
            <Typography variant="caption" color="text.secondary">Tendencia a Retraccion</Typography>
            <Chip
              label={p.physical.shrinkageTendency}
              color={p.physical.shrinkageTendency === "Baja" ? "success" : p.physical.shrinkageTendency === "Media" ? "warning" : "error"}
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* 4.5 Aplicaciones Recomendadas */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <SectionHeader label="4.5 Aplicaciones Recomendadas" />
        <Divider sx={{ mb: 2 }} />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tipo de Aplicacion</TableCell>
                <TableCell align="center">Adecuacion</TableCell>
                <TableCell>Justificacion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {evaluations.map((ev) => (
                <TableRow key={ev.category}>
                  <TableCell sx={{ fontWeight: 600 }}>{ev.category}</TableCell>
                  <TableCell align="center">
                    <Chip label={ev.suitability} color={suitabilityColor[ev.suitability]} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{ev.justification}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 4.6 Protocolo de Fabricacion Sugerido */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <SectionHeader label="4.6 Protocolo de Fabricacion Sugerido" />
        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle2" gutterBottom>Orden de mezclado recomendado</Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2">1. Mezclar aridos gruesos y finos en seco (30 seg)</Typography>
          <Typography variant="body2">2. Agregar cemento{comp.blast_furnace_slag > 0 ? ", escoria" : ""}{comp.fly_ash > 0 ? " y ceniza volante" : ""} — mezclar en seco (30 seg)</Typography>
          <Typography variant="body2">3. Agregar 75% del agua — mezclar (60 seg)</Typography>
          {comp.superplasticizer > 0 && (
            <Typography variant="body2">4. Agregar superplastificante diluido en el 25% de agua restante — mezclar (90 seg)</Typography>
          )}
          {comp.superplasticizer <= 0 && (
            <Typography variant="body2">4. Agregar 25% de agua restante — mezclar (90 seg)</Typography>
          )}
          <Typography variant="body2">5. Mezclar hasta homogeneidad total (60–120 seg adicionales)</Typography>
        </Box>

        <Typography variant="subtitle2" gutterBottom>Tiempo total de mezclado estimado</Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>4–5 minutos (ajustar segun consistencia visual)</Typography>

        <Typography variant="subtitle2" gutterBottom>Edades recomendadas de ensayo</Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Chip label="7 dias" variant="outlined" size="small" />
          <Chip label="14 dias" variant="outlined" size="small" />
          <Chip label="28 dias" variant="outlined" size="small" color={comp.age === 28 ? "primary" : "default"} />
          {comp.age > 28 && <Chip label={`${comp.age} dias`} variant="outlined" size="small" color="primary" />}
        </Box>

        <Typography variant="subtitle2" gutterBottom>Ensayos sugeridos</Typography>
        <Box sx={{ pl: 2 }}>
          <Typography variant="body2">- Compresion uniaxial (probeta cilindrica 150x300 mm o cubica 150 mm)</Typography>
          <Typography variant="body2">- Flexion a 3 puntos (prisma 100x100x400 mm)</Typography>
          <Typography variant="body2">- Traccion indirecta (ensayo brasileno, cilindro 150x300 mm)</Typography>
        </Box>
      </Paper>

      {/* 4.7 Validacion Experimental */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <SectionHeader label="4.7 Validacion Experimental" />
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ingresa los resultados medidos en laboratorio para calcular el error respecto a la prediccion.
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 4 }}>
            <TextField
              fullWidth label="Compresion medida (MPa)" type="number" size="small"
              value={measured.compression}
              onChange={(e) => setMeasured((prev) => ({ ...prev, compression: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField
              fullWidth label="Flexion medida (MPa)" type="number" size="small"
              value={measured.flexion}
              onChange={(e) => setMeasured((prev) => ({ ...prev, flexion: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField
              fullWidth label="Traccion medida (MPa)" type="number" size="small"
              value={measured.tensile}
              onChange={(e) => setMeasured((prev) => ({ ...prev, tensile: e.target.value }))}
            />
          </Grid>
        </Grid>

        {(compError || flexError || tensError) && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Propiedad</TableCell>
                  <TableCell align="right">Predicho</TableCell>
                  <TableCell align="right">Medido</TableCell>
                  <TableCell align="right">Error Abs.</TableCell>
                  <TableCell align="right">Error %</TableCell>
                  <TableCell align="right">Diferencia</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {compError && (
                  <TableRow>
                    <TableCell>Compresion (MPa)</TableCell>
                    <TableCell align="right">{p.mechanical.compressiveStrength.toFixed(1)}</TableCell>
                    <TableCell align="right">{measuredCompression.toFixed(1)}</TableCell>
                    <TableCell align="right">{compError.absolute.toFixed(2)}</TableCell>
                    <TableCell align="right">{compError.percentage.toFixed(1)}%</TableCell>
                    <TableCell align="right" sx={{ color: compError.diff > 0 ? "success.main" : "error.main" }}>
                      {compError.diff > 0 ? "+" : ""}{compError.diff.toFixed(2)}
                    </TableCell>
                  </TableRow>
                )}
                {flexError && (
                  <TableRow>
                    <TableCell>Flexion (MPa)</TableCell>
                    <TableCell align="right">{p.mechanical.flexuralStrength.toFixed(2)}</TableCell>
                    <TableCell align="right">{measuredFlexion.toFixed(2)}</TableCell>
                    <TableCell align="right">{flexError.absolute.toFixed(2)}</TableCell>
                    <TableCell align="right">{flexError.percentage.toFixed(1)}%</TableCell>
                    <TableCell align="right" sx={{ color: flexError.diff > 0 ? "success.main" : "error.main" }}>
                      {flexError.diff > 0 ? "+" : ""}{flexError.diff.toFixed(2)}
                    </TableCell>
                  </TableRow>
                )}
                {tensError && (
                  <TableRow>
                    <TableCell>Traccion (MPa)</TableCell>
                    <TableCell align="right">{p.mechanical.tensileStrength.toFixed(2)}</TableCell>
                    <TableCell align="right">{measuredTensile.toFixed(2)}</TableCell>
                    <TableCell align="right">{tensError.absolute.toFixed(2)}</TableCell>
                    <TableCell align="right">{tensError.percentage.toFixed(1)}%</TableCell>
                    <TableCell align="right" sx={{ color: tensError.diff > 0 ? "success.main" : "error.main" }}>
                      {tensError.diff > 0 ? "+" : ""}{tensError.diff.toFixed(2)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* F. Nivel de Confianza */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <SectionHeader label="Nivel de Confianza del Modelo" />
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          {p.confidence.r2 != null && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">R2</Typography>
              <Typography variant="h6">{p.confidence.r2.toFixed(3)}</Typography>
            </Grid>
          )}
          {p.confidence.mae != null && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">MAE</Typography>
              <Typography variant="h6">{p.confidence.mae.toFixed(2)} MPa</Typography>
            </Grid>
          )}
        </Grid>
        {p.confidence.domainWarnings.length > 0 ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Advertencias de dominio:</Typography>
            {p.confidence.domainWarnings.map((w, i) => (
              <Typography key={i} variant="body2">- {w}</Typography>
            ))}
          </Alert>
        ) : (
          <Alert severity="success" sx={{ mt: 2 }}>
            Todos los valores dentro del dominio de entrenamiento.
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
