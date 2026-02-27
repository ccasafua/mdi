// --- Application classification by MPa ---

export function classifyApplication(mpa: number): { label: string; color: string } {
  if (mpa < 15) return { label: "Elemento decorativo no estructural", color: "#9e9e9e" };
  if (mpa < 25) return { label: "Revestimiento / pieza ligera", color: "#42a5f5" };
  if (mpa < 35) return { label: "Mueble estructural liviano", color: "#66bb6a" };
  if (mpa < 45) return { label: "Mueble estructural pesado", color: "#ffa726" };
  return { label: "Elemento estructural arquitectonico", color: "#ef5350" };
}

// --- Application presets for safety factor ---

export const APPLICATION_PRESETS = [
  { label: "Decorativo (no carga)", requiredMpa: 10 },
  { label: "Revestimiento ligero", requiredMpa: 20 },
  { label: "Mobiliario liviano", requiredMpa: 30 },
  { label: "Mobiliario pesado", requiredMpa: 40 },
  { label: "Elemento estructural", requiredMpa: 50 },
] as const;

// --- Safety factor ---

export function computeSafetyFactor(
  predictedMpa: number,
  requiredMpa: number,
): { factor: number; status: string; icon: string; color: string } {
  if (requiredMpa <= 0) return { factor: Infinity, status: "safe", icon: "✓", color: "#4caf50" };
  const factor = predictedMpa / requiredMpa;
  if (factor >= 1.5) return { factor, status: "safe", icon: "✓", color: "#4caf50" };
  if (factor >= 1.0) return { factor, status: "marginal", icon: "⚠", color: "#ff9800" };
  return { factor, status: "unsafe", icon: "✕", color: "#f44336" };
}

// --- Model confidence ---

export function classifyModelConfidence(r2: number): { level: string; label: string; color: string } {
  if (r2 > 0.85) return { level: "high", label: "Alta confianza", color: "#4caf50" };
  if (r2 >= 0.70) return { level: "medium", label: "Confianza media", color: "#ff9800" };
  return { level: "low", label: "Experimental", color: "#f44336" };
}

// --- Dataset ranges (hardcoded from concrete dataset) ---

export const DATASET_RANGES: Record<string, { min: number; max: number }> = {
  cement: { min: 102, max: 540 },
  blast_furnace_slag: { min: 0, max: 359.4 },
  fly_ash: { min: 0, max: 200.1 },
  water: { min: 121.8, max: 247 },
  superplasticizer: { min: 0, max: 32.2 },
  coarse_aggregate: { min: 801, max: 1145 },
  fine_aggregate: { min: 594, max: 992.6 },
  age: { min: 1, max: 365 },
};

// --- Domain warnings ---

export function checkDomainWarnings(
  features: Record<string, number>,
  ranges: Record<string, { min: number; max: number }> = DATASET_RANGES,
): { feature: string; value: number; min: number; max: number }[] {
  const warnings: { feature: string; value: number; min: number; max: number }[] = [];
  for (const [feature, value] of Object.entries(features)) {
    const r = ranges[feature];
    if (r && (value < r.min || value > r.max)) {
      warnings.push({ feature, value, min: r.min, max: r.max });
    }
  }
  return warnings;
}

// --- Sustainability ---

export function computeSustainability(
  features: Record<string, number>,
): { score: number; label: string; color: string } {
  const cement = features.cement ?? 0;
  const flyAsh = features.fly_ash ?? 0;
  const slag = features.blast_furnace_slag ?? 0;
  const total = cement + flyAsh + slag;
  if (total === 0) return { score: 0, label: "Sin datos", color: "#9e9e9e" };
  const score = ((flyAsh + slag) / total) * 100;
  if (score > 30) return { score, label: "Alta sustentabilidad", color: "#4caf50" };
  if (score >= 15) return { score, label: "Sustentabilidad media", color: "#ff9800" };
  return { score, label: "Baja sustentabilidad", color: "#9e9e9e" };
}
