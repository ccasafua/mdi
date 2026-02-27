// ── Structural Analysis Engine ──
// Computes structural demands for real elements (beams, slabs, columns, panels, furniture)
// and maps them to inverse design constraints.

import type { InverseConstraints } from "./inverseDesign";
import type { DerivedMaterialProperties } from "./materialProperties";

// ── Types ──

export type ElementType = "viga" | "losa" | "columna" | "panel" | "mobiliario";
export type SupportCondition = "simply_supported" | "fixed" | "cantilever";
export type LoadType = "distributed" | "point";

export interface StructuralInput {
  elementType: ElementType;
  span: number;          // L (m)
  width: number;         // b (m)
  height: number;        // h (m)
  support: SupportCondition;
  loadType: LoadType;
  loadValue: number;     // kN/m (distributed) or kN (point/axial)
  deflectionLimit: number; // e.g. 250 for L/250
  safetyFactor: number;  // default 1.5
  age: number;           // days
  columnK?: number;      // effective length factor for columns
}

export interface StructuralDemands {
  Mmax: number;          // kN·m
  sigmaMax: number;      // MPa
  requiredFc: number;    // MPa
  requiredE: number;     // GPa
  deltaMax: number;      // mm (allowable deflection)
  sectionModulus: number; // m³ (S = bh²/6)
  momentOfInertia: number; // m⁴ (I = bh³/12)
  area: number;          // m² (b × h)
  formulaUsed: string;
}

export interface StructuralVerification {
  fcDemand: number;
  fcCapacity: number;
  fcOk: boolean;
  eDemand: number;
  eCapacity: number;
  eOk: boolean;
  deflectionCalc: number;  // mm
  deflectionLimit: number; // mm
  deflectionOk: boolean;
  bucklingOk: boolean | null; // only for columns
  verdict: "Cumple" | "Marginal" | "No Cumple";
}

// ── Constants ──

export const ELEMENT_LABELS: Record<ElementType, string> = {
  viga: "Viga",
  losa: "Losa",
  columna: "Columna",
  panel: "Panel",
  mobiliario: "Mobiliario",
};

export const SUPPORT_LABELS: Record<SupportCondition, string> = {
  simply_supported: "Simplemente Apoyada",
  fixed: "Empotrada",
  cantilever: "Voladizo",
};

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  distributed: "Distribuida",
  point: "Puntual",
};

export const DEFAULT_GEOMETRY: Record<ElementType, { span: number; width: number; height: number; support: SupportCondition; loadType: LoadType; loadValue: number }> = {
  viga:       { span: 4.0, width: 0.30, height: 0.50, support: "simply_supported", loadType: "distributed", loadValue: 10 },
  losa:       { span: 5.0, width: 1.00, height: 0.15, support: "simply_supported", loadType: "distributed", loadValue: 8 },
  columna:    { span: 3.0, width: 0.30, height: 0.30, support: "fixed", loadType: "point", loadValue: 500 },
  panel:      { span: 3.0, width: 1.00, height: 0.10, support: "simply_supported", loadType: "distributed", loadValue: 3 },
  mobiliario: { span: 0.6, width: 0.30, height: 0.05, support: "cantilever", loadType: "point", loadValue: 1 },
};

export const DEFLECTION_OPTIONS = [
  { label: "L/250 (General)", value: 250 },
  { label: "L/300 (Pisos)", value: 300 },
  { label: "L/500 (Preciso)", value: 500 },
];

// ── Compute Structural Demands ──

