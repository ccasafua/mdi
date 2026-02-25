from fastapi import APIRouter, HTTPException
from ..services.exploration_service import exploration_service
from ..models.schemas import (
    ParametricSweepRequest, ParametricSweepResponse,
    MultivariableRequest, MultivariableResponse,
    CompareRequest, CompareResponse,
)

router = APIRouter(prefix="/api/exploration", tags=["exploration"])


@router.post("/parametric", response_model=ParametricSweepResponse)
def parametric_sweep(req: ParametricSweepRequest):
    try:
        return exploration_service.parametric_sweep(
            model_id=req.model_id,
            base_config=req.base_config,
            sweep_feature=req.sweep_feature,
            min_val=req.min_val,
            max_val=req.max_val,
            steps=req.steps,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/multivariable", response_model=MultivariableResponse)
def multivariable_exploration(req: MultivariableRequest):
    try:
        ranges = [r.model_dump() for r in req.variable_ranges]
        return exploration_service.multivariable_exploration(
            model_id=req.model_id,
            base_config=req.base_config,
            variable_ranges=ranges,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/compare", response_model=CompareResponse)
def compare_configurations(req: CompareRequest):
    try:
        return exploration_service.compare_configurations(
            model_id=req.model_id,
            configurations=req.configurations,
            labels=req.labels,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
