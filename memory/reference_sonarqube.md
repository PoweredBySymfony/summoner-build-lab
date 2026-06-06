---
name: SonarQube Self-Hosted Setup
description: Configuration, access, and integration details
type: reference
---

**Instance** : Self-hosted at http://localhost:9000  
**Auth Token** : `squ_5405dd802e5406a7d88916f192da70611c1c9684`  
**Project Key** : `PoweredBySymfony_summoner-build-lab`

**MCP Integration**
- Tool prefix: `mcp__sonarqube__*`
- Available functions:
  - `search_sonar_issues_in_projects` — Get issues by severity/status
  - `search_files_by_coverage` — Identify files needing tests
  - `get_project_quality_gate_status` — Check QG pass/fail
  - `get_component_measures` — Fetch metrics (coverage, complexity, etc.)
  - `show_security_hotspot` — Details on security issues
  - `change_sonar_issue_status` — Mark issues as reviewed/false positive

**Quality Gate Rules**
- Coverage ≥ 80% (new code priority)
- No BLOCKER issues (security, critical)
- Max 3 CRITICAL issues (code smells allowed)

**Workflow in Claude**
```python
# Check coverage status
mcp__sonarqube__get_project_quality_gate_status(
    projectKey="PoweredBySymfony_summoner-build-lab"
)

# Find low-coverage files
mcp__sonarqube__search_files_by_coverage(
    projectKey="PoweredBySymfony_summoner-build-lab",
    maxCoverage=50  # files < 50% coverage
)

# Get BLOCKER/CRITICAL issues
mcp__sonarqube__search_sonar_issues_in_projects(
    projects=["PoweredBySymfony_summoner-build-lab"],
    severities=["BLOCKER", "CRITICAL"]
)
```

**Status Page** : Open SonarQube UI at http://localhost:9000/dashboard
