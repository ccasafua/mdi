from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from ..services.configuration_service import configuration_service
from ..models.schemas import SaveConfigurationRequest, ConfigurationItem

router = APIRouter(prefix="/api/configurations", tags=["configurations"])


@router.post("", response_model=ConfigurationItem)
def save_configuration(req: SaveConfigurationRequest):
    return configuration_service.save(
        label=req.label,
        values=req.values,
        model_id=req.model_id,
        predicted_strength=req.predicted_strength,
        lower_bound=req.lower_bound,
        upper_bound=req.upper_bound,
        is_candidate=req.is_candidate,
    )


@router.get("", response_model=list[ConfigurationItem])
def list_configurations():
    return configuration_service.list_all()


@router.patch("/{config_id}/validate", response_model=ConfigurationItem)
def mark_validation_candidate(config_id: str):
    try:
        return configuration_service.mark_as_validation_candidate(config_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{config_id}")
def delete_configuration(config_id: str):
    try:
        configuration_service.delete(config_id)
        return {"status": "deleted", "id": config_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/export", response_class=PlainTextResponse)
def export_configurations(only_candidates: bool = Query(default=False)):
    csv_content = configuration_service.export_csv(only_candidates=only_candidates)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=configurations.csv"},
    )
