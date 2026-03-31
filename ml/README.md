# Summoner Build Lab ML

Cette brique Python prepare un espace ML local, isole et CPU-first pour le projet Summoner Build Lab.

## Objectif

- separer proprement le travail ML du backend Node/TypeScript/Prisma existant
- fournir un socle reproductible pour la preparation de donnees tabulaires, l'entrainement baseline et un futur serving modele
- livrer des stubs explicites plutot qu'une logique metier LoL prematuree

## Structure

```text
ml/
  artifacts/         # artefacts locaux de modeles et metadonnees
  configs/           # configuration centrale YAML
  data/
    raw/             # donnees brutes non versionnees
    interim/         # donnees intermediaires non versionnees
    processed/       # datasets preprocesses non versionnes
  features/          # preparation de datasets et transformations
  inference/         # API FastAPI et schemas d'inference
  models/            # helpers d'artefacts et metadata de modele
  scripts/           # bootstrap env et task runner
  training/          # entrainement baseline CPU-first
  tests/             # tests pytest
```

## Python cible

- version cible: `Python 3.13`
- raison: base stable pour `scikit-learn`, `xgboost` et `fastapi`, tout en restant distincte du runtime Node du projet

## Commandes principales

Depuis `ml/`:

```powershell
python scripts/create_venv.py
python scripts/install_deps.py
python scripts/tasks.py lint
python scripts/tasks.py typecheck
python scripts/tasks.py test
python scripts/tasks.py train-baseline
python scripts/tasks.py run-api
```

Sous Windows, les wrappers PowerShell restent disponibles:

```powershell
.\scripts\create_venv.ps1
.\scripts\install.ps1
```

## API locale

- `GET /health`: etat du service et disponibilite de l'artefact baseline
- `GET /version`: version du module ML et de la configuration chargee
- `POST /predict-next-item`: stub explicite, sans logique metier LoL lourde

## Docker optionnel

- image definie dans `ml/Dockerfile`
- service `ml-api` ajoute au `docker-compose.yml` racine sous le profil `ml`
- activation explicite:

```powershell
docker compose --profile ml up --build ml-api
```

## Ce qui n'est pas implemente

- aucune logique metier de recommandation League of Legends
- aucun pipeline de collecte de donnees live
- aucun entrainement distribue ou GPU
- aucun registry de modeles distant
- aucune persistance de predictions

