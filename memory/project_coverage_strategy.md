---
name: Coverage Strategy Plan
description: 5-lot roadmap from 31% → 80% coverage, starting with pure modules
type: project
---

**Objective** : Raise code coverage from 31% to 80%+ (SonarQube metric)

**Strategy**: Layer-by-layer approach, prioritizing testable-first (no React/DB coupling):

**Lot 1 — Pure ML/Riot Modules** (🎯 Highest ROI, lowest risk)
- Target: 70-90% coverage
- Files: snapshotAttemptEvaluator, snapshotCandidateBuilder, matchImportRunner, competitiveSeeds, riotIdentity, publicPlayerProfile, viewMappers
- Method: Unit tests, table-driven, no external deps
- Est. effort: 2-3 days
- Gain: 31% → 40%

**Lot 2 — Services Backend** (Large files, high value)
- Target: 60-80% coverage
- Files: puzzleGenerationService, mlPuzzleGenerationService, itemExplanationService, progressService, adminService, authService, appService, riotSyncService
- Method: Service-level tests with mocked repositories/API clients
- Est. effort: 3-5 days
- Gain: 40% → 55%

**Lot 3 — React Components** (Critical UX paths)
- Target: 50-70% coverage
- Files: RiotIdSearch, ItemIcon, Lab, PlayerProfile, Admin, Training, SetupColumn, PatchDialog
- Method: Testing Library, user interaction workflows, loading/error states
- Est. effort: 4-6 days
- Gain: 55% → 65%

**Lot 4 — API Hooks & Routes** (Integration level)
- Target: 60-80% coverage
- Files: hooks.ts, appRoutes.ts, adminRoutes.ts, app.ts
- Method: Integration tests after services covered (avoid duplication)
- Est. effort: 2-3 days
- Gain: 65% → 72%

**Lot 5 — Python ML Pipeline** (Remaining coverage)
- Target: 70%+ coverage
- Files: ml/features/*, ml/inference/*, ml/models/*, ml/training/*
- Method: Pytest with fixtures, coverage.xml validation
- Est. effort: 3-4 days
- Gain: 72% → 80%+

**Quality Gate Constraint** : SonarQube checks **new code coverage** first (80% required on every commit). Focus each lot on maintaining this threshold.

**Start Date** : 2026-06-06  
**Target Completion** : 2026-06-25 (3 weeks with parallel work)
