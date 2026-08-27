---
name: Available Skills & Agents
description: Complete list of Claude skills, agents, and prompts configured
type: reference
---

## Core Skills (Invoke with `/skillname`)

| Skill | Purpose | Use When |
|-------|---------|----------|
| `/update-config` | Manage settings.json, hooks, permissions | Need to configure tools or automation |
| `/simplify` | Code review + optimization | After writing tests, before commit |
| `/review` | Full code review (calls agents) | Need comprehensive review |
| `/security-review` | Security audit | Before pushing security-critical code |
| `/loop` | Polling/recurring tasks | Need to check status every N seconds |
| `/keybindings-help` | Customize keyboard shortcuts | VS Code integration |
| `/less-permission-prompts` | Auto-allowlist read commands | Reduce permission pop-ups |

## Agent Types (Use via `Agent` tool)

**Specialized Agents** (.agents:*)
- `.agents:typescript-advanced-types` — Complex generic types, decorators
- `.agents:react-modernization` — React patterns, hooks, state mgmt
- `.agents:python-testing-patterns` — Pytest, fixtures, mocking
- `.agents:testing-patterns` — General test strategy design
- `.agents:code-review-excellence` — Deep code review + feedback
- `.agents:python-ml-data-pipeline` — ML pipeline design
- `.agents:python-ml-bootstrap` — ML setup from scratch

**Exploration Agents** (use for broad searches)
- `Agent(subagent_type="Explore")` — Fast codebase search by file pattern/keyword

**General-Purpose** (default)
- `Agent()` — General research, multi-step tasks, complex queries

## Prompt Templates (stored in skills)

| Prompt | Purpose |
|--------|---------|
| `prompts:get-search-view-results` | Extract search results from IDE |
| `prompts:troubleshoot` | Diagnostic framework for issues |
| `prompts:project-setup-info-local` | Gather local project config |

## How to Invoke

**Skills** (with `/`)
```
/review          # Start code review
/simplify        # Auto-optimize code
/loop 5m /review # Poll review every 5 minutes
```

**Agents** (with Agent tool)
```typescript
Agent({
  description: "Design table-driven test structure",
  subagent_type: "testing-patterns",
  prompt: "We need to test calculateScore(hp, armor) with edge cases..."
})
```

**MCP Tools** (direct access)
```typescript
mcp__sonarqube__search_sonar_issues_in_projects(...)
mcp__gitkraken__git_status(directory: ".")
mcp__pylance_mcp_server__pylanceRunCodeSnippet(...)
```

## Recommended Workflow

1. **Plan tests** → Use `.agents:testing-patterns` 
2. **Write code** → Use `/simplify` before commit
3. **Review** → Use `/review` or `/security-review`
4. **Monitor** → Use `/loop` to poll SonarQube status
5. **Refactor** → Use `.agents:typescript-advanced-types` or `.agents:react-modernization`

## Skill Permissions

All skills above are **auto-enabled** in `.claude/settings.local.json`  
Additional bash/git commands require approval (shown in permission dialog)
