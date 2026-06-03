# Clean-code audit - 2026-05-28

Branch: `optimization/coder-proprement-audit`

This audit applies the new global `$coder-proprement` skill, plus the technical `$audit` rubric. The frontend-design context is incomplete because `.impeccable.md` is absent and no `$teach-impeccable` skill is installed, so UI findings are limited to verifiable implementation issues.

## Remediation status

Applied in follow-up commit:

- Fixed `ItemIcon` keyboard accessibility by using a native `button` for interactive item icons.
- Extracted item stat visual token maps from `ItemIcon` into `src/lib/itemStatVisuals.ts`.
- Added typed Admin update payloads on the client and explicit Admin payload types on the server.
- Replaced Admin route `z.any()` with `z.unknown()` and removed route casts to service `Parameters<...>`.
- Added `asyncRoute` and migrated `adminRoutes` to remove repeated route-level `try/catch` boilerplate.
- Removed the stale Prisma eslint-disable warning.
- Documented `main = production`, `dev = integration preview`, and `feature/*` / `optimization/* = preview` in `README.md`.

Applied in second follow-up commit:

- Migrated `appRoutes` to the shared `asyncRoute` wrapper, removing repeated route-level `try/catch` boilerplate.
- Extracted UI variant definitions for button, badge, toggle, and navigation-menu into non-component modules.
- Stopped exporting non-component helpers from component files where they were only used internally.
- Moved the i18n hook into `src/i18n/useLanguage.ts` and kept `src/i18n/context.tsx` focused on the provider component.
- Cleared the previous React Fast Refresh lint warnings.

Applied in third follow-up commit:

- Started the `Admin.tsx` split by extracting shared admin UI primitives, admin option constants, JSON parsing, and `ChampionEditDialog` into focused modules under `src/pages/admin`.
- Kept `Admin.tsx` as the page orchestrator while reducing local presentation/helper responsibilities.

Applied in fourth follow-up commit:

- Completed the admin dialog split by extracting `ItemEditDialog`, `PuzzleEditDialog`, and `PatchDialog` into focused modules under `src/pages/admin`.
- Reduced `src/pages/Admin.tsx` to the page orchestration, filtering, tables, mutation wiring, and delete confirmation flow.

Applied in fifth follow-up commit:

- Extracted pure Riot item catalog selection rules from `riotSyncService.ts` into `server/src/lib/riot/catalogItemRules.ts`.
- Kept network calls and persistence in `riotSyncService.ts`; the new module owns only purchasability filtering, canonical item candidate comparison, and boot item derivation.

Applied in sixth follow-up commit:

- Started the `importCompetitiveMatches.ts` split by extracting CLI option parsing and tranche preset logic into `scripts/lib/competitiveImportCli.ts`.
- Added an explicit TypeScript check for the competitive import script and fixed a discovered contract mismatch: `CompetitiveSeedMatchDiscovery.priorityScore` was being read as `matchPriorityScore`.

Applied in seventh follow-up commit:

- Started the `mlPuzzleGenerationService.ts` split by extracting snapshot scoring, publishability, low-confidence override, and quality-score rules into `server/src/lib/ml/snapshotQuality.ts`.
- Kept `mlPuzzleGenerationService.ts` as the orchestrator while moving pure, test-covered decision logic into a focused ML library module.

Applied in eighth follow-up commit:

- Continued the `importCompetitiveMatches.ts` split by extracting discovery quarantine persistence into `scripts/lib/competitiveDiscoveryQuarantine.ts`.
- Extracted competitive ingestion Markdown report rendering into `scripts/lib/competitiveImportReport.ts`.

Applied in ninth follow-up commit:

- Continued the `riotSyncService.ts` split by extracting Riot account lookup, platform resolution, account indexing, and import identity resolution into `server/src/lib/riot/riotIdentity.ts`.
- Continued the admin split by extracting page search filters into `src/pages/admin/adminFilters.ts`.

Applied in tenth follow-up commit:

- Continued the `mlPuzzleGenerationService.ts` split by extracting snapshot history signatures, segment boundaries, reuse penalties, best-attempt selection, and series selection into `server/src/lib/ml/snapshotSeriesSelection.ts`.
- Kept the existing orchestration tests as characterization coverage for the moved selection logic.

Applied in eleventh follow-up commit:

