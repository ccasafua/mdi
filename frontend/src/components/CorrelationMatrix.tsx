import Plot from "react-plotly.js";
import { Typography, Box } from "@mui/material";

interface CorrelationMatrixProps {
  columns: string[];
  matrix: Record<string, Record<string, number>>;
}

export default function CorrelationMatrix({ columns, matrix }: CorrelationMatrixProps) {
  const z = columns.map((row) =>
    columns.map((col) => matrix[row]?.[col] ?? 0)
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Correlation Matrix
      </Typography>
      <Plot
        data={[
          {
            z,
            x: columns,
            y: columns,
            type: "heatmap" as const,
            colorscale: "RdBu" as const,
            zmin: -1,
            zmax: 1,
            text: z.map((row) => row.map((v) => v.toFixed(2))) as unknown as string[],
            hovertemplate: "%{y} vs %{x}: %{z:.3f}<extra></extra>",
          },
        ]}
        layout={{
          height: 500,
          margin: { l: 140, r: 40, t: 20, b: 140 },
          xaxis: { tickangle: -45 },
        }}
        config={{ responsive: true }}
        style={{ width: "100%" }}
      />
    </Box>
  );
}
