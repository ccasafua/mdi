import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Typography } from "@mui/material";

interface FeatureImportanceProps {
  data: { feature: string; importance: number }[];
}

export default function FeatureImportance({ data }: FeatureImportanceProps) {
  return (
    <>
      <Typography variant="h6" gutterBottom>
        Feature Importance (mean |SHAP|)
      </Typography>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="feature" width={110} />
          <Tooltip formatter={(v) => (v as number).toFixed(4)} />
          <Bar dataKey="importance" fill="#1976d2" />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