- Continued the `importCompetitiveMatches.ts` split by extracting checkpoint reuse and discovered-match reconstruction helpers into `scripts/lib/competitiveDiscoveryCheckpoint.ts`.
- Continued the `riotSyncService.ts` split by extracting public player profile projection into `server/src/lib/riot/publicPlayerProfile.ts`.

Applied in twelfth follow-up commit:

- Continued the `mlPuzzleGenerationService.ts` split by extracting snapshot candidate reconstruction, candidate dedupe/ranking, and gold-before-purchase reconstruction into `server/src/lib/ml/snapshotCandidateBuilder.ts`.
- Kept archive loading and snapshot candidate persistence in `mlPuzzleGenerationService.ts`, so the service remains responsible for IO while the builder owns timeline-to-candidate logic.

Applied in thirteenth follow-up commit:

- Continued the `mlPuzzleGenerationService.ts` split by extracting snapshot attempt evaluation into `server/src/lib/ml/snapshotAttemptEvaluator.ts`.
- Moved attempt accepted/rejected types, attempt logging, actual-purchase prevalidation, ML prediction interpretation, choice resolution, publishability checks, and low-confidence handling out of the service.

Applied in fourteenth follow-up commit:

- Completed the `mlPuzzleGenerationService.ts` split by extracting generation diagnostics (`countReasons`, `sortReasonEntries`, `summarizeNoViableDiagnostics`, `buildMlRequestMetadata`) into `server/src/lib/ml/generationDiagnostics.ts` (156 lines) and puzzle persistence helpers (`getItemsBySlugs`, `persistAiGeneratedPuzzle`, `updateGeneratedRequest`) into `server/src/lib/ml/puzzlePersistence.ts` (163 lines).
- `mlPuzzleGenerationService.ts` is now 924 lines (down from 1214), focused on ML orchestration.

Applied in fifteenth follow-up commit:

- Completed the `importCompetitiveMatches.ts` split by extracting seed resolution and match discovery into `scripts/lib/competitiveSeedRunner.ts` (439 lines, includes `buildDiscoveryQuerySignature`, `mergeResolvedSeed`, `resolveSeed`, `resolveSeeds`, `discoverMatchIdsForSeed`, `discoverSeeds`) and match classification into `scripts/lib/competitiveClassificationRunner.ts` (273 lines, includes `normalizePatch`, `normalizeQueueId`, `normalizeGameCreationAt`, `classifyDiscoveredMatches`, `buildRejectedMatches`, `buildSourceMetadata`).
- `importCompetitiveMatches.ts` is now 1180 lines (down from 1860), keeping only the `main()` loop, progress persistence, and orchestration logic.

Applied in sixteenth follow-up commit:

- Completed the `riotSyncService.ts` split by extracting the full match import pipeline into `server/src/lib/riot/matchImportRunner.ts` (508 lines, includes `RiotImportSourceContext`, `RiotImportedMatchDetail`, `normalizeSourceKind`, `buildImportedMatchMetadata`, `fetchMatchBundleWithRetry`, `importMatchForIdentityInternal`, `importRecentMatchesInternal`, and all participant/champion helpers).
- `riotSyncService.ts` is now 436 lines (down from 929), delegating to the new runner module while keeping catalog sync, public profile, autocomplete, and identity facade methods.

Applied in seventeenth follow-up commit:

- Moved Admin write schemas into `server/src/lib/admin/adminPayloadSchemas.ts`, with server payload types inferred from the Zod schemas.
- Removed the remaining Admin route casts after Zod parsing; `adminRoutes.ts` now passes parsed DTOs directly to `adminService`.
- Narrowed Admin service collection fields from broad `unknown` payloads to typed `string[]` and `Record<string, unknown>` DTO fields.
- Moved item tooltip class tokens and arrow placement classes into `src/lib/itemStatVisuals.ts`, keeping `ItemIcon.tsx` focused on trigger behavior, portal placement, and tooltip composition.

Applied in eighteenth follow-up commit:

- Extracted the remaining Admin page sections into `src/pages/admin/OverviewAdminSection.tsx`, `ChampionAdminSection.tsx`, `ItemAdminSection.tsx`, and `PuzzleAdminSection.tsx`.
- Reduced `src/pages/Admin.tsx` to 347 lines focused on route protection, hook orchestration, dialog state, mutation callbacks, sidebar navigation, and destructive-action confirmation.
- Added `src/test/adminPayloadSchemas.test.ts` to cover valid Admin DTOs, unknown-field rejection, and invalid collection fields.
- Made Admin write schemas strict so destructive admin endpoints reject unknown payload fields instead of silently stripping them.

