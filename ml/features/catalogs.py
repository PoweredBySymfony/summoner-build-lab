from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class CatalogBundle:
    patch: str
    dd_version: str
    items: list[dict[str, Any]]
    champions: list[dict[str, Any]]
    item_slug_by_id: dict[int, str]
    item_meta_by_slug: dict[str, dict[str, Any]]
    champion_index: dict[int, dict[str, Any]]


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_manifest(manifest_path: Path) -> dict[str, Any]:
    payload = _load_json(manifest_path)
    if not isinstance(payload, dict):
        raise ValueError("Export manifest must be a JSON object.")
    return payload


def resolve_catalog_path(raw_data_dir: Path, relative_path: str) -> Path:
    return (raw_data_dir / relative_path).resolve()


def safe_int(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int | float):
        return int(value)
    return 0


@lru_cache(maxsize=32)
def load_catalog_bundle(
    manifest_path: Path,
    raw_data_dir: Path,
    patch: str,
    default_item_catalog_path: Path,
    default_champion_catalog_path: Path,
) -> CatalogBundle:
    manifest = load_manifest(manifest_path)
    patch_catalogs = manifest.get("patchCatalogs", {})
    catalog_entry = patch_catalogs.get(patch) if isinstance(patch_catalogs, dict) else None

    if isinstance(catalog_entry, dict):
        item_catalog_path = resolve_catalog_path(
            raw_data_dir,
            str(catalog_entry["itemCatalogPath"]),
        )
        champion_catalog_path = resolve_catalog_path(
            raw_data_dir, str(catalog_entry["championCatalogPath"])
        )
        dd_version = str(catalog_entry["ddVersion"])
    else:
        item_catalog_path = default_item_catalog_path
        champion_catalog_path = default_champion_catalog_path
        dd_version = str(manifest.get("latestDataDragonVersion", "unknown"))

    items = _load_json(item_catalog_path)
    champions = _load_json(champion_catalog_path)
    item_slug_by_id = {
        safe_int(item["riotItemId"]): str(item["slug"])
        for item in items
        if safe_int(item.get("riotItemId")) > 0
    }
    item_meta_by_slug = {
        str(item["slug"]): item
        for item in items
        if str(item.get("slug") or "").strip()
    }
    champion_index = {
        safe_int(champion["riotChampionId"]): champion
        for champion in champions
        if safe_int(champion.get("riotChampionId")) > 0
    }
    return CatalogBundle(
        patch=patch,
        dd_version=dd_version,
        items=items,
        champions=champions,
        item_slug_by_id=item_slug_by_id,
        item_meta_by_slug=item_meta_by_slug,
        champion_index=champion_index,
    )


def is_plausible_candidate(
    item: dict[str, Any],
    *,
    owned_item_slugs: set[str],
    gold_available: int,
) -> bool:
    slug = str(item.get("slug") or "")
    tags = {str(tag) for tag in item.get("tags", [])}
    map_availability = item.get("mapAvailability")
    on_summoners_rift = not isinstance(map_availability, dict) or bool(map_availability.get("11"))
    if not slug or slug in owned_item_slugs:
        return False
    if not item.get("isActive", False) or not on_summoners_rift:
        return False
    if item.get("isConsumable") or item.get("isStarter"):
        return False
    if "Trinket" in tags:
        return False
    if gold_available > 0 and safe_int(item.get("goldTotal")) > gold_available:
        return False
    return True


def build_candidate_pool(
    catalog: CatalogBundle,
    *,
    owned_item_slugs: list[str],
    gold_available: int,
) -> list[str]:
    owned_set = set(owned_item_slugs)
    candidates = [
        item
        for item in catalog.items
        if is_plausible_candidate(
            item,
            owned_item_slugs=owned_set,
            gold_available=gold_available,
        )
    ]
    candidates.sort(
        key=lambda item: (safe_int(item.get("goldTotal")), str(item.get("slug") or ""))
    )
    return [str(item["slug"]) for item in candidates]
