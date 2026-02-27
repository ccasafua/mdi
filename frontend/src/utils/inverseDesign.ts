// ── Inverse Design Engine ──
// Generates candidate mixes that satisfy structural constraints
// while MAXIMIZING fly ash content as the primary strategic objective.
//
// Objective function:
//   PRIMARY:   Maximize fly ash (kg/m³ and % binder substitution)
//   SECONDARY: Minimize Portland cement content
//
// Constraints (must all be satisfied):
//   - f'c predicted ≥ minCompression
//   - E predicted ≥ minElasticModulus
//   - Setting time ≤ maxSettingTimeMinutes
//   - All properties within user-defined ranges

import { computeDerivedProperties, type Composition, type DerivedMaterialProperties } from "./materialProperties";

export interface InverseConstraints {
  minCompression: number;
  maxCompression: number;
  minTensile: number;
  maxTensile: number;
  minFlexural: number;
  maxFlexural: number;
  minElasticModulus: number;    // GPa
  maxElasticModulus: number;    // GPa
  age: number;
  maxFlyAshPercent: number;     // % of total binder (upper limit, default 70)
  maxSettingTimeMinutes: number; // approximate limit
}

export interface CandidateMix {
  composition: Composition;
  properties: DerivedMaterialProperties;
  structuralMargin: number;      // f'c - minCompression (MPa)
  sustainabilityScore: number;
  cementUsage: number;           // kg/m³
  flyAshContent: number;         // kg/m³
  flyAshSubstitution: number;    // % of total binder
}

