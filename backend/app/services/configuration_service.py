import uuid
import json
import io
import csv
from pathlib import Path
from ..config import DATA_DIR


STORE_PATH = DATA_DIR / "configurations.json"


class ConfigurationService:
    def __init__(self):
        self._configs: dict[str, dict] = {}
        self._load_from_disk()

    def _load_from_disk(self):
        if STORE_PATH.exists():
            try:
                with open(STORE_PATH) as f:
                    data = json.load(f)
                self._configs = {item["id"]: item for item in data}
            except (json.JSONDecodeError, KeyError):
                self._configs = {}

    def _save_to_disk(self):
        with open(STORE_PATH, "w") as f:
            json.dump(list(self._configs.values()), f, indent=2)

    def save(
        self,
        label: str,
        values: dict[str, float],
        model_id: str,
        predicted_strength: float,
        lower_bound: float | None = None,
        upper_bound: float | None = None,
        is_candidate: bool = False,
    ) -> dict:
        config_id = str(uuid.uuid4())[:8]
        item = {
            "id": config_id,
            "label": label,
            "values": values,
            "model_id": model_id,
            "predicted_strength": round(predicted_strength, 4),
            "lower_bound": round(lower_bound, 4) if lower_bound is not None else None,
            "upper_bound": round(upper_bound, 4) if upper_bound is not None else None,
            "is_candidate": is_candidate,
        }
        self._configs[config_id] = item
        self._save_to_disk()
        return item

    def list_all(self) -> list[dict]:
        return list(self._configs.values())

    def mark_as_validation_candidate(self, config_id: str) -> dict:
        if config_id not in self._configs:
            raise ValueError(f"Configuration '{config_id}' not found")
        self._configs[config_id]["is_candidate"] = True
        self._save_to_disk()
        return self._configs[config_id]

    def delete(self, config_id: str):
        if config_id not in self._configs:
            raise ValueError(f"Configuration '{config_id}' not found")
        del self._configs[config_id]
        self._save_to_disk()

    def export_csv(self, only_candidates: bool = False) -> str:
        items = self.list_all()
        if only_candidates:
            items = [i for i in items if i.get("is_candidate")]

        if not items:
            return "No configurations to export\n"

        # Collect all value keys
        all_keys = set()
        for item in items:
            all_keys.update(item["values"].keys())
        value_keys = sorted(all_keys)

        output = io.StringIO()
        fieldnames = ["id", "label"] + value_keys + [
            "predicted_strength", "lower_bound", "upper_bound",
            "model_id", "is_candidate",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            row = {
                "id": item["id"],
                "label": item["label"],
                "predicted_strength": item["predicted_strength"],
                "lower_bound": item.get("lower_bound", ""),
                "upper_bound": item.get("upper_bound", ""),
                "model_id": item["model_id"],
                "is_candidate": item["is_candidate"],
            }
            for k in value_keys:
                row[k] = item["values"].get(k, "")
            writer.writerow(row)

        return output.getvalue()


configuration_service = ConfigurationService()
