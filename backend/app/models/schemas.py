from pydantic import BaseModel, Field
from typing import Optional


# --- Dataset schemas ---

class DatasetInfo(BaseModel):
    name: str
    description: str
    source_label: str = ""
    features: list[str]
    target: str
    num_samples: int
    units: dict[str, str]


class FeatureStats(BaseModel):
    name: str
    mean: float
    std: float
    min: float
    max: float
    q25: float
    q50: float
    q75: float


class DatasetSummary(BaseModel):
    name: str
    num_samples: int
    num_features: int
    feature_stats: list[FeatureStats]
    correlations: dict[str, dict[str, float]]


class CorrelationMatrix(BaseModel):
    columns: list[str]
    matrix: dict[str, dict[str, float]]


class UnifiedSummary(BaseModel):
    name: str
    num_samples: int
    num_features: int
    feature_stats: list[FeatureStats]
    correlations: dict[str, dict[str, float]]
    sources: dict[str, int]
    dataset_names: list[str]


class DistributionBin(BaseModel):
    bin_start: float
    bin_end: float
    count: int


class FeatureDistribution(BaseModel):
    feature: str
    bins: list[DistributionBin]


# --- Model schemas ---

class TrainRequest(BaseModel):
    algorithm: str = Field(..., pattern="^(random_forest|gradient_boosting)$")
    test_size: float = Field(default=0.2, gt=0.0, lt=1.0)
    n_estimators: int = Field(default=100, ge=10, le=1000)
    max_depth: Optional[int] = Field(default=None, ge=1, le=50)
    learning_rate: Optional[float] = Field(default=0.1, gt=0.0, le=1.0)
    random_state: int = Field(default=42)


class ModelInfo(BaseModel):
    model_id: str
    algorithm: str
    params: dict
    r2: float
    mae: float
    rmse: float


class ModelMetrics(BaseModel):
    model_id: str
    algorithm: str
    r2: float
    mae: float
    rmse: float
    actual: list[float]
    predicted: list[float]


class PredictRequest(BaseModel):
    cement: float
    blast_furnace_slag: float = 0.0
    fly_ash: float = 0.0
    water: float
    superplasticizer: float = 0.0
    coarse_aggregate: float
    fine_aggregate: float
    age: float


class PredictResponse(BaseModel):
    prediction: float
    model_id: str
    input_data: dict[str, float]


class BatchPredictRequest(BaseModel):
    samples: list[PredictRequest]


class BatchPredictResponse(BaseModel):
    predictions: list[float]
    model_id: str


# --- Uncertainty schemas ---

class UncertaintyInfo(BaseModel):
    lower_bound: float
    upper_bound: float
    std_dev: float
    confidence: float = 0.95


class PredictWithUncertaintyResponse(BaseModel):
    prediction: float
    uncertainty: UncertaintyInfo
    model_id: str
    input_data: dict[str, float]


# --- XAI schemas ---

class ShapSummaryPoint(BaseModel):
    feature: str
    shap_value: float
    feature_value: float


class ShapSummaryData(BaseModel):
    model_id: str
    points: list[ShapSummaryPoint]
    feature_names: list[str]


class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float


class FeatureImportanceData(BaseModel):
    model_id: str
    importances: list[FeatureImportanceItem]


class ShapWaterfallItem(BaseModel):
    feature: str
    shap_value: float
    feature_value: float


class PredictionExplanation(BaseModel):
    model_id: str
    prediction: float
    base_value: float
    waterfall: list[ShapWaterfallItem]
    interpretation: str
    uncertainty: Optional[UncertaintyInfo] = None


class DependencePoint(BaseModel):
    feature_value: float
    shap_value: float
    color_value: float


class DependenceData(BaseModel):
    model_id: str
    feature: str
    color_feature: str
    points: list[DependencePoint]


# --- Exploration schemas ---

class ParametricSweepRequest(BaseModel):
    model_id: str
    base_config: dict[str, float]
    sweep_feature: str = "fly_ash"
    min_val: float = 0.0
    max_val: float = 200.0
    steps: int = Field(default=20, ge=5, le=100)


class ParametricSweepPoint(BaseModel):
    feature_value: float
    prediction: float
    lower_bound: float
    upper_bound: float


class ParametricSweepResponse(BaseModel):
    model_id: str
    sweep_feature: str
    points: list[ParametricSweepPoint]
    optimal_region: dict


class VariableRange(BaseModel):
    feature: str
    min_val: float
    max_val: float
    steps: int = 20


class MultivariableRequest(BaseModel):
    model_id: str
    base_config: dict[str, float]
    variable_ranges: list[VariableRange]


class MultivariableResponse(BaseModel):
    model_id: str
    axes: dict[str, list[float]]
    predictions: list[list[float]]
    variable_names: list[str]


class CompareRequest(BaseModel):
    model_id: str
    configurations: list[dict[str, float]]
    labels: list[str]


class ComparisonResult(BaseModel):
    label: str
    prediction: float
    lower_bound: float
    upper_bound: float
    top_shap: list[dict]


class CompareResponse(BaseModel):
    model_id: str
    results: list[ComparisonResult]


# --- Configuration schemas ---

class SaveConfigurationRequest(BaseModel):
    label: str
    values: dict[str, float]
    model_id: str
    predicted_strength: float
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    is_candidate: bool = False


class ConfigurationItem(BaseModel):
    id: str
    label: str
    values: dict[str, float]
    model_id: str
    predicted_strength: float
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    is_candidate: bool = False
