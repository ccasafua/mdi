import io
import uuid
import numpy as np
import joblib
from sklearn.ensemble import (
    RandomForestRegressor, GradientBoostingRegressor,
    ExtraTreesRegressor, AdaBoostRegressor,
)
from sklearn.linear_model import Ridge, Lasso
from sklearn.svm import SVR
from sklearn.neighbors import KNeighborsRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, root_mean_squared_error
from .data_service import data_service
from ..config import DATASETS, SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET

TREE_ALGORITHMS = {"random_forest", "gradient_boosting", "extra_trees", "adaboost"}


class ModelService:
    def __init__(self):
        self._models: dict[str, dict] = {}
        self._storage = None
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                from supabase import create_client
                client = create_client(SUPABASE_URL, SUPABASE_KEY)
                self._storage = client.storage
                self._load_all()
            except Exception as e:
                print(f"[ModelService] Supabase init failed: {e}")

    def _persist(self, model_id: str) -> None:
        if not self._storage:
            return
        try:
            buf = io.BytesIO()
            joblib.dump(self._models[model_id], buf)
            buf.seek(0)
            self._storage.from_(SUPABASE_BUCKET).upload(
                f"{model_id}.pkl",
                buf.getvalue(),
                file_options={"content-type": "application/octet-stream", "upsert": "true"},
            )
        except Exception as e:
            print(f"[ModelService] Persist {model_id} failed: {e}")

    def _load_all(self) -> None:
        if not self._storage:
            return
        try:
            files = self._storage.from_(SUPABASE_BUCKET).list()
            for f in files:
                name = f["name"]
                if not name.endswith(".pkl"):
                    continue
                model_id = name[:-4]
                data = self._storage.from_(SUPABASE_BUCKET).download(name)
                entry = joblib.load(io.BytesIO(data))
                self._models[model_id] = entry
            if self._models:
                print(f"[ModelService] Loaded {len(self._models)} model(s) from Supabase")
        except Exception as e:
            print(f"[ModelService] Load from Supabase failed: {e}")

    def _build_model(
        self,
        algorithm: str,
        n_estimators: int,
        max_depth: int | None,
        learning_rate: float,
        random_state: int,
        alpha: float,
        kernel: str,
        C: float,
        n_neighbors: int,
    ) -> tuple:
        """Return (model, params_dict) for the given algorithm."""
        if algorithm == "random_forest":
            params = {"n_estimators": n_estimators, "random_state": random_state}
            if max_depth is not None:
                params["max_depth"] = max_depth
            return RandomForestRegressor(**params), params

        if algorithm == "gradient_boosting":
            params = {
                "n_estimators": n_estimators, "random_state": random_state,
                "learning_rate": learning_rate,
            }
            if max_depth is not None:
                params["max_depth"] = max_depth
            return GradientBoostingRegressor(**params), params

        if algorithm == "extra_trees":
            params = {"n_estimators": n_estimators, "random_state": random_state}
            if max_depth is not None:
                params["max_depth"] = max_depth
            return ExtraTreesRegressor(**params), params

        if algorithm == "adaboost":
            params = {
                "n_estimators": n_estimators, "random_state": random_state,
                "learning_rate": learning_rate,
            }
            return AdaBoostRegressor(**params), params

        if algorithm == "ridge":
            params = {"alpha": alpha}
            return make_pipeline(StandardScaler(), Ridge(**params)), params

        if algorithm == "lasso":
            params = {"alpha": alpha}
            return make_pipeline(StandardScaler(), Lasso(**params)), params

        if algorithm == "svr":
            params = {"C": C, "kernel": kernel}
            return make_pipeline(StandardScaler(), SVR(**params)), params

        if algorithm == "knn":
            params = {"n_neighbors": n_neighbors}
            return make_pipeline(StandardScaler(), KNeighborsRegressor(**params)), params

        raise ValueError(f"Unknown algorithm: {algorithm}")

    def train(
        self,
        algorithm: str,
        test_size: float = 0.2,
        n_estimators: int = 100,
        max_depth: int | None = None,
        learning_rate: float = 0.1,
        random_state: int = 42,
        alpha: float = 1.0,
        kernel: str = "rbf",
        C: float = 1.0,
        n_neighbors: int = 5,
    ) -> dict:
        df = data_service.load_dataset("concrete")
        config = DATASETS["concrete"]
        X = df[config["features"]].values
        y = df[config["target"]].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state,
        )

        model, params = self._build_model(
            algorithm, n_estimators, max_depth, learning_rate,
            random_state, alpha, kernel, C, n_neighbors,
        )

        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        r2 = float(r2_score(y_test, y_pred))
        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(root_mean_squared_error(y_test, y_pred))

        # Residual std for uncertainty in non-ensemble models
        residual_std = float(np.std(y_test - y_pred))

        model_id = str(uuid.uuid4())[:8]
        entry = {
            "model": model,
            "algorithm": algorithm,
            "params": params,
            "r2": round(r2, 4),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "residual_std": round(residual_std, 4),
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
        self._persist(model_id)

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

        if algorithm == "random_forest" or algorithm == "extra_trees":
            tree_preds = np.array([t.predict(X)[0] for t in model.estimators_])
            std_dev = float(np.std(tree_preds))
            lower = float(np.percentile(tree_preds, 2.5))
            upper = float(np.percentile(tree_preds, 97.5))
        elif algorithm == "gradient_boosting":
            lower = float(entry["quantile_lower"].predict(X)[0])
            upper = float(entry["quantile_upper"].predict(X)[0])
            std_dev = (upper - lower) / 3.92
        else:
            # Residual-based uncertainty for non-ensemble models
            residual_std = entry.get("residual_std", 0.0)
            std_dev = residual_std
            lower = prediction - 1.96 * residual_std
            upper = prediction + 1.96 * residual_std

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
