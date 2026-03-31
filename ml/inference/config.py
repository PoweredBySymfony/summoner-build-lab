from __future__ import annotations

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
    baseline_model_path: Path
    baseline_metadata_path: Path


class TrainingConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    random_seed: int
    test_size: float
    n_samples: int
    n_features: int
    n_informative: int


class ApiConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    host: str
    port: int
    log_level: str


class AppConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    project: ProjectConfig
    paths: PathsConfig
    training: TrainingConfig
    api: ApiConfig


def _resolve_path(root_dir: Path, raw_value: str) -> Path:
    path = Path(raw_value)
    return path if path.is_absolute() else (root_dir / path).resolve()


def load_config(config_path: Path | None = None) -> AppConfig:
    load_dotenv()
    resolved_config_path = (config_path or DEFAULT_CONFIG_PATH).resolve()
    raw_config = yaml.safe_load(resolved_config_path.read_text(encoding="utf-8"))
    root_dir = resolved_config_path.parent.parent
    raw_paths = raw_config["paths"]
    normalized_paths = {
        key: _resolve_path(root_dir, value) for key, value in raw_paths.items()
    }
    raw_config["paths"] = normalized_paths
    return AppConfig.model_validate(raw_config)


@lru_cache(maxsize=1)
def get_config() -> AppConfig:
    return load_config()
