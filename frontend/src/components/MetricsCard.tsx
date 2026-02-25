import { Card, CardContent, Typography, Box } from "@mui/material";

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function MetricsCard({
  title,
  value,
  subtitle,
  color = "#1976d2",
}: MetricsCardProps) {
  return (
    <Card sx={{ minWidth: 150 }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="h4" sx={{ color, fontWeight: "bold" }}>
            {typeof value === "number" ? value.toFixed(4) : value}
          </Typography>
        </Box>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