export function computeStructuralDemands(input: StructuralInput): StructuralDemands {
  const { elementType, span: L, width: b, height: h, support, loadType, loadValue, deflectionLimit, safetyFactor } = input;

  const S = (b * h * h) / 6;          // section modulus (m³)
  const I = (b * h * h * h) / 12;     // moment of inertia (m⁴)
  const A = b * h;                     // cross-section area (m²)
  const deltaMax = (L * 1000) / deflectionLimit; // allowable deflection (mm)

  let Mmax = 0;      // kN·m
  let formulaUsed = "";
  let deflectionFormula = ""; // for E calculation

  if (elementType === "columna") {
    // Column: axial load, no bending moment in this simplified model
    const P = loadValue; // kN
    const sigmaAxial = P / (A * 1000); // MPa (A in m², P in kN → P/(A) = kN/m² → /1000 = MPa)
    const requiredFc = sigmaAxial * safetyFactor;

    // Euler buckling: Pcr = π²EI/(KL)²
    const K = input.columnK ?? 1.0;
    const KL = K * L;
    // Required E so that Pcr > P × safetyFactor
    // E_req = P × SF × (KL)² / (π² × I) in kN/m² → convert to GPa
    const requiredE_kNm2 = (P * safetyFactor * KL * KL) / (Math.PI * Math.PI * I);
    const requiredE = requiredE_kNm2 / 1e6; // GPa

    return {
      Mmax: 0,
      sigmaMax: sigmaAxial,
      requiredFc,
      requiredE: Math.max(requiredE, 5), // minimum 5 GPa
      deltaMax,
      sectionModulus: S,
      momentOfInertia: I,
      area: A,
      formulaUsed: `Columna: σ = P/A = ${P.toFixed(1)}/(${(A * 1e4).toFixed(1)} cm²) = ${sigmaAxial.toFixed(2)} MPa | Pcr = π²EI/(KL)²`,
    };
  }

  // For losa: load is per unit width, convert to line load
  const w = elementType === "losa" ? loadValue * b : loadValue;
  const P = loadValue; // for point loads

  if (loadType === "distributed") {
    if (support === "simply_supported") {
      Mmax = (w * L * L) / 8;
      formulaUsed = `M = wL²/8 = ${w.toFixed(1)}×${L.toFixed(1)}²/8`;
      deflectionFormula = "5wL⁴/(384EI)";
    } else if (support === "fixed") {
      Mmax = (w * L * L) / 12;
      formulaUsed = `M = wL²/12 = ${w.toFixed(1)}×${L.toFixed(1)}²/12`;
      deflectionFormula = "wL⁴/(384EI)";
    } else {
      // cantilever
      Mmax = (w * L * L) / 2;
      formulaUsed = `M = wL²/2 = ${w.toFixed(1)}×${L.toFixed(1)}²/2`;
      deflectionFormula = "wL⁴/(8EI)";
    }
  } else {
    // point load
    if (support === "simply_supported") {
      Mmax = (P * L) / 4;
      formulaUsed = `M = PL/4 = ${P.toFixed(1)}×${L.toFixed(1)}/4`;
      deflectionFormula = "PL³/(48EI)";
    } else if (support === "fixed") {
      Mmax = (P * L) / 8;
      formulaUsed = `M = PL/8 = ${P.toFixed(1)}×${L.toFixed(1)}/8`;
      deflectionFormula = "PL³/(192EI)";
    } else {
      // cantilever
      Mmax = P * L;
      formulaUsed = `M = PL = ${P.toFixed(1)}×${L.toFixed(1)}`;
      deflectionFormula = "PL³/(3EI)";
    }
  }

  // σ = M / (S × 1000) → M in kN·m, S in m³ → σ in MPa
  // M (kN·m) = M × 1000 (N·m), S (m³) → σ = M×1000 / (S × 1e6) = M / (S × 1000) MPa
  const sigmaMax = Mmax / (S * 1000);
  const requiredFc = sigmaMax * safetyFactor;

  // E required from deflection formula rearrangement
  // δ = coeff × load × L^n / (E × I)  → E = coeff × load × L^n / (δ × I)
  // δ in m (deltaMax / 1000), I in m⁴, load in kN/m or kN
  const deltaMeter = deltaMax / 1000;
  let requiredE_kNm2 = 0;

  if (loadType === "distributed") {
    const wEff = elementType === "losa" ? loadValue * b : loadValue;
    if (support === "simply_supported") {
      requiredE_kNm2 = (5 * wEff * Math.pow(L, 4)) / (384 * deltaMeter * I);
    } else if (support === "fixed") {
      requiredE_kNm2 = (wEff * Math.pow(L, 4)) / (384 * deltaMeter * I);
    } else {
      requiredE_kNm2 = (wEff * Math.pow(L, 4)) / (8 * deltaMeter * I);
    }
  } else {
    if (support === "simply_supported") {
      requiredE_kNm2 = (P * Math.pow(L, 3)) / (48 * deltaMeter * I);
    } else if (support === "fixed") {
      requiredE_kNm2 = (P * Math.pow(L, 3)) / (192 * deltaMeter * I);
    } else {
      requiredE_kNm2 = (P * Math.pow(L, 3)) / (3 * deltaMeter * I);
    }
  }

  const requiredE = requiredE_kNm2 / 1e6; // kN/m² → GPa

  formulaUsed += ` | σ = M/(S×1000) = ${sigmaMax.toFixed(2)} MPa | δ = ${deflectionFormula}`;

  return {
    Mmax,
    sigmaMax,
    requiredFc,
    requiredE: Math.max(requiredE, 1), // minimum 1 GPa
    deltaMax,
    sectionModulus: S,
    momentOfInertia: I,
    area: A,
    formulaUsed,
  };
}

