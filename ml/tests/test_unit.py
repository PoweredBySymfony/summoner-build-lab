"""Unit tests for pure functions across all ML modules."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from features.analytics import (
    _aggregate_team_features,
    _apply_inventory_event,
    _canonicalize_patch,
    _extract_match_payloads,
    _extract_participants,
    _extract_timeline_frames,
    _frame_for_timestamp,
    _item_gold_values,
    _normalize_role,
    _parse_game_creation_at,
    _participant_frame,
    _patch_bucket,
    _remove_item_once,
    _replay_gold_event,
    _resolve_patch_fields,
    _update_combat_counters,
)
from inference.api import app
from models.feature_builder import (
    _add_list_indicators,
    _safe_float,
    build_feature_dict,
    build_ranking_feature_dict,
)


# ---------------------------------------------------------------------------
# features/analytics.py — _parse_game_creation_at
# ---------------------------------------------------------------------------


class TestParseGameCreationAt:
    def test_none_returns_none(self) -> None:
        assert _parse_game_creation_at(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert _parse_game_creation_at("") is None

    def test_zero_returns_none(self) -> None:
        assert _parse_game_creation_at(0) is None

    def test_datetime_with_tzinfo_returned_as_is(self) -> None:
        dt = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)
        result = _parse_game_creation_at(dt)
        assert result == dt
        assert result.tzinfo is not None

    def test_datetime_without_tzinfo_gets_utc(self) -> None:
        dt = datetime(2026, 1, 15, 12, 0, 0)
        result = _parse_game_creation_at(dt)
        assert result is not None
        assert result.tzinfo == UTC

    def test_iso_string_with_z_suffix(self) -> None:
        result = _parse_game_creation_at("2026-01-15T12:00:00Z")
        assert result is not None
        assert result.year == 2026

    def test_invalid_string_returns_none(self) -> None:
        assert _parse_game_creation_at("not-a-date") is None

    def test_whitespace_string_returns_none(self) -> None:
        assert _parse_game_creation_at("   ") is None

    def test_iso_string_without_tz_gets_utc(self) -> None:
        result = _parse_game_creation_at("2026-03-10T10:00:00")
        assert result is not None
        assert result.tzinfo == UTC


# ---------------------------------------------------------------------------
# features/analytics.py — _canonicalize_patch
# ---------------------------------------------------------------------------


class TestCanonicalizePatch:
    def test_invalid_patch_returns_none_unknown(self) -> None:
        assert _canonicalize_patch("invalid", None) == (None, "unknown")

    def test_empty_patch_returns_none_unknown(self) -> None:
        assert _canonicalize_patch("", None) == (None, "unknown")

    def test_year_patch_major_26(self) -> None:
        canonical, fmt = _canonicalize_patch("26.1", None)
        assert canonical == "26.1"
        assert fmt == "year_patch"

    def test_year_patch_major_20(self) -> None:
        canonical, fmt = _canonicalize_patch("20.5", None)
        assert canonical == "20.5"
        assert fmt == "year_patch"

    def test_legacy_patch_no_game_date(self) -> None:
        canonical, fmt = _canonicalize_patch("14.3", None)
        assert canonical == "14.3"
        assert fmt == "legacy_patch"

    def test_legacy_patch_with_pre_2026_date(self) -> None:
        old_date = datetime(2025, 6, 1, tzinfo=UTC)
        canonical, fmt = _canonicalize_patch("14.3", old_date)
        assert canonical == "14.3"
        assert fmt == "legacy_patch"

    def test_legacy_patch_with_post_2026_date_converts(self) -> None:
        new_date = datetime(2026, 3, 1, tzinfo=UTC)
        canonical, fmt = _canonicalize_patch("14.3", new_date)
        assert canonical == "24.3"
        assert fmt == "legacy_patch"

    def test_old_patch_below_10(self) -> None:
        canonical, fmt = _canonicalize_patch("9.1", None)
        assert canonical == "9.1"
        assert fmt == "unknown"


# ---------------------------------------------------------------------------
# features/analytics.py — _resolve_patch_fields
# ---------------------------------------------------------------------------


class TestResolvePatchFields:
    def test_uses_patch_canonical_when_present(self) -> None:
        record = {"patchCanonical": "26.5", "patchFormat": "year_patch"}
        canonical, fmt = _resolve_patch_fields(record)
        assert canonical == "26.5"
        assert fmt == "year_patch"

    def test_uses_patch_field_when_no_patch_canonical(self) -> None:
        record = {"patch": "26.3"}
        canonical, fmt = _resolve_patch_fields(record)
        assert canonical == "26.3"
        assert fmt == "unknown"

    def test_falls_back_to_canonicalize_when_no_patch_fields(self) -> None:
        record: dict[str, str] = {}
        canonical, fmt = _resolve_patch_fields(record)
        assert canonical == "unknown"
        assert fmt == "unknown"


# ---------------------------------------------------------------------------
# features/analytics.py — _patch_bucket
# ---------------------------------------------------------------------------


class TestPatchBucket:
    def test_exact_target_patch(self) -> None:
        assert _patch_bucket("26.7", ["26."], []) == "exact_target_patch"

    def test_adjacent_recent_patch(self) -> None:
        assert _patch_bucket("26.6", [], ["26.6", "26.5"]) == "adjacent_recent_patch"

    def test_out_of_target_patch(self) -> None:
        assert _patch_bucket("25.1", ["26."], ["26.6"]) == "out_of_target_patch"

    def test_none_patch_returns_out_of_target(self) -> None:
        assert _patch_bucket(None, ["26."], ["26.6"]) == "out_of_target_patch"


# ---------------------------------------------------------------------------
# features/analytics.py — _extract_match_payloads
# ---------------------------------------------------------------------------


class TestExtractMatchPayloads:
    def test_returns_none_when_no_timeline_raw(self) -> None:
        record: dict[str, Any] = {"timelineData": {}, "matchData": {"raw": {}}}
        assert _extract_match_payloads(record) is None

    def test_returns_none_when_no_match_raw(self) -> None:
        record: dict[str, Any] = {"timelineData": {"raw": {}}, "matchData": {}}
        assert _extract_match_payloads(record) is None

    def test_returns_tuple_when_both_present(self) -> None:
        record: dict[str, Any] = {
            "timelineData": {"raw": {"info": {}}},
            "matchData": {"raw": {"info": {}}},
        }
        result = _extract_match_payloads(record)
        assert result is not None
        assert isinstance(result, tuple)


# ---------------------------------------------------------------------------
# features/analytics.py — _extract_participants
# ---------------------------------------------------------------------------


class TestExtractParticipants:
    def test_returns_none_when_participants_not_list(self) -> None:
        match_raw = {"info": {"participants": "not-a-list"}}
        assert _extract_participants(match_raw) is None

    def test_returns_list_of_dicts(self) -> None:
        match_raw = {"info": {"participants": [{"puuid": "abc"}, {"puuid": "def"}]}}
        result = _extract_participants(match_raw)
        assert result == [{"puuid": "abc"}, {"puuid": "def"}]

    def test_filters_non_dict_entries(self) -> None:
        match_raw = {"info": {"participants": [{"puuid": "abc"}, "invalid", None]}}
        result = _extract_participants(match_raw)
        assert result == [{"puuid": "abc"}]


# ---------------------------------------------------------------------------
# features/analytics.py — _extract_timeline_frames
# ---------------------------------------------------------------------------


class TestExtractTimelineFrames:
    def test_returns_none_when_frames_empty(self) -> None:
        assert _extract_timeline_frames({"info": {"frames": []}}) is None

    def test_returns_none_when_frames_not_list(self) -> None:
        assert _extract_timeline_frames({"info": {"frames": "bad"}}) is None

    def test_returns_frames_list(self) -> None:
        frames = [{"timestamp": 0}, {"timestamp": 60000}]
        result = _extract_timeline_frames({"info": {"frames": frames}})
        assert result == frames


# ---------------------------------------------------------------------------
# features/analytics.py — _update_combat_counters
# ---------------------------------------------------------------------------


class TestUpdateCombatCounters:
    def test_non_champion_kill_event_unchanged(self) -> None:
        event = {"type": "ITEM_PURCHASED"}
        assert _update_combat_counters(event, 1, 0, 0, 0) == (0, 0, 0)

    def test_kill_increments_kills(self) -> None:
        event = {"type": "CHAMPION_KILL", "killerId": 1, "victimId": 2}
        kills, deaths, _ = _update_combat_counters(event, 1, 0, 0, 0)
        assert kills == 1
        assert deaths == 0

    def test_death_increments_deaths(self) -> None:
        event = {"type": "CHAMPION_KILL", "killerId": 2, "victimId": 1}
        _, deaths, _ = _update_combat_counters(event, 1, 0, 0, 0)
        assert deaths == 1

    def test_assist_increments_assists(self) -> None:
        event = {
            "type": "CHAMPION_KILL",
            "killerId": 2,
            "victimId": 3,
            "assistingParticipantIds": [1, 5],
        }
        _, _, assists = _update_combat_counters(event, 1, 0, 0, 0)
        assert assists == 1

    def test_non_list_assisting_ids_ignored(self) -> None:
        event = {
            "type": "CHAMPION_KILL",
            "killerId": 2,
            "victimId": 3,
            "assistingParticipantIds": "not-a-list",
        }
        _, _, assists = _update_combat_counters(event, 1, 0, 0, 0)
        assert assists == 0


# ---------------------------------------------------------------------------
# features/analytics.py — _apply_inventory_event
# ---------------------------------------------------------------------------


class TestApplyInventoryEvent:
    def test_item_sold_removes_item(self) -> None:
        inventory = [1001, 2003, 1001]
        _apply_inventory_event(inventory, {"type": "ITEM_SOLD", "itemId": 1001})
        assert inventory == [2003, 1001]

    def test_item_destroyed_removes_item(self) -> None:
        inventory = [3031]
        _apply_inventory_event(inventory, {"type": "ITEM_DESTROYED", "itemId": 3031})
        assert inventory == []

    def test_item_undo_removes_before_adds_after(self) -> None:
        inventory = [1001]
        _apply_inventory_event(
            inventory,
            {"type": "ITEM_UNDO", "beforeId": 1001, "afterId": 2003},
        )
        assert 1001 not in inventory
        assert 2003 in inventory

    def test_item_undo_zero_before_skips_remove(self) -> None:
        inventory = [1001]
        _apply_inventory_event(
            inventory,
            {"type": "ITEM_UNDO", "beforeId": 0, "afterId": 2003},
        )
        assert 1001 in inventory

    def test_unknown_event_type_no_change(self) -> None:
        inventory = [1001]
        _apply_inventory_event(inventory, {"type": "WARD_PLACED"})
        assert inventory == [1001]


# ---------------------------------------------------------------------------
# features/analytics.py — _normalize_role
# ---------------------------------------------------------------------------


class TestNormalizeRole:
    @pytest.mark.parametrize("raw,expected", [
        ("TOP", "TOP"),
        ("JUNGLE", "JUNGLE"),
        ("MID", "MID"),
        ("ADC", "ADC"),
        ("SUPPORT", "SUPPORT"),
        ("MIDDLE", "MID"),
        ("BOTTOM", "ADC"),
        ("BOT", "ADC"),
        ("CARRY", "ADC"),
        ("UTILITY", "SUPPORT"),
        ("UNKNOWN_ROLE", None),
        (None, None),
        ("", None),
    ])
    def test_role_normalization(self, raw: Any, expected: str | None) -> None:
        assert _normalize_role(raw) == expected


# ---------------------------------------------------------------------------
# features/analytics.py — _aggregate_team_features
# ---------------------------------------------------------------------------


class TestAggregateTeamFeatures:
    def test_unknown_champion_skips_entry(self) -> None:
        participants = [{"championId": 999, "teamId": 100}]
        result = _aggregate_team_features(participants, 100, {})
        assert result["ally_frontline_count"] == 0

    def test_known_champion_increments_ally(self) -> None:
        participants = [{"championId": 1, "teamId": 100}]
        champion_index = {1: {"tags": ["Tank", "Fighter"]}}
        result = _aggregate_team_features(participants, 100, champion_index)
        assert result["ally_frontline_count"] == 1

    def test_enemy_team_increments_enemy(self) -> None:
        participants = [{"championId": 1, "teamId": 200}]
        champion_index = {1: {"tags": ["Mage"]}}
        result = _aggregate_team_features(participants, 100, champion_index)
        assert result["enemy_magic_damage_count"] == 1


# ---------------------------------------------------------------------------
# features/analytics.py — _frame_for_timestamp
# ---------------------------------------------------------------------------


class TestFrameForTimestamp:
    def test_returns_none_when_before_first_frame(self) -> None:
        assert _frame_for_timestamp(-1, [0, 60000], [{"t": 0}, {"t": 60000}]) is None

    def test_returns_correct_frame(self) -> None:
        frames = [{"t": 0}, {"t": 60000}]
        result = _frame_for_timestamp(30000, [0, 60000], frames)
        assert result == {"t": 0}


# ---------------------------------------------------------------------------
# features/analytics.py — _participant_frame
# ---------------------------------------------------------------------------


class TestParticipantFrame:
    def test_none_frame_returns_empty(self) -> None:
        assert _participant_frame(None, 1) == {}

    def test_non_dict_participant_frames_returns_empty(self) -> None:
        frame = {"participantFrames": "bad"}
        assert _participant_frame(frame, 1) == {}

    def test_returns_participant_data_by_str_key(self) -> None:
        frame = {"participantFrames": {"1": {"gold": 500}}}
        assert _participant_frame(frame, 1) == {"gold": 500}


# ---------------------------------------------------------------------------
# features/analytics.py — _item_gold_values
# ---------------------------------------------------------------------------


class TestItemGoldValues:
    def test_unknown_item_returns_zeros(self) -> None:
        catalog = MagicMock()
        catalog.item_slug_by_id = {}
        assert _item_gold_values(catalog, 9999) == (0, 0)

    def test_known_item_with_sell_price(self) -> None:
        catalog = MagicMock()
        catalog.item_slug_by_id = {1001: "boots"}
        catalog.item_meta_by_slug = {"boots": {"goldTotal": 300, "goldSell": 210}}
        total, sell = _item_gold_values(catalog, 1001)
        assert total == 300
        assert sell == 210

    def test_known_item_without_sell_uses_70_percent(self) -> None:
        catalog = MagicMock()
        catalog.item_slug_by_id = {1001: "boots"}
        catalog.item_meta_by_slug = {"boots": {"goldTotal": 300, "goldSell": None}}
        total, sell = _item_gold_values(catalog, 1001)
        assert total == 300
        assert sell == 210


# ---------------------------------------------------------------------------
# features/analytics.py — _replay_gold_event
# ---------------------------------------------------------------------------


class TestReplayGoldEvent:
    def setup_method(self) -> None:
        self.catalog = MagicMock()
        self.catalog.item_slug_by_id = {1001: "boots"}
        self.catalog.item_meta_by_slug = {"boots": {"goldTotal": 300, "goldSell": 210}}

    def test_item_purchased_adds_cost(self) -> None:
        event = {"type": "ITEM_PURCHASED", "itemId": 1001}
        gold, stop = _replay_gold_event(
            event=event, index=2, purchase_event_index=5, working_gold=1000, catalog=self.catalog
        )
        assert gold == 1300
        assert stop is False

    def test_item_purchased_at_target_index_stops(self) -> None:
        event = {"type": "ITEM_PURCHASED", "itemId": 1001}
        _, stop = _replay_gold_event(
            event=event, index=3, purchase_event_index=3, working_gold=1000, catalog=self.catalog
        )
        assert stop is True

    def test_item_sold_subtracts_sell_value(self) -> None:
        event = {"type": "ITEM_SOLD", "itemId": 1001}
        gold, stop = _replay_gold_event(
            event=event, index=0, purchase_event_index=5, working_gold=1000, catalog=self.catalog
        )
        assert gold == 790
        assert stop is False

    def test_item_undo_at_target_index_stops(self) -> None:
        event = {"type": "ITEM_UNDO", "itemId": 1001}
        _, stop = _replay_gold_event(
            event=event, index=3, purchase_event_index=3, working_gold=1000, catalog=self.catalog
        )
        assert stop is True

    def test_unrelated_event_no_change(self) -> None:
        event = {"type": "WARD_PLACED"}
        gold, stop = _replay_gold_event(
            event=event, index=0, purchase_event_index=5, working_gold=1000, catalog=self.catalog
        )
        assert gold == 1000
        assert stop is False


# ---------------------------------------------------------------------------
# features/analytics.py — _remove_item_once
# ---------------------------------------------------------------------------


class TestRemoveItemOnce:
    def test_removes_first_occurrence(self) -> None:
        items = [1001, 2003, 1001]
        _remove_item_once(items, 1001)
        assert items == [2003, 1001]

    def test_no_op_when_item_absent(self) -> None:
        items = [2003]
        _remove_item_once(items, 9999)
        assert items == [2003]


# ---------------------------------------------------------------------------
# models/feature_builder.py — _safe_float
# ---------------------------------------------------------------------------


class TestSafeFloat:
    def test_bool_true_returns_1(self) -> None:
        assert _safe_float(True) == pytest.approx(1.0)

    def test_bool_false_returns_0(self) -> None:
        assert _safe_float(False) == pytest.approx(0.0)

    def test_int_converts(self) -> None:
        assert _safe_float(42) == pytest.approx(42.0)

    def test_float_passthrough(self) -> None:
        assert _safe_float(3.14) == pytest.approx(3.14)

    def test_string_returns_0(self) -> None:
        assert _safe_float("text") == pytest.approx(0.0)

    def test_none_returns_0(self) -> None:
        assert _safe_float(None) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# models/feature_builder.py — build_feature_dict with current_items
# ---------------------------------------------------------------------------


class TestBuildFeatureDict:
    def test_current_items_added_as_indicators(self) -> None:
        row = {
            "timestamp_minutes": 10,
            "gold_available": 1200,
            "level": 7,
            "kills": 2,
            "deaths": 1,
            "assists": 3,
            "cs": 80,
            "current_item_count": 1,
            "ally_frontline_count": 1,
            "ally_magic_damage_count": 1,
            "ally_physical_damage_count": 2,
            "ally_support_count": 0,
            "enemy_frontline_count": 2,
            "enemy_magic_damage_count": 1,
            "enemy_physical_damage_count": 1,
            "enemy_support_count": 1,
            "patch": "26.7",
            "champion_slug": "jinx",
            "role": "ADC",
            "current_items": ["trinity-force", "boots"],
        }
        features = build_feature_dict(row)
        assert features["current_item::trinity-force"] == pytest.approx(1.0)
        assert features["current_item::boots"] == pytest.approx(1.0)

    def test_empty_item_slug_skipped(self) -> None:
        row = {
            "timestamp_minutes": 0,
            "gold_available": 0,
            "level": 1,
            "kills": 0,
            "deaths": 0,
            "assists": 0,
            "cs": 0,
            "current_item_count": 0,
            "ally_frontline_count": 0,
            "ally_magic_damage_count": 0,
            "ally_physical_damage_count": 0,
            "ally_support_count": 0,
            "enemy_frontline_count": 0,
            "enemy_magic_damage_count": 0,
            "enemy_physical_damage_count": 0,
            "enemy_support_count": 0,
            "patch": "26.7",
            "champion_slug": "jinx",
            "role": "ADC",
            "current_items": ["", "  "],
        }
        features = build_feature_dict(row)
        assert not any(k.startswith("current_item::") for k in features)


# ---------------------------------------------------------------------------
# models/feature_builder.py — _add_list_indicators
# ---------------------------------------------------------------------------


class TestAddListIndicators:
    def test_non_list_is_no_op(self) -> None:
        features: dict[str, float | str] = {}
        _add_list_indicators(features, "not-a-list", "tag")
        assert not features

    def test_list_adds_indicators(self) -> None:
        features: dict[str, float | str] = {}
        _add_list_indicators(features, ["damage", "boots"], "item_tag")
        assert features["item_tag::damage"] == pytest.approx(1.0)
        assert features["item_tag::boots"] == pytest.approx(1.0)

    def test_empty_string_values_skipped(self) -> None:
        features: dict[str, float | str] = {}
        _add_list_indicators(features, ["", "  "], "tag")
        assert not features


# ---------------------------------------------------------------------------
# models/feature_builder.py — build_ranking_feature_dict
# ---------------------------------------------------------------------------


class TestBuildRankingFeatureDict:
    def test_includes_item_tags_as_indicators(self) -> None:
        row = {
            "timestamp_minutes": 10,
            "gold_available": 1000,
            "level": 6,
            "kills": 0,
            "deaths": 0,
            "assists": 0,
            "cs": 70,
            "current_item_count": 1,
            "ally_frontline_count": 1,
            "ally_magic_damage_count": 0,
            "ally_physical_damage_count": 2,
            "ally_support_count": 0,
            "enemy_frontline_count": 2,
            "enemy_magic_damage_count": 1,
            "enemy_physical_damage_count": 1,
            "enemy_support_count": 0,
            "patch": "26.7",
            "champion_slug": "jinx",
            "role": "ADC",
            "item_cost": 3400,
            "item_is_boots": False,
            "item_is_legendary": True,
            "item_builds_from_count": 2,
            "item_builds_into_count": 0,
            "candidate_item_slug": "infinity-edge",
            "item_category": "crit",
            "current_items": ["boots"],
            "item_tags": ["Damage", "CriticalStrike"],
        }
        features = build_ranking_feature_dict(row)
        assert features["item_tag::Damage"] == pytest.approx(1.0)
        assert features["item_tag::CriticalStrike"] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# inference/api.py — FastAPI endpoint tests
# ---------------------------------------------------------------------------


class TestInferenceApi:
    @pytest.fixture
    def client(self) -> TestClient:
        return TestClient(app)

    def test_health_endpoint_returns_ok(self, client: TestClient, tmp_path: Any) -> None:
        mock_config = MagicMock()
        mock_config.project.name = "summoner-build-lab-ml"
        mock_config.project.environment = "test"
        mock_config.paths.baseline_model_path.exists.return_value = False
        mock_config.paths.analytic_dataset_path.exists.return_value = False

        with patch("inference.api.get_config", return_value=mock_config):
            response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "summoner-build-lab-ml"

    def test_version_endpoint_returns_info(self, client: TestClient) -> None:
        mock_config = MagicMock()
        mock_config.project.name = "summoner-build-lab-ml"
        mock_config.project.version = "0.2.0"

        with patch("inference.api.get_config", return_value=mock_config):
            response = client.get("/version")

        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "summoner-build-lab-ml"
        assert data["version"] == "0.2.0"

    def test_predict_when_model_not_ready(self, client: TestClient) -> None:
        from inference.service import PredictionOutput

        not_ready = PredictionOutput(
            model_ready=False,
            predicted_item_slug=None,
            confidence=None,
            candidate_pool_size=0,
            top_predictions=[],
            model_version=None,
        )

        payload = {
            "champion_slug": "jinx",
            "role": "ADC",
            "patch": "26.7",
            "level": 8,
            "gold_available": 2000,
            "timestamp_minutes": 15,
            "kills": 2,
            "deaths": 1,
            "assists": 3,
            "cs": 120,
            "current_items": [],
            "current_item_count": 0,
            "ally_frontline_count": 1,
            "ally_magic_damage_count": 1,
            "ally_physical_damage_count": 2,
            "ally_support_count": 1,
            "enemy_frontline_count": 2,
            "enemy_magic_damage_count": 1,
            "enemy_physical_damage_count": 1,
            "enemy_support_count": 1,
        }

        with patch("inference.api.predict_next_item", return_value=not_ready):
            response = client.post("/predict-next-item", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["model_ready"] is False
        assert "Model artifact" in data["message"]


# ---------------------------------------------------------------------------
# training/baseline.py — main()
# ---------------------------------------------------------------------------


class TestBaselineMain:
    def _make_summary(self) -> "RankingTrainingSummary":
        from training.ranking import RankingTrainingSummary

        return RankingTrainingSummary(
            model_family="lgbm_ranking",
            train_rows=100,
            validation_rows=20,
            test_rows=20,
            train_queries=50,
            validation_queries=10,
            test_queries=10,
            unique_candidate_items=80,
            ndcg_at_k=0.85,
            map_at_k=0.80,
            top1_accuracy=0.70,
            topk_accuracy=0.90,
            model_path="model.pkl",
            metadata_path="meta.json",
            evaluation_report_path="report.md",
        )

    def test_train_baseline_delegates_to_ranking(self) -> None:
        from training.baseline import train_baseline

        fake_summary = self._make_summary()

        with patch("training.baseline.train_ranking_model", return_value=fake_summary) as mock_train:
            result = train_baseline(config=MagicMock())

        assert result == fake_summary
        mock_train.assert_called_once()

    def test_main_prints_summary(self) -> None:
        from training.baseline import main

        fake_summary = self._make_summary()

        with (
            patch("training.baseline.train_ranking_model", return_value=fake_summary),
            patch("inference.config.load_config", return_value=MagicMock()),
        ):
            main()
