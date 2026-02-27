import { jsPDF } from "jspdf";
import type { DerivedMaterialProperties } from "./materialProperties";
import { computeDerivedProperties, type Composition } from "./materialProperties";
import { recommendApplications } from "./designInterpretation";

// ── Legacy interface for backward compatibility ──
interface ConfigItem {
  id: string;
  label: string;
  values: Record<string, number>;
  model_id: string;
  predicted_strength: number;
  lower_bound: number | null;
  upper_bound: number | null;
  is_candidate: boolean;
}

export const COMPONENT_LABELS: Record<string, { name: string; unit: string }> = {
  cement: { name: "Cemento", unit: "kg/m\u00B3" },
  blast_furnace_slag: { name: "Escoria de Alto Horno", unit: "kg/m\u00B3" },
  fly_ash: { name: "Ceniza Volante", unit: "kg/m\u00B3" },
  water: { name: "Agua", unit: "kg/m\u00B3" },
  superplasticizer: { name: "Superplastificante", unit: "kg/m\u00B3" },
  coarse_aggregate: { name: "\u00C1rido Grueso", unit: "kg/m\u00B3" },
  fine_aggregate: { name: "\u00C1rido Fino", unit: "kg/m\u00B3" },
  age: { name: "Edad", unit: "d\u00EDas" },
};

// ── Helpers ──

export function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 25) {
    doc.addPage();
    return 20;
  }
  return y;
}

