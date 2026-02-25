from fastapi import APIRouter, HTTPException
from ..services.model_service import model_service
from ..models.schemas import (
    TrainRequest, ModelInfo, ModelMetrics,
    PredictRequest, PredictResponse,
    BatchPredictRequest, BatchPredictResponse,
    PredictWithUncertaintyResponse,
)

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=list[ModelInfo])
def list_models():
    return model_service.list_models()


@router.post("/train", response_model=ModelInfo)
def train_model(req: TrainRequest):
    try:
        return model_service.train(
            algorithm=req.algorithm,
            test_size=req.test_size,
            n_estimators=req.n_estimators,
            max_depth=req.max_depth,
            learning_rate=req.learning_rate,
            random_state=req.random_state,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{model_id}/metrics", response_model=ModelMetrics)
def get_metrics(model_id: str):
    try:
        return model_service.get_metrics(model_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{model_id}/predict", response_model=PredictResponse)
def predict(model_id: str, req: PredictRequest):
    try:
        input_data = req.model_dump()
        prediction = model_service.predict(model_id, input_data)
        return {
            "prediction": prediction,
            "model_id": model_id,
            "input_data": input_data,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/{model_id}/predict/uncertainty",
    response_model=PredictWithUncertaintyResponse,
)
def predict_with_uncertainty(model_id: str, req: PredictRequest):
    try:
        input_data = req.model_dump()
        return model_service.predict_with_uncertainty(model_id, input_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{model_id}/predict/batch", response_model=BatchPredictResponse)
def predict_batch(model_id: str, req: BatchPredictRequest):
    try:
        predictions = []
        for sample in req.samples:
            pred = model_service.predict(model_id, sample.model_dump())
            predictions.append(pred)
        return {"predictions": predictions, "model_id": model_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
