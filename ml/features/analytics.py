from __future__ import annotations

import json
import re
from bisect import bisect_right
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from features.catalogs import build_candidate_pool, load_catalog_bundle, load_manifest, safe_int
from features.quality import build_quality_summary, validate_quality_gates
from inference.config import AppConfig
from models.artifacts import save_metadata

PHYSICAL_TAGS = {"Marksman", "Assassin", "Fighter"}
MAGIC_TAGS = {"Mage", "Support"}
FRONTLINE_TAGS = {"Tank", "Fighter"}
CANONICAL_SEASON_2026_START = datetime(2026, 1, 1, tzinfo=UTC)


def _parse_game_creation_at(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
    raw = str(value).strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def _canonicalize_patch(patch_raw: Any, game_creation_at: Any) -> tuple[str | None, str]:
    value = str(patch_raw or "").strip()
    match = re.match(r"^(\d{1,2})\.(\d{1,2})", value)
    if not match:
        return None, "unknown"

    major = int(match.group(1))
    minor = int(match.group(2))
    game_date = _parse_game_creation_at(game_creation_at)

    if 20 <= major <= 29:
        return f"{major}.{minor}", "year_patch"
    if 10 <= major <= 19:
        if game_date is not None and game_date >= CANONICAL_SEASON_2026_START:
            return f"{major + 10}.{minor}", "legacy_patch"
        return f"{major}.{minor}", "legacy_patch"
    return f"{major}.{minor}", "unknown"


def _resolve_patch_fields(record: dict[str, Any]) -> tuple[str, str]:
    patch_canonical = str(record.get("patchCanonical") or record.get("patch") or "").strip()
    patch_format = str(record.get("patchFormat") or "").strip() or "unknown"

    if patch_canonical:
        return patch_canonical, patch_format

    canonical_patch, canonical_format = _canonicalize_patch(
        record.get("patch"),
        record.get("gameCreationAt"),
    )
    return canonical_patch or "unknown", canonical_format


def _patch_bucket(
    patch: Any,
    strict_prefixes: list[str],
    adjacent_prefixes: list[str],
) -> str:
    value = str(patch or "")
    if any(value.startswith(prefix) for prefix in strict_prefixes):
        return "exact_target_patch"
    if any(value.startswith(prefix) for prefix in adjacent_prefixes):
        return "adjacent_recent_patch"
    return "out_of_target_patch"


@dataclass(slots=True)
class DatasetBuildSummary:
    matches_seen: int
    matches_with_timeline: int
    snapshots_written: int
    ranking_rows_written: int
    train_rows: int
    validation_rows: int
    test_rows: int
    unique_labels: int
    skipped_matches: int


@dataclass(slots=True)
class EventCounters:
    kills: int = 0
    deaths: int = 0
    assists: int = 0


@dataclass(slots=True)
class MatchContext:
    patch: str
    patch_format: str
    catalog: Any
    participant_id: int
    composition_features: dict[str, int]
    frame_timestamps: list[int]
    frames: list[dict[str, Any]]


@dataclass(slots=True)
class PurchaseRows:
    row: dict[str, Any] | None
    ranking_rows: list[dict[str, Any]]
    missing_actual_item_count: int = 0
    gold_incoherent_count: int = 0


@dataclass(slots=True)
class RawDatasetRows:
    rows: list[dict[str, Any]]
    ranking_rows: list[dict[str, Any]]
    matches_with_timeline: int
    skipped_matches: int
    missing_actual_item_count: int
    gold_incoherent_count: int


@dataclass(slots=True)
class MatchRows:
    rows: list[dict[str, Any]]
    ranking_rows: list[dict[str, Any]]
    missing_actual_item_count: int = 0
    gold_incoherent_count: int = 0


def _extract_match_payloads(record: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]] | None:
    timeline_wrapper = record.get("timelineData")
    timeline_raw = timeline_wrapper.get("raw") if isinstance(timeline_wrapper, dict) else None
    match_wrapper = record.get("matchData", {})
    match_raw = match_wrapper.get("raw") if isinstance(match_wrapper, dict) else None
    if not isinstance(timeline_raw, dict) or not isinstance(match_raw, dict):
        return None
    return timeline_raw, match_raw


