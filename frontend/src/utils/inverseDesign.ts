// ── Inverse Design Engine ──
// Generates candidate mixes that satisfy user-defined structural constraints
// via parametric grid search over the composition space.

import { computeDerivedProperties, type Composition, type DerivedMaterialProperties } from "./materialProperties";

export interface InverseConstraints {
  minCompression: number;
  maxCompression: number;
  minTensile: number;
  maxTensile: number;
  age: number;
  maxFlyAshPercent: number;     // % of total binder
  maxSettingTimeMinutes: number; // approximate limit
}

export interface CandidateMix {
  composition: Composition;
  properties: DerivedMaterialProperties;
  structuralMargin: number;     // how far above minimum compression
  sustainabilityScore: number;
  cementUsage: number;
}

// ── Grid search ranges (within dataset domain) ──
const SEARCH_GRID = {
  cement:            { min: 150, max: 500, steps: 6 },
  blast_furnace_slag:{ min: 0,   max: 300, steps: 4 },
  fly_ash:           { min: 0,   max: 180, steps: 4 },
  water:             { min: 130, max: 230, steps: 4 },
  superplasticizer:  { min: 0,   max: 25,  steps: 3 },
  coarse_aggregate:  { min: 850, max: 1100, steps: 3 },
  fine_aggregate:    { min: 600, max: 950, steps: 3 },
};

function linspace(min: number, max: number, steps: number): number[] {
  if (steps <= 1) return [min];
  const result: number[] = [];
  for (let i = 0; i < steps; i++) {
    result.push(min + (max - min) * (i / (steps - 1)));
  }
  return result;
}

// Estimate setting time in minutes (mirrors materialProperties heuristic)
function estimateSettingTimeMinutes(comp: Composition): number {
  const wc = comp.cement > 0 ? comp.water / comp.cement : 0;
  const totalBinder = comp.cement + comp.fly_ash + comp.blast_furnace_slag || 1;
  const flyAshPct = (comp.fly_ash / totalBinder) * 100;
  const slagPct = (comp.blast_furnace_slag / totalBinder) * 100;

  let initialSet = 150;
  if (wc > 0.55) initialSet -= 30;
  else if (wc < 0.35) initialSet += 40;
  if (flyAshPct > 20) initialSet += 40;
  else if (flyAshPct > 10) initialSet += 20;
  if (slagPct > 30) initialSet += 25;
  if (comp.superplasticizer > 2) initialSet += 20;

  return Math.max(90, Math.min(300, initialSet));
}

interface PredictionFn {
  (composition: Record<string, number>): Promise<{ prediction: number; lower: number; upper: number }>;
}

export async function searchCandidateMixes(
  constraints: InverseConstraints,
  predictFn: PredictionFn,
  modelId: string,
  r2: number | null,
  mae: number | null,
  onProgress?: (pct: number) => void,
): Promise<CandidateMix[]> {
  // Generate a focused sample grid
  const cementVals = linspace(SEARCH_GRID.cement.min, SEARCH_GRID.cement.max, SEARCH_GRID.cement.steps);
  const slagVals = linspace(SEARCH_GRID.blast_furnace_slag.min, SEARCH_GRID.blast_furnace_slag.max, SEARCH_GRID.blast_furnace_slag.steps);
  const flyAshVals = linspace(SEARCH_GRID.fly_ash.min, SEARCH_GRID.fly_ash.max, SEARCH_GRID.fly_ash.steps);
  const waterVals = linspace(SEARCH_GRID.water.min, SEARCH_GRID.water.max, SEARCH_GRID.water.steps);
  const spVals = linspace(SEARCH_GRID.superplasticizer.min, SEARCH_GRID.superplasticizer.max, SEARCH_GRID.superplasticizer.steps);
  // Fixed aggregate values (use middle of range to reduce dimensionality)
  const coarseAgg = (SEARCH_GRID.coarse_aggregate.min + SEARCH_GRID.coarse_aggregate.max) / 2;
  const fineAgg = (SEARCH_GRID.fine_aggregate.min + SEARCH_GRID.fine_aggregate.max) / 2;

  // Pre-filter compositions
  const candidates: Composition[] = [];
  for (const cement of cementVals) {
    for (const slag of slagVals) {
      for (const flyAsh of flyAshVals) {
        const totalBinder = cement + flyAsh + slag;
        if (totalBinder <= 0) continue;
        const flyAshPct = (flyAsh / totalBinder) * 100;
        if (flyAshPct > constraints.maxFlyAshPercent) continue;

        for (const water of waterVals) {
          const wc = water / cement;
          if (wc < 0.25 || wc > 0.70) continue; // unrealistic W/C

          for (const sp of spVals) {
            const comp: Composition = {
              cement, blast_furnace_slag: slag, fly_ash: flyAsh,
              water, superplasticizer: sp,
              coarse_aggregate: coarseAgg, fine_aggregate: fineAgg,
              age: constraints.age,
            };

            // Check setting time constraint
            const stMinutes = estimateSettingTimeMinutes(comp);
            if (stMinutes > constraints.maxSettingTimeMinutes) continue;

            candidates.push(comp);
          }
        }
      }
    }
  }

  // Evaluate candidates with ML model (batch in groups for progress reporting)
  const valid: CandidateMix[] = [];
  const total = candidates.length;
  const BATCH = 20;

  for (let i = 0; i < total; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (comp) => {
        try {
          const input: Record<string, number> = { ...comp };
          const res = await predictFn(input);
          return { comp, res };
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (!r) continue;
      const { comp, res } = r;
      const fc = res.prediction;
      const tensile = 0.10 * fc;

      // Check constraints
      if (fc < constraints.minCompression || fc > constraints.maxCompression) continue;
      if (tensile < constraints.minTensile || tensile > constraints.maxTensile) continue;

      const props = computeDerivedProperties({
        composition: comp,
        predictedStrength: fc,
        lowerBound: res.lower,
        upperBound: res.upper,
        r2, mae,
        modelId,
        configLabel: `Inv-${Date.now().toString(36)}`,
      });

      valid.push({
        composition: comp,
        properties: props,
        structuralMargin: fc - constraints.minCompression,
        sustainabilityScore: props.sustainability.sustainabilityScore,
        cementUsage: comp.cement,
      });
    }

    onProgress?.(Math.min(100, Math.round(((i + batch.length) / total) * 100)));
  }

  // Sort: structural margin desc, then sustainability desc, then cement asc
  valid.sort((a, b) => {
    const marginDiff = b.structuralMargin - a.structuralMargin;
    if (Math.abs(marginDiff) > 2) return marginDiff;
    const sustDiff = b.sustainabilityScore - a.sustainabilityScore;
    if (Math.abs(sustDiff) > 5) return sustDiff;
    return a.cementUsage - b.cementUsage;
  });

  // Deduplicate: keep top 3 that are sufficiently different
  const selected: CandidateMix[] = [];
  for (const c of valid) {
    if (selected.length >= 3) break;
    const isDuplicate = selected.some((s) =>
      Math.abs(s.composition.cement - c.composition.cement) < 30 &&
      Math.abs(s.composition.fly_ash - c.composition.fly_ash) < 20 &&
      Math.abs(s.composition.water - c.composition.water) < 20
    );
    if (!isDuplicate) selected.push(c);
  }

  return selected;
}
