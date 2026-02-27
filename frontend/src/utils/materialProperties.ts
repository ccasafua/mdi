// ── Material Properties Calculation Engine ──
// Computes derived mechanical, physical, and sustainability properties
// from a concrete mix composition and ML prediction.

export interface Composition {
  cement: number;
  blast_furnace_slag: number;
  fly_ash: number;
  water: number;
  superplasticizer: number;
  coarse_aggregate: number;
  fine_aggregate: number;
  age: number;
}

export interface MechanicalProperties {
  compressiveStrength: number;   // f'c (MPa) — from ML prediction
  tensileStrength: number;       // ≈ 0.10 × f'c (MPa) — derived
  flexuralStrength: number;      // ≈ 0.62 × √f'c (MPa) — derived
  elasticModulus: number;        // ≈ 4700 × √f'c (MPa) — derived
  fragilityIndex: number;        // f'c / E (dimensionless) — derived
  confidenceInterval: { lower: number; upper: number } | null;
}

export interface PhysicalProperties {
  waterCementRatio: number;      // W/C
  porosity: number;              // % (Powers model simplified)
  density: number;               // kg/m³ estimated
  settingTime: string;           // Estimated setting time description
  shrinkageTendency: "Baja" | "Media" | "Alta";
}

export interface SustainabilityProperties {
  cementSubstitution: number;    // % of binder replaced by SCMs
  co2Reduction: number;          // estimated % reduction vs pure cement
  sustainabilityScore: number;   // 0-100 composite score
}

export interface ConfidenceInfo {
  r2: number | null;
  mae: number | null;
  domainWarnings: string[];
}

export interface DerivedMaterialProperties {
  composition: Composition;
  mechanical: MechanicalProperties;
  physical: PhysicalProperties;
  sustainability: SustainabilityProperties;
  confidence: ConfidenceInfo;
  configLabel: string;
  modelId: string;
  datasetName: string;
  generatedAt: string;
}

export interface ComputeInput {
  composition: Composition;
  predictedStrength: number;
  lowerBound: number | null;
  upperBound: number | null;
  r2: number | null;
  mae: number | null;
  modelId: string;
  configLabel: string;
  datasetName?: string;
}

// ── Domain ranges for warning checks ──
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

function checkDomainWarningsInternal(comp: Composition): string[] {
  const warnings: string[] = [];
  for (const [key, range] of Object.entries(DATASET_RANGES)) {
    const val = comp[key as keyof Composition];
    if (val < range.min || val > range.max) {
      warnings.push(`${key}: ${val} fuera del rango [${range.min}, ${range.max}]`);
    }
  }
  return warnings;
}

// ── Setting time heuristic ──
function estimateSettingTime(comp: Composition): string {
  const wc = comp.cement > 0 ? comp.water / comp.cement : 0;
  const flyAshPct = (comp.fly_ash / (comp.cement + comp.fly_ash + comp.blast_furnace_slag || 1)) * 100;
  const slagPct = (comp.blast_furnace_slag / (comp.cement + comp.fly_ash + comp.blast_furnace_slag || 1)) * 100;
  const spPresent = comp.superplasticizer > 2;

  // Base estimate in minutes
  let initialSet = 150; // ~2.5h baseline

  // High W/C → faster initial set
  if (wc > 0.55) initialSet -= 30;
  else if (wc < 0.35) initialSet += 40;

  // Fly ash retards setting
  if (flyAshPct > 20) initialSet += 40;
  else if (flyAshPct > 10) initialSet += 20;

  // Slag retards slightly
  if (slagPct > 30) initialSet += 25;

  // SP can retard setting
  if (spPresent) initialSet += 20;

  initialSet = Math.max(90, Math.min(300, initialSet));
  const finalSet = Math.round(initialSet * 1.6);

  const h1 = Math.floor(initialSet / 60);
  const m1 = initialSet % 60;
  const h2 = Math.floor(finalSet / 60);
  const m2 = finalSet % 60;

  return `Inicial: ~${h1}h${m1 > 0 ? ` ${m1}min` : ""} | Final: ~${h2}h${m2 > 0 ? ` ${m2}min` : ""}`;
}

export function computeDerivedProperties(input: ComputeInput): DerivedMaterialProperties {
  const { composition: comp, predictedStrength: fc } = input;

  // ── Mechanical Properties ──
  const tensileStrength = 0.10 * fc;
  const flexuralStrength = 0.62 * Math.sqrt(fc);
  const elasticModulus = 4700 * Math.sqrt(fc);
  const fragilityIndex = elasticModulus > 0 ? fc / elasticModulus : 0;

  const mechanical: MechanicalProperties = {
    compressiveStrength: fc,
    tensileStrength,
    flexuralStrength,
    elasticModulus,
    fragilityIndex,
    confidenceInterval:
      input.lowerBound != null && input.upperBound != null
        ? { lower: input.lowerBound, upper: input.upperBound }
        : null,
  };

  // ── Physical Properties ──
  const cement = comp.cement || 0;
  const water = comp.water || 0;
  const wc = cement > 0 ? water / cement : 0;
  const porosity = 28.3 * wc + 2.2; // Powers simplified model
  const density =
    (comp.cement || 0) +
    (comp.blast_furnace_slag || 0) +
    (comp.fly_ash || 0) +
    (comp.water || 0) +
    (comp.superplasticizer || 0) +
    (comp.coarse_aggregate || 0) +
    (comp.fine_aggregate || 0);

  // Shrinkage heuristic
  let shrinkageTendency: "Baja" | "Media" | "Alta" = "Media";
  if (wc > 0.55 || water > 200 || comp.fine_aggregate > 850) {
    shrinkageTendency = "Alta";
  } else if (wc < 0.40 && water < 170 && comp.fine_aggregate < 700) {
    shrinkageTendency = "Baja";
  }

  const settingTime = estimateSettingTime(comp);

  const physical: PhysicalProperties = {
    waterCementRatio: wc,
    porosity: Math.max(0, porosity),
    density,
    settingTime,
    shrinkageTendency,
  };

  // ── Sustainability Properties ──
  const flyAsh = comp.fly_ash || 0;
  const slag = comp.blast_furnace_slag || 0;
  const totalBinder = cement + flyAsh + slag;
  const cementSubstitution = totalBinder > 0 ? ((flyAsh + slag) / totalBinder) * 100 : 0;
  const co2Reduction = cementSubstitution * 0.85;

  // Composite sustainability score (0-100)
  const substitutionPart = Math.min(cementSubstitution / 50, 1) * 40;
  const waterEfficiency = wc > 0 ? Math.max(0, 1 - (wc - 0.3) / 0.4) : 0;
  const waterPart = waterEfficiency * 30;
  const spUsage = comp.superplasticizer > 0 ? Math.min(comp.superplasticizer / 10, 1) : 0;
  const spPart = spUsage * 30;
  const sustainabilityScore = Math.min(100, Math.round(substitutionPart + waterPart + spPart));

  const sustainability: SustainabilityProperties = {
    cementSubstitution,
    co2Reduction,
    sustainabilityScore,
  };

  // ── Confidence ──
  const confidence: ConfidenceInfo = {
    r2: input.r2,
    mae: input.mae,
    domainWarnings: checkDomainWarningsInternal(comp),
  };

  return {
    composition: comp,
    mechanical,
    physical,
    sustainability,
    confidence,
    configLabel: input.configLabel,
    modelId: input.modelId,
    datasetName: input.datasetName ?? "concrete",
    generatedAt: new Date().toISOString(),
  };
}
