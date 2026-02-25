import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.model_service import ModelService
from app.services.xai_service import XAIService

# Train a model once for all tests
_model_svc = ModelService()
_train_result = _model_svc.train(algorithm="random_forest", n_estimators=50, random_state=42)
_model_id = _train_result["model_id"]
_xai_svc = XAIService()


def _patch():
    """Patch both model_service references used by xai_service."""
    return patch("app.services.xai_service.model_service", _model_svc)


def test_compute_shap_values():
    with _patch():
        result = _xai_svc.compute_shap_values(_model_id)
    assert "shap_values" in result
    assert "expected_value" in result
    assert result["shap_values"].shape[1] == 8


def test_get_summary_plot_data():
    with _patch():
        data = _xai_svc.get_summary_plot_data(_model_id)
    assert data["model_id"] == _model_id
    assert len(data["points"]) > 0
    point = data["points"][0]
    assert "feature" in point
    assert "shap_value" in point
    assert "feature_value" in point


def test_get_feature_importance():
    with _patch():
        data = _xai_svc.get_feature_importance(_model_id)
    assert data["model_id"] == _model_id
    assert len(data["importances"]) == 8
    imps = [item["importance"] for item in data["importances"]]
    assert imps == sorted(imps, reverse=True)
    top_features = [item["feature"] for item in data["importances"][:3]]
    assert "cement" in top_features or "age" in top_features


def test_explain_prediction():
    input_data = {
        "cement": 300.0,
        "blast_furnace_slag": 0.0,
        "fly_ash": 0.0,
        "water": 180.0,
        "superplasticizer": 0.0,
        "coarse_aggregate": 1000.0,
        "fine_aggregate": 700.0,
        "age": 28,
    }
    with _patch():
        result = _xai_svc.explain_prediction(_model_id, input_data)
    assert "prediction" in result
    assert "base_value" in result
    assert "waterfall" in result
    assert "interpretation" in result
    assert len(result["waterfall"]) == 8
    # SHAP consistency: base_value + sum(shap_values) ≈ prediction
    shap_sum = sum(w["shap_value"] for w in result["waterfall"])
    expected = result["base_value"] + shap_sum
    assert abs(expected - result["prediction"]) < 1.0, (
        f"SHAP consistency failed: {expected} vs {result['prediction']}"
    )


def test_get_dependence_data():
    with _patch():
        data = _xai_svc.get_dependence_data(_model_id, "cement")
    assert data["model_id"] == _model_id
    assert data["feature"] == "cement"
    assert "color_feature" in data
    assert len(data["points"]) > 0
    point = data["points"][0]
    assert "feature_value" in point
    assert "shap_value" in point
    assert "color_value" in point


def test_dependence_invalid_feature():
    with _patch():
        try:
            _xai_svc.get_dependence_data(_model_id, "nonexistent_feature")
            assert False, "Should have raised ValueError"
        except ValueError:
            pass
