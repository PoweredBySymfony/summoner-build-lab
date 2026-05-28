from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
VENV_DIR = ROOT_DIR / ".venv"


def resolve_python_command() -> list[str]:
    override = os.environ.get("ML_PYTHON_BIN")
    if override:
        return override.split()
    if os.name == "nt":
        return ["py", "-3.13"]
    return ["python3.13"]


def main() -> None:
    command = [*resolve_python_command(), "-m", "venv", str(VENV_DIR)]
    subprocess.run(command, check=True, cwd=ROOT_DIR)
    print(f"Created virtual environment at {VENV_DIR}")


if __name__ == "__main__":
    sys.exit(main())
