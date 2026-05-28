from __future__ import annotations

from fastapi import FastAPI

from inference.config import get_config
from inference.schemas import (
    PredictNextItemRequest,
    PredictNextItemResponse,
    RankedPredictionResponse,
)
from inference.service import predict_next_item

app = FastAPI(title="Summoner Build Lab ML", version="0.2.0")


@app.get("/health")
def health() -> dict[str, object]:
    config = get_config()
    return {
        "status": "ok",
        "service": config.project.name,
        "environment": config.project.environment,
        "model_ready": config.paths.baseline_model_path.exists(),
        "dataset_ready": config.paths.analytic_dataset_path.exists(),
    }


@app.get("/version")
def version() -> dict[str, str]:
    config = get_config()
    return {
        "service": config.project.name,
        "version": config.project.version,
        "config": "base.yaml",
    }


@app.post("/predict-next-item", response_model=PredictNextItemResponse)
def predict_next_item_endpoint(payload: PredictNextItemRequest) -> PredictNextItemResponse:
    prediction = predict_next_item(payload.model_dump())
    if not prediction.model_ready:
        return PredictNextItemResponse(
        model_ready=False,
        message=(
                "Model artifact is not available yet. "
                "Build the dataset and train the ranking model first."
            ),
        )

    return PredictNextItemResponse(
        model_ready=True,
        predicted_item_slug=prediction.predicted_item_slug,
        confidence=prediction.confidence,
        candidate_pool_size=prediction.candidate_pool_size,
        top_k_predictions=[
            RankedPredictionResponse(item_slug=item.item_slug, score=item.score)
            for item in prediction.top_predictions
        ],
        model_version=prediction.model_version,
        message="Prediction generated from the local next-item ranking model.",
    )
