import { jsPDF } from "jspdf";

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

const COMPONENT_LABELS: Record<string, { name: string; unit: string }> = {
  cement: { name: "Cemento", unit: "kg/m³" },
  fly_ash: { name: "Ceniza Volante", unit: "kg/m³" },
  water: { name: "Agua", unit: "kg/m³" },
  superplasticizer: { name: "Superplastificante", unit: "kg/m³" },
  fine_aggregate: { name: "Árido Fino", unit: "kg/m³" },
  coarse_aggregate: { name: "Árido Grueso", unit: "kg/m³" },
  age: { name: "Edad", unit: "días" },
};

export function generateFichaTecnica(config: ConfigItem) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 0;

  // --- Header bar ---
  doc.setFillColor(25, 118, 210); // MUI primary blue
  doc.rect(0, 0, pageWidth, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA TÉCNICA DE MATERIAL", pageWidth / 2, 16, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("MDI — Material Design Intelligence", pageWidth / 2, 28, { align: "center" });

  y = 50;
  doc.setTextColor(0, 0, 0);

  // --- Identification section ---
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Identificación", 14, y);
  y += 2;
  doc.setDrawColor(25, 118, 210);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const idRows = [
    ["Etiqueta", config.label],
    ["ID", config.id],
    ["Fecha de generación", new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })],
  ];
  for (const [label, value] of idRows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 18, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 65, y);
    y += 7;
  }

  y += 6;

  // --- Composition table ---
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Composición del Material", 14, y);
  y += 2;
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  // Table header
  const col1 = 18;
  const col2 = 110;
  const col3 = 155;

  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 4, pageWidth - 28, 8, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Componente", col1, y);
  doc.text("Valor", col2, y, { align: "right" });
  doc.text("Unidad", col3, y);
  y += 8;

  // Table rows
  doc.setFont("helvetica", "normal");
  const keys = Object.keys(COMPONENT_LABELS);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const info = COMPONENT_LABELS[key];
    const val = config.values[key];

    if (i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, pageWidth - 28, 7, "F");
    }

    doc.text(info.name, col1, y);
    doc.text(val !== undefined ? val.toFixed(1) : "-", col2, y, { align: "right" });
    doc.text(info.unit, col3, y);
    y += 7;
  }

  y += 10;

  // --- Prediction section ---
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Predicción", 14, y);
  y += 2;
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  doc.setFontSize(10);

  // Predicted strength — highlighted
  doc.setFillColor(227, 242, 253); // light blue background
  doc.rect(14, y - 5, pageWidth - 28, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Resistencia a compresión:", 18, y);
  doc.setFontSize(12);
  doc.text(`${config.predicted_strength.toFixed(1)} MPa`, col2, y, { align: "right" });
  y += 12;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Intervalo de confianza (95%):", 18, y);
  doc.setFont("helvetica", "normal");
  const ciText =
    config.lower_bound != null && config.upper_bound != null
      ? `[${config.lower_bound.toFixed(1)} — ${config.upper_bound.toFixed(1)}] MPa`
      : "No disponible";
  doc.text(ciText, col2, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text("Modelo:", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text(config.model_id, 65, y);
  y += 12;

  // --- Status section ---
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Estado", 14, y);
  y += 2;
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Candidato a validación:", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text(config.is_candidate ? "Sí" : "No", 80, y);

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text("Generado por MDI — Material Design Intelligence", pageWidth / 2, footerY, { align: "center" });

  // Save
  const safeName = config.label.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`ficha_${safeName}.pdf`);
}