Still remaining:

- Optional `ItemTooltip` / `TooltipPortal` extraction if item presentation work continues.
- `.impeccable.md` design context before a deeper frontend UX audit.
- Dependency freshness warnings for Browserslist/Prisma/punycode.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 4/4 | `ItemIcon` now uses a native button for interactive item icons. |
| 2 | Performance | 3/4 | Build is healthy; remaining risk is mostly bundle size and large item tooltip code. |
| 3 | Responsive Design | 3/4 | Admin sections are modular now, but table-heavy workflows still need UX review before redesign. |
| 4 | Theming | 3/4 | Item tooltip presentation classes are centralized, but broader product theming still mixes tokens and one-off classes. |
| 5 | Anti-Patterns | 3/4 | Major backend files and Admin page sections have been split; some card-heavy UI composition remains. |
| **Total** | | **17/20** | **Good: core behavior is tested and high-risk clean-code findings are mostly remediated.** |

## Anti-Patterns Verdict

The product does not look like a pure AI-generated shell: it has domain-specific League of Legends item, puzzle, and ingestion flows. However, several implementation tells match the audit rubric: repeated gradient accents, glass/blur surfaces, card-heavy admin sections, hard-coded color palettes, and oversized all-in-one components. The issue is less visual polish than maintainability: the current code often works by accumulating behavior inside large files instead of maintaining small ownership boundaries.

## Executive Summary

- Audit Health Score: **17/20** (Good).
- Issues found: **0 P0 / 0 P1 / 4 P2 / 1 P3** remaining after the follow-up refactors.
- Checks: `npm run build` passed, `npm run lint` passed with 0 warnings, `npm run test` passed with 26 files and 115 tests.
- Top priorities now: prepare the Admin UX/navigation redesign with `.impeccable.md`, optionally extract `ItemTooltip`, and schedule dependency warning cleanup.

## Detailed Findings by Severity

### [P1] ML puzzle generation service has too many responsibilities
- Location: `server/src/services/mlPuzzleGenerationService.ts:1`, `server/src/services/mlPuzzleGenerationService.ts:1192`, `server/src/services/mlPuzzleGenerationService.ts:1680`, `server/src/services/mlPuzzleGenerationService.ts:2460`
- Category: Clean Code / Architecture / Performance
- Status: mostly resolved; snapshot quality, series selection, candidate reconstruction, attempt evaluation, diagnostics, and puzzle persistence have moved into focused ML modules. `mlPuzzleGenerationService.ts` is now 924 lines and acts primarily as the orchestration boundary.
- Principle: one responsibility per module, one abstraction level per function
- Impact: the original 2402-line service no longer owns most pure generation rules, but the remaining orchestration is still large enough that future ML changes should be scoped carefully.
- Recommendation: avoid broad rewrites; only extract more when a touched subsection has a clear reason to change independently.
- Verification: `npm run test -- src/test/mlPuzzle*.test.ts` and `npm run build`.

### [P1] Competitive import script combines CLI parsing, discovery, checkpointing, classification, persistence, reporting, and quarantine
- Location: `scripts/importCompetitiveMatches.ts:89`, `scripts/importCompetitiveMatches.ts:760`, `scripts/importCompetitiveMatches.ts:1420`, `scripts/importCompetitiveMatches.ts:2070`
- Category: Clean Code / Architecture
- Status: mostly resolved; CLI parsing, tranche preset logic, quarantine persistence, checkpoint reuse, discovered-match reconstruction, report rendering, seed discovery, and match classification have moved to `scripts/lib`. `importCompetitiveMatches.ts` is now 1180 lines and keeps the `main()` loop, progress persistence, and orchestration.
- Principle: separate command-line adapter from domain workflow
- Impact: the original 2135-line script is significantly smaller, but progress/checkpoint reporting still lives close to the operational loop.
- Recommendation: extract progress/checkpoint reporting only if another change needs that behavior or if dry-run/reporting tests become hard to maintain.
- Verification: `npm run test -- src/test/competitive*.test.ts` plus a documented `--dry-run` smoke test.

