# Clean-code audit - 2026-05-28

Branch: `optimization/coder-proprement-audit`

This audit applies the new global `$coder-proprement` skill, plus the technical `$audit` rubric. The frontend-design context is incomplete because `.impeccable.md` is absent and no `$teach-impeccable` skill is installed, so UI findings are limited to verifiable implementation issues.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2/4 | `ItemIcon` uses a focusable `div` as a button without keyboard activation. |
| 2 | Performance | 3/4 | Build is healthy, but large UI/service chunks concentrate render and change risk. |
| 3 | Responsive Design | 2/4 | Several admin/dialog tables rely on wide fixed minimums and horizontal overflow. |
| 4 | Theming | 2/4 | High-value UI paths hard-code many colors instead of design tokens. |
| 5 | Anti-Patterns | 2/4 | Gradient/glass/card-heavy patterns appear in repeated product surfaces. |
| **Total** | | **11/20** | **Acceptable: working and tested, but significant maintainability cleanup is needed.** |

## Anti-Patterns Verdict

The product does not look like a pure AI-generated shell: it has domain-specific League of Legends item, puzzle, and ingestion flows. However, several implementation tells match the audit rubric: repeated gradient accents, glass/blur surfaces, card-heavy admin sections, hard-coded color palettes, and oversized all-in-one components. The issue is less visual polish than maintainability: the current code often works by accumulating behavior inside large files instead of maintaining small ownership boundaries.

## Executive Summary

- Audit Health Score: **11/20** (Acceptable).
- Issues found: **0 P0 / 5 P1 / 5 P2 / 2 P3**.
- Checks: `npm run build` passed, `npm run lint` passed with 9 warnings, `npm run test` passed with 25 files and 112 tests.
- Top priorities: split the ML puzzle generator, split the competitive import script, type the admin write APIs, extract admin page modules, and replace the custom `div` button in `ItemIcon` with proper keyboard semantics.

## Detailed Findings by Severity

### [P1] ML puzzle generation service has too many responsibilities
- Location: `server/src/services/mlPuzzleGenerationService.ts:1`, `server/src/services/mlPuzzleGenerationService.ts:1192`, `server/src/services/mlPuzzleGenerationService.ts:1680`, `server/src/services/mlPuzzleGenerationService.ts:2460`
- Category: Clean Code / Architecture / Performance
- Principle: one responsibility per module, one abstraction level per function
- Impact: this 2402-line service mixes type definitions, archive loading, timeline parsing, snapshot scoring, candidate filtering, ML calls, publication selection, persistence, diagnostics, and response formatting. Each change to ML behavior risks touching unrelated persistence or diagnostics logic.
- Recommendation: split by ownership: `snapshotCandidateBuilder`, `attemptEvaluator`, `seriesSelector`, `requestPersistence`, and `diagnostics`. Keep the exported service as an orchestrator with minimal branching.
- Verification: `npm run test -- src/test/mlPuzzle*.test.ts` and `npm run build`.

### [P1] Competitive import script combines CLI parsing, discovery, checkpointing, classification, persistence, reporting, and quarantine
- Location: `scripts/importCompetitiveMatches.ts:89`, `scripts/importCompetitiveMatches.ts:760`, `scripts/importCompetitiveMatches.ts:1420`, `scripts/importCompetitiveMatches.ts:2070`
- Category: Clean Code / Architecture
- Principle: separate command-line adapter from domain workflow
- Impact: the 2135-line script contains both operational workflow and reusable ingestion logic. This makes dry-runs, checkpoint recovery, and auth failure handling difficult to review safely.
- Recommendation: move CLI parsing to a small entrypoint; extract `competitiveDiscoveryRunner`, `competitiveProgressReporter`, and `competitiveImportRunner` modules under `server/src/lib/riot` or `scripts/lib`.
- Verification: `npm run test -- src/test/competitive*.test.ts` plus a documented `--dry-run` smoke test.

