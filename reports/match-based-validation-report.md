# Match-Based Validation Report

- Generated at: 2026-04-19T15:04:27.424Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 0.8
- No viable snapshot found rate: 0.2
- Distinct selected snapshots: 8
- Distinct selected snapshot signatures: 8
- Reused selected snapshot signatures: 0
- Distinct champions covered: 9

## Rejection Reasons
- low-confidence: 32
- publishability-insufficient-credible-distractors: 5

## Snapshot Diversity
- mid: 4
- early: 2
- late: 2
- none: 2

## Generations
- #1 cmo5wcmb00031usraot25bvis [26.3 ambessa TOP]  status=completed snapshot=7 minute=11.85 gold=1254 candidatePool=11 quality=94.64
- #2 cmo5wcleu002qusragaza0uff [26.3 gnar TOP]  status=completed snapshot=19 minute=23.49 gold=3107 candidatePool=11 quality=89.72
- #3 cmo5wck5q002fusra0lto4com [26.3 kennen TOP]  status=no_viable_snapshot_found snapshot=none minute=9.89 gold=3325 candidatePool=11 quality=0 failure=low-confidence
- #4 cmo5wcj320024usra7wadli4b [26.3 vi JUNGLE]  status=completed snapshot=19 minute=18.71 gold=1153 candidatePool=11 quality=94.3
- #5 cmo5wchul001tusraowguha48 [26.3 ksante TOP]  status=completed snapshot=12 minute=11.92 gold=1587 candidatePool=11 quality=99.72
- #6 cmo5wcgk6001iusrasj7cfew9 [26.3 gwen TOP]  status=no_publishable_snapshot_found snapshot=none minute=8.48 gold=1689 candidatePool=11 quality=0 failure=publishability-insufficient-credible-distractors
- #7 cmo5wcfag0017usraazz6ebz4 [26.3 viego JUNGLE]  status=completed snapshot=13 minute=16.06 gold=1214 candidatePool=11 quality=108
- #8 cmo5wcegn000wusrazodd4hxl [26.3 ambessa JUNGLE]  status=completed snapshot=22 minute=23.23 gold=3588 candidatePool=11 quality=99.82
- #9 cmo5wcd5c000lusramvgt87om [26.3 rumble TOP]  status=completed snapshot=15 minute=20.77 gold=1862 candidatePool=11 quality=97.04
- #10 cmo5wccab000ausrai4gbtj09 [26.4 gangplank TOP]  status=completed snapshot=14 minute=19.99 gold=3271 candidatePool=11 quality=89.94

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
