# Premium V1 Dataset Audit

- Generated at: 2026-04-19T12:41:34.643Z
- Competitive report path: C:\Users\XavierTrouche\dev\summoner-build-lab\data\runtime\competitive-ingestion\phase-2000.report.json
- Baseline state: frozen-for-ml-audit
- Ingestion freeze: true
- Training policy verified: true

## Reporting Scopes
- DB-wide: Tous les ImportedMatch de la base, quelle que soit la provenance.
- Premium-only: Sous-ensemble premium exploitable: sourceKind competitif + sourceTier connu.
- Competitive report: Rapport pipeline competitif source-filtered, limite aux imports competitifs observes par le checkpoint/report.

## Scope Gap
- DB-wide total matches: 1166
- Competitive matches in DB: 1153
- Premium-only matches: 1153
- Excluded from premium-only because non-competitive: 13
- Excluded from premium-only because source tier still unknown: 0
- Unknown source tier among competitive matches: 0
- Explanation: Le mismatch venait du fait que le report competitif ne couvre que les imports competitifs, alors que l'audit ML exportait toute la base. Le scope premium-only rend maintenant cet ecart explicite.

## DB-wide
- Total imported matches: 1166
- Total valid timelines: 1166
- Premium recent matches (26.1-26.7): 1060
- Premium recent share: 90.91

### Match Distribution By Source Tier
- pro: 1150
- unknown: 13
- elite: 3

### Match Distribution By Source Kind
- PRO_SEED: 1150
- unknown: 13
- ELITE_SEED: 3

### Match Distribution By Patch
- 26.6: 558
- 26.7: 390
- 26.1: 49
- 26.5: 47
- 15.23: 27
- 14.20: 19
- 15.24: 12
- 26.3: 10
- 15.19: 8
- 15.4: 8
- 14.24: 5
- 15.7: 5
- 26.4: 5
- 15.1: 4
- 15.18: 4
- 15.9: 4
- 14.15: 3
- 15.5: 3
- 15.22: 2
- 15.12: 1
- 15.20: 1
- 26.2: 1

### Match Distribution By Source League
- First Stand: 469
- LoL Champions Korea: 362
- World Championship: 188
- League of Legends Championship of The Americas: 86
- Mid-Season Invitational: 45
- unknown: 13
- Riot Ranked Ladder: 3

### Match Distribution By Source Region Hint
- International: 702
- Korea: 362
- Americas: 86
- europe: 11
- KR: 3
- asia: 2

## Premium-only
- Total imported matches: 1153
- Total valid timelines: 1153
- Premium recent matches (26.1-26.7): 1048
- Premium recent share: 90.89

### Match Distribution By Source Tier
- pro: 1150
- elite: 3

### Match Distribution By Source Kind
- PRO_SEED: 1150
- ELITE_SEED: 3

### Match Distribution By Patch
- 26.6: 554
- 26.7: 383
- 26.1: 49
- 26.5: 46
- 15.23: 26
- 14.20: 19
- 15.24: 12
- 26.3: 10
- 15.19: 8
- 15.4: 8
- 14.24: 5
- 15.7: 5
- 26.4: 5
- 15.1: 4
- 15.18: 4
- 15.9: 4
- 14.15: 3
- 15.5: 3
- 15.22: 2
- 15.12: 1
- 15.20: 1
- 26.2: 1

### Match Distribution By Source League
- First Stand: 469
- LoL Champions Korea: 362
- World Championship: 188
- League of Legends Championship of The Americas: 86
- Mid-Season Invitational: 45
- Riot Ranked Ladder: 3

### Match Distribution By Source Region Hint
- International: 702
- Korea: 362
- Americas: 86
- KR: 3

## Dataset
- Total snapshots generated: 12019
- Snapshots trainable strict recents: 12019
- Candidate pool median: 35
- Candidate pool p95: 164.00000000000364
- Gold incoherent ratio: 0.3123387969049006
- Missing actual item ratio: 0

## Snapshots By Patch
- 26.6: 9810
- 26.1: 1020
- 26.5: 991
- 26.7: 109
- 26.3: 62
- 26.4: 22
- 26.2: 5

## Snapshots By Role
- ADC: 3027
- SUPPORT: 2513
- MID: 2459
- TOP: 2066
- JUNGLE: 1954

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
- `npm run backfill:competitive-provenance`
- `npm run riot:report-competitive`
- `npm run ml:export-raw`
- `ml\.venv\Scripts\python.exe ml\scripts\tasks.py build-dataset`
- `npm run audit:premium-v1-dataset`
