from __future__ import annotations

import json
from bisect import bisect_right
from collections import Counter
from dataclasses import asdict, dataclass
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


def build_analytic_dataset(config: AppConfig) -> DatasetBuildSummary:
    raw_matches = _load_jsonl(config.paths.raw_matches_path)
    manifest = load_manifest(config.paths.export_manifest_path)
    all_rows: list[dict[str, Any]] = []
    all_ranking_rows: list[dict[str, Any]] = []
    skipped_matches = 0
    matches_with_timeline = 0
    missing_actual_item_count = 0
    gold_incoherent_count = 0

    for record in raw_matches:
        timeline_wrapper = record.get("timelineData")
        timeline_raw = timeline_wrapper.get("raw") if isinstance(timeline_wrapper, dict) else None
        match_wrapper = record.get("matchData", {})
        match_raw = match_wrapper.get("raw") if isinstance(match_wrapper, dict) else None
        if not isinstance(timeline_raw, dict) or not isinstance(match_raw, dict):
            skipped_matches += 1
            continue

        info = match_raw.get("info", {})
        participants = info.get("participants", []) if isinstance(info, dict) else []
        if not isinstance(participants, list):
            skipped_matches += 1
            continue

        patch = str(record.get("patch") or "unknown")
        catalog = load_catalog_bundle(
            config.paths.export_manifest_path,
            config.paths.raw_data_dir,
            patch,
            config.paths.item_catalog_path,
            config.paths.champion_catalog_path,
        )
        target_puuid = str(record.get("targetPuuid") or "")
        participant = next(
            (
                entry
                for entry in participants
                if isinstance(entry, dict) and str(entry.get("puuid") or "") == target_puuid
            ),
            None,
        )
        if participant is None:
            skipped_matches += 1
            continue

        participant_id = safe_int(participant.get("participantId"))
        if participant_id <= 0:
            skipped_matches += 1
            continue

        matches_with_timeline += 1
        own_team_id = safe_int(participant.get("teamId"))
        composition_features = _aggregate_team_features(
            [entry for entry in participants if isinstance(entry, dict)],
            own_team_id,
            catalog.champion_index,
        )
        timeline_info = timeline_raw.get("info", {})
        frames = timeline_info.get("frames", []) if isinstance(timeline_info, dict) else []
        if not isinstance(frames, list) or not frames:
            skipped_matches += 1
            continue

        frame_timestamps, normalized_frames = _frame_state_by_timestamp(
            [frame for frame in frames if isinstance(frame, dict)]
        )
        inventory: list[int] = []
        kills = 0
        deaths = 0
        assists = 0
        sorted_events = sorted(
            (
                event
                for frame in normalized_frames
                for event in frame.get("events", [])
                if isinstance(event, dict)
            ),
            key=lambda entry: (safe_int(entry.get("timestamp")), str(entry.get("type") or "")),
        )

        for event in sorted_events:
            event_type = str(event.get("type") or "")
            event_timestamp = safe_int(event.get("timestamp"))

            if event_type == "CHAMPION_KILL":
                if safe_int(event.get("killerId")) == participant_id:
                    kills += 1
                if safe_int(event.get("victimId")) == participant_id:
                    deaths += 1
                assisting_ids = event.get("assistingParticipantIds", [])
                normalized_assists = [safe_int(value) for value in assisting_ids] if isinstance(
                    assisting_ids, list
                ) else []
                if participant_id in normalized_assists:
                    assists += 1

            if safe_int(event.get("participantId")) != participant_id:
                continue

            item_id = safe_int(event.get("itemId"))
            if event_type == "ITEM_PURCHASED" and item_id > 0:
                frame = _frame_for_timestamp(event_timestamp, frame_timestamps, normalized_frames)
                participant_frame = _participant_frame(frame, participant_id)
                current_items = [
                    catalog.item_slug_by_id[item_id_value]
                    for item_id_value in inventory
                    if item_id_value in catalog.item_slug_by_id
                ]
                actual_next_item = catalog.item_slug_by_id.get(item_id)
                if actual_next_item is None:
                    missing_actual_item_count += 1
                    inventory.append(item_id)
                    continue

                gold_available = safe_int(participant_frame.get("currentGold"))
                actual_item_meta = catalog.item_meta_by_slug.get(actual_next_item, {})
                actual_item_cost = safe_int(actual_item_meta.get("goldTotal"))
                if gold_available > 0 and actual_item_cost > gold_available:
                    gold_incoherent_count += 1

                candidate_pool = build_candidate_pool(
                    catalog,
                    owned_item_slugs=current_items,
                    gold_available=gold_available,
                    role=_normalize_role(record.get("targetRole")),
                )
                snapshot_id = f"{record.get('riotMatchId') or ''}:{event_timestamp}"
                row = {
                    "snapshot_id": snapshot_id,
                    "match_id": str(record.get("riotMatchId") or ""),
                    "timestamp": event_timestamp,
                    "timestamp_minutes": round(event_timestamp / 60000, 2),
                    "patch": patch,
                    "source_kind": str(record.get("sourceKind") or "unknown"),
                    "source_tier": str(record.get("sourceTier") or "unknown"),
                    "source_league": str(record.get("sourceLeague") or "unknown"),
                    "source_region_hint": str(record.get("sourceRegionHint") or "unknown"),
                    "dd_version": catalog.dd_version,
                    "game_creation_at": str(record.get("gameCreationAt") or ""),
                    "champion_id": safe_int(record.get("targetChampionId")),
                    "champion_slug": str(record.get("targetChampionSlug") or "unknown"),
                    "role": _normalize_role(record.get("targetRole")) or "UNKNOWN",
                    "gold_available": gold_available,
                    "level": safe_int(participant_frame.get("level")),
                    "kills": kills,
                    "deaths": deaths,
                    "assists": assists,
                    "cs": safe_int(participant_frame.get("minionsKilled"))
                    + safe_int(participant_frame.get("jungleMinionsKilled")),
                    "current_items": current_items,
                    "current_item_count": len(current_items),
                    "candidate_pool": candidate_pool,
                    "candidate_pool_size": len(candidate_pool),
                    "actual_next_item": actual_next_item,
                    "actual_item_in_candidate_pool": actual_next_item in candidate_pool,
                    "actual_item_cost": actual_item_cost,
                    **composition_features,
                }
                all_rows.append(row)

                for candidate_item_slug in candidate_pool:
                    candidate_item_meta = catalog.item_meta_by_slug.get(candidate_item_slug, {})
                    all_ranking_rows.append(
                        {
                            **row,
                            "candidate_item_slug": candidate_item_slug,
                            "label": int(candidate_item_slug == actual_next_item),
                            **_build_item_feature_payload(candidate_item_meta),
                        }
                    )

                inventory.append(item_id)
                continue

            if event_type in {"ITEM_SOLD", "ITEM_DESTROYED"} and item_id > 0:
                _remove_item_once(inventory, item_id)
            elif event_type == "ITEM_UNDO":
                before_id = safe_int(event.get("beforeId"))
                after_id = safe_int(event.get("afterId"))
                if before_id > 0:
                    _remove_item_once(inventory, before_id)
                if after_id > 0:
                    inventory.append(after_id)

    raw_dataset = pd.DataFrame(all_rows)
    raw_ranking_dataset = pd.DataFrame(all_ranking_rows)
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
            raw_ranking_dataset["patch_bucket"].isin(["exact_target_patch", "adjacent_recent_patch"])
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
        missing_actual_item_count=missing_actual_item_count,
        gold_incoherent_count=gold_incoherent_count,
    )
    save_metadata(
        config.paths.dataset_report_path,
        {
            "rows": len(dataset),
            "matches_seen": len(raw_matches),
            "matches_with_timeline": matches_with_timeline,
            "skipped_matches": skipped_matches,
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
            "snapshots_exact_target_patch": int((dataset["patch_bucket"] == "exact_target_patch").sum()),
            "snapshots_adjacent_recent_patch": int((dataset["patch_bucket"] == "adjacent_recent_patch").sum()),
            "snapshots_out_of_target_patch": int((dataset["patch_bucket"] == "out_of_target_patch").sum()),
            "snapshots_trainable_strict": int((raw_dataset["patch_bucket"] == "exact_target_patch").sum()),
            "snapshots_trainable_preferred_fallback": int(
                raw_dataset["patch_bucket"].isin(["exact_target_patch", "adjacent_recent_patch"]).sum()
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
        matches_with_timeline=matches_with_timeline,
        snapshots_written=len(dataset),
        ranking_rows_written=len(ranking_dataset),
        train_rows=len(train_frame),
        validation_rows=len(validation_frame),
        test_rows=len(test_frame),
        unique_labels=len(label_counts),
        skipped_matches=skipped_matches,
    )


def main() -> None:
    from inference.config import load_config

    summary = build_analytic_dataset(load_config())
    print(asdict(summary))


if __name__ == "__main__":
    main()
