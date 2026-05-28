from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import joblib


def ensure_parent_directory(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def save_model(path: Path, model: Any) -> None:
    ensure_parent_directory(path)
    joblib.dump(model, path)


def load_model(path: Path) -> Any:
    return joblib.load(path)


def save_metadata(path: Path, payload: dict[str, Any]) -> None:
    ensure_parent_directory(path)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_metadata(path: Path) -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))
