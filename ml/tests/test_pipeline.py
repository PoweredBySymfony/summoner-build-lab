from __future__ import annotations

import json
import os
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient

from features.analytics import build_analytic_dataset, _gold_before_purchase_from_frame_events
from features.catalogs import CatalogBundle
from inference.api import app
from inference.config import (
    ApiConfig,
    AppConfig,
    DatasetConfig,
    PathsConfig,
    ProjectConfig,
    PuzzleConfig,
    TrainingConfig,
    get_config,
)
from inference.puzzle_prep import build_puzzle_seed
from inference.service import PredictionOutput, RankedPrediction, clear_model_cache
from training.baseline import train_baseline


def make_test_catalog() -> CatalogBundle:
    items = [
        {"riotItemId": 1001, "slug": "boots", "goldTotal": 300, "goldSell": 210},
        {"riotItemId": 2003, "slug": "health-potion", "goldTotal": 50, "goldSell": 20},
    ]
    return CatalogBundle(
        patch="26.1",
        dd_version="26.1.1",
        items=items,
        champions=[],
        item_slug_by_id={1001: "boots", 2003: "health-potion"},
        item_meta_by_slug={str(item["slug"]): item for item in items},
        champion_index={},
    )


def make_config(tmp_path: Path) -> AppConfig:
    return AppConfig(
        project=ProjectConfig(name="summoner-build-lab-ml", version="0.2.0", environment="test"),
        paths=PathsConfig(
            artifacts_dir=tmp_path / "artifacts",
            raw_data_dir=tmp_path / "raw",
            interim_data_dir=tmp_path / "interim",
            processed_data_dir=tmp_path / "processed",
            raw_matches_path=tmp_path / "raw" / "imported_matches.jsonl",
            item_catalog_path=tmp_path / "raw" / "item_catalog.json",
            champion_catalog_path=tmp_path / "raw" / "champion_catalog.json",
            export_manifest_path=tmp_path / "raw" / "manifest.json",
            ranking_dataset_path=tmp_path / "processed" / "ranking.parquet",
            analytic_dataset_path=tmp_path / "processed" / "analytic.parquet",
            train_dataset_path=tmp_path / "processed" / "train.parquet",
            validation_dataset_path=tmp_path / "processed" / "validation.parquet",
            test_dataset_path=tmp_path / "processed" / "test.parquet",
            dataset_report_path=tmp_path / "artifacts" / "reports" / "dataset.json",
            baseline_model_path=tmp_path / "artifacts" / "models" / "model.joblib",
            baseline_metadata_path=tmp_path / "artifacts" / "models" / "metadata.json",
            evaluation_metrics_path=tmp_path / "artifacts" / "reports" / "evaluation.json",
            evaluation_report_path=tmp_path / "artifacts" / "reports" / "evaluation.md",
        ),
        dataset=DatasetConfig(
            validation_ratio=0.2,
            test_ratio=0.2,
            min_rows=1,
            min_unique_labels=1,
            min_train_label_frequency=1,
            max_missing_actual_item_ratio=0.5,
            max_gold_incoherent_ratio=0.6,
            max_unknown_role_ratio=0.5,
            min_candidate_pool_median=1,
            strict_train_patch_prefixes=["26."],
            adjacent_train_patch_prefixes=["26.6", "26.5", "26.4", "26.3"],
            train_patch_mode="strict_recent_competitive",
        ),
        training=TrainingConfig(
            random_seed=7,
            top_k=3,
            max_top_k=5,
            xgboost_estimators=30,
            xgboost_max_depth=4,
            xgboost_learning_rate=0.2,
            xgboost_subsample=1.0,
            xgboost_colsample_bytree=1.0,
        ),
        puzzle=PuzzleConfig(
            min_confidence=0.2,
            min_confidence_gap=0.05,
            distractor_count=3,
        ),
        api=ApiConfig(host="127.0.0.1", port=8001, log_level="info"),
    )


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def make_raw_export(tmp_path: Path) -> AppConfig:
    config = make_config(tmp_path)
    write_json(
        config.paths.item_catalog_path,
        [
            {
                "riotItemId": 1001,
                "slug": "boots",
                "name": "Boots",
                "goldTotal": 300,
                "isBoots": True,
                "isLegendary": False,
                "isConsumable": False,
                "isStarter": False,
                "isActive": True,
                "tags": ["Boots"],
                "buildsFrom": [],
                "buildsInto": [],
                "mapAvailability": {"11": True},
            },
            {
                "riotItemId": 2003,
                "slug": "health-potion",
                "name": "Health Potion",
                "goldTotal": 50,
                "isBoots": False,
                "isLegendary": False,
                "isConsumable": True,
                "isStarter": False,
                "isActive": True,
                "tags": ["Consumable"],
                "buildsFrom": [],
                "buildsInto": [],
                "mapAvailability": {"11": True},
            },
            {
                "riotItemId": 6672,
                "slug": "kraken-slayer",
                "name": "Kraken Slayer",
                "goldTotal": 3000,
                "isBoots": False,
                "isLegendary": True,
                "isConsumable": False,
                "isStarter": False,
                "isActive": True,
                "tags": ["Damage", "AttackSpeed"],
                "buildsFrom": [1036],
                "buildsInto": [],
                "mapAvailability": {"11": True},
            },
            {
                "riotItemId": 1036,
                "slug": "long-sword",
                "name": "Long Sword",
                "goldTotal": 350,
                "isBoots": False,
                "isLegendary": False,
                "isConsumable": False,
                "isStarter": False,
                "isActive": True,
                "tags": ["Damage"],
                "buildsFrom": [],
                "buildsInto": [6672],
                "mapAvailability": {"11": True},
            },
        ],
    )
    write_json(
        config.paths.champion_catalog_path,
        [
            {"riotChampionId": 222, "slug": "jinx", "tags": ["Marksman"]},
            {"riotChampionId": 412, "slug": "thresh", "tags": ["Support", "Tank"]},
        ],
    )
    manifest = {
        "exportedAt": "2026-03-31T10:00:00Z",
        "matchCount": 1,
        "matchesWithTimeline": 1,
        "latestDataDragonVersion": "26.1.1",
        "patchCatalogs": {
            "26.1": {
                "itemCatalogPath": "catalogs/26.1/item_catalog.json",
                "championCatalogPath": "catalogs/26.1/champion_catalog.json",
                "ddVersion": "26.1.1",
            }
        },
    }
    write_json(config.paths.export_manifest_path, manifest)
    write_json(
        tmp_path / "raw" / "catalogs" / "26.1" / "item_catalog.json",
        json.loads(config.paths.item_catalog_path.read_text(encoding="utf-8")),
    )
    write_json(
        tmp_path / "raw" / "catalogs" / "26.1" / "champion_catalog.json",
        json.loads(config.paths.champion_catalog_path.read_text(encoding="utf-8")),
    )

    match_record = {
        "riotMatchId": "EUW1_1",
        "patch": "16.1",
        "patchCanonical": "26.1",
        "patchFormat": "legacy_patch",
        "targetPuuid": "player-1",
        "targetChampionId": 222,
        "targetChampionSlug": "jinx",
        "targetRole": "ADC",
        "gameCreationAt": "2026-03-30T10:00:00+00:00",
        "sourceKind": "PRO_SEED",
        "sourceTier": "pro",
        "sourceLeague": "LoL Champions Korea",
        "sourceRegionHint": "KR",
        "matchData": {
            "raw": {
                "info": {
                    "participants": [
                        {
                            "puuid": "player-1",
                            "participantId": 1,
                            "teamId": 100,
                            "championId": 222,
                            "teamPosition": "BOTTOM",
                        },
                        {
                            "puuid": "ally-2",
                            "participantId": 2,
                            "teamId": 100,
                            "championId": 412,
                            "teamPosition": "UTILITY",
                        },
                    ]
                }
            }
        },
        "timelineData": {
            "raw": {
                "info": {
                    "frames": [
                        {
                            "timestamp": 60000,
                            "participantFrames": {
                                "1": {
                                    "currentGold": 900,
                                    "level": 3,
                                    "minionsKilled": 20,
                                    "jungleMinionsKilled": 0,
                                }
                            },
                            "events": [
                                {
                                    "timestamp": 60000,
                                    "type": "ITEM_PURCHASED",
                                    "participantId": 1,
                                    "itemId": 1001,
                                }
                            ],
                        },
                        {
                            "timestamp": 120000,
                            "participantFrames": {
                                "1": {
                                    "currentGold": 1500,
                                    "level": 5,
                                    "minionsKilled": 42,
                                    "jungleMinionsKilled": 0,
                                }
                            },
                            "events": [
                                {
                                    "timestamp": 120000,
                                    "type": "ITEM_PURCHASED",
                                    "participantId": 1,
                                    "itemId": 6672,
                                }
                            ],
                        },
                    ]
                }
            }
        },
        "createdAt": "2026-03-30T10:30:00+00:00",
    }
    config.paths.raw_matches_path.parent.mkdir(parents=True, exist_ok=True)
    config.paths.raw_matches_path.write_text(
        json.dumps(match_record) + "\n",
        encoding="utf-8",
    )
    return config


