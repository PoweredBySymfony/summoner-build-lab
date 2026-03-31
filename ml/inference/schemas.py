from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PredictNextItemRequest(BaseModel):
    session_id: str | None = None
    candidate_item_ids: list[str] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


class PredictNextItemResponse(BaseModel):
    model_ready: bool
    predicted_item_id: str | None = None
    ranked_candidates: list[str] = Field(default_factory=list)
    message: str

