// ── Structural Application Evaluation Engine ──
// Rule-based system: evaluates 8 structural application categories
// using compression, traction, flexion, and elasticity.

import type { DerivedMaterialProperties } from "./materialProperties";

export interface ApplicationEvaluation {
  category: string;
  suitability: "Alta" | "Media" | "Baja";
  score: number;        // 0-100
  justification: string;
  advantages: string[];
  risks: string[];
}

type Evaluator = (props: DerivedMaterialProperties) => ApplicationEvaluation;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function suitabilityFromScore(score: number): "Alta" | "Media" | "Baja" {
  if (score >= 65) return "Alta";
  if (score >= 40) return "Media";
  return "Baja";
}

// ── 1. Losas ──
const evalLosas: Evaluator = (p) => {
  const fc = p.mechanical.compressiveStrength;
  const ft = p.mechanical.tensileStrength;
  const fr = p.mechanical.flexuralStrength;
  const advantages: string[] = [];
  const risks: string[] = [];
  let score = 50;

  if (fc >= 25 && fc <= 45) { score += 15; advantages.push(`Compresion ${fc.toFixed(1)} MPa adecuada para losas`); }
  else if (fc > 45) { score += 10; advantages.push("Resistencia superior — permite menor espesor"); }
  else { score -= 20; risks.push(`Compresion ${fc.toFixed(1)} MPa insuficiente (min. recomendado 25 MPa)`); }

  if (fr >= 3.0) { score += 15; advantages.push(`Flexion ${fr.toFixed(2)} MPa favorable para solicitaciones de carga`); }
  else { score -= 10; risks.push(`Flexion ${fr.toFixed(2)} MPa baja — considerar refuerzo`); }

  if (ft >= 2.5) { score += 5; advantages.push("Traccion adecuada"); }
  else { risks.push("Traccion limitada"); }

  if (p.physical.shrinkageTendency === "Alta") { score -= 10; risks.push("Alta retraccion puede generar fisuras en losa"); }
  else if (p.physical.shrinkageTendency === "Baja") { score += 5; advantages.push("Baja retraccion — menor fisuracion"); }

  if (p.confidence.domainWarnings.length > 0) { score -= 5; risks.push("Valores fuera del dominio de entrenamiento"); }

  score = clamp(score, 0, 100);
  return {
    category: "Losas",
    suitability: suitabilityFromScore(score),
    score,
    justification: `Compresion ${fc.toFixed(1)} MPa, flexion ${fr.toFixed(2)} MPa. ${fc >= 25 ? "Apto" : "Insuficiente"} para losas de hormigon.`,
    advantages, risks,
  };
};

// ── 2. Vigas ──
const evalVigas: Evaluator = (p) => {
  const fc = p.mechanical.compressiveStrength;
  const fr = p.mechanical.flexuralStrength;
  const E = p.mechanical.elasticModulus;
  const advantages: string[] = [];
  const risks: string[] = [];
  let score = 50;

  if (fc >= 28) { score += 15; advantages.push(`Compresion ${fc.toFixed(1)} MPa adecuada para vigas`); }
  else { score -= 20; risks.push(`Compresion ${fc.toFixed(1)} MPa por debajo del minimo para vigas (28 MPa)`); }

  if (fr >= 3.5) { score += 15; advantages.push(`Flexion ${fr.toFixed(2)} MPa — buena resistencia a momentos flectores`); }
  else { score -= 10; risks.push(`Flexion baja — margen estructural limitado`); }

  if (E >= 25000) { score += 10; advantages.push(`E = ${(E/1000).toFixed(1)} GPa — rigidez adecuada para control de deflexion`); }
  else { score -= 10; risks.push(`E = ${(E/1000).toFixed(1)} GPa bajo — riesgo de deflexion excesiva`); }

  if (p.mechanical.rigidityIndex >= 10) { score += 5; advantages.push(`Indice de rigidez ${p.mechanical.rigidityIndex.toFixed(1)} — eficiencia estructural`); }

  if (p.physical.waterCementRatio < 0.50) { score += 5; advantages.push("W/C favorable para durabilidad"); }
  if (p.confidence.r2 != null && p.confidence.r2 < 0.80) { score -= 5; risks.push("Confianza del modelo moderada para decision estructural"); }

  score = clamp(score, 0, 100);
  return {
    category: "Vigas",
    suitability: suitabilityFromScore(score),
    score,
    justification: `Compresion ${fc.toFixed(1)} MPa, flexion ${fr.toFixed(2)} MPa, E = ${(E/1000).toFixed(1)} GPa. ${fc >= 28 ? "Apto" : "Insuficiente"} para vigas.`,
    advantages, risks,
  };
};