def write_split_dataset(config: AppConfig) -> None:
    config.paths.processed_data_dir.mkdir(parents=True, exist_ok=True)
    candidate_items = {
        "boots": {
            "item_cost": 300,
            "item_category": "boots",
            "item_is_boots": True,
            "item_is_legendary": False,
            "item_builds_from_count": 0,
            "item_builds_into_count": 0,
            "item_tags": ["Boots"],
        },
        "long-sword": {
            "item_cost": 350,
            "item_category": "fighter",
            "item_is_boots": False,
            "item_is_legendary": False,
            "item_builds_from_count": 0,
            "item_builds_into_count": 1,
            "item_tags": ["Damage"],
        },
        "kraken-slayer": {
            "item_cost": 3000,
            "item_category": "crit",
            "item_is_boots": False,
            "item_is_legendary": True,
            "item_builds_from_count": 1,
            "item_builds_into_count": 0,
            "item_tags": ["Damage", "AttackSpeed"],
        },
    }
    analytic_rows: list[dict[str, object]] = []
    ranking_rows: list[dict[str, object]] = []
    labels = ["boots", "long-sword", "kraken-slayer"]
    for index in range(30):
        label = labels[index % len(labels)]
        snapshot_id = f"snapshot-{index}"
        analytic_row = {
            "snapshot_id": snapshot_id,
            "match_id": f"EUW1_{index}",
            "timestamp": 60000 + index * 1000,
            "timestamp_minutes": 1.0 + index / 60.0,
            "patch": "26.1",
            "source_kind": "PRO_SEED",
            "source_tier": "pro",
            "source_league": "LoL Champions Korea",
            "source_region_hint": "KR",
            "dd_version": "26.1.1",
            "game_creation_at": f"2026-03-{(index % 28) + 1:02d}T10:00:00+00:00",
            "champion_id": 222,
            "champion_slug": "jinx",
            "role": "ADC",
            "gold_available": 4000,
            "level": 4 + (index % 6),
            "kills": index % 4,
            "deaths": index % 3,
            "assists": index % 5,
            "cs": 20 + index * 3,
            "current_items": ["boots"] if index % 2 == 0 else [],
            "current_item_count": 1 if index % 2 == 0 else 0,
            "candidate_pool": ["boots", "long-sword", "kraken-slayer"],
            "candidate_pool_size": 3,
            "actual_next_item": label,
            "actual_item_in_candidate_pool": True,
            "actual_item_cost": candidate_items[label]["item_cost"],
            "ally_frontline_count": 1,
            "ally_magic_damage_count": 1,
            "ally_physical_damage_count": 2,
            "ally_support_count": 1,
            "enemy_frontline_count": 2,
            "enemy_magic_damage_count": 1,
            "enemy_physical_damage_count": 2,
            "enemy_support_count": 1,
        }
        analytic_rows.append(analytic_row)
        for candidate_item_slug, item_features in candidate_items.items():
            ranking_rows.append(
                {
                    **analytic_row,
                    "candidate_item_slug": candidate_item_slug,
                    "label": int(candidate_item_slug == label),
                    **item_features,
                }
            )

    analytic_frame = pd.DataFrame(analytic_rows)
    ranking_frame = pd.DataFrame(ranking_rows)
    analytic_frame.iloc[:18].to_parquet(config.paths.train_dataset_path, index=False)
    analytic_frame.iloc[18:24].to_parquet(config.paths.validation_dataset_path, index=False)
    analytic_frame.iloc[24:].to_parquet(config.paths.test_dataset_path, index=False)
    analytic_frame.to_parquet(config.paths.analytic_dataset_path, index=False)
    ranking_frame.to_parquet(config.paths.ranking_dataset_path, index=False)


