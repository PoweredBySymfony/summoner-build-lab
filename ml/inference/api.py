from __future__ import annotations

from fastapi import FastAPI

from inference.config import get_config
from inference.schemas import PredictNextItemRequest, PredictNextItemResponse

app = FastAPI(title="Summoner Build Lab ML", version="0.1.0")


@app.get("/health")
def health() -> dict[str, object]:
    config = get_config()
    return {
        "status": "ok",
        "service": config.project.name,
        "environment": config.project.environment,
        "model_ready": config.paths.baseline_model_path.exists(),
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
def predict_next_item(payload: PredictNextItemRequest) -> PredictNextItemResponse:
    config = get_config()
    model_ready = config.paths.baseline_model_path.exists()
    return PredictNextItemResponse(
        model_ready=model_ready,
        ranked_candidates=payload.candidate_item_ids,
        message=(
            "Stub only: no League of Legends business model is wired yet."
            if not model_ready
            else "Baseline artifact detected, but prediction logic is still intentionally stubbed."
        ),
    )
