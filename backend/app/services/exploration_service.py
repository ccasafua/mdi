import numpy as np
from .model_service import model_service
from .xai_service import xai_service


class ExplorationService:
    def parametric_sweep(
        self,
        model_id: str,
        base_config: dict[str, float],
        sweep_feature: str = "fly_ash",
        min_val: float = 0.0,
        max_val: float = 200.0,
        steps: int = 20,
    ) -> dict:
        entry = model_service.get_model_entry(model_id)
        feature_names = entry["feature_names"]

        sweep_values = np.linspace(min_val, max_val, steps)
        points = []
        best_pred = -np.inf
        best_range = [min_val, max_val]

        for val in sweep_values:
            input_data = {**base_config, sweep_feature: float(val)}
            # Ensure all features present
            for f in feature_names:
                if f not in input_data:
                    input_data[f] = 0.0
            result = model_service.predict_with_uncertainty(model_id, input_data)
            pred = result["prediction"]
            lower = result["uncertainty"]["lower_bound"]
            upper = result["uncertainty"]["upper_bound"]
            points.append({
                "feature_value": round(float(val), 4),
                "prediction": round(pred, 4),
                "lower_bound": round(lower, 4),
                "upper_bound": round(upper, 4),
            })
            if pred > best_pred:
                best_pred = pred

        # Find optimal region (top 10% of predictions)
        threshold = best_pred * 0.9
        optimal_vals = [p["feature_value"] for p in points if p["prediction"] >= threshold]
        if optimal_vals:
            best_range = [min(optimal_vals), max(optimal_vals)]

        return {
            "model_id": model_id,
            "sweep_feature": sweep_feature,
            "points": points,
            "optimal_region": {
                "start": round(best_range[0], 4),
                "end": round(best_range[1], 4),
                "best_prediction": round(best_pred, 4),
            },
        }

    def multivariable_exploration(
        self,
        model_id: str,
        base_config: dict[str, float],
        variable_ranges: list[dict],
    ) -> dict:
        entry = model_service.get_model_entry(model_id)
        feature_names = entry["feature_names"]

        if len(variable_ranges) < 2:
            raise ValueError("Need at least 2 variable ranges")

        r0 = variable_ranges[0]
        r1 = variable_ranges[1]
        vals0 = np.linspace(r0["min_val"], r0["max_val"], r0.get("steps", 20))
        vals1 = np.linspace(r1["min_val"], r1["max_val"], r1.get("steps", 20))

        predictions = []
        for v1 in vals1:
            row = []
            for v0 in vals0:
                input_data = {**base_config}
                input_data[r0["feature"]] = float(v0)
                input_data[r1["feature"]] = float(v1)
                for f in feature_names:
                    if f not in input_data:
                        input_data[f] = 0.0
                pred = model_service.predict(model_id, input_data)
                row.append(round(pred, 4))
            predictions.append(row)

        return {
            "model_id": model_id,
            "axes": {
                r0["feature"]: [round(float(v), 4) for v in vals0],
                r1["feature"]: [round(float(v), 4) for v in vals1],
            },
            "predictions": predictions,
            "variable_names": [r0["feature"], r1["feature"]],
        }

    def compare_configurations(
        self,
        model_id: str,
        configurations: list[dict[str, float]],
        labels: list[str],
    ) -> dict:
        entry = model_service.get_model_entry(model_id)
        feature_names = entry["feature_names"]
        results = []

        for config, label in zip(configurations, labels):
            input_data = {**config}
            for f in feature_names:
                if f not in input_data:
                    input_data[f] = 0.0

            unc_result = model_service.predict_with_uncertainty(model_id, input_data)
            top_shap = xai_service.get_top_shap(model_id, input_data, top_n=3)

            results.append({
                "label": label,
                "prediction": unc_result["prediction"],
                "lower_bound": unc_result["uncertainty"]["lower_bound"],
                "upper_bound": unc_result["uncertainty"]["upper_bound"],
                "top_shap": top_shap,
            })

        return {
            "model_id": model_id,
            "results": results,
        }


exploration_service = ExplorationService()