def test_build_analytic_dataset_creates_snapshots(tmp_path: Path) -> None:
    config = make_raw_export(tmp_path)
    summary = build_analytic_dataset(config)

    assert summary.matches_seen == 1
    assert summary.matches_with_timeline == 1
    assert summary.snapshots_written == 2
    assert summary.ranking_rows_written >= 2
    dataset = pd.read_parquet(config.paths.analytic_dataset_path)
    assert dataset["actual_next_item"].tolist() == ["boots", "kraken-slayer"]
    assert dataset["candidate_pool_size"].tolist() == [2, 2]
    assert dataset["actual_item_in_candidate_pool"].tolist() == [True, True]
    ranking_dataset = pd.read_parquet(config.paths.ranking_dataset_path)
    assert "snapshot_id" in ranking_dataset.columns
    assert set(ranking_dataset["candidate_item_slug"].tolist()) == {"boots", "long-sword", "kraken-slayer"}
    assert "item_cost" in ranking_dataset.columns
    assert "label" in ranking_dataset.columns
    report = json.loads(config.paths.dataset_report_path.read_text(encoding="utf-8"))
    assert report["quality"]["gold_incoherent_ratio"] == 0.0
    assert report["quality"]["candidate_pool_median"] == 2.0
    assert report["train_patch_mode"] == "strict_recent_competitive"
    assert report["snapshots_by_source_tier"] == {"pro": 2}
    assert report["snapshots_by_patch_format"] == {"legacy_patch": 2}
    assert report["snapshots_exact_target_patch"] == 2
    assert report["snapshots_adjacent_recent_patch"] == 0


