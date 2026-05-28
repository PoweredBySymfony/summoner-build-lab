from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if sys.platform == "win32":
    VENV_PYTHON = ROOT_DIR / ".venv" / "Scripts" / "python.exe"
else:
    VENV_PYTHON = ROOT_DIR / ".venv" / "bin" / "python"


def main() -> None:
    if not VENV_PYTHON.exists():
        raise SystemExit("Virtual environment not found. Run scripts/create_venv.py first.")

    subprocess.run([str(VENV_PYTHON), "-m", "pip", "install", "--upgrade", "pip"], check=True)
    subprocess.run(
        [str(VENV_PYTHON), "-m", "pip", "install", "-e", ".[dev]"],
        check=True,
        cwd=ROOT_DIR,
    )
    print("Installed ML dependencies into the local virtual environment.")


if __name__ == "__main__":
    main()
