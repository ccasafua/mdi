from fastapi import APIRouter, HTTPException, Query
from ..services.data_service import data_service
from ..models.schemas import (
    DatasetInfo, DatasetSummary, FeatureDistribution,
    CorrelationMatrix, UnifiedSummary,
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=list[DatasetInfo])
def list_datasets():
    return data_service.list_datasets()


@router.get("/unified/summary", response_model=UnifiedSummary)
def get_unified_summary(sources: str = Query(default="")):
    try:
        dataset_names = None
        if sources:
            dataset_names = [s.strip() for s in sources.split(",")]
        return data_service.load_unified(dataset_names)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{name}/summary", response_model=DatasetSummary)
def get_summary(name: str):
    try:
        return data_service.get_summary(name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{name}/correlations", response_model=CorrelationMatrix)
def get_correlations(name: str):
    try:
        return data_service.get_correlation_matrix(name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{name}/sample")
def get_sample(
    name: str,
    n: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    try:
        return data_service.get_sample(name, n=n, offset=offset)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{name}/distributions", response_model=list[FeatureDistribution])
def get_distributions(name: str, bins: int = Query(default=20, ge=5, le=50)):
    try:
        return data_service.get_feature_distributions(name, bins=bins)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
