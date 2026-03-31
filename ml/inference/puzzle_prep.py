from __future__ import annotations

from dataclasses import dataclass

from inference.config import AppConfig, get_config
from inference.service import PredictionOutput


@dataclass(slots=True)
class PuzzleSeed:
    good_answer: str | None
    distractors: list[str]
    difficulty: str
    low_confidence: bool


def build_puzzle_seed(
    prediction: PredictionOutput, config: AppConfig | None = None
) -> PuzzleSeed:
    active_config = config or get_config()
    top_predictions = prediction.top_predictions
    top_answer = top_predictions[0].item_slug if top_predictions else None
    distractors = [
        entry.item_slug
        for entry in top_predictions[1 : 1 + active_config.puzzle.distractor_count]
    ]
    confidence = prediction.confidence or 0.0
    second_score = top_predictions[1].score if len(top_predictions) > 1 else 0.0
    confidence_gap = confidence - second_score
    low_confidence = (
        confidence < active_config.puzzle.min_confidence
        or confidence_gap < active_config.puzzle.min_confidence_gap
        or len(distractors) < active_config.puzzle.distractor_count
    )

    if confidence >= 0.7 and confidence_gap >= 0.2:
        difficulty = "easy"
    elif confidence >= 0.45 and confidence_gap >= 0.1:
        difficulty = "medium"
    else:
        difficulty = "hard"

    return PuzzleSeed(
        good_answer=top_answer,
        distractors=distractors,
        difficulty=difficulty,
        low_confidence=low_confidence,
    )
