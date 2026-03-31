from __future__ import annotations

from pydantic import BaseModel, Field


class PredictNextItemRequest(BaseModel):
    patch: str
    champion_slug: str
    role: str | None = None
    gold_available: int = 0
    level: int = 1
    kills: int = 0
    deaths: int = 0
    assists: int = 0
    cs: int = 0
    timestamp_minutes: float = 0.0
    current_items: list[str] = Field(default_factory=list)
    ally_frontline_count: int = 0
    ally_magic_damage_count: int = 0
    ally_physical_damage_count: int = 0
    ally_support_count: int = 0
    enemy_frontline_count: int = 0
    enemy_magic_damage_count: int = 0
    enemy_physical_damage_count: int = 0
    enemy_support_count: int = 0


class RankedPredictionResponse(BaseModel):
    item_slug: str
    score: float


class PredictNextItemResponse(BaseModel):
    model_ready: bool
    predicted_item_slug: str | None = None
    confidence: float | None = None
    top_k_predictions: list[RankedPredictionResponse] = Field(default_factory=list)
    model_version: str | None = None
    message: str
