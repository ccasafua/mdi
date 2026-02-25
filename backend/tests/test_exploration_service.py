import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.model_service import ModelService
from app.services.xai_service import XAIService
from app.services.exploration_service import ExplorationService

SAMPLE_BASE = {
    "cement": 300.0,
    "blast_furnace_slag": 0.0,
    "fly_ash": 100.0,
    "water": 180.0,
    "superplasticizer": 6.0,
    "coarse_aggregate": 1000.0,
    "fine_aggregate": 700.0,
    "age": 28,
}

_model_svc = ModelService()
_train_result = _model_svc.train(algorithm="random_forest", n_estimators=50, random_state=42)
_model_id = _train_result["model_id"]
_xai_svc = XAIService()
_exploration_svc = ExplorationService()


def _patches():
    p1 = patch("app.services.exploration_service.model_service", _model_svc)
    p2 = patch("app.services.exploration_service.xai_service", _xai_svc)
    p3 = patch("app.services.xai_service.model_service", _model_svc)
    return p1, p2, p3


def test_parametric_sweep():
    p1, p2, p3 = _patches()
    with p1, p2, p3:
        result = _exploration_svc.parametric_sweep(
            model_id=_model_id,
            base_config=SAMPLE_BASE,
            sweep_feature="fly_ash",
            min_val=0,
            max_val=200,
            steps=10,
        )
    assert result["model_id"] == _model_id
    assert result["sweep_feature"] == "fly_ash"
    assert len(result["points"]) == 10
    point = result["points"][0]
    assert "feature_value" in point
    assert "prediction" in point
    assert "lower_bound" in point
    assert "upper_bound" in point
    assert "optimal_region" in result
    assert "start" in result["optimal_region"]
    assert "end" in result["optimal_region"]


def test_multivariable_2d():
    p1, p2, p3 = _patches()
    with p1, p2, p3:
        result = _exploration_svc.multivariable_exploration(
            model_id=_model_id,
            base_config=SAMPLE_BASE,
            variable_ranges=[
                {"feature": "fly_ash", "min_val": 0, "max_val": 200, "steps": 5},
                {"feature": "water", "min_val": 120, "max_val": 240, "steps": 5},
            ],
        )
    assert result["model_id"] == _model_id
    assert "fly_ash" in result["axes"]
    assert "water" in result["axes"]
    assert len(result["predictions"]) == 5  # rows = steps of var2
    assert len(result["predictions"][0]) == 5  # cols = steps of var1
    assert result["variable_names"] == ["fly_ash", "water"]


def test_compare_configurations():
    configs = [
        {**SAMPLE_BASE, "fly_ash": 50},
        {**SAMPLE_BASE, "fly_ash": 150},
    ]
    p1, p2, p3 = _patches()
    with p1, p2, p3:
        result = _exploration_svc.compare_configurations(
            model_id=_model_id,
            configurations=configs,
            labels=["Low FA", "High FA"],
        )
    assert result["model_id"] == _model_id
    assert len(result["results"]) == 2
    r0 = result["results"][0]
    assert r0["label"] == "Low FA"
    assert "prediction" in r0
    assert "lower_bound" in r0
    assert "upper_bound" in r0
    assert len(r0["top_shap"]) == 3
