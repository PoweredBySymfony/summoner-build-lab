# Summoner Build Lab ML

Brique ML Python locale pour construire une baseline `next item` exploitable a partir des matchs Riot importes.

## Objectif

- separer clairement la collecte Node/Prisma du pipeline ML Python
- produire un dataset analytique patch-aware et time-aware a partir des timelines Riot
- entrainer un modele learning-to-rank CPU-first pour predire le prochain item parmi un pool candidat
- exposer une API FastAPI simple, consommable plus tard par le backend Node

## Structure

```text
ml/
  artifacts/         # modeles, metadata et rapports d'evaluation
  configs/           # configuration centrale YAML
  data/
    raw/             # export brut depuis Prisma/Riot
    interim/         # reserve pour transformations intermediaires
    processed/       # dataset analytique et splits parquet
  features/          # construction du dataset analytique
  inference/         # config, schemas, service FastAPI et prep puzzle
  models/            # serialisation et feature builder
  scripts/           # bootstrap env et task runner
  training/          # entrainement baseline next-item
  tests/             # tests pipeline + inference
```

## Workflow V1

1. Importer des matchs Riot enrichis dans le backend Node, avec timeline.
2. Exporter les matchs importes vers `ml/data/raw`.
3. Construire le dataset analytique Python.
4. Entrainer le modele ranking `next item`.
5. Lancer l'API FastAPI pour l'inference locale.

## Commandes exactes

Depuis la racine du repo :

```powershell
npm run prisma:generate
npm run ml:export-raw
```

Depuis `ml/` :

```powershell
python scripts/create_venv.py
python scripts/install_deps.py
.\.venv\Scripts\python.exe scripts\tasks.py build-dataset
.\.venv\Scripts\python.exe scripts\tasks.py train-baseline
.\.venv\Scripts\python.exe scripts\tasks.py run-api
.\.venv\Scripts\python.exe scripts\tasks.py test
```

Commandes de verification :

```powershell
.\.venv\Scripts\python.exe scripts\tasks.py lint
.\.venv\Scripts\python.exe scripts\tasks.py typecheck
```

## API locale

- `GET /health`: etat du service, disponibilite du dataset et du modele
- `GET /version`: version du module ML
- `POST /predict-next-item`: prediction principale, top-k trie, score et version du modele
- le payload peut fournir `candidate_pool`, sinon le service reconstruit un pool candidat patch-aware cote Python

## Docker optionnel

Depuis la racine :

```powershell
docker compose --profile ml up --build ml-api
```

Le compose monte maintenant `ml/artifacts`, `ml/configs` et `ml/data` pour que le service voie les artefacts et datasets locaux.

## Ce qui est implemente

- enrichissement de l'import Riot avec timeline brute et metadata ML
- export brut Node -> `ml/data/raw`
- dataset analytique `1 ligne = 1 decision d'achat`
- splits train / validation / test temporels
- dataset ranking-ready `1 snapshot = N candidats`
- modele `XGBoost rank:ndcg`
- metriques `NDCG@k`, `MAP@k`, `top-k accuracy`
- rapport d'evaluation humain + metrics JSON
- service FastAPI de prediction
- fonction preparatoire de seed puzzle a partir des predictions du modele

## Limites actuelles

- la reconstruction de `gold_available` repose sur le dernier frame timeline disponible avant l'achat, donc reste une approximation
- les features d'equipe sont volontairement agregees et simples
- le candidate pool V1 reste gouverne par des regles simples de plausibilite, pas par une simulation complete de shop
- pas d'orchestration automatique entre import Node et pipeline Python
- pas encore d'integration directe dans le generateur de puzzles Node
