from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib


def ensure_parent_directory(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def save_model(path: Path, model: Any) -> None:
    ensure_parent_directory(path)
    joblib.dump(model, path)


def save_metadata(path: Path, payload: dict[str, Any]) -> None:
    ensure_parent_directory(path)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

