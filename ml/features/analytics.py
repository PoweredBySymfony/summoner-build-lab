from __future__ import annotations

import json
from bisect import bisect_right
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import pandas as pd

from inference.config import AppConfig
from models.artifacts import save_metadata

PHYSICAL_TAGS = {"Marksman", "Assassin", "Fighter"}
MAGIC_TAGS = {"Mage", "Support"}
FRONTLINE_TAGS = {"Tank", "Fighter"}


@dataclass(slots=True)
class DatasetBuildSummary:
    matches_seen: int
    matches_with_timeline: int
    snapshots_written: int
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
    if normalized in {"MIDDLE"}:
        return "MID"
    if normalized in {"BOTTOM", "BOT", "CARRY"}:
        return "ADC"
    if normalized in {"UTILITY"}:
        return "SUPPORT"
    return None


def _safe_int(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int | float):
        return int(value)
    return 0


def _safe_str_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(value) for value in values if str(value).strip()]


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
        champion = champion_index.get(_safe_int(participant.get("championId")))
        if champion is None:
            continue
        prefix = "ally" if _safe_int(participant.get("teamId")) == own_team_id else "enemy"
        profile = _champion_profile(champion)
        features[f"{prefix}_frontline_count"] += profile["frontline"]
        features[f"{prefix}_magic_damage_count"] += profile["magic"]
        features[f"{prefix}_physical_damage_count"] += profile["physical"]
        features[f"{prefix}_support_count"] += profile["support"]
    return features


def _frame_state_by_timestamp(
    frames: list[dict[str, Any]],
) -> tuple[list[int], list[dict[str, Any]]]:
    timestamps = [_safe_int(frame.get("timestamp")) for frame in frames]
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


