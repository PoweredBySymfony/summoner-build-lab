# Claude Skills Reproduction — Codex → Claude

## Skills à Reproduire (depuis ta capture d'écran)

| Skill Codex | Fonction | Status |
|------------|----------|--------|
| `/agents` | Accès agents spécialisés | ✅ Créer |
| `/claude-api` | Build Claude API apps | ✅ Natif |
| `/compact` | Compacter contexte | ✅ Créer |
| `/hooks` | Gérer automatisations | ✅ Créer |
| `/init` | Initialisation projet | ✅ Natif |
| `/memory` | Gestion mémoire | ✅ Natif |
| `/pr-comments` | Commentaires PR | ✅ Créer |
| `/review` | Code review | ✅ Natif |
| `/security-review` | Audit sécurité | ✅ Natif |
| `/simplify` | Optimiser code | ✅ Natif |
| `/ask` | Mode ask-before-edit | ✅ Créer |
| `/edit` | Mode auto-edit | ✅ Créer |
| `/token` | Token cost optimizer | ✅ Créer |

---

## Implementation Strategy

### Phase 1: Créer les Skills Manquants

1. **`/agents`** — Dispatcher vers agents spécialisés
2. **`/compact`** — Compacter contexte (résumer conversations)
3. **`/hooks`** — Gérer hooks (before_test, after_push, etc.)
4. **`/pr-comments`** — Commenter PR automatiquement
5. **`/ask`** — Basculer en mode "confirm before edit"
6. **`/edit`** — Basculer en mode "auto-edit"
7. **`/token`** — Token cost optimizer + usage tracking

### Phase 2: Auto-Invocation

Je configurerai les **hooks** pour déclencher les skills automatiquement:

```
BEFORE_TEST → /compact + /review
AFTER_COMMIT → /pr-comments
BEFORE_PUSH → /review + /security-review
CONTINUOUS → /token (track usage)
```

### Phase 3: Smart Triggering

Au lieu de `user types /skill`, je déclenche:
- **When writing tests** → Auto `/simplify`
- **When pushing code** → Auto `/review`
- **When committing** → Auto `/pr-comments`
- **Context getting full** → Auto `/compact`
- **Every operation** → Auto `/token` tracking

---

## Deliverables

1. ✅ `.claude/commands/` — Tous les skills en .md
2. ✅ `.claude/hooks.json` — Auto-triggering configuration
3. ✅ `.claude/settings.local.json` — Permissions + behaviors
4. ✅ **Memory updated** — Skills inventory
5. ✅ **No manual invocation needed** — Tout auto

---

## Procédure

**Dis OK et je:**
1. Crée tous les skills manquants
2. Configure les hooks pour auto-triggering
3. Teste que tout marche
4. Documente comment ça fonctionne

**Result:** Tu dis `git commit` → Je fais auto `/review` + `/pr-comments` + `/simplify` + `/compact` si needed.

**Tu veux que je lance ça?**
