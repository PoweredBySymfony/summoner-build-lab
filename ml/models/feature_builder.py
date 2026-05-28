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
RANKING_NUMERIC_FIELDS = NUMERIC_FIELDS + [
    "item_cost",
    "item_is_boots",
    "item_is_legendary",
    "item_builds_from_count",
    "item_builds_into_count",
]
RANKING_CATEGORICAL_FIELDS = CATEGORICAL_FIELDS + ["candidate_item_slug", "item_category"]


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


def build_ranking_feature_dict(row: Mapping[str, Any]) -> dict[str, float | str]:
    features: dict[str, float | str] = {}

    for field in RANKING_NUMERIC_FIELDS:
        features[field] = _safe_float(row.get(field))

    for field in RANKING_CATEGORICAL_FIELDS:
        value = str(row.get(field) or "unknown").strip()
        features[field] = value or "unknown"

    current_items = row.get("current_items", [])
    if isinstance(current_items, list):
        for item_slug in current_items:
            normalized = str(item_slug).strip()
            if normalized:
                features[f"current_item::{normalized}"] = 1.0

    item_tags = row.get("item_tags", [])
    if isinstance(item_tags, list):
        for item_tag in item_tags:
            normalized_tag = str(item_tag).strip()
            if normalized_tag:
                features[f"item_tag::{normalized_tag}"] = 1.0

    return features