// ── 3. Columnas ──
const evalColumnas: Evaluator = (p) => {
  const fc = p.mechanical.compressiveStrength;
  const E = p.mechanical.elasticModulus;
  const advantages: string[] = [];
  const risks: string[] = [];
  let score = 50;

  if (fc >= 30) { score += 20; advantages.push(`Compresion ${fc.toFixed(1)} MPa adecuada para columnas`); }
  else if (fc >= 21) { score -= 5; risks.push(`Compresion ${fc.toFixed(1)} MPa marginal — usar con seccion amplia`); }
  else { score -= 25; risks.push(`Compresion ${fc.toFixed(1)} MPa insuficiente para columnas (min. 21 MPa)`); }

  if (E >= 28000) { score += 10; advantages.push("Alta rigidez — resistencia al pandeo"); }
  else if (E < 22000) { score -= 10; risks.push("Rigidez baja — evaluar esbeltez y pandeo"); }

  if (p.physical.porosity < 14) { score += 5; advantages.push("Baja porosidad — durabilidad alta"); }
  else if (p.physical.porosity > 18) { score -= 5; risks.push("Porosidad elevada"); }

  if (p.mechanical.rigidityIndex >= 12) { score += 5; advantages.push(`Indice de rigidez ${p.mechanical.rigidityIndex.toFixed(1)} — buena eficiencia ante pandeo`); }

  if (p.physical.density >= 2300) { score += 5; advantages.push("Densidad consistente con hormigon estructural"); }
  if (p.confidence.domainWarnings.length > 0) { score -= 5; risks.push("Advertencias de dominio del modelo"); }

  score = clamp(score, 0, 100);
  return {
    category: "Columnas",
    suitability: suitabilityFromScore(score),
    score,
    justification: `Compresion ${fc.toFixed(1)} MPa, E = ${(E/1000).toFixed(1)} GPa. ${fc >= 30 ? "Apto" : fc >= 21 ? "Marginal" : "Insuficiente"} para columnas.`,
    advantages, risks,
  };
};

// ── 4. Prefabricados ──
const evalPrefabricados: Evaluator = (p) => {
  const fc = p.mechanical.compressiveStrength;
  const fr = p.mechanical.flexuralStrength;
  const advantages: string[] = [];
  const risks: string[] = [];
  let score = 50;

  if (fc >= 30 && fc <= 55) { score += 15; advantages.push(`Compresion ${fc.toFixed(1)} MPa en rango optimo para prefabricados`); }
  else if (fc >= 25) { score += 5; }
  else { score -= 15; risks.push("Resistencia baja para prefabricados"); }

  if (fr >= 3.0) { score += 10; advantages.push("Flexion adecuada para desmolde y transporte"); }
  else { score -= 5; risks.push("Flexion baja — riesgo en manipulacion temprana"); }

  if (p.mechanical.confidenceInterval) {
    const ciWidth = p.mechanical.confidenceInterval.upper - p.mechanical.confidenceInterval.lower;
    if (ciWidth < 10) { score += 10; advantages.push("Baja incertidumbre — produccion predecible"); }
    else if (ciWidth > 20) { score -= 10; risks.push("Alta incertidumbre — riesgo en produccion en serie"); }
  }

  if (p.sustainability.sustainabilityScore > 50) { score += 5; advantages.push("Perfil sostenible para produccion industrial"); }
  if (p.physical.shrinkageTendency === "Baja") { score += 5; advantages.push("Baja retraccion — desmolde temprano viable"); }
  else if (p.physical.shrinkageTendency === "Alta") { score -= 10; risks.push("Alta retraccion dificulta fabricacion"); }

  score = clamp(score, 0, 100);
  return {
    category: "Prefabricados",
    suitability: suitabilityFromScore(score),
    score,
    justification: `Compresion ${fc.toFixed(1)} MPa, flexion ${fr.toFixed(2)} MPa. ${fc >= 30 ? "Adecuado" : "Limitado"} para prefabricados.`,
    advantages, risks,
  };
};

