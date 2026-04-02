# Premium V1 Dataset Audit

- Generated at: 2026-04-02T07:44:34.521Z
- Competitive report path: C:\Users\XavierTrouche\dev\summoner-build-lab\data\runtime\competitive-ingestion\real-report.json
- Baseline state: frozen-for-ml-audit
- Ingestion freeze: true
- Training policy verified: true

## Reporting Scopes
- DB-wide: Tous les ImportedMatch de la base, quelle que soit la provenance.
- Premium-only: Sous-ensemble premium exploitable: sourceKind competitif + sourceTier connu.
- Competitive report: Rapport pipeline competitif source-filtered, limite aux imports competitifs observes par le checkpoint/report.

## Scope Gap
- DB-wide total matches: 612
- Competitive matches in DB: 601
- Premium-only matches: 601
- Excluded from premium-only because non-competitive: 11
- Excluded from premium-only because source tier still unknown: 0
- Unknown source tier among competitive matches: 0
- Explanation: Le mismatch venait du fait que le report competitif ne couvre que les imports competitifs, alors que l'audit ML exportait toute la base. Le scope premium-only rend maintenant cet ecart explicite.

## DB-wide
- Total imported matches: 612
- Total valid timelines: 612
- Premium recent matches (26.1-26.7): 506
- Premium recent share: 82.68

### Match Distribution By Source Tier
- pro: 601
- unknown: 11

### Match Distribution By Source Kind
- PRO_SEED: 601
- unknown: 11

### Match Distribution By Patch
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
- 26.7: 4
- 14.15: 3
- 15.5: 3
- 26.3: 3
- 15.22: 2
- 15.12: 1
- 15.20: 1
- 26.2: 1
- 26.4: 1

### Match Distribution By Source League
- First Stand: 210
- World Championship: 188
- League of Legends Championship of The Americas: 86
- LoL Champions Korea: 72
- Mid-Season Invitational: 45
- unknown: 11

### Match Distribution By Source Region Hint
- International: 443
- Americas: 86
- Korea: 72
- europe: 8
- asia: 3

## Premium-only
- Total imported matches: 601
- Total valid timelines: 601
- Premium recent matches (26.1-26.7): 496
- Premium recent share: 82.53

### Match Distribution By Source Tier
- pro: 601

### Match Distribution By Source Kind
- PRO_SEED: 601

### Match Distribution By Patch
- 26.6: 406
- 26.5: 43
- 26.1: 42
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
- 26.3: 3
- 15.22: 2
- 15.12: 1
- 15.20: 1
- 26.2: 1
- 26.4: 1

### Match Distribution By Source League
- First Stand: 210
- World Championship: 188
- League of Legends Championship of The Americas: 86
- LoL Champions Korea: 72
- Mid-Season Invitational: 45

### Match Distribution By Source Region Hint
- International: 443
- Americas: 86
- Korea: 72

## Dataset
- Total snapshots generated: 12003
- Snapshots trainable strict recents: 12003
- Candidate pool median: 35
- Candidate pool p95: 162.89999999999964
- Gold incoherent ratio: 0.3121719570107473
- Missing actual item ratio: 0

## Snapshots By Patch
- 26.6: 9810
- 26.1: 1020
- 26.5: 991
- 26.7: 93
- 26.3: 62
- 26.4: 22
- 26.2: 5

## Snapshots By Role
- ADC: 3027
- SUPPORT: 2513
- MID: 2459
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
- `npm run backfill:competitive-provenance`
- `npm run riot:report-competitive`
- `npm run ml:export-raw`
- `ml\.venv\Scripts\python.exe ml\scripts\tasks.py build-dataset`
- `npm run audit:premium-v1-dataset`
