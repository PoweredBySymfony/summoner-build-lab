# Match-Based Validation Report

- Generated at: 2026-04-01T19:16:55.519Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 0.1
- No viable snapshot found rate: 0.9
- Distinct selected snapshots: 1
- Distinct champions covered: 8

## Rejection Reasons
- good-answer-too-cheap: 40
- good-answer-unresolved: 34
- low-confidence: 33
- good-answer-incoherent-with-champion: 13

## Snapshot Diversity
- none: 9
- mid: 1

## Generations
- #1 cmnf21qsp04j69crabu00fwpd [26.6 azir MID]  status=no_viable_snapshot_found snapshot=none minute=11.13 gold=148 candidatePool=0 quality=0 failure=good-answer-unresolved
- #2 cmnf21pz104iv9crafx0wih0j [26.6 ksante TOP]  status=completed snapshot=13 minute=20.4 gold=1644 candidatePool=11 quality=84.04
- #3 cmnf21p6304ik9crazyu50ynz [26.6 graves JUNGLE]  status=no_viable_snapshot_found snapshot=none minute=15.84 gold=189 candidatePool=0 quality=0 failure=good-answer-unresolved
- #4 cmnf21o5104i99cra6n4hozd5 [26.6 gnar TOP]  status=no_viable_snapshot_found snapshot=none minute=10.89 gold=25 candidatePool=0 quality=0 failure=good-answer-unresolved
- #5 cmnf21mkj04hn9crar11jcf47 [26.6 azir MID]  status=no_viable_snapshot_found snapshot=none minute=10.93 gold=107 candidatePool=0 quality=0 failure=good-answer-unresolved
- #6 cmnf21kx004h19crasnmx0vuh [26.6 graves JUNGLE]  status=no_viable_snapshot_found snapshot=none minute=12.02 gold=517 candidatePool=11 quality=0 failure=good-answer-too-cheap
- #7 cmnf21j5u04gf9crafrfgid5p [26.6 mel MID]  status=no_viable_snapshot_found snapshot=none minute=10.72 gold=226 candidatePool=0 quality=0 failure=good-answer-unresolved
- #8 cmnf21if504g49cralemzccel [26.6 varus ADC]  status=no_viable_snapshot_found snapshot=none minute=9.43 gold=472 candidatePool=11 quality=0 failure=good-answer-too-cheap
- #9 cmnf21hrn04ft9cra2c5icsvs [26.6 ambessa TOP]  status=no_viable_snapshot_found snapshot=none minute=12.45 gold=218 candidatePool=0 quality=0 failure=good-answer-unresolved
- #10 cmnf21gvg04fi9craaycjzapf [26.6 jinx ADC]  status=no_viable_snapshot_found snapshot=none minute=17.24 gold=1722 candidatePool=11 quality=0 failure=low-confidence

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
