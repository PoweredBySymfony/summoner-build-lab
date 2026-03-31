from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, cast

import numpy as np

from inference.config import AppConfig, get_config
from models.artifacts import load_metadata, load_model
from models.feature_builder import build_feature_dict


@dataclass(slots=True)
class RankedPrediction:
    item_slug: str
    score: float


@dataclass(slots=True)
class PredictionOutput:
    model_ready: bool
    predicted_item_slug: str | None
    confidence: float | None
    top_predictions: list[RankedPrediction]
    model_version: str | None


class ModelNotReadyError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def load_prediction_bundle() -> dict[str, Any]:
    config = get_config()
    if not config.paths.baseline_model_path.exists():
        raise ModelNotReadyError("Model artifact is missing.")
    bundle = cast(dict[str, Any], load_model(config.paths.baseline_model_path))
    bundle["metadata"] = (
        load_metadata(config.paths.baseline_metadata_path)
        if config.paths.baseline_metadata_path.exists()
        else {}
    )
    return bundle


def clear_model_cache() -> None:
    load_prediction_bundle.cache_clear()


def predict_next_item(payload: dict[str, Any], config: AppConfig | None = None) -> PredictionOutput:
    active_config = config or get_config()
    if not active_config.paths.baseline_model_path.exists():
        return PredictionOutput(
            model_ready=False,
            predicted_item_slug=None,
            confidence=None,
            top_predictions=[],
            model_version=None,
        )

    bundle = load_prediction_bundle()
    vectorizer = bundle["vectorizer"]
    model = bundle["model"]
    encoder = bundle["label_encoder"]
    metadata = bundle.get("metadata", {})

    feature_vector = vectorizer.transform([build_feature_dict(payload)])
    probabilities = model.predict_proba(feature_vector)[0]
    ordered_indexes = np.argsort(probabilities)[::-1]
    top_k = min(active_config.training.max_top_k, len(ordered_indexes))
    ranked_predictions = [
        RankedPrediction(
            item_slug=str(encoder.inverse_transform([int(index)])[0]),
            score=float(probabilities[int(index)]),
        )
        for index in ordered_indexes[:top_k]
    ]
    primary = ranked_predictions[0] if ranked_predictions else None
    return PredictionOutput(
        model_ready=True,
        predicted_item_slug=primary.item_slug if primary else None,
        confidence=primary.score if primary else None,
        top_predictions=ranked_predictions,
        model_version=str(metadata.get("version", active_config.project.version)),
    )
