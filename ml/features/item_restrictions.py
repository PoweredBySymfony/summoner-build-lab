from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


RestrictionReason = str
BASIC_BOOTS_RIOT_ITEM_ID = 1001


def _normalize_patch_family(patch: str) -> str:
    trimmed = str(patch or "").strip()
    if not trimmed:
        return "unknown"
    parts = trimmed.split(".")
    return f"{parts[0]}.{parts[1]}" if len(parts) >= 2 else trimmed


def _normalize_role(role: str | None) -> str | None:
    normalized = str(role or "").strip().upper()
    return normalized or None


def _safe_int(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int | float):
        return int(value)
    return 0


def _item_groups(item: dict[str, Any]) -> set[str]:
    groups = {str(value).strip().lower() for value in item.get("itemGroups", []) if str(value).strip()}
    if item.get("isBoots"):
        groups.add("boots")
    builds_from = {_safe_int(value) for value in item.get("buildsFrom", [])}
    if 3035 in builds_from:
        groups.add("lastwhisper")
    return groups


def _is_tier3_boots(item: dict[str, Any], item_meta_by_slug: dict[str, dict[str, Any]]) -> bool:
    builds_from = [_safe_int(value) for value in item.get("buildsFrom", [])]
    if not builds_from or BASIC_BOOTS_RIOT_ITEM_ID in builds_from:
        return False

    meta_by_riot_item_id = {
        _safe_int(meta.get("riotItemId")): meta
        for meta in item_meta_by_slug.values()
        if isinstance(meta, dict) and _safe_int(meta.get("riotItemId")) > 0
    }

    def _is_boot_lineage(riot_item_id: int, seen: set[int]) -> bool:
        if riot_item_id in seen:
            return False
        if riot_item_id == BASIC_BOOTS_RIOT_ITEM_ID:
            return True
        meta = meta_by_riot_item_id.get(riot_item_id)
        if not isinstance(meta, dict):
            return False
        next_seen = seen | {riot_item_id}
        if meta.get("isBoots"):
            return True
        parent_ids = [_safe_int(value) for value in meta.get("buildsFrom", [])]
        return any(parent_id > 0 and _is_boot_lineage(parent_id, next_seen) for parent_id in parent_ids)

    return any(riot_item_id > 0 and _is_boot_lineage(riot_item_id, set()) for riot_item_id in builds_from)


@lru_cache(maxsize=1)
def load_item_restrictions(
    path: Path | None = None,
) -> dict[str, Any]:
    config_path = path or Path(__file__).resolve().parents[1] / "configs" / "item_restrictions.json"
    return json.loads(config_path.read_text(encoding="utf-8"))


def get_item_restriction_reasons(
    *,
    item_slug: str,
    patch: str,
    role: str | None,
    config: dict[str, Any] | None = None,
) -> list[RestrictionReason]:
    payload = config or load_item_restrictions()
    patches = payload.get("patches", [])
    patch_family = _normalize_patch_family(patch)
    patch_entry = next(
        (
            entry
            for entry in patches
            if _normalize_patch_family(str(entry.get("patch") or "")) == patch_family
        ),
        None,
    )
    if not isinstance(patch_entry, dict):
        return []

    normalized_role = _normalize_role(role)
    allowlist = {
        str(value).strip()
        for value in patch_entry.get("roleAllowlistOverrides", {}).get(normalized_role or "", [])
    }
    if item_slug in allowlist:
        return []

    reasons: list[RestrictionReason] = []
    global_blacklist = {str(value).strip() for value in patch_entry.get("globalBlacklist", [])}
    if item_slug in global_blacklist:
        reasons.append("patch-restricted")

    if normalized_role is not None:
        role_restrictions = {
            str(value).strip()
            for value in patch_entry.get("roleRestrictions", {}).get(normalized_role, [])
        }
        if item_slug in role_restrictions:
            reasons.append("role-restricted")

    return reasons


def is_item_allowed_for_role(
    *,
    item_slug: str,
    patch: str,
    role: str | None,
    config: dict[str, Any] | None = None,
) -> bool:
    return len(
        get_item_restriction_reasons(
            item_slug=item_slug,
            patch=patch,
            role=role,
            config=config,
        )
    ) == 0


def get_structural_restriction_reasons(
    *,
    item: dict[str, Any],
    role: str | None,
    owned_item_slugs: set[str],
    item_meta_by_slug: dict[str, dict[str, Any]],
) -> list[RestrictionReason]:
    reasons: list[RestrictionReason] = []
    normalized_role = _normalize_role(role)

    if normalized_role and normalized_role != "MID" and _is_tier3_boots(item, item_meta_by_slug):
        reasons.append("role-restricted")

    candidate_groups = _item_groups(item)
    if candidate_groups:
        for owned_slug in owned_item_slugs:
            owned_item = item_meta_by_slug.get(owned_slug)
            if not isinstance(owned_item, dict):
                continue
            if candidate_groups.intersection(_item_groups(owned_item)):
                reasons.append("exclusive-group")
                break

    return reasons
