---
name: Active MCP Servers
description: Integration points for tooling (SonarQube, GitKraken, Pylance)
type: reference
---

**SonarQube MCP Server**
- **URL** : http://localhost:9000
- **Auth** : Token `squ_5405dd802e5406a7d88916f192da70611c1c9684`
- **Purpose** : Code quality analysis, issue tracking, coverage metrics
- **Status** : ✅ Active
- **Tool Prefix** : `mcp__sonarqube__*`

**GitKraken MCP Server**
- **Purpose** : Git operations, GitHub PR workflows, issue tracking
- **Status** : ✅ Active
- **Tool Prefix** : `mcp__gitkraken__*`
- **Capabilities** :
  - `git_status`, `git_log`, `git_diff`, `git_add`, `git_commit`, `git_push`
  - `pull_request_create`, `pull_request_get_detail`, `pull_request_get_comments`
  - `issues_get_detail`, `issues_add_comment`

**Pylance MCP Server** (Python analysis)
- **Purpose** : Python type-checking, imports analysis, refactoring
- **Status** : ✅ Active (if configured)
- **Tool Prefix** : `mcp__pylance_mcp_server__*`
- **Capabilities** :
  - `pylanceDocString` — Get docstrings for Python symbols
  - `pylanceImports` — Analyze imports across workspace
  - `pylanceRunCodeSnippet` — Execute Python code in workspace
  - `pylanceSyntaxErrors` — Validate Python syntax

**IDE Integration** (VS Code)
- **Extension** : Anthropic.claude-code
- **Features** : Inline completions, diagnostics, refactoring suggestions

**Configuration File**
- **Global** : ~/.claude/settings.json
- **Local** : ./.claude/settings.local.json
- **CLAUDE.md** : Project-specific instructions (checked automatically)
