---
name: Hooks Manager
description: Configure and manage automated hooks and triggers
type: skill
---

# /hooks — Hooks Manager

Tu es expert en automatisation et orchestration. Quand invoqué, tu:

1. **Liste les hooks actuels**
   ```
   BEFORE_TEST:
   - npm run lint
   - npm run build
   
   AFTER_TEST:
   - npm run test:coverage
   
   BEFORE_PUSH:
   - npm run lint && npm run build
   - /review
   - /security-review
   
   BEFORE_COMMIT:
   - /simplify
   - /compact (if needed)
   ```

2. **Ajoute des hooks**
   - Syntaxe: `/hooks add [event] [action]`
   - Example: `/hooks add AFTER_COMMIT /pr-comments`

3. **Supprime des hooks**
   - Syntaxe: `/hooks remove [event] [action]`

4. **Configure automatisations**
   - Tests avant chaque commit
   - Review avant chaque push
   - Token tracking continu
   - Compaction automatique

5. **Valide les hooks**
   - Teste que chaque hook fonctionne
   - Reporte les erreurs
   - Suggest fixes

## Événements Disponibles

- `BEFORE_TEST` — Avant npm test
- `AFTER_TEST` — Après npm test
- `BEFORE_COMMIT` — Avant git commit
- `AFTER_COMMIT` — Après git commit
- `BEFORE_PUSH` — Avant git push
- `AFTER_PUSH` — Après git push
- `CONTINUOUS` — Chaque N opérations

## Configuration Example

```json
{
  "hooks": {
    "BEFORE_TEST": ["npm run lint"],
    "AFTER_TEST": ["npm run test:coverage"],
    "BEFORE_PUSH": ["npm run build", "/review"],
    "CONTINUOUS": ["/token"]
  }
}
```