// ── Map demands to inverse design constraints ──

export function demandsToConstraints(demands: StructuralDemands, input: StructuralInput): InverseConstraints {
  const fc = demands.requiredFc;
  const E = demands.requiredE;

  // Structural design only needs MINIMUMS — a mix that exceeds requirements is always valid.
  // Upper bounds set to 999 so the search engine never rejects an over-performing mix.
  return {
    minCompression: fc,
    maxCompression: 999,
    minTensile: 0,
    maxTensile: 999,
    minFlexural: 0,
    maxFlexural: 999,
    minElasticModulus: E,
    maxElasticModulus: 999,
    age: input.age,
    maxFlyAshPercent: 70,
    maxSettingTimeMinutes: 240,
  };
}

// ── Verify a candidate mix against structural demands ──

export function verifyCandidate(
  demands: StructuralDemands,
  input: StructuralInput,
  props: DerivedMaterialProperties,
): StructuralVerification {
  const fc = props.mechanical.compressiveStrength;
  const E_GPa = props.mechanical.elasticModulus / 1000; // MPa → GPa
  const I = demands.momentOfInertia;

  // f'c check
  const fcOk = fc >= demands.requiredFc;

  // E check
  const eOk = E_GPa >= demands.requiredE;

  // Deflection calculation using actual E
  let deflectionCalc = 0;
  const E_kNm2 = E_GPa * 1e6; // GPa → kN/m²
  const { elementType, span: L, width: b, support, loadType, loadValue } = input;

  if (elementType === "columna") {
    deflectionCalc = 0; // no deflection for columns
  } else if (loadType === "distributed") {
    const w = elementType === "losa" ? loadValue * b : loadValue;
    if (support === "simply_supported") {
      deflectionCalc = (5 * w * Math.pow(L, 4)) / (384 * E_kNm2 * I) * 1000;
    } else if (support === "fixed") {
      deflectionCalc = (w * Math.pow(L, 4)) / (384 * E_kNm2 * I) * 1000;
    } else {
      deflectionCalc = (w * Math.pow(L, 4)) / (8 * E_kNm2 * I) * 1000;
    }
  } else {
    const P = loadValue;
    if (support === "simply_supported") {
      deflectionCalc = (P * Math.pow(L, 3)) / (48 * E_kNm2 * I) * 1000;
    } else if (support === "fixed") {
      deflectionCalc = (P * Math.pow(L, 3)) / (192 * E_kNm2 * I) * 1000;
    } else {
      deflectionCalc = (P * Math.pow(L, 3)) / (3 * E_kNm2 * I) * 1000;
    }
  }

  const deflectionOk = deflectionCalc <= demands.deltaMax;

  // Buckling check for columns
  let bucklingOk: boolean | null = null;
  if (elementType === "columna") {
    const K = input.columnK ?? 1.0;
    const KL = K * L;
    const Pcr = (Math.PI * Math.PI * E_kNm2 * I) / (KL * KL); // kN
    bucklingOk = Pcr >= loadValue * input.safetyFactor;
  }

  // Verdict
  const checks = [fcOk, eOk, deflectionOk];
  if (bucklingOk !== null) checks.push(bucklingOk);

  const failCount = checks.filter((c) => !c).length;
  let verdict: "Cumple" | "Marginal" | "No Cumple";
  if (failCount === 0) {
    verdict = "Cumple";
  } else if (failCount === 1 && fcOk) {
    // If only one secondary check fails marginally
    verdict = "Marginal";
  } else {
    verdict = "No Cumple";
  }

  return {
    fcDemand: demands.requiredFc,
    fcCapacity: fc,
    fcOk,
    eDemand: demands.requiredE,
    eCapacity: E_GPa,
    eOk,
    deflectionCalc,
    deflectionLimit: demands.deltaMax,
    deflectionOk,
    bucklingOk,
    verdict,
  };
}
