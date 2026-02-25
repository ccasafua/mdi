import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.model_service import ModelService

SAMPLE_INPUT = {
    "cement": 300.0,
    "blast_furnace_slag": 0.0,
    "fly_ash": 0.0,
    "water": 180.0,
    "superplasticizer": 0.0,
    "coarse_aggregate": 1000.0,
    "fine_aggregate": 700.0,
    "age": 28,
}


def _get_trained_service(algorithm="random_forest"):
    svc = ModelService()
    result = svc.train(algorithm=algorithm, n_estimators=50, random_state=42)
    return svc, result


def test_train_random_forest():
    svc, result = _get_trained_service("random_forest")
    assert "model_id" in result
    assert result["algorithm"] == "random_forest"
    assert result["r2"] > 0.85, f"R² should be > 0.85, got {result['r2']}"
    assert result["mae"] > 0
    assert result["rmse"] > 0


def test_train_gradient_boosting():
    svc, result = _get_trained_service("gradient_boosting")
    assert result["algorithm"] == "gradient_boosting"
    assert result["r2"] > 0.80, f"R² should be > 0.80, got {result['r2']}"


def test_train_invalid_algorithm():
    svc = ModelService()
    try:
        svc.train(algorithm="invalid")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass


def test_predict():
    svc, result = _get_trained_service()
    prediction = svc.predict(result["model_id"], SAMPLE_INPUT)
    assert isinstance(prediction, float)
    assert 0 < prediction < 100


def test_get_metrics():
    svc, result = _get_trained_service()
    metrics = svc.get_metrics(result["model_id"])
    assert metrics["model_id"] == result["model_id"]
    assert len(metrics["actual"]) == len(metrics["predicted"])
    assert len(metrics["actual"]) > 0


def test_list_models():
    svc, result = _get_trained_service()
    models = svc.list_models()
    assert len(models) == 1
    assert models[0]["model_id"] == result["model_id"]


def test_model_not_found():
    svc = ModelService()
    try:
        svc.get_metrics("nonexistent")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass


def test_predict_with_uncertainty_rf():
    svc, result = _get_trained_service("random_forest")
    unc = svc.predict_with_uncertainty(result["model_id"], SAMPLE_INPUT)
    assert "prediction" in unc
    assert "uncertainty" in unc
    assert unc["uncertainty"]["confidence"] == 0.95
    assert unc["uncertainty"]["lower_bound"] <= unc["prediction"]
    assert unc["uncertainty"]["upper_bound"] >= unc["prediction"]
    assert unc["uncertainty"]["std_dev"] > 0


def test_predict_with_uncertainty_gb():
    svc, result = _get_trained_service("gradient_boosting")
    unc = svc.predict_with_uncertainty(result["model_id"], SAMPLE_INPUT)
    assert "prediction" in unc
    assert "uncertainty" in unc
    assert unc["uncertainty"]["confidence"] == 0.95
    assert unc["uncertainty"]["lower_bound"] < unc["uncertainty"]["upper_bound"]
    assert unc["uncertainty"]["std_dev"] > 0