// ── 5. Pavimentos ──
const evalPavimentos: Evaluator = (p) => {
  const fc = p.mechanical.compressiveStrength;
  const fr = p.mechanical.flexuralStrength;
  const ft = p.mechanical.tensileStrength;
  const advantages: string[] = [];
  const risks: string[] = [];
  let score = 50;

  // Pavements rely heavily on flexural strength
  if (fr >= 4.0) { score += 20; advantages.push(`Flexion ${fr.toFixed(2)} MPa excelente para pavimentos`); }
  else if (fr >= 3.0) { score += 10; advantages.push(`Flexion ${fr.toFixed(2)} MPa adecuada`); }
  else { score -= 15; risks.push(`Flexion ${fr.toFixed(2)} MPa insuficiente para cargas de transito`); }

  if (fc >= 28) { score += 10; advantages.push("Compresion suficiente para pavimento"); }
  else { score -= 10; risks.push("Compresion baja para cargas de transito"); }

  if (ft >= 3.0) { score += 5; advantages.push("Buena traccion indirecta"); }

  if (p.physical.porosity < 15) { score += 5; advantages.push("Baja porosidad — durabilidad ante agentes externos"); }
  else if (p.physical.porosity > 20) { score -= 5; risks.push("Porosidad alta — deterioro por ciclos de humedad"); }

  if (p.physical.shrinkageTendency === "Alta") { score -= 10; risks.push("Alta retraccion — riesgo de fisuracion en losa de pavimento"); }

  score = clamp(score, 0, 100);
  return {
    category: "Pavimentos",
    suitability: suitabilityFromScore(score),
    score,
    justification: `Flexion ${fr.toFixed(2)} MPa (critica para pavimentos), compresion ${fc.toFixed(1)} MPa. ${fr >= 3.0 ? "Apto" : "Insuficiente"}.`,
    advantages, risks,
  };
};

// ── 6. Mobiliario Urbano ──
const evalMobiliarioUrbano: Evaluator = (p) => {
  const fc = p.mechanical.compressiveStrength;
  const ft = p.mechanical.tensileStrength;
  const E = p.mechanical.elasticModulus;
  const advantages: string[] = [];
  const risks: string[] = [];
  let score = 50;

  if (fc >= 20 && fc <= 45) { score += 15; advantages.push(`Compresion ${fc.toFixed(1)} MPa en rango para mobiliario urbano`); }
  else if (fc < 20) { score -= 15; risks.push("Resistencia baja para uso publico"); }
  else { score += 10; advantages.push("Alta resistencia — permite secciones esbeltas"); }

  if (ft >= 2.0) { score += 10; advantages.push("Traccion adecuada para impactos y cargas dinamicas"); }
  else { score -= 5; risks.push("Traccion limitada — sensible a impactos"); }

  if (E >= 20000) { score += 5; advantages.push("Rigidez adecuada"); }

  if (p.physical.density < 2300) { score += 5; advantages.push("Densidad moderada — facilita instalacion"); }
  if (p.sustainability.sustainabilityScore > 40) { score += 10; advantages.push("Aporte sostenible valorable en obra publica"); }
  if (p.physical.waterCementRatio < 0.50) { score += 5; advantages.push("W/C favorable para durabilidad a intemperie"); }
  else if (p.physical.waterCementRatio > 0.55) { score -= 5; risks.push("W/C alto — menor durabilidad exterior"); }

  score = clamp(score, 0, 100);
  return {
    category: "Mobiliario Urbano",
    suitability: suitabilityFromScore(score),
    score,
    justification: `Compresion ${fc.toFixed(1)} MPa, traccion ${ft.toFixed(2)} MPa. ${fc >= 20 ? "Adecuado" : "Insuficiente"} para mobiliario urbano.`,
    advantages, risks,
  };
};

