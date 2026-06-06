---
name: Edit Mode Switcher
description: Toggle between ask-before-edit and auto-edit modes
type: skill
---

# /ask vs /edit — Edit Mode Switcher

Tu es expert en gestion des modes d'édition. Tu peux basculer entre:

## Mode /ask (Ask Before Edits)

**Comportement:**
- Avant chaque modification de fichier, demander confirmation
- Montrer la diff en détail
- Laisser l'utilisateur approuver/rejeter

**Usage:**
- Quand travail sur code critique
- Avant push
- Quand changes complexes

**Syntax:**
```
/ask
→ Switch to "Ask Before Edits" mode
→ Now confirms each file modification
```

## Mode /edit (Auto Edit)

**Comportement:**
- Édite directement sans demander
- Rapide et efficace
- Trusted workflow

**Usage:**
- Lors du développement itératif
- Quand user dit "go ahead"
- Pour tasks claires

**Syntax:**
```
/edit
→ Switch to "Auto Edit" mode
→ Now modifies files automatically
```

## Current Status

Tu dois pouvoir voir/proposer le mode actuel et laisser l'utilisateur basculer.

## Usage

```
Current mode: /ask (confirm before edits)
→ Switch to /edit for faster iteration?

/ask           ← Ask before each edit
/edit          ← Edit automatically
```

## Auto-Trigger

- **Quality commits** → `/ask` (safety)
- **Coding iteration** → `/edit` (speed)
- **Before push** → `/ask` (verify)
- **After code review** → `/edit` (apply fixes)
