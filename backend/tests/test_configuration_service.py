import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.configuration_service import ConfigurationService, STORE_PATH


def _fresh_service():
    # Remove persisted file if exists to start clean
    if STORE_PATH.exists():
        STORE_PATH.unlink()
    return ConfigurationService()


def test_save():
    svc = _fresh_service()
    item = svc.save(
        label="Test Config",
        values={"cement": 300, "water": 180},
        model_id="abc123",
        predicted_strength=35.5,
        lower_bound=30.0,
        upper_bound=41.0,
    )
    assert "id" in item
    assert item["label"] == "Test Config"
    assert item["predicted_strength"] == 35.5
    assert item["is_candidate"] is False
    # Clean up
    STORE_PATH.unlink(missing_ok=True)


def test_list():
    svc = _fresh_service()
    svc.save(label="A", values={"cement": 300}, model_id="m1", predicted_strength=30)
    svc.save(label="B", values={"cement": 250}, model_id="m1", predicted_strength=25)
    items = svc.list_all()
    assert len(items) == 2
    labels = [i["label"] for i in items]
    assert "A" in labels
    assert "B" in labels
    STORE_PATH.unlink(missing_ok=True)


def test_mark_candidate():
    svc = _fresh_service()
    item = svc.save(label="X", values={}, model_id="m1", predicted_strength=40)
    assert item["is_candidate"] is False
    updated = svc.mark_as_validation_candidate(item["id"])
    assert updated["is_candidate"] is True
    STORE_PATH.unlink(missing_ok=True)


def test_delete():
    svc = _fresh_service()
    item = svc.save(label="Del", values={}, model_id="m1", predicted_strength=20)
    assert len(svc.list_all()) == 1
    svc.delete(item["id"])
    assert len(svc.list_all()) == 0
    STORE_PATH.unlink(missing_ok=True)


def test_delete_not_found():
    svc = _fresh_service()
    try:
        svc.delete("nonexistent")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    STORE_PATH.unlink(missing_ok=True)


def test_export_csv():
    svc = _fresh_service()
    svc.save(label="C1", values={"cement": 300, "water": 180}, model_id="m1",
             predicted_strength=35, is_candidate=True)
    svc.save(label="C2", values={"cement": 250, "water": 190}, model_id="m1",
             predicted_strength=28, is_candidate=False)

    # Export all
    csv_all = svc.export_csv(only_candidates=False)
    lines = csv_all.strip().split("\n")
    assert len(lines) == 3  # header + 2 rows

    # Export only candidates
    csv_candidates = svc.export_csv(only_candidates=True)
    lines_c = csv_candidates.strip().split("\n")
    assert len(lines_c) == 2  # header + 1 row
    assert "C1" in lines_c[1]

    STORE_PATH.unlink(missing_ok=True)


def test_persistence():
    svc = _fresh_service()
    svc.save(label="Persist", values={"cement": 100}, model_id="m1", predicted_strength=20)

    # Create a new instance - should load from disk
    svc2 = ConfigurationService()
    items = svc2.list_all()
    assert len(items) == 1
    assert items[0]["label"] == "Persist"
    STORE_PATH.unlink(missing_ok=True)
