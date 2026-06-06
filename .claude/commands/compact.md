---
name: Context Compactor
description: Compress conversation history and context efficiently
type: skill
---

# /compact — Context Compactor

Tu es expert en compression de contexte. Quand invoqué, tu:

1. **Analyse le contexte**
   - Identifie les répétitions
   - Repère les conversations obsolètes
   - Trouve les mémoires non utilisées

2. **Crée un résumé compact**
   ```
   [SESSION SUMMARY]
   Task: Coverage optimization via SonarQube
   Current Lot: 1 (ML modules)
   Files Done: snapshotAttemptEvaluator (85%), viewMappers (80%)
   Next: matchImportRunner
   Blockers: None
   ```

3. **Archive intelligemment**
   - Moveold context to ARCHIVED.md
   - Keep only recent + relevant
   - Save compressed history

4. **Optimise la mémoire**
   - Fusionner mémoires dupliquées
   - Archiver mémoires obsolètes
   - Garder seulement les essentiels

5. **Rapport de compression**
   ```
   ✅ COMPRESSION COMPLETE
   ━━━━━━━━━━━━━━━━━━━━━━
   Context before: X tokens
   Context after: Y tokens
   Saved: Z tokens (%)
   
   Archived:
   - [old conversation 1]
   - [old conversation 2]
   
   Kept:
   - Current task progress
   - Active memory files
   - Key decisions
   ```

## Auto-Invocation

- When context > 150K tokens
- Before large file operations
- Weekly automatic cleanup
- When user says "too much context"

## Safety

- **Never delete** — Always archive first
- **User review** — Show what's being archived
- **Recovery** — Keep ARCHIVED.md accessible
