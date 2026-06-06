---
name: Git Workflow & Deployment
description: Small focused commits, PR validation, SonarQube Quality Gate checks
type: feedback
---

**Rule** : Each commit targets one Lot's coverage improvement; validate before push

**Why** :
- Small commits = easier reviews and easier to revert if needed
- Each commit should pass Quality Gate (80%+ new code coverage)
- GitHub Actions runs SonarQube analysis on every push
- Clear audit trail: which commit raised coverage by how much

**How to apply** :
1. Create tests for one file or one service
2. Ensure `npm run test:coverage` passes locally
3. Verify SonarQube Quality Gate status (check new code % specifically)
4. Commit with clear message: `test(module): raise coverage from X% to Y%`
5. Push to `optimization/sonarqube-audit` branch
6. Monitor GitHub Actions for SonarQube Scanner results

**Commit Message Format** :
```
test(snapshotAttemptEvaluator): raise coverage to 85%

- Added table-driven tests for score calculation
- Added edge cases: null snapshots, invalid ranges
- Coverage before: 12%, after: 85%
```

**Before each push** :
```bash
npm run lint    # Fix syntax issues
npm run build   # Compile successfully
npm run test:coverage  # Check coverage report
# Then: git add, git commit, git push
```

**After push** :
- GitHub Actions triggers SonarQube Scanner
- Monitor SonarQube dashboard (http://localhost:9000)
- If Quality Gate fails: analyse failure, add more tests, re-push

**No force-push to main** — always use normal commits to `optimization/sonarqube-audit`