### [P1] Admin update payloads lose type safety at the route and hook boundary
- Location: `server/src/routes/adminRoutes.ts:35`, `server/src/routes/adminRoutes.ts:73`, `src/api/hooks.ts:233`, `src/api/hooks.ts:249`, `src/api/hooks.ts:265`
- Category: Clean Code / Type Safety / API Boundary
- Principle: make dependencies and data contracts explicit
- Impact: server routes parse with Zod but cast with `as Parameters<...>`, while frontend admin mutations accept `Record<string, unknown>`. This weakens compile-time guarantees exactly where destructive admin edits happen.
- Recommendation: export shared DTO types from server/domain schemas or define typed client payloads that match Zod schemas. Replace `z.record(z.any())` with `z.record(z.unknown())` or a narrower stats schema.
- Verification: `npm run build`, `npm run lint`, and focused admin mutation tests if available.

### [P1] Interactive item icon is not keyboard-equivalent to a real button
- Location: `src/components/ItemIcon.tsx:401`
- Category: Accessibility / Clean Code
- WCAG/Standard: WCAG 2.1.1 Keyboard
- Impact: `ItemIcon` sets `role="button"` and `tabIndex=0` on a `div`, but only handles click/focus/blur. Keyboard users cannot activate it with Enter/Space consistently.
- Recommendation: render an actual `button` when interactive, or add explicit `onKeyDown` activation and preserve focus styling. Prefer the native button to reduce custom accessibility code.
- Verification: component keyboard test or Playwright smoke test for item inspection.

### [P1] Admin page is a 1172-line component containing page orchestration, tables, filters, dialogs, form state, and mutation wiring
- Location: `src/pages/Admin.tsx:194`, `src/pages/Admin.tsx:700`, `src/pages/Admin.tsx:980`, `src/pages/Admin.tsx:1130`
- Category: Clean Code / Frontend Architecture / Responsive
- Principle: small components with focused responsibilities
- Impact: admin changes require editing one large file with several nested workflows. Form state, validation, mutation payload mapping, and UI layout are tightly coupled.
- Recommendation: extract feature modules for champion, item, puzzle, and patch-sync sections. Move form state/payload mapping into hooks or small adapter functions per entity.
- Verification: `npm run build`, `npm run lint`, and manual admin smoke test.

### [P2] Route handlers repeat try/catch and schema parsing boilerplate
- Location: `server/src/routes/appRoutes.ts:53`, `server/src/routes/appRoutes.ts:78`, `server/src/routes/appRoutes.ts:153`, `server/src/routes/adminRoutes.ts:19`
- Category: Clean Code / Error Handling
- Principle: remove duplication after behavior is stable
- Impact: every handler repeats `try { ... } catch (error) { next(error) }`, making route files longer and obscuring endpoint-specific behavior.
- Recommendation: introduce a typed `asyncRoute` wrapper and a `parseRequest` helper for body/query/params. Migrate incrementally per route group.
- Verification: route tests or `npm run build` plus API smoke tests.

### [P2] Item tooltip embeds presentation palette and layout logic inside one component
- Location: `src/components/ItemIcon.tsx:26`, `src/components/ItemIcon.tsx:47`, `src/components/ItemIcon.tsx:499`
- Category: Theming / Clean Code / Anti-Pattern
- Principle: keep design tokens and rendering responsibilities explicit
- Impact: hard-coded hex colors, gradient classes, tooltip layout, portal positioning, glyph rendering, and item semantics live in one 569-line component. This makes theme changes and accessibility fixes risky.
- Recommendation: move stat color tokens to `itemPresentation` or CSS variables, extract tooltip body and positioning into focused components, and keep `ItemIcon` as a small trigger.
- Verification: visual regression or manual checks for item tooltip placement and contrast.

### [P2] Riot sync service mixes catalog sync, public profile mapping, identity resolution, import retries, and persistence
- Location: `server/src/services/riotSyncService.ts:415`, `server/src/services/riotSyncService.ts:1000`, `server/src/services/riotSyncService.ts:1148`
- Category: Clean Code / Architecture
- Principle: separate IO adapters, mapping, and application services
- Impact: one 1234-line service spans unrelated reasons to change: Data Dragon catalog updates, Riot API retry policy, player profile projections, and match import persistence.
- Recommendation: split catalog synchronization, identity resolution, match import, and public profile projection into separate modules with the current service as a facade.
- Verification: `npm run test -- src/test/riot*.test.ts` and `npm run build`.

