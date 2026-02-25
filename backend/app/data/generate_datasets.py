"""Generate synthetic datasets for ConcreteXAI and Geopolymer."""
import numpy as np
import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent


def generate_concrete_xai(n=500, seed=42):
    rng = np.random.default_rng(seed)
    cement = rng.uniform(150, 500, n)
    fly_ash = rng.uniform(0, 200, n)
    water = rng.uniform(120, 240, n)
    superplasticizer = rng.uniform(0, 20, n)
    fine_aggregate = rng.uniform(500, 900, n)
    coarse_aggregate = rng.uniform(800, 1150, n)
    age = rng.choice([3, 7, 14, 28, 56, 90, 180, 365], n)

    wc_ratio = water / (cement + fly_ash + 1e-6)
    strength = (
        0.08 * cement
        + 0.03 * fly_ash
        - 15.0 * wc_ratio
        + 0.4 * superplasticizer
        + 0.005 * fine_aggregate
        + 0.003 * coarse_aggregate
        + 4.0 * np.log1p(age)
        + rng.normal(0, 3, n)
    )
    strength = np.clip(strength, 5, 85)

    df = pd.DataFrame({
        "cement": np.round(cement, 1),
        "fly_ash": np.round(fly_ash, 1),
        "water": np.round(water, 1),
        "superplasticizer": np.round(superplasticizer, 1),
        "fine_aggregate": np.round(fine_aggregate, 1),
        "coarse_aggregate": np.round(coarse_aggregate, 1),
        "age": age.astype(int),
        "compressive_strength": np.round(strength, 2),
    })
    return df


def generate_geopolymer(n=400, seed=123):
    rng = np.random.default_rng(seed)
    cement = rng.uniform(50, 300, n)
    fly_ash = rng.uniform(100, 400, n)
    water = rng.uniform(100, 220, n)
    superplasticizer = rng.uniform(0, 15, n)
    fine_aggregate = rng.uniform(400, 800, n)
    coarse_aggregate = rng.uniform(700, 1100, n)
    age = rng.choice([3, 7, 14, 28, 56, 90], n)

    fa_ratio = fly_ash / (cement + fly_ash + 1e-6)
    wc_ratio = water / (cement + fly_ash + 1e-6)
    strength = (
        0.04 * cement
        + 0.06 * fly_ash
        + 10.0 * fa_ratio
        - 20.0 * wc_ratio
        + 0.3 * superplasticizer
        + 0.004 * fine_aggregate
        + 0.002 * coarse_aggregate
        + 3.5 * np.log1p(age)
        + rng.normal(0, 4, n)
    )
    strength = np.clip(strength, 5, 70)

    df = pd.DataFrame({
        "cement": np.round(cement, 1),
        "fly_ash": np.round(fly_ash, 1),
        "water": np.round(water, 1),
        "superplasticizer": np.round(superplasticizer, 1),
        "fine_aggregate": np.round(fine_aggregate, 1),
        "coarse_aggregate": np.round(coarse_aggregate, 1),
        "age": age.astype(int),
        "compressive_strength": np.round(strength, 2),
    })
    return df


if __name__ == "__main__":
    df_xai = generate_concrete_xai()
    df_xai.to_csv(DATA_DIR / "concrete_xai.csv", index=False)
    print(f"Generated concrete_xai.csv: {len(df_xai)} rows")

    df_geo = generate_geopolymer()
    df_geo.to_csv(DATA_DIR / "geopolymer.csv", index=False)
    print(f"Generated geopolymer.csv: {len(df_geo)} rows")
