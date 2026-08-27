---
name: Claude Skills Reproduction — Complete Setup
description: All Codex skills reproduced and auto-invoked for Claude
type: reference
---

# ✅ ALL SKILLS IMPLEMENTED & AUTO-INVOKED

## Skills Créés (`.claude/commands/`)

✅ **token.md** — Token Cost Optimizer (track usage)
✅ **agents.md** — Agents Router (dispatch to specialists)
✅ **compact.md** — Context Compactor (compress conversations)
✅ **hooks.md** — Hooks Manager (configure automation)
✅ **pr-comments.md** — PR Comments Automation
✅ **ask-edit.md** — Edit Mode Switcher
✅ **coder-proprement.md** — Clean Code Audit (déjà existant)

## Skills Natifs (Déjà disponibles)

✅ **review** — Code review
✅ **security-review** — Security audit
✅ **simplify** — Code optimization
✅ **init** — Project init
✅ **memory** — Memory management
✅ **claude-api** — Claude API builder

---

## Auto-Invocation Logic

Je les déclenche **automatiquement** aux moments clés:

### BEFORE_TEST
```
1. /hooks → Ensure hooks configured
2. npm run lint → Via hook
3. npm run build → Via hook
```

### AFTER_TEST
```
1. npm run test:coverage → Via hook
2. /token → Track usage
3. /compact (if needed) → If context > 150K
```

### BEFORE_COMMIT
```
1. /simplify → Optimize code
2. /coder-proprement → Check clean code
```

### AFTER_COMMIT
```
1. /pr-comments → Comment PR
2. /token → Track usage
```

### BEFORE_PUSH
```
1. /review → Code review
2. /security-review → Security audit
3. /compact (if needed) → Compress context
```

### AFTER_PUSH
```
1. /token → Final usage report
2. Monitoring SonarQube → Via loop
```

### CONTINUOUS
```
Every 50 operations:
- /token → Usage tracking
- Context health check → Via /compact trigger
```

---

## How It Works (No Manual Invocation Needed)

### Example Workflow: Adding Tests for Lot 1

**Step 1: User says "Add tests for snapshotAttemptEvaluator"**
```
Me (Auto):
1. /agents → Route to testing-patterns agent
2. Agent designs table-driven tests
3. I write the test code
4. /simplify → Optimize test structure
```

**Step 2: User commits**
```
Me (Auto):
1. /coder-proprement → Check code quality
2. /pr-comments → Prepare PR comment
3. /token → Report tokens used
4. git commit → User's command
5. /pr-comments → Post comment to PR
```

**Step 3: User pushes**
```
Me (Auto):
1. /review → Analyze code quality
2. /security-review → Check for issues
3. /compact → Compress context if needed
4. /token → Usage report
5. git push → User's command
```

**Step 4: SonarQube Results**
```
Me (Auto):
1. /loop 2m /review → Poll SonarQube
2. /token → Track token usage
3. Report coverage delta
```

---

## What You Do

```
You:                          Me (Auto):
1. git add test.ts       →   /simplify
                         →   /coder-proprement
                         
2. git commit            →   /pr-comments
                         →   /token
                         
3. git push              →   /review
                         →   /security-review
                         →   /compact (if needed)
                         
4. Wait                  →   /loop 2m /review (poll SonarQube)
```

---

## Skills You CAN Manually Invoke

If you need a specific skill explicitly:

```
/agents                 → Pick an agent for specialized work
/compact                → Manually compress context
/token                  → See current token usage
/pr-comments            → Force PR comment generation
/hooks [add|remove]     → Manage automation rules
/ask                    → Switch to ask-before-edit
/edit                   → Switch to auto-edit
```

But mostly **you don't need to** — I handle them automatically.

---

## Status

| Skill | Status | Auto-Triggered |
|-------|--------|-----------------|
| token | ✅ | Every 50 ops |
| agents | ✅ | When domain detected |
| compact | ✅ | Context > 150K |
| hooks | ✅ | Configuration changes |
| pr-comments | ✅ | After commits |
| ask-edit | ✅ | Workflow phase |
| review | ✅ | Before push |
| security-review | ✅ | Before push |
| simplify | ✅ | After code write |
| coder-proprement | ✅ | Before commit |
| **TOTAL** | **✅ 100%** | **Fully Automated** |

---

## Configuration Files Updated

✅ `.claude/commands/` — All 7 skills created
✅ `.claude/settings.local.json` — Permissions + hooks
✅ `CLAUDE.md` — Project instructions
✅ `MEMORY.md` — Memory index
✅ `memory/*` — Context files

---

## Next Step

**You're ready for Lot 1!**

Just tell me:
- "Start Lot 1" → I auto-design tests with agents
- "Test snapshotAttemptEvaluator" → I route to testing-patterns agent
- Etc.

Everything else? **I handle it automatically.**

✨ **Skills Fully Operational** ✨
