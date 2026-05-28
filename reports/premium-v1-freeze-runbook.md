# Premium V1 Freeze Runbook

## Statut

- Etat cible: `premium v1`
- Objectif: figer temporairement la base actuelle pour evaluation ML
- Regle: ne rien supprimer, ne pas relancer l'ingestion competitive pendant l'audit

## A faire

1. Ne pas lancer `npm run riot:import-competitive`
2. Produire ou rafraichir les rapports:
   - `npm run riot:report-competitive`
   - `npm run ml:export-raw`
   - `ml\.venv\Scripts\python.exe ml\scripts\tasks.py build-dataset`
   - `npm run audit:premium-v1-dataset`
3. Evaluer le dataset premium v1 avant tout nouvel entrainement

## Definition du baseline

- Les matchs existants restent en base
- Les vues trainables ML utilisent la policy patch recente courante
- Les timelines legacy peuvent etre archivees plus tard, mais pas supprimees

## Sortie attendue

- `reports/premium-v1-dataset-audit.json`
- `reports/premium-v1-dataset-audit.md`