def _extract_participants(match_raw: dict[str, Any]) -> list[dict[str, Any]] | None:
    info = match_raw.get("info", {})
    participants = info.get("participants", []) if isinstance(info, dict) else []
    if not isinstance(participants, list):
        return None
    return [entry for entry in participants if isinstance(entry, dict)]


def _find_target_participant(
    participants: list[dict[str, Any]],
    target_puuid: str,
) -> dict[str, Any] | None:
    return next(
        (
            entry
            for entry in participants
            if str(entry.get("puuid") or "") == target_puuid
        ),
        None,
    )


def _extract_timeline_frames(timeline_raw: dict[str, Any]) -> list[dict[str, Any]] | None:
    timeline_info = timeline_raw.get("info", {})
    frames = timeline_info.get("frames", []) if isinstance(timeline_info, dict) else []
    if not isinstance(frames, list) or not frames:
        return None
    return [frame for frame in frames if isinstance(frame, dict)]


def _sorted_timeline_events(frames: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        (
            event
            for frame in frames
            for event in frame.get("events", [])
            if isinstance(event, dict)
        ),
        key=lambda entry: (safe_int(entry.get("timestamp")), str(entry.get("type") or "")),
    )


def _update_combat_counters(
    event: dict[str, Any],
    participant_id: int,
    kills: int,
    deaths: int,
    assists: int,
) -> tuple[int, int, int]:
    if str(event.get("type") or "") != "CHAMPION_KILL":
        return kills, deaths, assists

    if safe_int(event.get("killerId")) == participant_id:
        kills += 1
    if safe_int(event.get("victimId")) == participant_id:
        deaths += 1

    assisting_ids = event.get("assistingParticipantIds", [])
    normalized_assists = (
        [safe_int(value) for value in assisting_ids]
        if isinstance(assisting_ids, list)
        else []
    )
    if participant_id in normalized_assists:
        assists += 1
    return kills, deaths, assists


def _apply_inventory_event(inventory: list[int], event: dict[str, Any]) -> None:
    event_type = str(event.get("type") or "")
    item_id = safe_int(event.get("itemId"))
    if event_type in {"ITEM_SOLD", "ITEM_DESTROYED"} and item_id > 0:
        _remove_item_once(inventory, item_id)
    elif event_type == "ITEM_UNDO":
        before_id = safe_int(event.get("beforeId"))
        after_id = safe_int(event.get("afterId"))
        if before_id > 0:
            _remove_item_once(inventory, before_id)
        if after_id > 0:
            inventory.append(after_id)


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped:
            rows.append(json.loads(stripped))
    return rows


def _normalize_role(raw_value: Any) -> str | None:
    normalized = str(raw_value or "").strip().upper()
    if normalized in {"TOP", "JUNGLE", "MID", "ADC", "SUPPORT"}:
        return normalized
    if normalized == "MIDDLE":
        return "MID"
    if normalized in {"BOTTOM", "BOT", "CARRY"}:
        return "ADC"
    if normalized == "UTILITY":
        return "SUPPORT"
    return None


def _remove_item_once(items: list[int], item_id: int) -> None:
    if item_id in items:
        items.remove(item_id)


def _champion_profile(champion: dict[str, Any]) -> dict[str, int]:
    tags = {str(tag) for tag in champion.get("tags", [])}
    return {
        "frontline": int(bool(tags & FRONTLINE_TAGS)),
        "physical": int(bool(tags & PHYSICAL_TAGS)),
        "magic": int(bool(tags & MAGIC_TAGS)),
        "support": int("Support" in tags),
    }


def _aggregate_team_features(
    participants: list[dict[str, Any]],
    own_team_id: int,
    champion_index: dict[int, dict[str, Any]],
) -> dict[str, int]:
    features = {
        "ally_frontline_count": 0,
        "ally_magic_damage_count": 0,
        "ally_physical_damage_count": 0,
        "ally_support_count": 0,
        "enemy_frontline_count": 0,
        "enemy_magic_damage_count": 0,
        "enemy_physical_damage_count": 0,
        "enemy_support_count": 0,
    }
    for participant in participants:
        champion = champion_index.get(safe_int(participant.get("championId")))
        if champion is None:
            continue
        prefix = "ally" if safe_int(participant.get("teamId")) == own_team_id else "enemy"
        profile = _champion_profile(champion)
        features[f"{prefix}_frontline_count"] += profile["frontline"]
        features[f"{prefix}_magic_damage_count"] += profile["magic"]
        features[f"{prefix}_physical_damage_count"] += profile["physical"]
        features[f"{prefix}_support_count"] += profile["support"]
    return features


