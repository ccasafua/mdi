// ── Structural Design PDF Report ──
// Generates a PDF report for the structural design assistant,
// including problem definition, demands, candidate verification, and recommendations.

import { jsPDF } from "jspdf";
import type { DerivedMaterialProperties } from "./materialProperties";
import type { StructuralInput, StructuralDemands, StructuralVerification } from "./structuralAnalysis";
import { ELEMENT_LABELS, SUPPORT_LABELS, LOAD_TYPE_LABELS } from "./structuralAnalysis";
import { recommendApplications } from "./designInterpretation";
import {
  checkPageBreak, sectionHeader, labelValue, labelValueTag,
  addFooters, COMPONENT_LABELS,
} from "./generatePDF";

interface CandidateReport {
  properties: DerivedMaterialProperties;
  verification: StructuralVerification;
}

export function generateStructuralPDF(
  input: StructuralInput,
  demands: StructuralDemands,
  candidates: CandidateReport[],
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header bar ──
  doc.setFillColor(25, 118, 210);
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("INFORME DE DISE\u00D1O ESTRUCTURAL", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("MDI \u2014 Material Design Intelligence", pageWidth / 2, 26, { align: "center" });

  let y = 44;
  doc.setTextColor(0, 0, 0);

  // ── 1. Definicion del Problema ──
  y = sectionHeader(doc, "1. Definici\u00F3n del Problema", y);
  y = labelValue(doc, "Tipo de elemento", ELEMENT_LABELS[input.elementType], y);
  y = labelValue(doc, "Luz / Longitud", `${input.span.toFixed(2)} m`, y);
  y = labelValue(doc, "Ancho (b)", `${input.width.toFixed(2)} m`, y);
  y = labelValue(doc, "Altura (h)", `${input.height.toFixed(2)} m`, y);

  if (input.elementType === "columna") {
    y = labelValue(doc, "Carga axial", `${input.loadValue.toFixed(1)} kN`, y);
    y = labelValue(doc, "Factor K", `${(input.columnK ?? 1.0).toFixed(1)}`, y);
  } else {
    y = labelValue(doc, "Condici\u00F3n de apoyo", SUPPORT_LABELS[input.support], y);
    y = labelValue(doc, "Tipo de carga", LOAD_TYPE_LABELS[input.loadType], y);
    y = labelValue(doc, "Valor de carga", `${input.loadValue.toFixed(1)} ${input.loadType === "distributed" ? "kN/m" : "kN"}`, y);
  }

  y = labelValue(doc, "L\u00EDmite de deflexi\u00F3n", `L/${input.deflectionLimit}`, y);
  y = labelValue(doc, "Factor de seguridad", input.safetyFactor.toFixed(1), y);
  y = labelValue(doc, "Edad de dise\u00F1o", `${input.age} d\u00EDas`, y);
  y += 3;

  // ── 2. Demandas Estructurales ──
  y = sectionHeader(doc, "2. Demandas Estructurales Calculadas", y);

  if (input.elementType !== "columna") {
    y = labelValue(doc, "Momento m\u00E1ximo (M_max)", `${demands.Mmax.toFixed(2)} kN\u00B7m`, y);
  }
  y = labelValue(doc, "Tensi\u00F3n m\u00E1xima (\u03C3_max)", `${demands.sigmaMax.toFixed(2)} MPa`, y);
  y = labelValue(doc, "f'c requerido", `${demands.requiredFc.toFixed(1)} MPa`, y);
  y = labelValue(doc, "E requerido", `${demands.requiredE.toFixed(2)} GPa`, y);
  y = labelValue(doc, "Deflexi\u00F3n admisible (\u03B4_max)", `${demands.deltaMax.toFixed(1)} mm`, y);
  y += 2;

  // Formula
  y = checkPageBreak(doc, y, 12);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const formulaLines = doc.splitTextToSize(`F\u00F3rmula: ${demands.formulaUsed}`, pageWidth - 36);
  doc.text(formulaLines, 18, y);
  y += formulaLines.length * 4 + 4;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  y += 3;

  // ── 3. Candidatos ──
  candidates.forEach((cand, idx) => {
    const p = cand.properties;
    const v = cand.verification;
    const comp = p.composition;

    y = sectionHeader(doc, `3.${idx + 1} Mezcla Candidata #${idx + 1}`, y);

    // Composition table
    y = checkPageBreak(doc, y, 10);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 4, pageWidth - 28, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Componente", 18, y);
    doc.text("Valor", 100, y, { align: "right" });
    doc.text("Unidad", 128, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    const keys = Object.keys(COMPONENT_LABELS);
    for (let i = 0; i < keys.length; i++) {
      y = checkPageBreak(doc, y, 7);
      const key = keys[i];
      const info = COMPONENT_LABELS[key];
      const val = comp[key as keyof typeof comp] ?? 0;
      if (i % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(14, y - 4, pageWidth - 28, 6, "F");
      }
      doc.text(info.name, 18, y);
      doc.text(val.toFixed(1), 100, y, { align: "right" });
      doc.text(info.unit, 128, y);
      y += 6;
    }
    y += 3;
    doc.setFontSize(10);

    // Predicted properties
    y = checkPageBreak(doc, y, 10);
    doc.setFillColor(227, 242, 253);
    doc.rect(14, y - 5, pageWidth - 28, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.text("f'c predicho:", 18, y);
    doc.text(`${p.mechanical.compressiveStrength.toFixed(1)} MPa`, 100, y, { align: "right" });
    doc.setFontSize(8);
    doc.text("[ML]", 105, y);
    doc.setFontSize(10);
    y += 10;

    y = labelValueTag(doc, "Tracci\u00F3n", `${p.mechanical.tensileStrength.toFixed(2)} MPa`, "Derivada", y);
    y = labelValueTag(doc, "Flexi\u00F3n", `${p.mechanical.flexuralStrength.toFixed(2)} MPa`, "Derivada", y);
    y = labelValueTag(doc, "M\u00F3dulo E", `${(p.mechanical.elasticModulus / 1000).toFixed(1)} GPa`, "Derivada", y);
    y += 3;

    // Structural verification table
    y = checkPageBreak(doc, y, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Verificaci\u00F3n Estructural", 18, y);
    y += 7;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 4, pageWidth - 28, 7, "F");
    doc.setFontSize(9);
    doc.text("Par\u00E1metro", 18, y);
    doc.text("Demanda", 80, y, { align: "right" });
    doc.text("Capacidad", 120, y, { align: "right" });
    doc.text("Estado", 160, y, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");

    // f'c row
    y = checkPageBreak(doc, y, 7);
    doc.text("f'c (MPa)", 18, y);
    doc.text(v.fcDemand.toFixed(1), 80, y, { align: "right" });
    doc.text(v.fcCapacity.toFixed(1), 120, y, { align: "right" });
    doc.setTextColor(v.fcOk ? 76 : 244, v.fcOk ? 175 : 67, v.fcOk ? 80 : 54);
    doc.text(v.fcOk ? "OK" : "FALLA", 160, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 6;

    // E row
    doc.setFillColor(248, 248, 248);
    doc.rect(14, y - 4, pageWidth - 28, 6, "F");
    doc.text("E (GPa)", 18, y);
    doc.text(v.eDemand.toFixed(2), 80, y, { align: "right" });
    doc.text(v.eCapacity.toFixed(2), 120, y, { align: "right" });
    doc.setTextColor(v.eOk ? 76 : 244, v.eOk ? 175 : 67, v.eOk ? 80 : 54);
    doc.text(v.eOk ? "OK" : "FALLA", 160, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 6;

    // Deflection row
    if (input.elementType !== "columna") {
      y = checkPageBreak(doc, y, 7);
      doc.text("Deflexi\u00F3n (mm)", 18, y);
      doc.text(v.deflectionLimit.toFixed(1), 80, y, { align: "right" });
      doc.text(v.deflectionCalc.toFixed(2), 120, y, { align: "right" });
      doc.setTextColor(v.deflectionOk ? 76 : 244, v.deflectionOk ? 175 : 67, v.deflectionOk ? 80 : 54);
      doc.text(v.deflectionOk ? "OK" : "FALLA", 160, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 6;
    }

    // Buckling row for columns
    if (v.bucklingOk !== null) {
      y = checkPageBreak(doc, y, 7);
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, pageWidth - 28, 6, "F");
      doc.text("Pandeo", 18, y);
      doc.text("-", 80, y, { align: "right" });
      doc.text("-", 120, y, { align: "right" });
      doc.setTextColor(v.bucklingOk ? 76 : 244, v.bucklingOk ? 175 : 67, v.bucklingOk ? 80 : 54);
      doc.text(v.bucklingOk ? "OK" : "FALLA", 160, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 6;
    }

    y += 3;

    // Verdict
    y = checkPageBreak(doc, y, 12);
    const verdictColor = v.verdict === "Cumple" ? [76, 175, 80] :
                         v.verdict === "Marginal" ? [255, 152, 0] : [244, 67, 54];
    doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
    doc.rect(14, y - 4, pageWidth - 28, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Veredicto: ${v.verdict}`, pageWidth / 2, y + 1, { align: "center" });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    y += 12;
  });

  // ── 4. Aplicaciones Recomendadas ──
  if (candidates.length > 0) {
    y = sectionHeader(doc, "4. Aplicaciones Recomendadas (Mezcla #1)", y);
    const evaluations = recommendApplications(candidates[0].properties);

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

      if (ev.suitability === "Alta") doc.setTextColor(76, 175, 80);
      else if (ev.suitability === "Media") doc.setTextColor(255, 152, 0);
      else doc.setTextColor(244, 67, 54);
      doc.text(ev.suitability, 85, y);
      doc.setTextColor(0, 0, 0);

      const just = ev.justification.length > 55 ? ev.justification.slice(0, 52) + "..." : ev.justification;
      doc.text(just, 115, y);
      y += 8;
    }
    y += 3;
    doc.setFontSize(10);
  }

  // ── 5. Protocolo Experimental ──
  y = sectionHeader(doc, "5. Protocolo Experimental Sugerido", y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  y = checkPageBreak(doc, y, 30);
  const steps = [
    "1. Mezclar \u00E1ridos gruesos y finos en seco (30 seg)",
    "2. Agregar cementantes \u2014 mezclar en seco (30 seg)",
    "3. Agregar 75% del agua \u2014 mezclar (60 seg)",
    "4. Agregar SP (si aplica) con 25% restante de agua \u2014 mezclar (90 seg)",
    "5. Mezclar hasta homogeneidad total (60-120 seg adicionales)",
  ];
  for (const step of steps) {
    doc.text(step, 22, y);
    y += 5;
  }
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.text("Ensayos sugeridos:", 18, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("\u2022 Compresi\u00F3n uniaxial (cilindro 150x300 mm)", 22, y); y += 5;
  doc.text("\u2022 Flexi\u00F3n a 3 puntos (prisma 100x100x400 mm)", 22, y); y += 5;
  doc.text("\u2022 M\u00F3dulo de elasticidad est\u00E1tico (cilindro 150x300 mm)", 22, y); y += 5;
  y += 3;
  doc.setFontSize(10);

  // ── 6. Confianza del Modelo ──
  if (candidates.length > 0) {
    const p = candidates[0].properties;
    y = checkPageBreak(doc, y, 25);
    y = sectionHeader(doc, "6. Confianza del Modelo", y);
    if (p.confidence.r2 != null) {
      y = labelValue(doc, "R\u00B2", p.confidence.r2.toFixed(3), y);
    }
    if (p.confidence.mae != null) {
      y = labelValue(doc, "MAE", `${p.confidence.mae.toFixed(2)} MPa`, y);
    }
    if (p.confidence.domainWarnings.length > 0) {
      y = checkPageBreak(doc, y, 8 + p.confidence.domainWarnings.length * 5);
      doc.setFillColor(255, 243, 224);
      const boxH = 6 + p.confidence.domainWarnings.length * 5;
      doc.rect(14, y - 4, pageWidth - 28, boxH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Advertencias de dominio:", 18, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      for (const w of p.confidence.domainWarnings) {
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
  }

  // ── Footers ──
  addFooters(doc);

  // Save
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`informe_estructural_${input.elementType}_${timestamp}.pdf`);
}
