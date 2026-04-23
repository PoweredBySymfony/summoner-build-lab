# Premium V1 Dataset Audit

- Generated at: 2026-04-23T14:21:35.787Z
- Competitive report path: C:\Users\XavierTrouche\dev\summoner-build-lab\data\runtime\competitive-ingestion\phase-2000-v3-2026-04-23.report.json
- Baseline state: frozen-for-ml-audit
- Ingestion freeze: true
- Training policy verified: true

## Reporting Scopes
- DB-wide: Tous les ImportedMatch de la base, quelle que soit la provenance.
- Premium-only: Sous-ensemble premium exploitable: sourceKind competitif + sourceTier connu.
- Competitive report: Rapport pipeline competitif source-filtered, limite aux imports competitifs observes par le checkpoint/report.

## Scope Gap
- DB-wide total matches: 1725
- Competitive matches in DB: 1710
- Premium-only matches: 1710
- Excluded from premium-only because non-competitive: 15
- Excluded from premium-only because source tier still unknown: 0
- Unknown source tier among competitive matches: 0
- Explanation: Le mismatch venait du fait que le report competitif ne couvre que les imports competitifs, alors que l'audit ML exportait toute la base. Le scope premium-only rend maintenant cet ecart explicite.

## DB-wide
- Total imported matches: 1725
- Total valid timelines: 1722
- Premium recent matches (26.1-26.7): 1473
- Premium recent share: 85.39

### Match Distribution By Source Tier
- pro: 1641
- elite: 69
- unknown: 15

### Match Distribution By Source Kind
- PRO_SEED: 1641
- ELITE_SEED: 69
- unknown: 15

### Match Distribution By Patch
- 26.6: 570
- 26.7: 485
- 26.8: 146
- 26.3: 126
- 26.1: 85
- 26.2: 76
- 26.5: 71
- 26.4: 60
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
- 15.22: 2
- 15.12: 1
- 15.20: 1

### Match Distribution By Source League
- LoL Champions Korea: 792
- First Stand: 521
- World Championship: 194
- League of Legends Championship of The Americas: 86
- Riot Ranked Ladder: 69
- Mid-Season Invitational: 48
- unknown: 15

### Match Distribution By Source Region Hint
- Korea: 792
- International: 763
- Americas: 86
- KR: 58
- europe: 13
- BR1: 11
- asia: 2

## Premium-only
- Total imported matches: 1710
- Total valid timelines: 1707
- Premium recent matches (26.1-26.7): 1460
- Premium recent share: 85.38

### Match Distribution By Source Tier
- pro: 1641
- elite: 69

### Match Distribution By Source Kind
- PRO_SEED: 1641
- ELITE_SEED: 69

### Match Distribution By Patch
- 26.6: 566
- 26.7: 477
- 26.8: 145
- 26.3: 126
- 26.1: 85
- 26.2: 76
- 26.5: 70
- 26.4: 60
- 15.23: 26
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
- 15.22: 2
- 15.12: 1
- 15.20: 1

### Match Distribution By Source League
- LoL Champions Korea: 792
- First Stand: 521
- World Championship: 194
- League of Legends Championship of The Americas: 86
- Riot Ranked Ladder: 69
- Mid-Season Invitational: 48

### Match Distribution By Source Region Hint
- Korea: 792
- International: 763
- Americas: 86
- KR: 58
- BR1: 11

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
