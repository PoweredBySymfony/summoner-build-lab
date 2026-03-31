from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def _get_config():
    from inference.config import get_config

    return get_config()


def _run(command: list[str]) -> int:
    return subprocess.run(command, cwd=ROOT_DIR, check=False).returncode


def install() -> int:
    return _run([sys.executable, "scripts/install_deps.py"])


def lint() -> int:
    return _run([sys.executable, "-m", "ruff", "check", "."])


def typecheck() -> int:
    return _run(
        [
            sys.executable,
            "-m",
            "mypy",
            "features",
            "inference",
            "models",
            "training",
            "tests",
        ]
    )


def test() -> int:
    return _run([sys.executable, "-m", "pytest"])


def build_dataset() -> int:
    return _run([sys.executable, "-m", "features.analytics"])


def train_baseline() -> int:
    return _run([sys.executable, "-m", "training.ranking"])


def run_api() -> int:
    config = _get_config()
    return _run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "inference.api:app",
            "--host",
            config.api.host,
            "--port",
            str(config.api.port),
            "--log-level",
            config.api.log_level,
        ]
    )


COMMANDS = {
    "install": install,
    "lint": lint,
    "typecheck": typecheck,
    "test": test,
    "build-dataset": build_dataset,
    "train-baseline": train_baseline,
    "run-api": run_api,
}


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        available = ", ".join(COMMANDS)
        print(f"Usage: python scripts/tasks.py <{available}>")
        return 1
    return COMMANDS[sys.argv[1]]()


if __name__ == "__main__":
    raise SystemExit(main())
