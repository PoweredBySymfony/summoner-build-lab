# Match-Based Validation Report

- Generated at: 2026-04-01T18:36:24.985Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 0.1
- No viable snapshot found rate: 0.9
- Distinct selected snapshots: 1
- Distinct champions covered: 8

## Rejection Reasons
- good-answer-unresolved: 40
- good-answer-too-cheap: 25
- low-confidence: 24
- good-answer-incoherent-with-champion: 5

## Snapshot Diversity
- none: 9
- early: 1

## Generations
- #1 cmnf22mo604u79cra4468jenw [26.6 bard SUPPORT]  status=no_viable_snapshot_found snapshot=none minute=13.78 gold=112 candidatePool=0 quality=0 failure=good-answer-unresolved
- #2 cmnf22lv804tw9cra0iitwxfk [26.6 ambessa JUNGLE]  status=completed snapshot=12 minute=12.07 gold=1297 candidatePool=11 quality=107.26
- #3 cmnf22l4n04tl9crau95gracs [26.6 vayne TOP]  status=no_viable_snapshot_found snapshot=none minute=10.84 gold=160 candidatePool=0 quality=0 failure=good-answer-unresolved
- #4 cmnf22k0q04ta9craz2vkt68v [26.6 talon JUNGLE]  status=no_viable_snapshot_found snapshot=none minute=11.79 gold=219 candidatePool=0 quality=0 failure=good-answer-unresolved
- #5 cmnf22ixe04sz9cratsnbydun [26.5 xayah ADC]  status=no_viable_snapshot_found snapshot=none minute=11.49 gold=110 candidatePool=0 quality=0 failure=good-answer-unresolved
- #6 cmnf22hue04so9cra2bq9kipu [26.5 jhin ADC]  status=no_viable_snapshot_found snapshot=none minute=9.13 gold=648 candidatePool=11 quality=0 failure=low-confidence, good-answer-too-cheap
- #7 cmnf22h6v04sd9craatq36miv [26.3 miss-fortune ADC]  status=no_viable_snapshot_found snapshot=none minute=9.24 gold=168 candidatePool=0 quality=0 failure=good-answer-unresolved
- #8 cmnf22gjg04s29cra0nhxbukp [26.6 jhin ADC]  status=no_viable_snapshot_found snapshot=none minute=9.29 gold=244 candidatePool=0 quality=0 failure=good-answer-unresolved
- #9 cmnf22fpg04rr9crauy95r6fp [26.6 ambessa JUNGLE]  status=no_viable_snapshot_found snapshot=none minute=9.02 gold=156 candidatePool=0 quality=0 failure=good-answer-unresolved
- #10 cmnf22dtr04r59cras9vykpll [26.1 jax TOP]  status=no_viable_snapshot_found snapshot=none minute=12.16 gold=431 candidatePool=11 quality=0 failure=good-answer-too-cheap

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
