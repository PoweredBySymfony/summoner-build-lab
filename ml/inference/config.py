from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = ROOT_DIR / "configs" / "base.yaml"


class ProjectConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    version: str
    environment: str


class PathsConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    artifacts_dir: Path
    raw_data_dir: Path
    interim_data_dir: Path
    processed_data_dir: Path
    raw_matches_path: Path
    item_catalog_path: Path
    champion_catalog_path: Path
    export_manifest_path: Path
    analytic_dataset_path: Path
    train_dataset_path: Path
    validation_dataset_path: Path
    test_dataset_path: Path
    dataset_report_path: Path
    baseline_model_path: Path
    baseline_metadata_path: Path
    evaluation_metrics_path: Path
    evaluation_report_path: Path


class DatasetConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    validation_ratio: float
    test_ratio: float
    min_rows: int
    min_unique_labels: int
    min_train_label_frequency: int


class TrainingConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    random_seed: int
    top_k: int
    max_top_k: int
    xgboost_estimators: int
    xgboost_max_depth: int
    xgboost_learning_rate: float
    xgboost_subsample: float
    xgboost_colsample_bytree: float


class PuzzleConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    min_confidence: float
    min_confidence_gap: float
    distractor_count: int


class ApiConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    host: str
    port: int
    log_level: str


class AppConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    project: ProjectConfig
    paths: PathsConfig
    dataset: DatasetConfig
    training: TrainingConfig
    puzzle: PuzzleConfig
    api: ApiConfig


def _resolve_path(root_dir: Path, raw_value: str) -> Path:
    path = Path(raw_value)
    return path if path.is_absolute() else (root_dir / path).resolve()


def _resolve_config_path(config_path: Path | None = None) -> Path:
    if config_path is not None:
        return config_path.resolve()
    env_override = os.environ.get("ML_CONFIG_PATH")
    if env_override:
        return Path(env_override).resolve()
    return DEFAULT_CONFIG_PATH.resolve()


def load_config(config_path: Path | None = None) -> AppConfig:
    load_dotenv()
    resolved_config_path = _resolve_config_path(config_path)
    raw_config = yaml.safe_load(resolved_config_path.read_text(encoding="utf-8"))
    root_dir = resolved_config_path.parent.parent
    raw_paths = raw_config["paths"]
    raw_config["paths"] = {
        key: _resolve_path(root_dir, value) for key, value in raw_paths.items()
    }
    return AppConfig.model_validate(raw_config)


@lru_cache(maxsize=1)
def get_config() -> AppConfig:
    return load_config()
