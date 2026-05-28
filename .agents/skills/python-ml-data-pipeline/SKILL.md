---
name: python-ml-data-pipeline
description: Structure a local tabular data pipeline for the ML workspace with raw/interim/processed directories, deterministic dataset builders, explicit configs, and testable preprocessing code. Use when adding or refactoring data preparation code under ml/.
---

# Python ML Data Pipeline

Implement data preparation as small, testable Python modules under `ml/features/` and `ml/training/`.

## Workflow

1. Keep directory semantics explicit: `raw`, `interim`, and `processed`.
2. Load paths and runtime parameters from `ml/configs/base.yaml`.
3. Prefer deterministic dataset builders and explicit file outputs.
4. Save intermediate tabular outputs in formats suited for local analysis, preferably parquet.
5. Cover pipeline helpers with fast unit tests under `ml/tests/`.

## Guardrails

- Avoid hidden side effects outside `ml/data` and `ml/artifacts`.
- Avoid product-specific LoL logic until the input schema is stabilized.
- Keep baseline datasets cheap to generate locally on CPU.

