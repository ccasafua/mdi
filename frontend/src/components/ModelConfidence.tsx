import { Chip, Tooltip } from "@mui/material";
import { useMode } from "../contexts/ModeContext";
import { classifyModelConfidence } from "../utils/designUtils";

interface Props {
  r2: number;
  mae: number;
  rmse: number;
}

export default function ModelConfidence({ r2, mae, rmse }: Props) {
  const { mode } = useMode();
  if (mode !== "design") return null;

  const confidence = classifyModelConfidence(r2);

  return (
    <Tooltip
      title={`R² = ${r2.toFixed(3)} | MAE = ${mae.toFixed(2)} MPa | RMSE = ${rmse.toFixed(2)} MPa`}
      arrow
    >
      <Chip
        label={confidence.label}
        sx={{ bgcolor: confidence.color, color: "#fff", fontWeight: 600, my: 1 }}
      />
    </Tooltip>
  );
}
