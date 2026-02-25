from fastapi import APIRouter, HTTPException
from ..services.xai_service import xai_service
from ..models.schemas import (
    ShapSummaryData, FeatureImportanceData,
    PredictRequest, PredictionExplanation, DependenceData,
)

router = APIRouter(prefix="/api/explanations", tags=["explanations"])


@router.post("/{model_id}/compute")
def compute_shap(model_id: str):
    try:
        xai_service.compute_shap_values(model_id)
        return {"status": "ok", "model_id": model_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{model_id}/summary", response_model=ShapSummaryData)
def get_summary(model_id: str):
    try:
        return xai_service.get_summary_plot_data(model_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{model_id}/importance", response_model=FeatureImportanceData)
def get_importance(model_id: str):
    try:
        return xai_service.get_feature_importance(model_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{model_id}/predict", response_model=PredictionExplanation)
def explain_prediction(model_id: str, req: PredictRequest):
    try:
        input_data = req.model_dump()
        return xai_service.explain_prediction(model_id, input_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{model_id}/dependence/{feature}", response_model=DependenceData)
def get_dependence(model_id: str, feature: str):
    try:
        return xai_service.get_dependence_data(model_id, feature)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
