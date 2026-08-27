# ⚙️ Claude Codex Environment — Complete Setup

**Status** : ✅ Fully Operational  
**Setup Date** : 2026-06-06  
**Environment** : Local + SonarQube self-hosted

---

## 📦 What's Installed

### Configuration Files
- ✅ `CLAUDE.md` — Project instructions + workflow guide
- ✅ `.claude/settings.local.json` — Local permissions & MCP servers
- ✅ `MEMORY.md` — Memory index (auto-updated with learnings)
- ✅ `memory/*` — Detailed context files (user profile, strategy, feedback)

### MCP Servers (Active)
- ✅ **SonarQube** (http://localhost:9000) — Code quality analysis
- ✅ **GitKraken** — Git + GitHub PR workflows
- ✅ **Pylance** — Python type-checking + analysis

### Skills Available
- ✅ `/review` — Code review
- ✅ `/security-review` — Security audit
- ✅ `/simplify` — Code optimization
- ✅ `/loop` — Polling/recurring tasks
- ✅ `/update-config` — Settings management
- ✅ Agents: `.agents:testing-patterns`, `.agents:typescript-advanced-types`, `.agents:react-modernization`, etc.

---

## 🚀 Quick Start

### 1. Check Current Status
```bash
# See SonarQube metrics
/review
```

### 2. Plan Tests for a File
```bash
Agent({
  description: "Design table-driven tests",
  subagent_type: "testing-patterns",
  prompt: "I need to test snapshotAttemptEvaluator.ts with edge cases..."
})
```

### 3. Write & Validate Locally
```bash
npm run lint && npm run build && npm run test:coverage
```

### 4. Commit & Push
```bash
git add src/test/*.test.ts
git commit -m "test(module): raise coverage from X% to Y%"
git push origin optimization/sonarqube-audit
```

### 5. Monitor SonarQube
```bash
/loop 5m /review  # Poll SonarQube every 5 minutes
```

---

## 📊 Key Metrics (Current)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Coverage | 39.4% | 80%+ | 🔴 In Progress |
| Quality Gate | FAIL | PASS | 🔴 Blocker |
| BLOCKER Issues | 3 | 0 | 🟡 Fix after 60% |
| CRITICAL Issues | 76 | <10 | 🔴 Low priority |
| Tests | 146 passing | +100 | 🟡 Adding tests |

---

## 🎯 Workflow (Lot 1 Example)

**Target** : `server/src/lib/ml/snapshotAttemptEvaluator.ts` → 85% coverage

### Step 1: Audit Current State
```
Use SonarQube to see:
- Current coverage: ~12%
- What's tested: constructor, basic methods
- What's missing: edge cases, error handling
```

### Step 2: Design Tests
```
With Agent (.agents:testing-patterns):
- Table-driven test structure
- Edge cases: null snapshots, invalid ranges, boundary values
- Expected: ~30-40 test cases
```

### Step 3: Implement Tests
```typescript
// src/test/snapshotAttemptEvaluator.test.ts
describe('snapshotAttemptEvaluator', () => {
  const cases = [
    { snapshot: null, expected: false },
    { snapshot: { valid: true }, expected: true },
    // ... 30+ more cases
  ];
  
  cases.forEach(({ snapshot, expected }) => {
    it(`should handle ${JSON.stringify(snapshot)}`, () => {
      expect(evaluateAttempt(snapshot)).toBe(expected);
    });
  });
});
```

### Step 4: Validate Locally
```bash
npm run test:coverage
# Expect: snapshotAttemptEvaluator.ts → 85%
```

### Step 5: Push & Monitor
```bash
git add src/test/snapshotAttemptEvaluator.test.ts
git commit -m "test(snapshotAttemptEvaluator): raise coverage to 85%"
git push origin optimization/sonarqube-audit

# Monitor SonarQube (GitHub Actions will trigger scanner)
/loop 2m /review  # Check every 2 minutes until green
```

### Step 6: Move to Next File
```
Repeat for other Lot 1 files until Lot 1 complete (70-90% each)
Then move to Lot 2
```

---

## 🛠️ Troubleshooting

### "Quality Gate Still Red"
→ Check **new code %** in SonarQube (not overall %)  
→ Ensure 80%+ coverage on new lines only  
→ Add more test cases for uncovered branches

### "Coverage Not Updating"
→ GitHub Actions may still be running  
→ Check workflow status: https://github.com/[repo]/actions  
→ SonarQube scanner takes 1-2 minutes after push

### "Permissions Denied"
→ Use `/update-config` to add new permissions  
→ Or approve when prompted in dialog

### "Tests Failing Locally"
```bash
npm run lint    # Fix syntax first
npm run build   # Ensure TypeScript compiles
npm run test    # Run tests with verbose output
```

---

## 📚 Reference Docs

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Full project context + workflow |
| `MEMORY.md` | Index of all learned context |
| `memory/project_coverage_strategy.md` | Lot-by-lot breakdown |
| `memory/project_sonarqube_status.md` | Current metrics & issues |
| `memory/feedback_testing.md` | Testing best practices |
| `memory/reference_skills.md` | All available tools & agents |

---

## 🔐 Security

- ✅ SonarQube token stored in `.claude/settings.json` (not in code)
- ✅ Git token managed by GitKraken MCP
- ✅ All permissions are explicit and revocable
- ✅ No credentials in commit messages or test files

---

## ✨ Next Steps

1. **Review this setup** → Ensure everything makes sense
2. **Start Lot 1** → Pick first file (snapshotAttemptEvaluator.ts)
3. **Run `/review`** → Check SonarQube status
4. **Plan tests** → Use Agent + testing-patterns skill
5. **Code & commit** → Follow Lot 1 workflow above
6. **Monitor progress** → Track coverage % each commit

---

**Ready to begin?**
