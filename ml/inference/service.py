from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, cast

import numpy as np

from features.catalogs import build_candidate_pool, load_catalog_bundle
from inference.config import AppConfig, get_config
from models.artifacts import load_metadata, load_model
from models.feature_builder import build_ranking_feature_dict


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
    candidate_pool_size: int = 0


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
    metadata = bundle.get("metadata", {})
    catalog = load_catalog_bundle(
        active_config.paths.export_manifest_path,
        active_config.paths.raw_data_dir,
        str(payload.get("patch") or "unknown"),
        active_config.paths.item_catalog_path,
        active_config.paths.champion_catalog_path,
    )
    candidate_pool = payload.get("candidate_pool")
    if not isinstance(candidate_pool, list) or not candidate_pool:
        candidate_pool = build_candidate_pool(
            catalog,
            owned_item_slugs=[
                str(item_slug)
                for item_slug in payload.get("current_items", [])
                if str(item_slug).strip()
            ],
            gold_available=int(payload.get("gold_available", 0) or 0),
            role=str(payload.get("role") or "").strip().upper() or None,
        )

    if not candidate_pool:
        return PredictionOutput(
            model_ready=True,
            predicted_item_slug=None,
            confidence=None,
            top_predictions=[],
            model_version=str(metadata.get("version", active_config.project.version)),
            candidate_pool_size=0,
        )

    ranking_rows = []
    for candidate_item_slug in candidate_pool:
        item_meta = catalog.item_meta_by_slug.get(str(candidate_item_slug), {})
        ranking_rows.append(
            {
                **payload,
                "candidate_item_slug": str(candidate_item_slug),
                "item_cost": int(item_meta.get("goldTotal", 0) or 0),
                "item_category": str(item_meta.get("category") or "unknown"),
                "item_is_boots": bool(item_meta.get("isBoots", False)),
                "item_is_legendary": bool(item_meta.get("isLegendary", False)),
                "item_builds_from_count": len(item_meta.get("buildsFrom", []))
                if isinstance(item_meta.get("buildsFrom"), list)
                else 0,
                "item_builds_into_count": len(item_meta.get("buildsInto", []))
                if isinstance(item_meta.get("buildsInto"), list)
                else 0,
                "item_tags": item_meta.get("tags", []),
            }
        )

    feature_vector = vectorizer.transform(
        [build_ranking_feature_dict(row) for row in ranking_rows]
    )
    scores = model.predict(feature_vector)
    ordered_indexes = np.argsort(scores)[::-1]
    top_k = min(active_config.training.max_top_k, len(ordered_indexes))
    ranked_predictions = [
        RankedPrediction(
            item_slug=str(candidate_pool[int(index)]),
            score=float(scores[int(index)]),
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
        candidate_pool_size=len(candidate_pool),
    )
