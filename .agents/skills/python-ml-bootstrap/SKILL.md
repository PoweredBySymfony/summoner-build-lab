---
name: python-ml-bootstrap
description: Bootstrap a local Python ML workspace with isolated dependencies, reproducible environment scripts, pyproject metadata, linting, typing, testing, and CPU-first defaults. Use when creating or extending the Python foundation for ML work in this repository.
---

# Python ML Bootstrap

Create or update the ML workspace under `ml/` without coupling it to the Node application.

## Workflow

1. Keep all Python ML code, dependencies, configs, and scripts inside `ml/`.
2. Prefer `pyproject.toml` with an explicit Python target and isolated dev tooling.
3. Add only the minimum scripts needed for environment creation, dependency install, lint, typecheck, test, training, and serving.
4. Default to CPU-first libraries and lightweight baseline workflows.
5. Update `ml/README.md` and `codex.md` when the foundation changes.

## Guardrails

- Do not import from `server/`, `src/`, or `prisma/`.
- Do not add hidden automation or heavyweight orchestration for V1.
- Keep commands reproducible from a clean checkout.