def _frame_state_by_timestamp(
    frames: list[dict[str, Any]],
) -> tuple[list[int], list[dict[str, Any]]]:
    timestamps = [safe_int(frame.get("timestamp")) for frame in frames]
    return timestamps, frames


def _frame_for_timestamp(
    event_timestamp: int,
    frame_timestamps: list[int],
    frames: list[dict[str, Any]],
) -> dict[str, Any] | None:
    index = bisect_right(frame_timestamps, event_timestamp) - 1
    if index < 0:
        return None
    return frames[index]


def _participant_frame(frame: dict[str, Any] | None, participant_id: int) -> dict[str, Any]:
    if frame is None:
        return {}
    participant_frames = frame.get("participantFrames", {})
    if isinstance(participant_frames, dict):
        return (
            participant_frames.get(str(participant_id), {})
            or participant_frames.get(participant_id, {})
            or {}
        )
    return {}


def _item_gold_values(catalog: Any, item_id: int) -> tuple[int, int]:
    item_slug = catalog.item_slug_by_id.get(item_id)
    if not item_slug:
        return 0, 0
    item_meta = catalog.item_meta_by_slug.get(item_slug, {})
    total = safe_int(item_meta.get("goldTotal"))
    gold_sell = item_meta.get("goldSell")
    sell = safe_int(gold_sell) if gold_sell is not None else int(total * 0.7)
    return total, sell


def _gold_before_purchase_from_frame_events(
    *,
    events: list[dict[str, Any]],
    participant_id: int,
    purchase_event_index: int,
    ending_gold: int,
    catalog: Any,
) -> int:
    working_gold = ending_gold

    for index in range(len(events) - 1, purchase_event_index - 1, -1):
        event = events[index]
        if safe_int(event.get("participantId")) != participant_id:
            continue

        event_type = str(event.get("type") or "")
        item_id = safe_int(event.get("itemId"))

        if event_type == "ITEM_PURCHASED" and item_id > 0:
            item_cost, _ = _item_gold_values(catalog, item_id)
            working_gold += item_cost
            if index == purchase_event_index:
                return working_gold
            continue

        if event_type == "ITEM_SOLD" and item_id > 0:
            _, sell_value = _item_gold_values(catalog, item_id)
            working_gold -= sell_value
            continue

        if event_type == "ITEM_UNDO" and index == purchase_event_index:
            return working_gold

    return working_gold


def _build_item_feature_payload(item_meta: dict[str, Any]) -> dict[str, Any]:
    builds_from = item_meta.get("buildsFrom", [])
    builds_into = item_meta.get("buildsInto", [])
    tags = item_meta.get("tags", [])
    return {
        "item_cost": safe_int(item_meta.get("goldTotal")),
        "item_category": str(item_meta.get("category") or "unknown"),
        "item_is_boots": bool(item_meta.get("isBoots", False)),
        "item_is_legendary": bool(item_meta.get("isLegendary", False)),
        "item_builds_from_count": len(builds_from) if isinstance(builds_from, list) else 0,
        "item_builds_into_count": len(builds_into) if isinstance(builds_into, list) else 0,
        "item_tags": tags if isinstance(tags, list) else [],
    }


def _load_catalog_for_record(config: AppConfig, patch: str) -> Any:
    return load_catalog_bundle(
        config.paths.export_manifest_path,
        config.paths.raw_data_dir,
        patch,
        config.paths.item_catalog_path,
        config.paths.champion_catalog_path,
    )


def _current_item_slugs(inventory: list[int], catalog: Any) -> list[str]:
    return [
        catalog.item_slug_by_id[item_id]
        for item_id in inventory
        if item_id in catalog.item_slug_by_id
    ]


def _event_index_in_frame(frame_events: Any, event: dict[str, Any]) -> int:
    if not isinstance(frame_events, list):
        return 0
    return next(
        (
            index
            for index, frame_event in enumerate(frame_events)
            if isinstance(frame_event, dict) and frame_event is event
        ),
        0,
    )