// ── 7. Paneles Arquitectonicos ──
const evalPanelesArquitectonicos: Evaluator = (p) => {
  const fc = p.mechanical.compressiveStrength;
  const fr = p.mechanical.flexuralStrength;
  const advantages: string[] = [];
  const risks: string[] = [];
  let score = 50;

  if (fc >= 25 && fc <= 50) { score += 15; advantages.push(`Compresion ${fc.toFixed(1)} MPa adecuada para paneles`); }
  else if (fc < 25) { score -= 15; risks.push("Resistencia insuficiente para panel"); }
  else { score += 5; advantages.push("Alta resistencia"); }

  if (fr >= 3.0) { score += 10; advantages.push(`Flexion ${fr.toFixed(2)} MPa — resistencia al viento y cargas laterales`); }
  else { score -= 5; risks.push("Flexion baja para cargas laterales"); }

  if (p.physical.porosity < 15) { score += 10; advantages.push("Baja porosidad — acabado superficial denso"); }
  else if (p.physical.porosity > 18) { score -= 5; risks.push("Porosidad puede afectar estetica"); }

  if (p.physical.shrinkageTendency === "Baja") { score += 5; advantages.push("Estabilidad dimensional"); }
  else if (p.physical.shrinkageTendency === "Alta") { score -= 10; risks.push("Retraccion puede causar deformacion visible"); }

  if (p.sustainability.sustainabilityScore > 50) { score += 5; advantages.push("Perfil sostenible — valor para certificaciones"); }

  score = clamp(score, 0, 100);
  return {
    category: "Paneles Arquitectonicos",
    suitability: suitabilityFromScore(score),
    score,
    justification: `Compresion ${fc.toFixed(1)} MPa, flexion ${fr.toFixed(2)} MPa. ${fc >= 25 ? "Adecuado" : "Insuficiente"} para paneles arquitectonicos.`,
    advantages, risks,
  };
};

// ── 8. Revestimientos Estructurales ──
const evalRevestimientosEstructurales: Evaluator = (p) => {
  const fc = p.mechanical.compressiveStrength;
  const ft = p.mechanical.tensileStrength;
  const E = p.mechanical.elasticModulus;
  const advantages: string[] = [];
  const risks: string[] = [];
  let score = 50;

  if (fc >= 20 && fc <= 40) { score += 15; advantages.push(`Compresion ${fc.toFixed(1)} MPa adecuada para revestimiento estructural`); }
  else if (fc > 40) { score += 10; advantages.push("Resistencia superior — sobredimensionado para revestimiento"); }
  else { score -= 15; risks.push("Resistencia insuficiente para revestimiento con funcion estructural"); }

  if (ft >= 2.0) { score += 10; advantages.push("Traccion adecuada — adherencia al sustrato"); }
  else { score -= 5; risks.push("Traccion limitada — riesgo de desprendimiento"); }

  if (E >= 20000 && E <= 35000) { score += 5; advantages.push("Modulo compatible con sustrato"); }
  else if (E > 35000) { score -= 5; risks.push("Rigidez excesiva — incompatibilidad con sustrato flexible"); }

  if (p.physical.porosity < 16) { score += 5; advantages.push("Buena compacidad superficial"); }
  else { score -= 5; risks.push("Porosidad puede afectar impermeabilidad"); }

  if (p.physical.shrinkageTendency === "Baja") { score += 5; advantages.push("Baja retraccion — menor fisuracion"); }
  else if (p.physical.shrinkageTendency === "Alta") { score -= 10; risks.push("Alta retraccion genera fisuras en capa delgada"); }

  if (p.physical.waterCementRatio < 0.50) { score += 5; advantages.push("W/C bajo — durabilidad"); }
  if (p.physical.waterBinderRatio < 0.45) { score += 5; advantages.push(`W/B ${p.physical.waterBinderRatio.toFixed(2)} — buena compacidad`); }

  score = clamp(score, 0, 100);
  return {
    category: "Revestimientos Estructurales",
    suitability: suitabilityFromScore(score),
    score,
    justification: `Compresion ${fc.toFixed(1)} MPa, traccion ${ft.toFixed(2)} MPa, E = ${(E/1000).toFixed(1)} GPa. ${fc >= 20 ? "Apto" : "Insuficiente"} para revestimiento estructural.`,
    advantages, risks,
  };
};

// ── Public API ──

const EVALUATORS: Evaluator[] = [
  evalLosas,
  evalVigas,
  evalColumnas,
  evalPrefabricados,
  evalPavimentos,
  evalMobiliarioUrbano,
  evalPanelesArquitectonicos,
  evalRevestimientosEstructurales,
];

export function recommendApplications(properties: DerivedMaterialProperties): ApplicationEvaluation[] {
  return EVALUATORS
    .map((evaluator) => evaluator(properties))
    .sort((a, b) => b.score - a.score);
}