export function addFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Generado por MDI \u2014 Material Design Intelligence | P\u00E1gina ${i} de ${totalPages}`, pageWidth / 2, footerY, { align: "center" });
  }
}

export function sectionHeader(doc: jsPDF, label: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  y = checkPageBreak(doc, y, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(25, 118, 210);
  doc.text(label, 14, y);
  y += 2;
  doc.setDrawColor(25, 118, 210);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 7;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  return y;
}

export function labelValue(doc: jsPDF, label: string, value: string, y: number, labelX = 18, valueX = 90): number {
  y = checkPageBreak(doc, y, 8);
  doc.setFont("helvetica", "bold");
  doc.text(`${label}:`, labelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(value, valueX, y);
  return y + 6;
}

export function labelValueTag(doc: jsPDF, label: string, value: string, tag: string, y: number): number {
  y = checkPageBreak(doc, y, 8);
  doc.setFont("helvetica", "bold");
  doc.text(`${label}:`, 18, y);
  doc.setFont("helvetica", "normal");
  doc.text(value, 90, y);
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(`[${tag}]`, 140, y);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  return y + 6;
}

// ── Main PDF generator (7 sections) ──

export function generateAdvancedPDF(props: DerivedMaterialProperties) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const comp = props.composition;

  // --- Header bar ---
  doc.setFillColor(25, 118, 210);
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA T\u00C9CNICA EXPERIMENTAL", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("MDI \u2014 Material Design Intelligence", pageWidth / 2, 26, { align: "center" });

  let y = 44;
  doc.setTextColor(0, 0, 0);

  // --- 4.1 Identificacion ---
  y = sectionHeader(doc, "4.1 Identificaci\u00F3n", y);
  y = labelValue(doc, "Etiqueta", props.configLabel, y);
  y = labelValue(doc, "Fecha", new Date(props.generatedAt).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }), y);
  y = labelValue(doc, "Dataset", props.datasetName, y);
  y = labelValue(doc, "Modelo", props.modelId, y);
  y += 3;

  // --- 4.2 Formulacion ---
  y = sectionHeader(doc, "4.2 Formulaci\u00F3n Completa", y);

  const col1 = 18, col2 = 100, col3 = 128, col4 = 170;

  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 4, pageWidth - 28, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Componente", col1, y);
  doc.text("Valor", col2, y, { align: "right" });
  doc.text("Unidad", col3, y);
  doc.text("% Rel.", col4, y, { align: "right" });
  y += 7;

  const totalMass = Object.entries(comp)
    .filter(([k]) => k !== "age")
    .reduce((sum, [, v]) => sum + (v || 0), 0);
  const totalBinder = (comp.cement || 0) + (comp.fly_ash || 0) + (comp.blast_furnace_slag || 0);
  const substPct = totalBinder > 0 ? (((comp.fly_ash || 0) + (comp.blast_furnace_slag || 0)) / totalBinder * 100) : 0;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const keys = Object.keys(COMPONENT_LABELS);
  for (let i = 0; i < keys.length; i++) {
    y = checkPageBreak(doc, y, 7);
    const key = keys[i];
    const info = COMPONENT_LABELS[key];
    const val = comp[key as keyof typeof comp] ?? 0;
    const pct = key !== "age" && totalMass > 0 ? ((val / totalMass) * 100).toFixed(1) + "%" : "-";

    if (i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, pageWidth - 28, 6, "F");
    }
    doc.text(info.name, col1, y);
    doc.text(val.toFixed(1), col2, y, { align: "right" });
    doc.text(info.unit, col3, y);
    doc.text(pct, col4, y, { align: "right" });
    y += 6;
  }

  y += 3;
  doc.setFontSize(10);
  y = labelValue(doc, "Relaci\u00F3n A/C", props.physical.waterCementRatio.toFixed(2), y);
  y = labelValue(doc, "Relaci\u00F3n A/B", props.physical.waterBinderRatio.toFixed(2), y);
  y = labelValue(doc, "% Sustituci\u00F3n cemento", `${substPct.toFixed(1)}%`, y);
  y = labelValue(doc, "Total aglomerantes", `${totalBinder.toFixed(1)} kg/m\u00B3`, y);
  y += 3;

  // --- 4.3 Propiedades Estructurales ---
  y = sectionHeader(doc, "4.3 Propiedades Estructurales Predichas", y);

  // Highlighted main value
  y = checkPageBreak(doc, y, 10);
  doc.setFillColor(227, 242, 253);
  doc.rect(14, y - 5, pageWidth - 28, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Resistencia a compresi\u00F3n (f'c):", 18, y);
  doc.setFontSize(11);
  doc.text(`${props.mechanical.compressiveStrength.toFixed(1)} MPa`, col2 + 20, y, { align: "right" });
  doc.setFontSize(8);
  doc.text("[ML]", col2 + 25, y);
  doc.setFontSize(10);
  y += 10;

  if (props.mechanical.confidenceInterval) {
    y = labelValue(doc, "IC 95%", `[${props.mechanical.confidenceInterval.lower.toFixed(1)} \u2014 ${props.mechanical.confidenceInterval.upper.toFixed(1)}] MPa`, y);
  }
  y = labelValueTag(doc, "Tracci\u00F3n estimada", `${props.mechanical.tensileStrength.toFixed(2)} MPa`, "Derivada: 0.10 x f'c", y);
  y = labelValueTag(doc, "Flexi\u00F3n estimada", `${props.mechanical.flexuralStrength.toFixed(2)} MPa`, "Derivada: 0.62 x sqrt(f'c)", y);
  y = labelValueTag(doc, "M\u00F3dulo de Elasticidad", `${(props.mechanical.elasticModulus / 1000).toFixed(1)} GPa (${props.mechanical.elasticModulus.toFixed(0)} MPa)`, "Derivada: 4700 x sqrt(f'c)", y);
  y = labelValueTag(doc, "\u00CDndice de Fragilidad", `${(props.mechanical.fragilityIndex * 1000).toFixed(2)} x10\u207B\u00B3`, "f'c / E", y);
  y = labelValueTag(doc, "\u00CDndice de Rigidez", `${props.mechanical.rigidityIndex.toFixed(2)} MPa\u00B7m\u00B3/kg`, "E / densidad", y);
  y += 3;

  // --- 4.4 Propiedades Fisicas ---
  y = sectionHeader(doc, "4.4 Propiedades F\u00EDsicas", y);
  y = labelValue(doc, "Relaci\u00F3n A/C", props.physical.waterCementRatio.toFixed(2), y);
  y = labelValue(doc, "Relaci\u00F3n A/B", props.physical.waterBinderRatio.toFixed(2), y);
  y = labelValue(doc, "Porosidad estimada", `${props.physical.porosity.toFixed(1)}%`, y);
  y = labelValue(doc, "Densidad estimada", `${props.physical.density.toFixed(0)} kg/m\u00B3`, y);
  y = labelValue(doc, "Fraguado estimado", props.physical.settingTime, y);
  y = labelValue(doc, "Tendencia retraccion", props.physical.shrinkageTendency, y);
  y += 3;

  // --- 4.5 Aplicaciones Recomendadas ---
  y = sectionHeader(doc, "4.5 Aplicaciones Recomendadas", y);

  const evaluations = recommendApplications(props);

  // Table header
  y = checkPageBreak(doc, y, 10);
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 4, pageWidth - 28, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Aplicaci\u00F3n", 18, y);
  doc.text("Adecuaci\u00F3n", 85, y);
  doc.text("Justificaci\u00F3n", 115, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (let i = 0; i < evaluations.length; i++) {
    y = checkPageBreak(doc, y, 10);
    const ev = evaluations[i];
    if (i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, pageWidth - 28, 8, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.text(ev.category, 18, y);
    doc.setFont("helvetica", "normal");

    // Suitability color
    if (ev.suitability === "Alta") doc.setTextColor(76, 175, 80);
    else if (ev.suitability === "Media") doc.setTextColor(255, 152, 0);
    else doc.setTextColor(244, 67, 54);
    doc.text(ev.suitability, 85, y);
    doc.setTextColor(0, 0, 0);

    // Justification (truncate if needed)
    const just = ev.justification.length > 55 ? ev.justification.slice(0, 52) + "..." : ev.justification;
    doc.text(just, 115, y);
    y += 8;
  }
  y += 3;
  doc.setFontSize(10);

  // --- 4.6 Protocolo de Fabricacion ---
  y = sectionHeader(doc, "4.6 Protocolo de Fabricaci\u00F3n Sugerido", y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  y = checkPageBreak(doc, y, 50);
  doc.text("Orden de mezclado:", 18, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const steps = [
    "1. Mezclar \u00E1ridos gruesos y finos en seco (30 seg)",
    `2. Agregar cemento${comp.blast_furnace_slag > 0 ? ", escoria" : ""}${comp.fly_ash > 0 ? " y ceniza volante" : ""} \u2014 mezclar en seco (30 seg)`,
    "3. Agregar 75% del agua \u2014 mezclar (60 seg)",
    comp.superplasticizer > 0
      ? "4. Agregar superplastificante diluido en 25% de agua restante \u2014 mezclar (90 seg)"
      : "4. Agregar 25% de agua restante \u2014 mezclar (90 seg)",
    "5. Mezclar hasta homogeneidad total (60-120 seg adicionales)",
  ];
  for (const step of steps) {
    doc.text(step, 22, y);
    y += 5;
  }
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.text("Tiempo total de mezclado:", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text("4-5 minutos", 80, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Edades recomendadas de ensayo:", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text("7, 14 y 28 d\u00EDas", 90, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Ensayos sugeridos:", 18, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("\u2022 Compresi\u00F3n uniaxial (cilindro 150x300 mm o cubo 150 mm)", 22, y); y += 5;
  doc.text("\u2022 Flexi\u00F3n a 3 puntos (prisma 100x100x400 mm)", 22, y); y += 5;
  doc.text("\u2022 Tracci\u00F3n indirecta (ensayo brasile\u00F1o, cilindro 150x300 mm)", 22, y); y += 5;
  y += 3;

  // --- 4.7 Validacion Experimental ---
  y = sectionHeader(doc, "4.7 Validaci\u00F3n Experimental", y);
  doc.setFontSize(10);

  y = checkPageBreak(doc, y, 40);

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 4, pageWidth - 28, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Propiedad", 18, y);
  doc.text("Predicho", 75, y, { align: "right" });
  doc.text("Medido", 105, y, { align: "right" });
  doc.text("Error Abs.", 135, y, { align: "right" });
  doc.text("Error %", 160, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  const valRows = [
    { name: "Compresi\u00F3n (MPa)", predicted: props.mechanical.compressiveStrength.toFixed(1) },
    { name: "Flexi\u00F3n (MPa)", predicted: props.mechanical.flexuralStrength.toFixed(2) },
    { name: "Tracci\u00F3n (MPa)", predicted: props.mechanical.tensileStrength.toFixed(2) },
  ];
  for (let i = 0; i < valRows.length; i++) {
    y = checkPageBreak(doc, y, 7);
    if (i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, pageWidth - 28, 7, "F");
    }
    doc.text(valRows[i].name, 18, y);
    doc.text(valRows[i].predicted, 75, y, { align: "right" });
    doc.text("________", 105, y, { align: "right" });
    doc.text("________", 135, y, { align: "right" });
    doc.text("________", 160, y, { align: "right" });
    y += 7;
  }

  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Completar campos en blanco con resultados de laboratorio.", 18, y);
  doc.setTextColor(0, 0, 0);

  // --- Confidence block ---
  y += 8;
  y = checkPageBreak(doc, y, 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(25, 118, 210);
  doc.text("Confianza del Modelo", 14, y);
  y += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  if (props.confidence.r2 != null) {
    y = labelValue(doc, "R\u00B2", props.confidence.r2.toFixed(3), y);
  }
  if (props.confidence.mae != null) {
    y = labelValue(doc, "MAE", `${props.confidence.mae.toFixed(2)} MPa`, y);
  }

  if (props.confidence.domainWarnings.length > 0) {
    y = checkPageBreak(doc, y, 8 + props.confidence.domainWarnings.length * 5);
    doc.setFillColor(255, 243, 224);
    const boxH = 6 + props.confidence.domainWarnings.length * 5;
    doc.rect(14, y - 4, pageWidth - 28, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Advertencias de dominio:", 18, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const w of props.confidence.domainWarnings) {
      doc.text(`\u2022 ${w}`, 22, y);
      y += 5;
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(76, 175, 80);
    doc.setFontSize(9);
    doc.text("\u2713 Todos los valores dentro del dominio de entrenamiento", 18, y);
    doc.setTextColor(0, 0, 0);
  }

  // --- Footers ---
  addFooters(doc);

  // Save
  const safeName = props.configLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`ficha_experimental_${safeName}.pdf`);
}

// ── Legacy wrapper ──
export function generateFichaTecnica(config: ConfigItem) {
  const composition: Composition = {
    cement: config.values.cement ?? 0,
    blast_furnace_slag: config.values.blast_furnace_slag ?? 0,
    fly_ash: config.values.fly_ash ?? 0,
    water: config.values.water ?? 0,
    superplasticizer: config.values.superplasticizer ?? 0,
    coarse_aggregate: config.values.coarse_aggregate ?? 0,
    fine_aggregate: config.values.fine_aggregate ?? 0,
    age: config.values.age ?? 0,
  };

  const derived = computeDerivedProperties({
    composition,
    predictedStrength: config.predicted_strength,
    lowerBound: config.lower_bound,
    upperBound: config.upper_bound,
    r2: null,
    mae: null,
    modelId: config.model_id,
    configLabel: config.label,
  });

  generateAdvancedPDF(derived);
}
