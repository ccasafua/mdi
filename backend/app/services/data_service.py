import pandas as pd
import numpy as np
from ..config import DATA_DIR, DATASETS, UNIFIED_FEATURES, BUILTIN_DATASETS


class DataService:
    def __init__(self):
        self._cache: dict[str, pd.DataFrame] = {}

    def _get_config(self, name: str) -> dict:
        if name not in DATASETS:
            raise ValueError(f"Dataset '{name}' not found. Available: {list(DATASETS.keys())}")
        return DATASETS[name]

    def load_dataset(self, name: str) -> pd.DataFrame:
        if name in self._cache:
            return self._cache[name]
        config = self._get_config(name)
        path = DATA_DIR / config["file"]
        df = pd.read_csv(path)
        self._cache[name] = df
        return df

    def list_datasets(self) -> list[dict]:
        result = []
        for name, config in DATASETS.items():
            df = self.load_dataset(name)
            result.append({
                "name": name,
                "description": config["description"],
                "source_label": config.get("source_label", name),
                "features": config["features"],
                "target": config["target"],
                "num_samples": len(df),
                "units": config["units"],
            })
        return result

    def register_dataset(self, name: str, description: str, target: str, df: pd.DataFrame) -> dict:
        if name in DATASETS:
            raise ValueError(f"Dataset '{name}' already exists")
        if target not in df.columns:
            raise ValueError(f"Target column '{target}' not found in data. Columns: {list(df.columns)}")
        numeric_cols = df.select_dtypes(include="number").columns.tolist()
        if len(numeric_cols) < 2:
            raise ValueError("Dataset must have at least 2 numeric columns")
        features = [c for c in numeric_cols if c != target]
        if not features:
            raise ValueError("No numeric feature columns found besides target")

        csv_path = DATA_DIR / f"{name}.csv"
        df.to_csv(csv_path, index=False)

        DATASETS[name] = {
            "file": f"{name}.csv",
            "description": description,
            "source_label": name,
            "features": features,
            "target": target,
            "units": {},
        }
        self._cache[name] = df

        return {
            "name": name,
            "description": description,
            "source_label": name,
            "features": features,
            "target": target,
            "num_samples": len(df),
            "units": {},
        }

    def remove_dataset(self, name: str) -> None:
        if name in BUILTIN_DATASETS:
            raise ValueError(f"Cannot delete built-in dataset '{name}'")
        if name not in DATASETS:
            raise ValueError(f"Dataset '{name}' not found")
        config = DATASETS.pop(name)
        self._cache.pop(name, None)
        csv_path = DATA_DIR / config["file"]
        if csv_path.exists():
            csv_path.unlink()

    def get_summary(self, name: str) -> dict:
        df = self.load_dataset(name)
        config = self._get_config(name)
        all_cols = config["features"] + [config["target"]]

        desc = df[all_cols].describe()
        feature_stats = []
        for col in all_cols:
            feature_stats.append({
                "name": col,
                "mean": round(float(desc[col]["mean"]), 4),
                "std": round(float(desc[col]["std"]), 4),
                "min": round(float(desc[col]["min"]), 4),
                "max": round(float(desc[col]["max"]), 4),
                "q25": round(float(desc[col]["25%"]), 4),
                "q50": round(float(desc[col]["50%"]), 4),
                "q75": round(float(desc[col]["75%"]), 4),
            })

        corr = df[all_cols].corr()
        correlations = {
            col: {c: round(float(corr.loc[col, c]), 4) for c in all_cols}
            for col in all_cols
        }

        return {
            "name": name,
            "num_samples": len(df),
            "num_features": len(config["features"]),
            "feature_stats": feature_stats,
            "correlations": correlations,
        }

    def get_sample(self, name: str, n: int = 10, offset: int = 0) -> list[dict]:
        df = self.load_dataset(name)
        subset = df.iloc[offset:offset + n]
        return subset.to_dict(orient="records")

    def get_feature_distributions(self, name: str, bins: int = 20) -> list[dict]:
        df = self.load_dataset(name)
        config = self._get_config(name)
        all_cols = config["features"] + [config["target"]]

        distributions = []
        for col in all_cols:
            counts, bin_edges = np.histogram(df[col].dropna(), bins=bins)
            dist_bins = []
            for i in range(len(counts)):
                dist_bins.append({
                    "bin_start": round(float(bin_edges[i]), 4),
                    "bin_end": round(float(bin_edges[i + 1]), 4),
                    "count": int(counts[i]),
                })
            distributions.append({"feature": col, "bins": dist_bins})

        return distributions

    def get_correlation_matrix(self, name: str) -> dict:
        df = self.load_dataset(name)
        config = self._get_config(name)
        all_cols = config["features"] + [config["target"]]
        corr = df[all_cols].corr()
        return {
            "columns": all_cols,
            "matrix": {
                col: {c: round(float(corr.loc[col, c]), 4) for c in all_cols}
                for col in all_cols
            },
        }

    def load_unified(self, dataset_names: list[str] | None = None) -> dict:
        if dataset_names is None:
            dataset_names = list(DATASETS.keys())

        frames = []
        for name in dataset_names:
            config = self._get_config(name)
            df = self.load_dataset(name).copy()
            # Only keep unified features + target that exist in this dataset
            available = [f for f in UNIFIED_FEATURES if f in df.columns]
            target = config["target"]
            cols = available + [target]
            df_sub = df[cols].copy()
            df_sub["source"] = config.get("source_label", name)
            frames.append(df_sub)

        merged = pd.concat(frames, ignore_index=True)
        all_cols = UNIFIED_FEATURES + ["compressive_strength"]
        existing = [c for c in all_cols if c in merged.columns]

        desc = merged[existing].describe()
        feature_stats = []
        for col in existing:
            feature_stats.append({
                "name": col,
                "mean": round(float(desc[col]["mean"]), 4),
                "std": round(float(desc[col]["std"]), 4),
                "min": round(float(desc[col]["min"]), 4),
                "max": round(float(desc[col]["max"]), 4),
                "q25": round(float(desc[col]["25%"]), 4),
                "q50": round(float(desc[col]["50%"]), 4),
                "q75": round(float(desc[col]["75%"]), 4),
            })

        corr = merged[existing].corr()
        correlations = {
            col: {c: round(float(corr.loc[col, c]), 4) for c in existing}
            for col in existing
        }

        sources = merged["source"].value_counts().to_dict()

        return {
            "name": "unified",
            "num_samples": len(merged),
            "num_features": len(UNIFIED_FEATURES),
            "feature_stats": feature_stats,
            "correlations": correlations,
            "sources": sources,
            "dataset_names": dataset_names,
        }


data_service = DataService()
