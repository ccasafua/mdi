import uuid
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, root_mean_squared_error
from .data_service import data_service
from ..config import DATASETS


class ModelService:
    def __init__(self):
        self._models: dict[str, dict] = {}

    def train(
        self,
        algorithm: str,
        test_size: float = 0.2,
        n_estimators: int = 100,
        max_depth: int | None = None,
        learning_rate: float = 0.1,
        random_state: int = 42,
    ) -> dict:
        df = data_service.load_dataset("concrete")
        config = DATASETS["concrete"]
        X = df[config["features"]].values
        y = df[config["target"]].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state,
        )

        params = {"n_estimators": n_estimators, "random_state": random_state}
        if algorithm == "random_forest":
            if max_depth is not None:
                params["max_depth"] = max_depth
            model = RandomForestRegressor(**params)
        elif algorithm == "gradient_boosting":
            params["learning_rate"] = learning_rate
            if max_depth is not None:
                params["max_depth"] = max_depth
            model = GradientBoostingRegressor(**params)
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        r2 = float(r2_score(y_test, y_pred))
        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(root_mean_squared_error(y_test, y_pred))

        model_id = str(uuid.uuid4())[:8]
        entry = {
            "model": model,
            "algorithm": algorithm,
            "params": params,
            "r2": round(r2, 4),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "X_test": X_test,
            "y_test": y_test,
            "y_pred": y_pred,
            "X_train": X_train,
            "y_train": y_train,
            "feature_names": config["features"],
        }

        # Train quantile models for GB uncertainty
        if algorithm == "gradient_boosting":
            q_params = {**params}
            q_params.pop("random_state", None)
            gb_lower = GradientBoostingRegressor(
                loss="quantile", alpha=0.05, **q_params,
                random_state=random_state,
            )
            gb_upper = GradientBoostingRegressor(
                loss="quantile", alpha=0.95, **q_params,
                random_state=random_state,
            )
            gb_lower.fit(X_train, y_train)
            gb_upper.fit(X_train, y_train)
            entry["quantile_lower"] = gb_lower
            entry["quantile_upper"] = gb_upper

        self._models[model_id] = entry

        return {
            "model_id": model_id,
            "algorithm": algorithm,
            "params": params,
            "r2": round(r2, 4),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
        }

    def predict(self, model_id: str, input_data: dict[str, float]) -> float:
        entry = self._get_model(model_id)
        features = entry["feature_names"]
        X = np.array([[input_data[f] for f in features]])
        prediction = entry["model"].predict(X)
        return round(float(prediction[0]), 4)

    def predict_with_uncertainty(self, model_id: str, input_data: dict[str, float]) -> dict:
        entry = self._get_model(model_id)
        features = entry["feature_names"]
        X = np.array([[input_data[f] for f in features]])
        model = entry["model"]
        algorithm = entry["algorithm"]

        prediction = float(model.predict(X)[0])

        if algorithm == "random_forest":
            tree_preds = np.array([t.predict(X)[0] for t in model.estimators_])
            std_dev = float(np.std(tree_preds))
            lower = float(np.percentile(tree_preds, 2.5))
            upper = float(np.percentile(tree_preds, 97.5))
        elif algorithm == "gradient_boosting":
            lower = float(entry["quantile_lower"].predict(X)[0])
            upper = float(entry["quantile_upper"].predict(X)[0])
            std_dev = (upper - lower) / 3.92  # approx from 95% CI
        else:
            std_dev = 0.0
            lower = prediction
            upper = prediction

        return {
            "prediction": round(prediction, 4),
            "uncertainty": {
                "lower_bound": round(lower, 4),
                "upper_bound": round(upper, 4),
                "std_dev": round(std_dev, 4),
                "confidence": 0.95,
            },
            "model_id": model_id,
            "input_data": input_data,
        }

    def get_metrics(self, model_id: str) -> dict:
        entry = self._get_model(model_id)
        return {
            "model_id": model_id,
            "algorithm": entry["algorithm"],
            "r2": entry["r2"],
            "mae": entry["mae"],
            "rmse": entry["rmse"],
            "actual": [round(float(v), 4) for v in entry["y_test"]],
            "predicted": [round(float(v), 4) for v in entry["y_pred"]],
        }

    def list_models(self) -> list[dict]:
        return [
            {
                "model_id": mid,
                "algorithm": entry["algorithm"],
                "params": entry["params"],
                "r2": entry["r2"],
                "mae": entry["mae"],
                "rmse": entry["rmse"],
            }
            for mid, entry in self._models.items()
        ]

    def get_model_entry(self, model_id: str) -> dict:
        return self._get_model(model_id)

    def _get_model(self, model_id: str) -> dict:
        if model_id not in self._models:
            raise ValueError(f"Model '{model_id}' not found")
        return self._models[model_id]


model_service = ModelService()
