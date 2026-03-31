from __future__ import annotations

from collections.abc import Mapping
from typing import Any

NUMERIC_FIELDS = [
    "timestamp_minutes",
    "gold_available",
    "level",
    "kills",
    "deaths",
    "assists",
    "cs",
    "current_item_count",
    "ally_frontline_count",
    "ally_magic_damage_count",
    "ally_physical_damage_count",
    "ally_support_count",
    "enemy_frontline_count",
    "enemy_magic_damage_count",
    "enemy_physical_damage_count",
    "enemy_support_count",
]

CATEGORICAL_FIELDS = ["patch", "champion_slug", "role"]


def _safe_float(value: Any) -> float:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, int | float):
        return float(value)
    return 0.0


def build_feature_dict(row: Mapping[str, Any]) -> dict[str, float | str]:
    features: dict[str, float | str] = {}

    for field in NUMERIC_FIELDS:
        features[field] = _safe_float(row.get(field))

    for field in CATEGORICAL_FIELDS:
        value = str(row.get(field) or "unknown").strip()
        features[field] = value or "unknown"

    current_items = row.get("current_items", [])
    if isinstance(current_items, list):
        for item_slug in current_items:
            normalized = str(item_slug).strip()
            if normalized:
                features[f"current_item::{normalized}"] = 1.0

    return features
