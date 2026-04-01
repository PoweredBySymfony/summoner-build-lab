# Premium V1 Dataset Audit

- Generated at: 2026-04-01T17:42:25.429Z
- Baseline state: frozen-for-ml-audit
- Ingestion freeze: true
- Training policy verified: true

## Database
- Total imported matches: 610
- Total valid timelines: 610
- Premium recent matches (26.1-26.7): 504
- Premium recent share: 82.62

## Match Distribution By Patch
- 26.6: 411
- 26.5: 44
- 26.1: 42
- 15.23: 27
- 14.20: 19
- 15.24: 12
- 15.19: 8
- 15.4: 8
- 14.24: 5
- 15.7: 5
- 15.1: 4
- 15.18: 4
- 15.9: 4
- 14.15: 3
- 15.5: 3
- 26.3: 3
- 15.22: 2
- 26.7: 2
- 15.12: 1
- 15.20: 1
- 26.2: 1
- 26.4: 1

## Match Distribution By Source Tier
- unknown: 602
- pro: 8

## Dataset
- Total snapshots generated: 11958
- Snapshots trainable strict recents: 11958
- Candidate pool median: 23
- Candidate pool p95: 82
- Gold incoherent ratio: 0.39831075430674023
- Missing actual item ratio: 0

## Snapshots By Patch
- 26.6: 9810
- 26.1: 1020
- 26.5: 991
- 26.3: 62
- 26.7: 48
- 26.4: 22
- 26.2: 5

## Snapshots By Role
- ADC: 3000
- SUPPORT: 2513
- MID: 2441
- TOP: 2066
- JUNGLE: 1938

## Snapshots By Champion
- anivia: 540
- bard: 479
- ezreal: 464
- ambessa: 442
- ryze: 367
- yunara: 348
- jayce: 329
- renekton: 303
- ashe: 298
- jhin: 270
- karma: 241
- varus: 239
- aurora: 228
- mel: 213
- pantheon: 208
- jarvan-iv: 197
- kaisa: 192
- sylas: 188
- vi: 185
- caitlyn: 173

## Reproduction
- `npm run riot:report-competitive`
- `npm run ml:export-raw`
- `ml\.venv\Scripts\python.exe ml\scripts\tasks.py build-dataset`
- `npm run audit:premium-v1-dataset`
