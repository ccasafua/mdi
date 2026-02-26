import numpy as np
import shap
from .model_service import model_service, TREE_ALGORITHMS


class XAIService:
    def __init__(self):
        self._cache: dict[str, dict] = {}

    def _create_explainer(self, model, algorithm, X_train):
        if algorithm in TREE_ALGORITHMS:
            return shap.TreeExplainer(model)
        background = shap.sample(X_train, min(100, len(X_train)))
        return shap.KernelExplainer(model.predict, background)

    def compute_shap_values(self, model_id: str) -> dict:
        if model_id in self._cache:
            return self._cache[model_id]

        entry = model_service.get_model_entry(model_id)
        model = entry["model"]
        X_test = entry["X_test"]
        X_train = entry["X_train"]
        algorithm = entry["algorithm"]
        feature_names = entry["feature_names"]

        explainer = self._create_explainer(model, algorithm, X_train)

        # For non-tree models, sample X_test to keep KernelExplainer fast
        if algorithm not in TREE_ALGORITHMS:
            sample_size = min(50, len(X_test))
            indices = np.random.RandomState(42).choice(
                len(X_test), sample_size, replace=False,
            )
            X_test = X_test[indices]

        shap_values = explainer.shap_values(X_test)

        result = {
            "shap_values": shap_values,
            "expected_value": float(np.asarray(explainer.expected_value).item()),
            "X_test": X_test,
            "feature_names": feature_names,
        }
        self._cache[model_id] = result
        return result

    def get_summary_plot_data(self, model_id: str) -> dict:
        data = self.compute_shap_values(model_id)
        shap_values = data["shap_values"]
        X_test = data["X_test"]
        feature_names = data["feature_names"]

        points = []
        for i in range(shap_values.shape[0]):
            for j, feat in enumerate(feature_names):
                points.append({
                    "feature": feat,
                    "shap_value": round(float(shap_values[i, j]), 4),
                    "feature_value": round(float(X_test[i, j]), 4),
                })

        return {
            "model_id": model_id,
            "points": points,
            "feature_names": feature_names,
        }

    def get_feature_importance(self, model_id: str) -> dict:
        data = self.compute_shap_values(model_id)
        shap_values = data["shap_values"]
        feature_names = data["feature_names"]

        mean_abs = np.mean(np.abs(shap_values), axis=0)
        importances = sorted(
            [
                {"feature": feat, "importance": round(float(imp), 4)}
                for feat, imp in zip(feature_names, mean_abs)
            ],
            key=lambda x: x["importance"],
            reverse=True,
        )

        return {"model_id": model_id, "importances": importances}

    def explain_prediction(self, model_id: str, input_data: dict[str, float]) -> dict:
        entry = model_service.get_model_entry(model_id)
        model = entry["model"]
        algorithm = entry["algorithm"]
        X_train = entry["X_train"]
        feature_names = entry["feature_names"]
        X = np.array([[input_data[f] for f in feature_names]])

        explainer = self._create_explainer(model, algorithm, X_train)
        shap_values = explainer.shap_values(X)

        prediction = float(model.predict(X)[0])
        base_value = float(np.asarray(explainer.expected_value).item())

        waterfall = []
        for j, feat in enumerate(feature_names):
            waterfall.append({
                "feature": feat,
                "shap_value": round(float(shap_values[0, j]), 4),
                "feature_value": round(float(X[0, j]), 4),
            })
        waterfall.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        interpretation = self._generate_interpretation(waterfall, prediction, base_value)

        # Include uncertainty if available
        uncertainty = None
        try:
            unc_result = model_service.predict_with_uncertainty(model_id, input_data)
            uncertainty = unc_result["uncertainty"]
        except Exception:
            pass

        return {
            "model_id": model_id,
            "prediction": round(prediction, 4),
            "base_value": round(base_value, 4),
            "waterfall": waterfall,
            "interpretation": interpretation,
            "uncertainty": uncertainty,
        }

    def get_dependence_data(self, model_id: str, feature: str) -> dict:
        data = self.compute_shap_values(model_id)
        shap_values = data["shap_values"]
        X_test = data["X_test"]
        feature_names = data["feature_names"]

        if feature not in feature_names:
            raise ValueError(f"Feature '{feature}' not found")

        feat_idx = feature_names.index(feature)
        feat_shap = shap_values[:, feat_idx]
        feat_vals = X_test[:, feat_idx]

        # Find most interacting feature (highest correlation with SHAP values)
        correlations = []
        for j, name in enumerate(feature_names):
            if j == feat_idx:
                correlations.append(0)
                continue
            corr = abs(float(np.corrcoef(X_test[:, j], feat_shap)[0, 1]))
            correlations.append(corr if not np.isnan(corr) else 0)
        color_idx = int(np.argmax(correlations))
        color_feature = feature_names[color_idx]

        points = []
        for i in range(len(feat_vals)):
            points.append({
                "feature_value": round(float(feat_vals[i]), 4),
                "shap_value": round(float(feat_shap[i]), 4),
                "color_value": round(float(X_test[i, color_idx]), 4),
            })

        return {
            "model_id": model_id,
            "feature": feature,
            "color_feature": color_feature,
            "points": points,
        }

    def get_top_shap(self, model_id: str, input_data: dict[str, float], top_n: int = 3) -> list[dict]:
        entry = model_service.get_model_entry(model_id)
        model = entry["model"]
        algorithm = entry["algorithm"]
        X_train = entry["X_train"]
        feature_names = entry["feature_names"]
        X = np.array([[input_data[f] for f in feature_names]])

        explainer = self._create_explainer(model, algorithm, X_train)
        shap_values = explainer.shap_values(X)

        items = []
        for j, feat in enumerate(feature_names):
            items.append({
                "feature": feat,
                "shap_value": round(float(shap_values[0, j]), 4),
                "feature_value": round(float(X[0, j]), 4),
            })
        items.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        return items[:top_n]

    def _generate_interpretation(
        self, waterfall: list[dict], prediction: float, base_value: float
    ) -> str:
        top = waterfall[:3]
        parts = []
        for item in top:
            direction = "aumenta" if item["shap_value"] > 0 else "disminuye"
            parts.append(
                f"{item['feature']} ({item['feature_value']}) {direction} "
                f"la prediccion en {abs(item['shap_value']):.2f} MPa"
            )
        text = (
            f"La prediccion es {prediction:.2f} MPa (valor base: {base_value:.2f} MPa). "
            f"Los factores mas influyentes son: {'; '.join(parts)}."
        )
        return text


xai_service = XAIService()
