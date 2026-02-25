import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.data_service import DataService


def test_load_dataset():
    svc = DataService()
    df = svc.load_dataset("concrete")
    assert df.shape == (1030, 9)
    assert "cement" in df.columns
    assert "compressive_strength" in df.columns


def test_load_dataset_invalid():
    svc = DataService()
    try:
        svc.load_dataset("nonexistent")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass


def test_list_datasets():
    svc = DataService()
    datasets = svc.list_datasets()
    assert len(datasets) == 3
    names = [d["name"] for d in datasets]
    assert "concrete" in names
    assert "concrete_xai" in names
    assert "geopolymer" in names


def test_list_datasets_multiple():
    svc = DataService()
    datasets = svc.list_datasets()
    assert len(datasets) == 3
    concrete = [d for d in datasets if d["name"] == "concrete"][0]
    assert concrete["num_samples"] == 1030
    assert len(concrete["features"]) == 8
    xai = [d for d in datasets if d["name"] == "concrete_xai"][0]
    assert xai["num_samples"] == 500
    geo = [d for d in datasets if d["name"] == "geopolymer"][0]
    assert geo["num_samples"] == 400


def test_get_summary():
    svc = DataService()
    summary = svc.get_summary("concrete")
    assert summary["name"] == "concrete"
    assert summary["num_samples"] == 1030
    assert summary["num_features"] == 8
    assert len(summary["feature_stats"]) == 9  # 8 features + 1 target
    stat = summary["feature_stats"][0]
    assert "mean" in stat
    assert "std" in stat
    assert "min" in stat
    assert "max" in stat
    assert "cement" in summary["correlations"]
    assert "compressive_strength" in summary["correlations"]["cement"]


def test_get_sample():
    svc = DataService()
    sample = svc.get_sample("concrete", n=5)
    assert len(sample) == 5
    assert "cement" in sample[0]

    sample_offset = svc.get_sample("concrete", n=5, offset=10)
    assert len(sample_offset) == 5


def test_get_feature_distributions():
    svc = DataService()
    distributions = svc.get_feature_distributions("concrete", bins=10)
    assert len(distributions) == 9  # 8 features + target
    dist = distributions[0]
    assert "feature" in dist
    assert "bins" in dist
    assert len(dist["bins"]) == 10
    assert dist["bins"][0]["count"] >= 0


def test_get_correlation_matrix():
    svc = DataService()
    result = svc.get_correlation_matrix("concrete")
    assert "columns" in result
    assert "matrix" in result
    assert len(result["columns"]) == 9
    assert "cement" in result["matrix"]
    assert result["matrix"]["cement"]["cement"] == 1.0


def test_load_unified():
    svc = DataService()
    result = svc.load_unified()
    assert result["name"] == "unified"
    assert result["num_samples"] == 1030 + 500 + 400
    assert "sources" in result
    assert len(result["sources"]) == 3
    assert "correlations" in result
    assert len(result["feature_stats"]) > 0


def test_load_unified_filtered():
    svc = DataService()
    result = svc.load_unified(["concrete", "geopolymer"])
    assert result["num_samples"] == 1030 + 400
    assert len(result["sources"]) == 2
    assert "UCI Concrete" in result["sources"]
    assert "Mendeley Geopolymer" in result["sources"]