### [P2] Technical frontend audit cannot be completed to the intended design standard without design context
- Location: `.impeccable.md` absent
- Category: Audit Process / Frontend Design
- Impact: `$audit` requires `$frontend-design` context: audience, use cases, and brand personality. Without it, UI scoring can only cover measurable code issues, not whether the interface fits the intended product tone.
- Recommendation: create `.impeccable.md` with target audience, primary workflows, brand tone, and visual constraints before the next UI audit.
- Verification: re-run `$audit` after adding design context.

### [P2] Branch/deployment workflow can still confuse preview with production
- Location: Vercel Git integration and branch workflow
- Category: Workflow / Deployment
- Impact: pushing `dev` or optimization branches creates Vercel previews. This is correct, but the team already confused a preview push with production once, so the workflow needs explicit naming and documentation.
- Recommendation: document `main = production`, `dev = integration preview`, `feature/*` and `optimization/* = preview only` in the README or contributor notes. Add branch protection if available.
- Verification: inspect Vercel deployment target after pushes; production deployments should report `target: production` and `githubCommitRef: main`.

### [P3] Lint passes but reports persistent warnings
- Location: `server/src/lib/prisma.ts:8`, `src/components/ui/button.tsx:50`, `src/components/ui/sidebar.tsx:636`, and related UI primitives
- Category: Tooling / Clean Code
- Impact: warnings normalize noise in CI output. The unused eslint-disable is directly fixable; Fast Refresh warnings are lower risk but indicate mixed component/non-component exports.
- Recommendation: remove the stale eslint-disable and consider extracting exported variants/constants from UI component files over time.
- Verification: `npm run lint`.

### [P3] Build/test output shows dependency freshness warnings
- Location: build/test tooling
- Category: Maintenance
- Impact: Browserslist data is 11 months old, Prisma reports 7.5.0 -> 7.8.0 available, and Vitest emits `punycode` deprecation warnings. None blocks release, but they reduce signal in checks.
- Recommendation: schedule dependency hygiene separately from clean-code refactors.
- Verification: `npm run build` and `npm run test`.

## Patterns and Systemic Issues

- Large files are the strongest maintainability signal: 8 source files exceed 800 lines, led by `mlPuzzleGenerationService.ts`, `importCompetitiveMatches.ts`, `riotSyncService.ts`, and `Admin.tsx`.
- Types are strong in domain tests and Prisma models, but admin write boundaries fall back to broad casts and `Record<string, unknown>`.
- UI code uses a solid component library foundation, but product-specific components frequently bypass tokens with inline hex palettes and one-off layout values.
- Tests are broad and fast, but several large orchestration modules need tests mapped to extracted responsibilities before refactoring.

## Positive Findings

- Build, lint, and tests all complete successfully.
- The test suite is meaningful: 25 files and 112 tests cover Riot ingestion, ML puzzle rules, item presentation, item lab calculations, and static data audits.
- Domain logic is already partially extracted in useful places, such as `puzzleBusinessRules`, `puzzleChoiceResolution`, `scenarioInventory`, `competitiveIngestion`, and `riotRequestScheduler`.
- Vercel production is already tied to `main`; non-main pushes create previews only.

## Recommended Actions

1. **[P1] `$extract`** - Split `server/src/services/mlPuzzleGenerationService.ts` into candidate building, attempt evaluation, selection, persistence, and diagnostics.
2. **[P1] `$extract`** - Split `scripts/importCompetitiveMatches.ts` into CLI adapter, discovery runner, progress reporter, and import runner.
3. **[P1] `$harden`** - Replace admin `Record<string, unknown>` and `z.any()` payload boundaries with explicit DTOs/schemas.
4. **[P1] `$adapt`** - Make `ItemIcon` interactive semantics native-button or keyboard-complete.
5. **[P2] `$normalize`** - Add route wrapper/helpers to remove repeated try/catch and parsing boilerplate.
6. **[P2] `$colorize`** - Move item tooltip hard-coded colors into design tokens or documented item-stat tokens.
7. **[P2] `$clarify`** - Document branch/Vercel deployment meanings so previews are not confused with production.
8. **[P3] `$polish`** - Remove lint warning noise and schedule dependency freshness cleanup.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `$audit` after fixes to see your score improve.

## Verification Log

- `python C:\Users\XavierTrouche\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Users\XavierTrouche\.codex\skills\coder-proprement` - passed.
- `npm run build` - passed.
- `npm run lint` - passed with 9 warnings.
- `npm run test` - passed: 25 test files, 112 tests.
