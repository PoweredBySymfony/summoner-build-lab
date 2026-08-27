# ⚡ SKILLS INVOCABLES — Ce Que Tu Peux Faire avec /

**Important:** Ceci est la liste des skills que Claude Code peut invoquer. Tape `/` puis le nom pour les utiliser.

## 🎯 Skills Disponibles pour Toi

### Core Skills (Taper `/` + nom)

```
/review              → Code review (GitHub PR analysis)
/security-review     → Security audit
/simplify            → Code optimization  
/loop                → Polling/recurring tasks (ex: /loop 5m /review)
/update-config       → Settings.json management
/keybindings-help    → Customize keyboard shortcuts
/less-permission-prompts → Auto-allowlist commands
/claude-api          → Build Claude API apps
/init                → Project initialization
/coder-proprement    → Clean code audit (CUSTOM)
```

### Comment Utiliser

**Exemple 1: Review Code**
```
/review
```
(Puis réponds aux prompts)

**Exemple 2: Polling Loop**
```
/loop 5m /review
```
(Exécute /review tous les 5 minutes)

**Exemple 3: Optimize Code**
```
/simplify
```

---

## 🤖 Agents Disponibles (Taper avec Agent tool)

Tu ne peux pas les invoquer directement avec `/`, mais je peux les utiliser:

```
Agent({
  description: "Design tests",
  subagent_type: "testing-patterns",
  prompt: "..."
})
```

### Liste Complète (150+ agents)
- `.agents:testing-patterns`
- `.agents:react-modernization`
- `.agents:python-ml-data-pipeline`
- `.agents:typescript-advanced-types`
- `.agents:code-review-excellence`
- ... et 145+ autres

[Voir `memory/reference_all_skills.md` pour la liste complète]

---

## 📋 Prompts Templates

Je peux aussi utiliser des prompts pré-configurés:
- `prompts:agent-customization`
- `prompts:chronicle`
- `prompts:troubleshoot`
- `prompts:project-setup-info-local`
- `prompts:install-vscode-extension`

---

## 🔴 IMPORTANT: Ce Que TU DOIS FAIRE

**Toi (Xavier):** Dis-moi quels skills tu VOIS quand tu fais `/` dans TON interface Codex.

**Exemple format:**
```
Quand je fais /, je vois:
- /review
- /security-review
- /loop
- /token  ← CE SKILL-LÀ!
- ...
```

Ensuite je saurai exactement ce qui est disponible pour toi vs. moi.

---

## 📱 Différences Possible Codex vs Claude Code

| Feature | Codex | Claude Code (Moi) |
|---------|-------|-------------------|
| Auto-complétion `/` | ✅ Yes | ❓ Unknown |
| Invoquer agents | ✅ Directement | Via Agent tool |
| Custom skills | ✅ `/token` | Via .claude/commands |
| MCP Servers | ✅ Configured | ✅ Configured |

---

**Action Required:** Dis-moi quelle est la liste exacte de skills que tu vois avec `/` dans ton Codex.
