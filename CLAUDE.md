# CLAUDE.md — Configuration Codex pour Summoner Build Lab

## Contexte du Projet

**Projet** : summoner-build-lab (Full-Stack TypeScript + Python ML)  
**Objectif actuel** : Monter le code coverage de 31% → 80%+ via SonarQube  
**Branches principales** : `main` (production), `optimization/sonarqube-audit` (work in progress)  
**Stack** : TypeScript (React + Node.js), Python (ML pipeline), Prisma (DB)

---

## Processus Clés

### 1. **Audit SonarQube & Analyse Coverage**
- **Outil** : SonarQube self-hosted (http://localhost:9000)
- **Token** : `squ_5405dd802e5406a7d88916f192da70611c1c9684`
- **Processus** :
  - Récupérer issues/metrics via `mcp__sonarqube__*` tools
  - Identifier fichiers bas coverage (Lot 1→5)
  - Proposer tests avant implémentation
  - Vérifier après chaque push

### 2. **Test Coverage Stratégies par Lot**

**Lot 1 — Modules purs (ML, Riot)** → 70-90% target
```
- server/src/lib/ml/snapshotAttemptEvaluator.ts
- server/src/lib/ml/snapshotCandidateBuilder.ts
- server/src/lib/riot/matchImportRunner.ts
- server/src/lib/riot/competitiveSeeds.ts
- server/src/lib/riot/riotIdentity.ts
- server/src/lib/riot/publicPlayerProfile.ts
- server/src/services/viewMappers.ts
```
Tests : unitaires, table-driven, sans React/DB

**Lot 2 — Services backend** → mocks pour dépendances
```
- server/src/services/puzzleGenerationService.ts
- server/src/services/mlPuzzleGenerationService.ts
- server/src/services/itemExplanationService.ts
- server/src/services/progressService.ts
- server/src/services/adminService.ts
- server/src/services/authService.ts
- server/src/services/appService.ts
- server/src/services/riotSyncService.ts
```
Tests : service-level avec repositories mockés

**Lot 3 — Composants React** → workflow utilisateur
```
- src/components/RiotIdSearch.tsx
- src/components/ItemIcon.tsx
- src/components/lab/SetupColumn.tsx
- src/pages/Lab.tsx
- src/pages/PlayerProfile.tsx
- src/pages/Admin.tsx
- src/pages/admin/PatchDialog.tsx
- src/pages/Training.tsx
```
Tests : Testing Library, mocks API/hooks

**Lot 4 — API Hooks & Routes**
```
- src/api/hooks.ts
- server/src/routes/appRoutes.ts
- server/src/routes/adminRoutes.ts
- server/src/app.ts
```

**Lot 5 — Python ML**
```
- ml/features/*
- ml/inference/*
- ml/models/*
- ml/training/*
```

### 3. **Quality Gate SonarQube**
- **Objectif global** : 80%+ coverage
- **Critère New Code** : 80%+ sur chaque commit (prioritaire)
- **Issues BLOCKER** : 3 (sécurité Python + SQL migration)
- **Issues CRITICAL** : 76 (cognitive complexity, sort comparators)

---

## Permissions & Hooks Pré-Configurés

### Permissions Autorisées
```
✅ Bash: npm run *
✅ Bash: git add/commit (staging + commits)
✅ Bash: find/grep/ls (exploration)
✅ SonarQube: analyse complète
✅ GitHub: push/PR (avec confirmation)
```

### Hooks Automatisés
```
BEFORE_TEST: npm run lint (check syntax first)
AFTER_TEST: npm run test:coverage (verify coverage %)
BEFORE_PUSH: validation Quality Gate
```

---

## Skills Claude Opérationnels

### Core Skills (disponibles)
- `/review` — Code review avec SonarQube
- `/security-review` — Audit sécurité
- `/simplify` — Refactor détection + optimisation
- `/loop` — Polling continu pour status builds/tests
- `update-config` — Gérer settings.json/permissions

### Agent Spécialisés
- `.agents:typescript-advanced-types` — Types complexes
- `.agents:react-modernization` — React patterns
- `.agents:python-testing-patterns` — Tests Python
- `.agents:testing-patterns` — Stratégies test générales
- `.agents:code-review-excellence` — Reviews qualité

### MCP Servers Actifs
- `sonarqube` : Self-hosted (http://localhost:9000)
- `gitkraken` : Git + GitHub PR workflows
- `pylance` : Python analysis (type-checking, imports)

---

## Workflow Type: Monter Coverage d'un Fichier

1. **Audit SonarQube**
   ```bash
   # Je recherche : fichiers < 50% coverage dans Lot 1
   # SonarQube → identifie gaps → propose structure tests
   ```

2. **Planification Tests (Plan Mode)**
   ```
   - Quels cas limites/happy paths?
   - Mocks nécessaires?
   - Stratégie table-driven?
   - Viser 80%+ tout de suite
   ```

3. **Implémentation Tests**
   ```bash
   npm run test:coverage  # valider localement
   git add src/test/*.ts
   git commit -m "test(file): raise coverage to X%"
   ```

4. **Vérification Post-Push**
   ```
   - GitHub Actions run
   - SonarQube re-analyse
   - Quality Gate status
   - Tracker progression Lot X → Lot Y
   ```

---

## Commandes Rapides

```bash
# Tests & Coverage
npm run test:coverage              # Check coverage %
npm run test -- src/test/xxx.test.ts  # Single file

# Linting & Build
npm run lint                       # Fix issues
npm run build                      # Compile

# Git & Push
git add <files>
git commit -m "test(...): message"
git push origin optimization/sonarqube-audit

# Coverage Report (local)
open coverage/index.html           # View coverage report
```

---

## Notes Importantes

- **Quality Gate Sonar** : regarde surtout le **new code coverage** (80%+ par commit)
- **Pas de DB réelle** : jusqu'à Lot 4, utiliser mocks/stubs
- **Cognitive Complexity** : 76 issues CRITICAL — ne pas les régler maintenant, focus coverage
- **BLOCKER Security** : 3 issues — laisser pour après (après coverage atteint 60%+)

---

## Statut Actuel (2026-06-06)

| Métrique | Valeur |
|----------|--------|
| Coverage | 39.4% |
| Bugs | 0 |
| Vulnerabilités | 0 |
| Code Smells | 402 |
| Quality Gate | 🔴 ROUGE |
| Commits | 235ab96 (test coverage helpers) |
| Tests | 146 passing |

**Prochaine étape** : Lot 1 (purs modules) → 70-90%, puis Lot 2 (services).

---

## Contacts & Ressources

- **Codex Instance** : Anthropic Claude with Codex SDK integration
- **SonarQube** : http://localhost:9000 (local self-hosted)
- **GitHub Repo** : (privé, via gitkraken MCP)
- **Memory File** : `MEMORY.md` (auto-updated with lessons learned)
