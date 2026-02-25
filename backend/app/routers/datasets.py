from io import StringIO

import httpx
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response

from ..models.schemas import (
    CorrelationMatrix,
    DatasetInfo,
    DatasetSummary,
    FeatureDistribution,
    UnifiedSummary,
    UploadDatasetResponse,
)
from ..services.data_service import data_service

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=list[DatasetInfo])
def list_datasets():
    return data_service.list_datasets()


@router.post("/upload", response_model=UploadDatasetResponse)
async def upload_dataset(
    name: str = Form(...),
    description: str = Form(""),
    target: str = Form(""),
    file: UploadFile | None = File(None),
    url: str = Form(""),
):
    if not file and not url:
        raise HTTPException(status_code=400, detail="Provide either a file or a URL")

    try:
        if url:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, follow_redirects=True, timeout=30)
                resp.raise_for_status()
            df = pd.read_csv(StringIO(resp.text))
        else:
            content = await file.read()
            df = pd.read_csv(StringIO(content.decode("utf-8")))
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download URL: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    if not target:
        numeric_cols = df.select_dtypes(include="number").columns.tolist()
        if not numeric_cols:
            raise HTTPException(status_code=400, detail="No numeric columns found in CSV")
        target = numeric_cols[-1]

    try:
        info = data_service.register_dataset(name, description, target, df)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return UploadDatasetResponse(message="Dataset uploaded successfully", dataset=DatasetInfo(**info))


@router.delete("/{name}", status_code=204)
def delete_dataset(name: str):
    try:
        data_service.remove_dataset(name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(status_code=204)


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
