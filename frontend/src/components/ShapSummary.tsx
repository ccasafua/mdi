import Plot from "react-plotly.js";
import { Typography, Box } from "@mui/material";

interface ShapPoint {
  feature: string;
  shap_value: number;
  feature_value: number;
}

interface ShapSummaryProps {
  points: ShapPoint[];
  featureNames: string[];
}

export default function ShapSummary({ points, featureNames }: ShapSummaryProps) {
  // Group by feature and compute mean |SHAP| for ordering
  const featureOrder = [...featureNames].sort((a, b) => {
    const meanA =
      points
        .filter((p) => p.feature === a)
        .reduce((s, p) => s + Math.abs(p.shap_value), 0) /
      Math.max(points.filter((p) => p.feature === a).length, 1);
    const meanB =
      points
        .filter((p) => p.feature === b)
        .reduce((s, p) => s + Math.abs(p.shap_value), 0) /
      Math.max(points.filter((p) => p.feature === b).length, 1);
    return meanA - meanB;
  });

  const traces = featureOrder.map((feat, idx) => {
    const featurePoints = points.filter((p) => p.feature === feat);
    return {
      x: featurePoints.map((p) => p.shap_value),
      y: featurePoints.map(() => idx + (Math.random() - 0.5) * 0.3),
      mode: "markers" as const,
      type: "scatter" as const,
      name: feat,
      marker: {
        size: 4,
        color: featurePoints.map((p) => p.feature_value),
        colorscale: "RdBu" as const,
        showscale: idx === featureOrder.length - 1,
        colorbar: idx === featureOrder.length - 1 ? { title: "Feature value" } : undefined,
      },
      showlegend: false,
    };
  });

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        SHAP Summary Plot
      </Typography>
      <Plot
        data={traces}
        layout={{
          height: 450,
          margin: { l: 140, r: 40, t: 20, b: 40 },
          xaxis: { title: "SHAP value" },
          yaxis: {
            tickvals: featureOrder.map((_, i) => i),
            ticktext: featureOrder,
          },
        }}
        config={{ responsive: true }}
        style={{ width: "100%" }}
      />
    </Box>
  );
}