def _dict_events(events: Any) -> list[dict[str, Any]]:
    if not isinstance(events, list):
        return []
    return [event for event in events if isinstance(event, dict)]


def _build_snapshot_row(
    *,
    record: dict[str, Any],
    context: MatchContext,
    event_timestamp: int,
    participant_frame: dict[str, Any],
    counters: EventCounters,
    inventory: list[int],
    gold_available: int,
    candidate_pool: list[str],
    actual_next_item: str,
    actual_item_cost: int,
) -> dict[str, Any]:
    current_items = _current_item_slugs(inventory, context.catalog)
    return {
        "snapshot_id": f"{record.get('riotMatchId') or ''}:{event_timestamp}",
        "match_id": str(record.get("riotMatchId") or ""),
        "timestamp": event_timestamp,
        "timestamp_minutes": round(event_timestamp / 60000, 2),
        "patch": context.patch,
        "patch_canonical": context.patch,
        "patch_format": context.patch_format,
        "source_kind": str(record.get("sourceKind") or "unknown"),
        "source_tier": str(record.get("sourceTier") or "unknown"),
        "source_league": str(record.get("sourceLeague") or "unknown"),
        "source_region_hint": str(record.get("sourceRegionHint") or "unknown"),
        "dd_version": context.catalog.dd_version,
        "game_creation_at": str(record.get("gameCreationAt") or ""),
        "champion_id": safe_int(record.get("targetChampionId")),
        "champion_slug": str(record.get("targetChampionSlug") or "unknown"),
        "role": _normalize_role(record.get("targetRole")) or "UNKNOWN",
        "gold_available": gold_available,
        "level": safe_int(participant_frame.get("level")),
        "kills": counters.kills,
        "deaths": counters.deaths,
        "assists": counters.assists,
        "cs": safe_int(participant_frame.get("minionsKilled"))
        + safe_int(participant_frame.get("jungleMinionsKilled")),
        "current_items": current_items,
        "current_item_count": len(current_items),
        "candidate_pool": candidate_pool,
        "candidate_pool_size": len(candidate_pool),
        "actual_next_item": actual_next_item,
        "actual_item_in_candidate_pool": actual_next_item in candidate_pool,
        "actual_item_cost": actual_item_cost,
        **context.composition_features,
    }


def _build_ranking_rows(
    row: dict[str, Any],
    candidate_pool: list[str],
    actual_next_item: str,
    catalog: Any,
) -> list[dict[str, Any]]:
    return [
        {
            **row,
            "candidate_item_slug": candidate_item_slug,
            "label": int(candidate_item_slug == actual_next_item),
            **_build_item_feature_payload(catalog.item_meta_by_slug.get(candidate_item_slug, {})),
        }
        for candidate_item_slug in candidate_pool
    ]


def _build_purchase_rows(
    *,
    record: dict[str, Any],
    context: MatchContext,
    event: dict[str, Any],
    counters: EventCounters,
    inventory: list[int],
) -> PurchaseRows:
    item_id = safe_int(event.get("itemId"))
    actual_next_item = context.catalog.item_slug_by_id.get(item_id)
    if actual_next_item is None:
        return PurchaseRows(row=None, ranking_rows=[], missing_actual_item_count=1)

    event_timestamp = safe_int(event.get("timestamp"))
    frame = _frame_for_timestamp(event_timestamp, context.frame_timestamps, context.frames)
    participant_frame = _participant_frame(frame, context.participant_id)
    frame_events = frame.get("events", []) if isinstance(frame, dict) else []
    gold_available = _gold_before_purchase_from_frame_events(
        events=_dict_events(frame_events),
        participant_id=context.participant_id,
        purchase_event_index=_event_index_in_frame(frame_events, event),
        ending_gold=safe_int(participant_frame.get("currentGold")),
        catalog=context.catalog,
    )
    actual_item_meta = context.catalog.item_meta_by_slug.get(actual_next_item, {})
    actual_item_cost = safe_int(actual_item_meta.get("goldTotal"))
    current_items = _current_item_slugs(inventory, context.catalog)
    candidate_pool = build_candidate_pool(
        context.catalog,
        owned_item_slugs=current_items,
        gold_available=gold_available,
        role=_normalize_role(record.get("targetRole")),
    )
    row = _build_snapshot_row(
        record=record,
        context=context,
        event_timestamp=event_timestamp,
        participant_frame=participant_frame,
        counters=counters,
        inventory=inventory,
        gold_available=gold_available,
        candidate_pool=candidate_pool,
        actual_next_item=actual_next_item,
        actual_item_cost=actual_item_cost,
    )
    return PurchaseRows(
        row=row,
        ranking_rows=_build_ranking_rows(row, candidate_pool, actual_next_item, context.catalog),
        gold_incoherent_count=int(gold_available > 0 and actual_item_cost > gold_available),
    )