def test_gold_before_purchase_replays_multiple_buys_within_same_frame() -> None:
    catalog = make_test_catalog()

    first_purchase_gold = _gold_before_purchase_from_frame_events(
        events=[
            {"type": "ITEM_PURCHASED", "participantId": 1, "itemId": 1001},
            {"type": "ITEM_PURCHASED", "participantId": 1, "itemId": 2003},
        ],
        participant_id=1,
        purchase_event_index=0,
        ending_gold=150,
        catalog=catalog,
    )
    second_purchase_gold = _gold_before_purchase_from_frame_events(
        events=[
            {"type": "ITEM_PURCHASED", "participantId": 1, "itemId": 1001},
            {"type": "ITEM_PURCHASED", "participantId": 1, "itemId": 2003},
        ],
        participant_id=1,
        purchase_event_index=1,
        ending_gold=150,
        catalog=catalog,
    )

    assert first_purchase_gold == 500
    assert second_purchase_gold == 200


def test_train_baseline_creates_model_and_reports(tmp_path: Path) -> None:
    config = make_config(tmp_path)
    write_split_dataset(config)

    summary = train_baseline(config)

    assert summary.unique_candidate_items == 3
    assert Path(summary.model_path).exists()
    assert Path(summary.metadata_path).exists()
    assert Path(summary.evaluation_report_path).exists()
    assert 0.0 <= summary.ndcg_at_k <= 1.0


def test_predict_next_item_endpoint_with_trained_model(tmp_path: Path) -> None:
    config = make_raw_export(tmp_path)
    write_split_dataset(config)
    train_baseline(config)

    os.environ["ML_CONFIG_PATH"] = str(tmp_path / "test-config.yaml")
    write_json(
        Path(os.environ["ML_CONFIG_PATH"]),
        {
            "project": config.project.model_dump(),
            "paths": {key: str(value) for key, value in config.paths.model_dump().items()},
            "dataset": config.dataset.model_dump(),
            "training": config.training.model_dump(),
            "puzzle": config.puzzle.model_dump(),
            "api": config.api.model_dump(),
        },
    )
    get_config.cache_clear()
    clear_model_cache()

    client = TestClient(app)
    response = client.post(
        "/predict-next-item",
        json={
            "patch": "15.6",
            "champion_slug": "jinx",
            "role": "ADC",
            "gold_available": 1600,
            "level": 8,
            "kills": 3,
            "deaths": 1,
            "assists": 4,
            "cs": 92,
            "timestamp_minutes": 12.5,
            "current_items": ["boots"],
            "candidate_pool": ["long-sword", "kraken-slayer"],
            "ally_frontline_count": 1,
            "ally_magic_damage_count": 1,
            "ally_physical_damage_count": 2,
            "ally_support_count": 1,
            "enemy_frontline_count": 2,
            "enemy_magic_damage_count": 1,
            "enemy_physical_damage_count": 2,
            "enemy_support_count": 1,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["model_ready"] is True
    assert payload["predicted_item_slug"] is not None
    assert payload["model_version"] == "0.2.0"
    assert payload["candidate_pool_size"] == 2
    assert len(payload["top_k_predictions"]) >= 1
    assert {entry["item_slug"] for entry in payload["top_k_predictions"]}.issubset(
        {"long-sword", "kraken-slayer"}
    )

    puzzle_seed = build_puzzle_seed(
        PredictionOutput(
            model_ready=True,
            predicted_item_slug="boots",
            confidence=0.7,
            top_predictions=[
                RankedPrediction(item_slug="boots", score=0.7),
                RankedPrediction(item_slug="kraken-slayer", score=0.15),
                RankedPrediction(item_slug="health-potion", score=0.1),
                RankedPrediction(item_slug="guardian-angel", score=0.05),
            ],
            model_version="0.2.0",
            candidate_pool_size=2,
        ),
        config=config,
    )
    assert puzzle_seed.good_answer == "boots"
    assert len(puzzle_seed.distractors) == 3
    assert puzzle_seed.low_confidence is True
