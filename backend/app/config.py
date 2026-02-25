from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

UNIFIED_FEATURES = [
    "cement", "fly_ash", "water", "superplasticizer",
    "fine_aggregate", "coarse_aggregate", "age",
]

DATASETS = {
    "concrete": {
        "file": "concrete.csv",
        "description": "UCI Concrete Compressive Strength Dataset",
        "source_label": "UCI Concrete",
        "features": [
            "cement", "blast_furnace_slag", "fly_ash", "water",
            "superplasticizer", "coarse_aggregate", "fine_aggregate", "age",
        ],
        "target": "compressive_strength",
        "units": {
            "cement": "kg/m³",
            "blast_furnace_slag": "kg/m³",
            "fly_ash": "kg/m³",
            "water": "kg/m³",
            "superplasticizer": "kg/m³",
            "coarse_aggregate": "kg/m³",
            "fine_aggregate": "kg/m³",
            "age": "days",
            "compressive_strength": "MPa",
        },
    },
    "concrete_xai": {
        "file": "concrete_xai.csv",
        "description": "ConcreteXAI Extended Dataset (synthetic)",
        "source_label": "ConcreteXAI",
        "features": [
            "cement", "fly_ash", "water", "superplasticizer",
            "fine_aggregate", "coarse_aggregate", "age",
        ],
        "target": "compressive_strength",
        "units": {
            "cement": "kg/m³",
            "fly_ash": "kg/m³",
            "water": "kg/m³",
            "superplasticizer": "kg/m³",
            "fine_aggregate": "kg/m³",
            "coarse_aggregate": "kg/m³",
            "age": "days",
            "compressive_strength": "MPa",
        },
    },
    "geopolymer": {
        "file": "geopolymer.csv",
        "description": "Mendeley Geopolymer Concrete Dataset (synthetic)",
        "source_label": "Mendeley Geopolymer",
        "features": [
            "cement", "fly_ash", "water", "superplasticizer",
            "fine_aggregate", "coarse_aggregate", "age",
        ],
        "target": "compressive_strength",
        "units": {
            "cement": "kg/m³",
            "fly_ash": "kg/m³",
            "water": "kg/m³",
            "superplasticizer": "kg/m³",
            "fine_aggregate": "kg/m³",
            "coarse_aggregate": "kg/m³",
            "age": "days",
            "compressive_strength": "MPa",
        },
    },
}

BUILTIN_DATASETS = set(DATASETS.keys())