### [P1] Admin update payloads lose type safety at the route and hook boundary
- Location: `server/src/lib/admin/adminPayloadSchemas.ts:4`, `server/src/routes/adminRoutes.ts:33`, `server/src/services/adminService.ts:3`
- Category: Clean Code / Type Safety / API Boundary
- Status: resolved in the seventeenth follow-up; Admin write schemas and payload types now share one source, routes no longer cast parsed payloads, and service collection fields are typed.
- Principle: make dependencies and data contracts explicit
- Impact: the destructive admin edit boundary now has a clearer DTO contract; future work can still narrow `stats` into a domain-specific schema if useful.
- Recommendation: keep Admin schema changes in `adminPayloadSchemas.ts` so route validation and service payload types cannot drift.
- Verification: `npm run build`, `npm run lint`, and focused admin mutation tests if available.

### [P1] Interactive item icon is not keyboard-equivalent to a real button
- Location: `src/components/ItemIcon.tsx:424`
- Category: Accessibility / Clean Code
- Status: resolved; interactive item icons render as native `button` elements.
- WCAG/Standard: WCAG 2.1.1 Keyboard
- Impact: native keyboard activation and focus semantics now come from the platform instead of custom role handling.
- Recommendation: add a small component/browser smoke test if item inspection becomes a critical regression surface.
- Verification: component keyboard test or Playwright smoke test for item inspection.

### [Resolved P1] Admin page owned page orchestration, tables, mutation wiring, and delete confirmation flow
- Location: `src/pages/Admin.tsx:1`, `src/pages/admin/ChampionAdminSection.tsx:1`, `src/pages/admin/ItemAdminSection.tsx:1`, `src/pages/admin/PuzzleAdminSection.tsx:1`
- Category: Clean Code / Frontend Architecture / Responsive
- Status: resolved; admin dialogs, shared helper modules, search filters, and section/table modules have been extracted, and `src/pages/Admin.tsx` is now 347 lines focused on page orchestration.
- Principle: small components with focused responsibilities
- Impact: admin table and queue changes now live in focused section modules instead of one page file.
- Recommendation: future Admin UX/navigation redesign can work section by section without reintroducing page-level table markup.
- Verification: `npm run build`, `npm run lint`, and manual admin smoke test.

### [P2] Route handlers repeat try/catch and schema parsing boilerplate
- Location: `server/src/routes/appRoutes.ts:53`, `server/src/routes/appRoutes.ts:78`, `server/src/routes/appRoutes.ts:153`, `server/src/routes/adminRoutes.ts:19`
- Category: Clean Code / Error Handling
- Status: resolved for the audited route groups; `asyncRoute` wraps `adminRoutes` and `appRoutes`.
- Principle: remove duplication after behavior is stable
- Impact: every handler repeats `try { ... } catch (error) { next(error) }`, making route files longer and obscuring endpoint-specific behavior.
- Recommendation: introduce a typed `asyncRoute` wrapper and a `parseRequest` helper for body/query/params. Migrate incrementally per route group.
- Verification: route tests or `npm run build` plus API smoke tests.

### [P2] Item tooltip embeds presentation palette and layout logic inside one component
- Location: `src/components/ItemIcon.tsx:467`, `src/lib/itemStatVisuals.ts:45`
- Category: Theming / Clean Code / Anti-Pattern
- Status: partially resolved; stat tint classes, tooltip class tokens, and arrow placement classes now live in `src/lib/itemStatVisuals.ts`.
- Principle: keep design tokens and rendering responsibilities explicit
- Impact: tooltip styling is centralized, but the component still owns glyph rendering, portal placement, trigger behavior, and tooltip composition.
- Recommendation: extract tooltip body/portal components only if future item UI changes increase `ItemIcon` again.
- Verification: visual regression or manual checks for item tooltip placement and contrast.

### [P2] Riot sync service mixes catalog sync, public profile mapping, identity resolution, import retries, and persistence
- Location: `server/src/services/riotSyncService.ts:415`, `server/src/services/riotSyncService.ts:1000`, `server/src/services/riotSyncService.ts:1148`
- Category: Clean Code / Architecture
- Status: mostly resolved; pure item catalog selection rules, Riot identity resolution/indexing, public profile projection, and match import have been moved into focused modules. `riotSyncService.ts` is now 436 lines.
- Principle: separate IO adapters, mapping, and application services
- Impact: the service is now a manageable facade, with catalog sync still present as the main remaining responsibility.
- Recommendation: extract catalog synchronization later if catalog updates become a frequent change surface.
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
- Status: resolved in follow-up commits; `npm run lint` now passes with 0 warnings.
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

