---
name: SonarQube Audit Status
description: Current SonarQube metrics, issues distribution, Quality Gate state
type: project
---

**Last Update** : 2026-06-06 23:00 UTC

**Coverage Metrics**
| Metric | Value | Status |
|--------|-------|--------|
| Overall Coverage | 39.4% | 🟡 Needs work |
| Lines to Cover | 258 files | High scope |
| Bugs | 0 | ✅ Good |
| Vulnerabilities | 0 | ✅ Good |
| Quality Gate | 🔴 FAIL | Coverage too low |

**Issue Distribution**

| Severity | Type | Count | Action |
|----------|------|-------|--------|
| BLOCKER | Security (Path Traversal) | 2 | Fix after 60% coverage |
| BLOCKER | SQL (Quoted Identifiers) | 1 | Fix after 60% coverage |
| CRITICAL | Cognitive Complexity | 70+ | Refactor later (not blocking) |
| CRITICAL | Sort Comparators | 6 | Add localeCompare() |
| CRITICAL | Code Smells | 402 | Low priority |

**BLOCKER Issues** (must fix for final push):
1. `ml/tests/test_pipeline.py:102` — S2083 (path construction)
2. `ml/models/artifacts.py:25` — S2083 (path construction)
3. `prisma/migrations/.../migration.sql:16` — Quoted identifiers

**Highest-Impact CRITICAL Issues** (cognitive complexity):
- `scripts/importCompetitiveMatches.ts:1270` — Complexity: 84
- `ml/features/analytics.py:282` — Complexity: 105
- `server/src/services/mlPuzzleGenerationService.ts` — Multiple functions > 20

**Strategy** :
- Ignore complexity issues for now (refactoring separate effort)
- Focus 100% on test coverage (new code 80%+)
- After 60% coverage achieved, address BLOCKER security issues
- Ignore code smells (low priority)

**SonarQube Access**
- URL: http://localhost:9000
- Token: squ_5405dd802e5406a7d88916f192da70611c1c9684
- MCP Integration: `mcp__sonarqube__*` tools available
- Report Tool: `mcp__sonarqube__search_sonar_issues_in_projects`
