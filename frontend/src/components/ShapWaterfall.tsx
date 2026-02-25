import Plot from "react-plotly.js";
import type Plotly from "plotly.js";
import { Typography, Box } from "@mui/material";

interface WaterfallItem {
  feature: string;
  shap_value: number;
  feature_value: number;
}

interface ShapWaterfallProps {
  waterfall: WaterfallItem[];
  baseValue: number;
  prediction: number;
}

export default function ShapWaterfall({
  waterfall,
  baseValue,
  prediction,
}: ShapWaterfallProps) {
  // Show sorted by absolute SHAP value (already sorted from backend)
  const items = [...waterfall].reverse();
  const features = items.map(
    (w) => `${w.feature} = ${w.feature_value.toFixed(1)}`
  );
  const values = items.map((w) => w.shap_value);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        SHAP Waterfall (Prediction: {prediction.toFixed(2)} MPa)
      </Typography>
      <Plot
        data={[
          {
            type: "waterfall" as const,
            orientation: "h" as const,
            y: ["Base value", ...features, "Prediction"],
            x: [baseValue, ...values, 0],
            measure: [
              "absolute",
              ...values.map(() => "relative"),
              "total",
            ],
            connector: { line: { color: "#ccc" } },
            decreasing: { marker: { color: "#4444ff" } },
            increasing: { marker: { color: "#ff4444" } },
            totals: { marker: { color: "#333" } },
          } as Plotly.Data,
        ]}
        layout={{
          height: 400,
          margin: { l: 200, r: 40, t: 20, b: 40 },
          xaxis: { title: { text: "Compressive Strength (MPa)" } },
          showlegend: false,
        }}
        config={{ responsive: true }}
        style={{ width: "100%" }}
      />
    </Box>
  );
}