def build_analytic_dataset(config: AppConfig) -> DatasetBuildSummary:
    raw_matches = _load_jsonl(config.paths.raw_matches_path)
    item_catalog = _load_json(config.paths.item_catalog_path)
    champion_catalog = _load_json(config.paths.champion_catalog_path)

    item_slug_by_id = {
        _safe_int(item["riotItemId"]): str(item["slug"])
        for item in item_catalog
        if _safe_int(item.get("riotItemId")) > 0
    }
    champion_index = {
        _safe_int(champion["riotChampionId"]): champion
        for champion in champion_catalog
        if _safe_int(champion.get("riotChampionId")) > 0
    }

    rows: list[dict[str, Any]] = []
    skipped_matches = 0
    matches_with_timeline = 0

    for record in raw_matches:
        timeline_wrapper = record.get("timelineData")
        timeline_raw = timeline_wrapper.get("raw") if isinstance(timeline_wrapper, dict) else None
        if not isinstance(timeline_raw, dict):
            skipped_matches += 1
            continue

        match_wrapper = record.get("matchData", {})
        match_raw = match_wrapper.get("raw") if isinstance(match_wrapper, dict) else None
        if not isinstance(match_raw, dict):
            skipped_matches += 1
            continue

        info = match_raw.get("info", {})
        if not isinstance(info, dict):
            skipped_matches += 1
            continue

        participants = info.get("participants", [])
        if not isinstance(participants, list):
            skipped_matches += 1
            continue

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

        participant_id = _safe_int(participant.get("participantId"))
        if participant_id <= 0:
            skipped_matches += 1
            continue

        matches_with_timeline += 1
        own_team_id = _safe_int(participant.get("teamId"))
        composition_features = _aggregate_team_features(
            [entry for entry in participants if isinstance(entry, dict)],
            own_team_id,
            champion_index,
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
            key=lambda entry: (_safe_int(entry.get("timestamp")), str(entry.get("type") or "")),
        )

        for event in sorted_events:
            event_type = str(event.get("type") or "")
            event_timestamp = _safe_int(event.get("timestamp"))

            if event_type == "CHAMPION_KILL":
                if _safe_int(event.get("killerId")) == participant_id:
                    kills += 1
                if _safe_int(event.get("victimId")) == participant_id:
                    deaths += 1
                assisting_ids = event.get("assistingParticipantIds", [])
                if isinstance(assisting_ids, list) and participant_id in [
                    _safe_int(value) for value in assisting_ids
                ]:
                    assists += 1

            if _safe_int(event.get("participantId")) != participant_id:
                continue

            item_id = _safe_int(event.get("itemId"))
            if event_type == "ITEM_PURCHASED" and item_id > 0:
                frame = _frame_for_timestamp(event_timestamp, frame_timestamps, normalized_frames)
                participant_frame = _participant_frame(frame, participant_id)
                current_items = [
                    item_slug_by_id[item] for item in inventory if item in item_slug_by_id
                ]
                actual_next_item = item_slug_by_id.get(item_id)
                if actual_next_item is None:
                    inventory.append(item_id)
                    continue

                rows.append(
                    {
                        "match_id": str(record.get("riotMatchId") or ""),
                        "timestamp": event_timestamp,
                        "timestamp_minutes": round(event_timestamp / 60000, 2),
                        "patch": str(record.get("patch") or "unknown"),
                        "game_creation_at": str(record.get("gameCreationAt") or ""),
                        "champion_id": _safe_int(record.get("targetChampionId")),
                        "champion_slug": str(record.get("targetChampionSlug") or "unknown"),
                        "role": _normalize_role(record.get("targetRole")) or "UNKNOWN",
                        "gold_available": _safe_int(participant_frame.get("currentGold")),
                        "level": _safe_int(participant_frame.get("level")),
                        "kills": kills,
                        "deaths": deaths,
                        "assists": assists,
                        "cs": _safe_int(participant_frame.get("minionsKilled"))
                        + _safe_int(participant_frame.get("jungleMinionsKilled")),
                        "current_items": current_items,
                        "current_item_count": len(current_items),
                        "candidate_next_item": actual_next_item,
                        "actual_next_item": actual_next_item,
                        **composition_features,
                    }
                )
                inventory.append(item_id)
                continue

            if event_type == "ITEM_SOLD" and item_id > 0:
                _remove_item_once(inventory, item_id)
            elif event_type == "ITEM_DESTROYED" and item_id > 0:
                _remove_item_once(inventory, item_id)
            elif event_type == "ITEM_UNDO":
                before_id = _safe_int(event.get("beforeId"))
                after_id = _safe_int(event.get("afterId"))
                if before_id > 0:
                    _remove_item_once(inventory, before_id)
                if after_id > 0:
                    inventory.append(after_id)

    dataset = pd.DataFrame(rows)
    if dataset.empty:
        raise ValueError("No analytic rows could be built from the exported raw matches.")

    dataset = dataset.sort_values(
        ["game_creation_at", "timestamp", "match_id"]
    ).reset_index(drop=True)
    config.paths.analytic_dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_parquet(config.paths.analytic_dataset_path, index=False)

    total_rows = len(dataset)
    test_rows = min(max(1, int(total_rows * config.dataset.test_ratio)), max(total_rows - 2, 0))
    validation_rows = min(
        max(1, int(total_rows * config.dataset.validation_ratio)),
        max(total_rows - test_rows - 1, 0),
    )
    train_rows = total_rows - validation_rows - test_rows
    if train_rows <= 0:
        raise ValueError("Dataset split would leave no training rows.")

    train_frame = dataset.iloc[:train_rows].copy()
    validation_frame = dataset.iloc[train_rows : train_rows + validation_rows].copy()
    test_frame = dataset.iloc[train_rows + validation_rows :].copy()

    train_frame.to_parquet(config.paths.train_dataset_path, index=False)
    validation_frame.to_parquet(config.paths.validation_dataset_path, index=False)
    test_frame.to_parquet(config.paths.test_dataset_path, index=False)

    label_counts = Counter(str(value) for value in dataset["actual_next_item"].tolist())
    report_payload = {
        "rows": total_rows,
        "matches_seen": len(raw_matches),
        "matches_with_timeline": matches_with_timeline,
        "skipped_matches": skipped_matches,
        "unique_labels": len(label_counts),
        "top_labels": label_counts.most_common(15),
        "null_role_rows": int((dataset["role"] == "UNKNOWN").sum()),
        "train_rows": len(train_frame),
        "validation_rows": len(validation_frame),
        "test_rows": len(test_frame),
        "patches": sorted(str(value) for value in dataset["patch"].dropna().unique().tolist()),
    }
    save_metadata(config.paths.dataset_report_path, report_payload)

    if total_rows < config.dataset.min_rows:
        raise ValueError(
            "Analytic dataset too small for training: "
            f"{total_rows} rows < {config.dataset.min_rows}."
        )
    if len(label_counts) < config.dataset.min_unique_labels:
        raise ValueError(
            "Analytic dataset does not contain enough unique next-item labels "
            "for baseline training."
        )

    return DatasetBuildSummary(
        matches_seen=len(raw_matches),
        matches_with_timeline=matches_with_timeline,
        snapshots_written=total_rows,
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
