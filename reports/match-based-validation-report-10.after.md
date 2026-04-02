# Match-Based Validation Report

- Generated at: 2026-04-02T07:33:10.904Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 0.4
- No viable snapshot found rate: 0.6
- Distinct selected snapshots: 4
- Distinct selected snapshot signatures: 4
- Reused selected snapshot signatures: 0
- Distinct champions covered: 10

## Rejection Reasons
- good-answer-too-cheap: 38
- low-confidence: 36
- good-answer-unresolved: 4
- good-answer-incoherent-with-champion: 2

## Snapshot Diversity
- none: 6
- late: 2
- early: 1
- mid: 1

## Generations
- #1 cmnf2133604ar9crag4ukrc6c [26.6 mel MID]  status=no_viable_snapshot_found snapshot=none minute=11.26 gold=525 candidatePool=11 quality=0 failure=good-answer-too-cheap
- #2 cmnf2123704ag9cra3zu95jrf [26.6 bard SUPPORT]  status=no_viable_snapshot_found snapshot=none minute=15.44 gold=1366 candidatePool=11 quality=0 failure=low-confidence
- #3 cmnf2110l04a59cra9v07y64k [26.6 jayce JUNGLE]  status=completed snapshot=24 minute=24.9 gold=1258 candidatePool=11 quality=87.96
- #4 cmnf2101t049u9craju95zfco [26.6 jhin ADC]  status=no_viable_snapshot_found snapshot=none minute=0.19 gold=50 candidatePool=0 quality=0 failure=good-answer-unresolved
- #5 cmnf20zi9049j9cradp4wu6ul [26.6 sivir ADC]  status=no_viable_snapshot_found snapshot=none minute=8.3 gold=1098 candidatePool=11 quality=0 failure=low-confidence
- #6 cmnf20yw004989crar5t7izt3 [26.6 naafiri JUNGLE]  status=completed snapshot=18 minute=17.81 gold=2356 candidatePool=11 quality=86.13
- #7 cmnf20x71048g9crafttft9rr [26.6 corki ADC]  status=no_viable_snapshot_found snapshot=none minute=11.38 gold=1065 candidatePool=11 quality=0 failure=low-confidence
- #8 cmnf20wf104859crad1g0g09v [26.6 seraphine SUPPORT]  status=completed snapshot=12 minute=10.52 gold=982 candidatePool=11 quality=99.68
- #9 cmnf20w0z047u9crad1ulpt0z [26.6 ryze MID]  status=no_viable_snapshot_found snapshot=none minute=11.18 gold=3405 candidatePool=11 quality=0 failure=good-answer-too-cheap
- #10 cmnf20uyb047j9craomy9wv0t [26.6 aatrox JUNGLE]  status=completed snapshot=23 minute=26.52 gold=1182 candidatePool=11 quality=89.4

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10 --imported-match-ids cmnf2133604ar9crag4ukrc6c,cmnf2123704ag9cra3zu95jrf,cmnf2110l04a59cra9v07y64k,cmnf2101t049u9craju95zfco,cmnf20zi9049j9cradp4wu6ul,cmnf20yw004989crar5t7izt3,cmnf20x71048g9crafttft9rr,cmnf20wf104859crad1g0g09v,cmnf20w0z047u9crad1ulpt0z,cmnf20uyb047j9craomy9wv0t --baseline-report reports/match-based-validation-report.before-2026-04-02.json`
