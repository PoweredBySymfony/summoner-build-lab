---
name: python-ml-fastapi-serving
description: Build or extend a minimal FastAPI serving layer for the ML workspace with health/version endpoints, explicit request and response schemas, config-driven runtime settings, and stub-friendly prediction paths. Use when working on model serving under ml/inference.
---

# Python ML FastAPI Serving

Build the serving surface in `ml/inference/` as a small, explicit API.

## Workflow

1. Keep the app factory or module entrypoint inside `ml/inference/`.
2. Expose only explicit endpoints with typed request and response schemas.
3. Use configuration from `ml/configs/base.yaml` rather than hardcoded runtime paths.
4. Make stub behavior obvious when a real trained model is not wired yet.
5. Add smoke tests for every public endpoint.

## Guardrails

- Do not hide business logic behind placeholder predictions.
- Do not depend on the Node backend runtime.
- Keep local serving runnable with a single command from `ml/`.