// ── Grid search ranges ──
// Fly ash is the strategic axis: finer resolution, broader range, explored first.
// Cement is reduced progressively.
const SEARCH_GRID = {
  fly_ash:           { min: 20,  max: 200, steps: 10 }, // priority axis — always > 0, fine resolution
  cement:            { min: 102, max: 500, steps: 8 },  // min from dataset domain, explored low→high
  blast_furnace_slag:{ min: 0,   max: 300, steps: 4 },
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
  // Generate grid — fly ash explored from HIGH to LOW (priority axis)
  const flyAshVals = linspace(SEARCH_GRID.fly_ash.min, SEARCH_GRID.fly_ash.max, SEARCH_GRID.fly_ash.steps).reverse();
  // Cement explored from LOW to HIGH (secondary objective: minimize)
  const cementVals = linspace(SEARCH_GRID.cement.min, SEARCH_GRID.cement.max, SEARCH_GRID.cement.steps);
  const slagVals = linspace(SEARCH_GRID.blast_furnace_slag.min, SEARCH_GRID.blast_furnace_slag.max, SEARCH_GRID.blast_furnace_slag.steps);
  const waterVals = linspace(SEARCH_GRID.water.min, SEARCH_GRID.water.max, SEARCH_GRID.water.steps);
  const spVals = linspace(SEARCH_GRID.superplasticizer.min, SEARCH_GRID.superplasticizer.max, SEARCH_GRID.superplasticizer.steps);
  // Fixed aggregates (middle of range to reduce dimensionality)
  const coarseAgg = (SEARCH_GRID.coarse_aggregate.min + SEARCH_GRID.coarse_aggregate.max) / 2;
  const fineAgg = (SEARCH_GRID.fine_aggregate.min + SEARCH_GRID.fine_aggregate.max) / 2;

  // Build candidates: fly ash first (outer loop = priority)
  const candidates: Composition[] = [];
  for (const flyAsh of flyAshVals) {
    for (const cement of cementVals) {
      for (const slag of slagVals) {
        const totalBinder = cement + flyAsh + slag;
        if (totalBinder <= 0) continue;
        const flyAshPct = (flyAsh / totalBinder) * 100;
        if (flyAshPct > constraints.maxFlyAshPercent) continue;

        for (const water of waterVals) {
          const wc = water / cement;
          if (wc < 0.25 || wc > 0.70) continue;

          for (const sp of spVals) {
            const comp: Composition = {
              cement, blast_furnace_slag: slag, fly_ash: flyAsh,
              water, superplasticizer: sp,
              coarse_aggregate: coarseAgg, fine_aggregate: fineAgg,
              age: constraints.age,
            };

            // Setting time constraint
            const stMinutes = estimateSettingTimeMinutes(comp);
            if (stMinutes > constraints.maxSettingTimeMinutes) continue;

            candidates.push(comp);
          }
        }
      }
    }
  }

  // Evaluate candidates with ML model
  const valid: CandidateMix[] = [];
  const total = candidates.length;
  const BATCH = 20;
  const rejectedCounts: Record<string, number> = {};

  console.log(`[MDI] Search started: ${total} candidates | Constraints: fc=[${constraints.minCompression}, ${constraints.maxCompression}] E=[${constraints.minElasticModulus}, ${constraints.maxElasticModulus}] GPa`);

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
      const flexural = 0.62 * Math.sqrt(fc);
      const elasticModulusGPa = (4700 * Math.sqrt(fc)) / 1000;
      const totalBind = comp.cement + comp.fly_ash + comp.blast_furnace_slag;
      const substPct = totalBind > 0 ? (comp.fly_ash / totalBind) * 100 : 0;

      // Diagnostic: log first 5 rejections per reason
      const logReject = (reason: string) => {
        rejectedCounts[reason] = (rejectedCounts[reason] || 0) + 1;
        if (rejectedCounts[reason] <= 3) {
          console.log(`[MDI] REJECTED (${reason}): fc=${fc.toFixed(1)} req=[${constraints.minCompression},${constraints.maxCompression}] | E=${elasticModulusGPa.toFixed(2)} req=[${constraints.minElasticModulus},${constraints.maxElasticModulus}] | cement=${comp.cement.toFixed(0)} fly_ash=${comp.fly_ash.toFixed(0)} subst=${substPct.toFixed(1)}%`);
        }
      };

      // Check structural constraints
      if (fc < constraints.minCompression || fc > constraints.maxCompression) { logReject("fc"); continue; }
      if (tensile < constraints.minTensile || tensile > constraints.maxTensile) { logReject("tensile"); continue; }
      if (flexural < constraints.minFlexural || flexural > constraints.maxFlexural) { logReject("flexural"); continue; }
      if (elasticModulusGPa < constraints.minElasticModulus || elasticModulusGPa > constraints.maxElasticModulus) { logReject("E"); continue; }

      const props = computeDerivedProperties({
        composition: comp,
        predictedStrength: fc,
        lowerBound: res.lower,
        upperBound: res.upper,
        r2, mae,
        modelId,
        configLabel: `Inv-${Date.now().toString(36)}`,
      });

      const totalBinder = comp.cement + comp.fly_ash + comp.blast_furnace_slag;
      const flyAshSubstitution = totalBinder > 0 ? (comp.fly_ash / totalBinder) * 100 : 0;

      valid.push({
        composition: comp,
        properties: props,
        structuralMargin: fc - constraints.minCompression,
        sustainabilityScore: props.sustainability.sustainabilityScore,
        cementUsage: comp.cement,
        flyAshContent: comp.fly_ash,
        flyAshSubstitution,
      });
    }

    onProgress?.(Math.min(100, Math.round(((i + batch.length) / total) * 100)));
  }

  // Diagnostic summary
  console.log(`[MDI] Search complete: ${valid.length} valid of ${total} candidates | Rejections:`, rejectedCounts);
  if (valid.length > 0) {
    const best = valid.reduce((a, b) => a.flyAshSubstitution > b.flyAshSubstitution ? a : b);
    console.log(`[MDI] Best fly ash: ${best.flyAshContent.toFixed(0)} kg/m³ (${best.flyAshSubstitution.toFixed(1)}%) | cement=${best.cementUsage.toFixed(0)} | fc=${best.properties.mechanical.compressiveStrength.toFixed(1)} MPa | E=${(best.properties.mechanical.elasticModulus/1000).toFixed(2)} GPa`);
  }

  // ── SORTING: Fly ash substitution % DESC (primary), cement ASC (secondary) ──
  valid.sort((a, b) => {
    // Primary: highest fly ash substitution first
    const flyAshDiff = b.flyAshSubstitution - a.flyAshSubstitution;
    if (Math.abs(flyAshDiff) > 2) return flyAshDiff;
    // Secondary: lowest cement first
    const cementDiff = a.cementUsage - b.cementUsage;
    if (Math.abs(cementDiff) > 15) return cementDiff;
    // Tiebreaker: sustainability score
    return b.sustainabilityScore - a.sustainabilityScore;
  });

  // Deduplicate: keep top 3 with sufficiently different fly ash levels
  const selected: CandidateMix[] = [];
  for (const c of valid) {
    if (selected.length >= 3) break;
    const isDuplicate = selected.some((s) =>
      Math.abs(s.flyAshSubstitution - c.flyAshSubstitution) < 5 &&
      Math.abs(s.composition.cement - c.composition.cement) < 30
    );
    if (!isDuplicate) selected.push(c);
  }

  return selected;
}