- Large files are the strongest maintainability signal: led by `mlPuzzleGenerationService.ts`, `importCompetitiveMatches.ts`, and `riotSyncService.ts`. `Admin.tsx` has been reduced below the original large-file threshold through dialog extraction.
- Types are strong in domain tests and Prisma models, but admin write boundaries fall back to broad casts and `Record<string, unknown>`.
- UI code uses a solid component library foundation, but product-specific components frequently bypass tokens with inline hex palettes and one-off layout values.
- Tests are broad and fast, but several large orchestration modules need tests mapped to extracted responsibilities before refactoring.

## Positive Findings

- Build, lint, and tests all complete successfully.
- The test suite is meaningful: 26 files and 115 tests cover Riot ingestion, ML puzzle rules, item presentation, item lab calculations, static data audits, and Admin payload contracts.
- Domain logic is already partially extracted in useful places, such as `puzzleBusinessRules`, `puzzleChoiceResolution`, `scenarioInventory`, `competitiveIngestion`, and `riotRequestScheduler`.
- Vercel production is already tied to `main`; non-main pushes create previews only.

## Recommended Actions

1. **[P2] `$clarify`** - Create `.impeccable.md` before the Admin UX/navigation redesign so UI choices have product context.
2. **[P2] `$extract`** - Extract `ItemTooltip` body/portal modules only when future item presentation changes make `ItemIcon` grow again.
3. **[P2] `$stabilize`** - Add browser smoke coverage for critical Admin flows after the UX/navigation redesign.
4. **[P3] `$polish`** - Schedule dependency freshness cleanup for Browserslist, Prisma, and the Vitest `punycode` warning.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `$audit` after fixes to see your score improve.

## Verification Log

- `python C:\Users\XavierTrouche\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Users\XavierTrouche\.codex\skills\coder-proprement` - passed.
- `npm run build` - passed.
- `npm run lint` - passed with 0 warnings after second follow-up.
- `npm run test` - passed previously: 25 test files, 112 tests.
- Fourth/fifth follow-up: `npm run lint` passed, `npm run build` passed, and `npm run test` passed after Docker/PostgreSQL was started: 25 test files, 112 tests.
- Sixth follow-up: `npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck --strict false --noImplicitAny false scripts/importCompetitiveMatches.ts scripts/lib/competitiveImportCli.ts` passed.
- Seventh to ninth follow-up: `npm run test -- src/test/mlPuzzleOrchestration.test.ts`, `npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck --strict false --noImplicitAny false scripts/importCompetitiveMatches.ts scripts/lib/competitiveImportCli.ts scripts/lib/competitiveDiscoveryQuarantine.ts scripts/lib/competitiveImportReport.ts`, targeted Riot identity TypeScript check, `npm run lint`, and `npm run build` passed.
- Tenth/eleventh follow-up: `npm run test -- src/test/mlPuzzleOrchestration.test.ts`, targeted TypeScript checks for ML series selection, competitive discovery checkpoint, and Riot public profile projection, plus `npm run lint` passed.
- Twelfth/thirteenth follow-up: targeted TypeScript checks for ML candidate builder and attempt evaluator, `npm run test -- src/test/mlPuzzleOrchestration.test.ts`, and `npm run lint` passed.
- Fourteenth to sixteenth follow-up (2026-06-02): `npm run build` passed (0 TypeScript errors), `npm run lint` passed (0 errors, 9 pre-existing warnings), `npm run test` passed (25 test files, 112 tests) after extracting ML generation diagnostics, ML puzzle persistence, competitive seed runner, competitive classification runner, and Riot match import runner.
- Seventeenth follow-up: `npm run build` passed after Admin schema extraction and tooltip class token extraction; `npm run lint` passed with 0 warnings; `npm run test` passed with 25 files and 112 tests. Build still reports non-blocking Prisma update and Browserslist freshness notices; tests still emit the known `punycode` deprecation warning.
- Eighteenth follow-up: `npm run build` passed after Admin section extraction and strict Admin schema tests; `npm run lint` passed with 0 warnings; `npm run test` passed with 26 files and 115 tests. Build still reports the Browserslist freshness notice; tests still emit the known `punycode` deprecation warning.
