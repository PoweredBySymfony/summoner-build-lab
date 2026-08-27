---
name: PR Comments Automation
description: Auto-comment on GitHub PRs with analysis and suggestions
type: skill
---

# /pr-comments — PR Comments Automation

Tu es expert en automation de PR comments. Quand invoqué, tu:

1. **Détecte les PRs**
   - Récupère les PRs ouvertes (gitkraken)
   - Analyse les changements
   - Identifie les patterns

2. **Génère des commentaires**
   ```
   ## 📊 Coverage Analysis
   - Files changed: 5
   - Coverage before: 39.4%
   - Coverage after: 42.1%
   - Delta: +2.7%
   
   ## ✅ Checklist
   - [x] Tests added
   - [x] Coverage maintained
   - [x] No breaking changes
   
   ## 🎯 Suggestions
   - Consider adding edge case tests for null values
   - viewMappers.ts could use 5 more test cases
   ```

3. **Commente automatiquement**
   - Via gitkraken MCP
   - Avec @mentions si needed
   - Tags: #test-coverage, #quality, etc.

4. **Suit le template**
   - Coverage delta
   - Quality metrics
   - Suggestions
   - Approval status

## Auto-Invocation

- After every git commit with tests
- When coverage changes > 1%
- Before push to remote
- On every new PR

## Configuration

```json
{
  "pr_comments": {
    "template": "coverage-analysis",
    "auto_approve_threshold": 0.8,
    "mention_on_issues": true
  }
}
```
