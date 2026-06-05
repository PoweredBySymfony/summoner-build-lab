from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import joblib


def secure_path(path: Path) -> Path:
    if ".." in path.parts:
        raise ValueError(f"Parent directory traversal is not allowed: {path}")
    return path.resolve()


def ensure_parent_directory(path: Path) -> None:
    secure_path(path).parent.mkdir(parents=True, exist_ok=True)


def save_model(path: Path, model: Any) -> None:
    ensure_parent_directory(path)
    joblib.dump(model, secure_path(path))


def load_model(path: Path) -> Any:
    return joblib.load(secure_path(path))


def save_metadata(path: Path, payload: dict[str, Any]) -> None:
    ensure_parent_directory(path)
    secure_path(path).write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_metadata(path: Path) -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(secure_path(path).read_text(encoding="utf-8")))
