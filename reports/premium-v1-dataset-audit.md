# Premium V1 Dataset Audit

- Generated at: 2026-04-19T15:09:28.022Z
- Competitive report path: C:\Users\XavierTrouche\dev\summoner-build-lab\data\runtime\competitive-ingestion\phase-2000-2026-04-19.report.json
- Baseline state: frozen-for-ml-audit
- Ingestion freeze: true
- Training policy verified: true

## Reporting Scopes
- DB-wide: Tous les ImportedMatch de la base, quelle que soit la provenance.
- Premium-only: Sous-ensemble premium exploitable: sourceKind competitif + sourceTier connu.
- Competitive report: Rapport pipeline competitif source-filtered, limite aux imports competitifs observes par le checkpoint/report.

## Scope Gap
- DB-wide total matches: 1291
- Competitive matches in DB: 1278
- Premium-only matches: 1278
- Excluded from premium-only because non-competitive: 13
- Excluded from premium-only because source tier still unknown: 0
- Unknown source tier among competitive matches: 0
- Explanation: Le mismatch venait du fait que le report competitif ne couvre que les imports competitifs, alors que l'audit ML exportait toute la base. Le scope premium-only rend maintenant cet ecart explicite.

## DB-wide
- Total imported matches: 1291
- Total valid timelines: 1290
- Premium recent matches (26.1-26.7): 1169
- Premium recent share: 90.55

### Match Distribution By Source Tier
- pro: 1264
- elite: 14
- unknown: 13

### Match Distribution By Source Kind
- PRO_SEED: 1264
- ELITE_SEED: 14
- unknown: 13

### Match Distribution By Patch
- 26.6: 569
- 26.7: 415
- 26.5: 69
- 26.1: 49
- 26.4: 46
- 15.23: 27
- 14.20: 19
- 26.3: 19
- 26.8: 16
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
- 26.2: 2
- 15.12: 1
- 15.20: 1

### Match Distribution By Source League
- LoL Champions Korea: 473
- First Stand: 472
- World Championship: 188
- League of Legends Championship of The Americas: 86
- Mid-Season Invitational: 45
- Riot Ranked Ladder: 14
- unknown: 13

### Match Distribution By Source Region Hint
- International: 705
- Korea: 473
- Americas: 86
- KR: 14
- europe: 11
- asia: 2

## Premium-only
- Total imported matches: 1278
- Total valid timelines: 1277
- Premium recent matches (26.1-26.7): 1157
- Premium recent share: 90.53

### Match Distribution By Source Tier
- pro: 1264
- elite: 14

### Match Distribution By Source Kind
- PRO_SEED: 1264
- ELITE_SEED: 14

### Match Distribution By Patch
- 26.6: 565
- 26.7: 408
- 26.5: 68
- 26.1: 49
- 26.4: 46
- 15.23: 26
- 14.20: 19
- 26.3: 19
- 26.8: 16
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
- 26.2: 2
- 15.12: 1
- 15.20: 1

### Match Distribution By Source League
- LoL Champions Korea: 473
- First Stand: 472
- World Championship: 188
- League of Legends Championship of The Americas: 86
- Mid-Season Invitational: 45
- Riot Ranked Ladder: 14

### Match Distribution By Source Region Hint
- International: 705
- Korea: 473
- Americas: 86
- KR: 14

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