def _split_dataset(
    dataset: pd.DataFrame,
    config: AppConfig,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    total_rows = len(dataset)
    test_rows = min(max(1, int(total_rows * config.dataset.test_ratio)), max(total_rows - 2, 0))
    validation_rows = min(
        max(1, int(total_rows * config.dataset.validation_ratio)),
        max(total_rows - test_rows - 1, 0),
    )
    train_rows = total_rows - validation_rows - test_rows
    if train_rows <= 0:
        raise ValueError("Dataset split would leave no training rows.")
    return (
        dataset.iloc[:train_rows].copy(),
        dataset.iloc[train_rows : train_rows + validation_rows].copy(),
        dataset.iloc[train_rows + validation_rows :].copy(),
    )


def _build_match_context(
    record: dict[str, Any],
    config: AppConfig,
) -> tuple[MatchContext | None, bool]:
    payloads = _extract_match_payloads(record)
    if payloads is None:
        return None, False
    timeline_raw, match_raw = payloads

    participants = _extract_participants(match_raw)
    if participants is None:
        return None, False

    patch, patch_format = _resolve_patch_fields(record)
    catalog = _load_catalog_for_record(config, patch)
    target_puuid = str(record.get("targetPuuid") or "")
    participant = _find_target_participant(participants, target_puuid)
    if participant is None:
        return None, False

    participant_id = safe_int(participant.get("participantId"))
    if participant_id <= 0:
        return None, False

    frames = _extract_timeline_frames(timeline_raw)
    if frames is None:
        return None, True

    own_team_id = safe_int(participant.get("teamId"))
    frame_timestamps, normalized_frames = _frame_state_by_timestamp(frames)
    return (
        MatchContext(
            patch=patch,
            patch_format=patch_format,
            catalog=catalog,
            participant_id=participant_id,
            composition_features=_aggregate_team_features(
                participants,
                own_team_id,
                catalog.champion_index,
            ),
            frame_timestamps=frame_timestamps,
            frames=normalized_frames,
        ),
        True,
    )


def _process_match_events(record: dict[str, Any], context: MatchContext) -> MatchRows:
    rows: list[dict[str, Any]] = []
    ranking_rows: list[dict[str, Any]] = []
    counters = EventCounters()
    inventory: list[int] = []
    missing_actual_item_count = 0
    gold_incoherent_count = 0

    for event in _sorted_timeline_events(context.frames):
        counters.kills, counters.deaths, counters.assists = _update_combat_counters(
            event,
            context.participant_id,
            counters.kills,
            counters.deaths,
            counters.assists,
        )
        if safe_int(event.get("participantId")) != context.participant_id:
            continue

        event_type = str(event.get("type") or "")
        item_id = safe_int(event.get("itemId"))
        if event_type != "ITEM_PURCHASED" or item_id <= 0:
            _apply_inventory_event(inventory, event)
            continue

        purchase_rows = _build_purchase_rows(
            record=record,
            context=context,
            event=event,
            counters=counters,
            inventory=inventory,
        )
        if purchase_rows.row is not None:
            rows.append(purchase_rows.row)
            ranking_rows.extend(purchase_rows.ranking_rows)
        missing_actual_item_count += purchase_rows.missing_actual_item_count
        gold_incoherent_count += purchase_rows.gold_incoherent_count
        inventory.append(item_id)

    return MatchRows(
        rows=rows,
        ranking_rows=ranking_rows,
        missing_actual_item_count=missing_actual_item_count,
        gold_incoherent_count=gold_incoherent_count,
    )


def _build_raw_dataset_rows(config: AppConfig, raw_matches: list[dict[str, Any]]) -> RawDatasetRows:
    rows: list[dict[str, Any]] = []
    ranking_rows: list[dict[str, Any]] = []
    skipped_matches = 0
    matches_with_timeline = 0
    missing_actual_item_count = 0
    gold_incoherent_count = 0

    for record in raw_matches:
        context, has_timeline = _build_match_context(record, config)
        matches_with_timeline += int(has_timeline)
        if context is None:
            skipped_matches += 1
            continue

        match_rows = _process_match_events(record, context)
        rows.extend(match_rows.rows)
        ranking_rows.extend(match_rows.ranking_rows)
        missing_actual_item_count += match_rows.missing_actual_item_count
        gold_incoherent_count += match_rows.gold_incoherent_count

    return RawDatasetRows(
        rows=rows,
        ranking_rows=ranking_rows,
        matches_with_timeline=matches_with_timeline,
        skipped_matches=skipped_matches,
        missing_actual_item_count=missing_actual_item_count,
        gold_incoherent_count=gold_incoherent_count,
    )


def build_analytic_dataset(config: AppConfig) -> DatasetBuildSummary:
    raw_matches = _load_jsonl(config.paths.raw_matches_path)
    manifest = load_manifest(config.paths.export_manifest_path)
    raw_rows = _build_raw_dataset_rows(config, raw_matches)

    raw_dataset = pd.DataFrame(raw_rows.rows)
    raw_ranking_dataset = pd.DataFrame(raw_rows.ranking_rows)
    if raw_dataset.empty:
        raise ValueError("No analytic rows could be built from the exported raw matches.")

    raw_dataset["patch_bucket"] = raw_dataset["patch"].fillna("").apply(
        lambda value: _patch_bucket(
            value,
            config.dataset.strict_train_patch_prefixes,
            config.dataset.adjacent_train_patch_prefixes,
        )
    )
    raw_ranking_dataset["patch_bucket"] = raw_ranking_dataset["patch"].fillna("").apply(
        lambda value: _patch_bucket(
            value,
            config.dataset.strict_train_patch_prefixes,
            config.dataset.adjacent_train_patch_prefixes,
        )
    )

    if config.dataset.train_patch_mode == "strict_recent_competitive":
        dataset = raw_dataset[raw_dataset["patch_bucket"] == "exact_target_patch"].copy()
        ranking_dataset = raw_ranking_dataset[
            raw_ranking_dataset["patch_bucket"] == "exact_target_patch"
        ].copy()
    elif config.dataset.train_patch_mode == "recent_preferred_with_controlled_fallback":
        dataset = raw_dataset[
            raw_dataset["patch_bucket"].isin(["exact_target_patch", "adjacent_recent_patch"])
        ].copy()
        ranking_dataset = raw_ranking_dataset[
            raw_ranking_dataset["patch_bucket"].isin(
                ["exact_target_patch", "adjacent_recent_patch"]
            )
        ].copy()
    else:
        raise ValueError(f"Unsupported train_patch_mode: {config.dataset.train_patch_mode}")

    if dataset.empty:
        raise ValueError("No analytic rows match the configured training patch policy.")

    dataset = dataset.sort_values(
        ["game_creation_at", "timestamp", "match_id"]
    ).reset_index(drop=True)
    ranking_dataset = ranking_dataset.sort_values(
        ["game_creation_at", "timestamp", "match_id", "candidate_item_slug"]
    ).reset_index(drop=True)

    config.paths.analytic_dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_parquet(config.paths.analytic_dataset_path, index=False)
    ranking_dataset.to_parquet(config.paths.ranking_dataset_path, index=False)

    train_frame, validation_frame, test_frame = _split_dataset(dataset, config)
    train_frame.to_parquet(config.paths.train_dataset_path, index=False)
    validation_frame.to_parquet(config.paths.validation_dataset_path, index=False)
    test_frame.to_parquet(config.paths.test_dataset_path, index=False)

    label_counts = Counter(str(value) for value in dataset["actual_next_item"].tolist())
    quality_summary = build_quality_summary(
        dataset,
        missing_actual_item_count=raw_rows.missing_actual_item_count,
        gold_incoherent_count=raw_rows.gold_incoherent_count,
    )
    save_metadata(
        config.paths.dataset_report_path,
        {
            "rows": len(dataset),
            "matches_seen": len(raw_matches),
            "matches_with_timeline": raw_rows.matches_with_timeline,
            "skipped_matches": raw_rows.skipped_matches,
            "rows_before_train_patch_filter": len(raw_dataset),
            "rows_after_train_patch_filter": len(dataset),
            "unique_labels": len(label_counts),
            "top_labels": label_counts.most_common(15),
            "null_role_rows": int((dataset["role"] == "UNKNOWN").sum()),
            "train_rows": len(train_frame),
            "validation_rows": len(validation_frame),
            "test_rows": len(test_frame),
            "ranking_rows": len(ranking_dataset),
            "patches": sorted(str(value) for value in dataset["patch"].dropna().unique().tolist()),
            "strict_train_patch_prefixes": config.dataset.strict_train_patch_prefixes,
            "adjacent_train_patch_prefixes": config.dataset.adjacent_train_patch_prefixes,
            "train_patch_mode": config.dataset.train_patch_mode,
            "snapshots_by_patch": (
                dataset["patch"].fillna("unknown").value_counts().sort_values(ascending=False).to_dict()
            ),
            "snapshots_by_patch_before_filter": (
                raw_dataset["patch"].fillna("unknown").value_counts().sort_values(ascending=False).to_dict()
            ),
            "snapshots_by_patch_bucket": (
                dataset["patch_bucket"].fillna("unknown").value_counts().sort_values(ascending=False).to_dict()
            ),
            "snapshots_by_patch_format": (
                raw_dataset["patch_format"].fillna("unknown").value_counts().sort_values(ascending=False).to_dict()
                if "patch_format" in raw_dataset.columns
                else {}
            ),
            "snapshots_by_role": (
                dataset["role"].fillna("UNKNOWN").value_counts().sort_values(ascending=False).to_dict()
            ),
            "snapshots_by_champion": (
                dataset["champion_slug"].fillna("unknown").value_counts().head(30).to_dict()
            ),
            "snapshots_by_source_kind": (
                dataset["source_kind"].fillna("unknown").value_counts().sort_values(ascending=False).to_dict()
                if "source_kind" in dataset.columns
                else {}
            ),
            "snapshots_by_source_tier": (
                dataset["source_tier"].fillna("unknown").value_counts().sort_values(ascending=False).to_dict()
                if "source_tier" in dataset.columns
                else {}
            ),
            "snapshots_by_source_league": (
                dataset["source_league"].fillna("unknown").value_counts().head(20).to_dict()
                if "source_league" in dataset.columns
                else {}
            ),
            "snapshots_exact_target_patch": int(
                (dataset["patch_bucket"] == "exact_target_patch").sum()
            ),
            "snapshots_adjacent_recent_patch": int(
                (dataset["patch_bucket"] == "adjacent_recent_patch").sum()
            ),
            "snapshots_out_of_target_patch": int(
                (dataset["patch_bucket"] == "out_of_target_patch").sum()
            ),
            "snapshots_trainable_strict": int(
                (raw_dataset["patch_bucket"] == "exact_target_patch").sum()
            ),
            "snapshots_trainable_preferred_fallback": int(
                raw_dataset["patch_bucket"]
                .isin(["exact_target_patch", "adjacent_recent_patch"])
                .sum()
            ),
            "patch_catalogs": manifest.get("patchCatalogs", {}),
            "quality": quality_summary.to_report_payload(),
        },
    )

    if len(dataset) < config.dataset.min_rows:
        raise ValueError(
            "Analytic dataset too small for training: "
            f"{len(dataset)} rows < {config.dataset.min_rows}."
        )
    if len(label_counts) < config.dataset.min_unique_labels:
        raise ValueError(
            "Analytic dataset does not contain enough unique next-item labels "
            "for baseline training."
        )
    validate_quality_gates(quality_summary, config.dataset)

    return DatasetBuildSummary(
        matches_seen=len(raw_matches),
        matches_with_timeline=raw_rows.matches_with_timeline,
        snapshots_written=len(dataset),
        ranking_rows_written=len(ranking_dataset),
        train_rows=len(train_frame),
        validation_rows=len(validation_frame),
        test_rows=len(test_frame),
        unique_labels=len(label_counts),
        skipped_matches=raw_rows.skipped_matches,
    )


def main() -> None:
    from inference.config import load_config

    summary = build_analytic_dataset(load_config())
    print(asdict(summary))


if __name__ == "__main__":
    main()
