# Match-Based Validation Report

- Generated at: 2026-04-01T20:03:47.098Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 0.6
- No viable snapshot found rate: 0.4
- Distinct selected snapshots: 6
- Distinct champions covered: 10

## Rejection Reasons
- good-answer-too-cheap: 44
- low-confidence: 25
- good-answer-incoherent-with-champion: 5
- good-answer-unresolved: 3

## Snapshot Diversity
- mid: 6
- none: 4

## Generations
- #1 cmnf2133604ar9crag4ukrc6c [26.6 mel MID]  status=completed snapshot=19 minute=21.15 gold=1654 candidatePool=11 quality=100
- #2 cmnf2123704ag9cra3zu95jrf [26.6 bard SUPPORT]  status=no_viable_snapshot_found snapshot=none minute=12.13 gold=2775 candidatePool=11 quality=0 failure=good-answer-too-cheap
- #3 cmnf2110l04a59cra9v07y64k [26.6 jayce JUNGLE]  status=completed snapshot=17 minute=16.28 gold=1344 candidatePool=11 quality=112
- #4 cmnf2101t049u9craju95zfco [26.6 jhin ADC]  status=no_viable_snapshot_found snapshot=none minute=0.19 gold=50 candidatePool=0 quality=0 failure=good-answer-unresolved
- #5 cmnf20zi9049j9cradp4wu6ul [26.6 sivir ADC]  status=no_viable_snapshot_found snapshot=none minute=8.3 gold=1098 candidatePool=11 quality=0 failure=good-answer-too-cheap
- #6 cmnf20yw004989crar5t7izt3 [26.6 naafiri JUNGLE]  status=completed snapshot=23 minute=21.46 gold=1280 candidatePool=11 quality=104
- #7 cmnf20x71048g9crafttft9rr [26.6 corki ADC]  status=completed snapshot=15 minute=15.16 gold=3629 candidatePool=11 quality=85.83
- #8 cmnf20wf104859crad1g0g09v [26.6 seraphine SUPPORT]  status=no_viable_snapshot_found snapshot=none minute=8.46 gold=182 candidatePool=0 quality=0 failure=good-answer-unresolved
- #9 cmnf20w0z047u9crad1ulpt0z [26.6 ryze MID]  status=completed snapshot=16 minute=21.96 gold=1946 candidatePool=11 quality=106
- #10 cmnf20uyb047j9craomy9wv0t [26.6 aatrox JUNGLE]  status=completed snapshot=15 minute=16.43 gold=1412 candidatePool=11 quality=108

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
