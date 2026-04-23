# Match-Based Validation Report

- Generated at: 2026-04-23T10:34:49.140Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 0.9
- No viable snapshot found rate: 0.1
- Distinct selected snapshots: 9
- Distinct selected snapshot signatures: 9
- Reused selected snapshot signatures: 0
- Distinct champions covered: 9

## Rejection Reasons
- low-confidence: 26
- publishability-insufficient-credible-distractors: 2

## Snapshot Diversity
- mid: 5
- early: 3
- late: 1
- none: 1

## Generations
- #1 cmobchajw00f9roravoke9kly [26.2 kennen TOP]  status=completed snapshot=20 minute=22.21 gold=2671 candidatePool=11 quality=91.69
- #2 cmobch9pd00eyroraocip3na1 [26.2 aurora TOP]  status=completed snapshot=9 minute=13.43 gold=3449 candidatePool=11 quality=77.89
- #3 cmobch90m00enrorawse3zrgy [26.2 varus TOP]  status=completed snapshot=25 minute=27.2 gold=1768 candidatePool=11 quality=92.4
- #4 cmobch86z00ecrorab8lhudqh [26.2 jayce JUNGLE]  status=no_publishable_snapshot_found snapshot=none minute=12.75 gold=1148 candidatePool=11 quality=0 failure=low-confidence
- #5 cmobch71k00e1rorayaqy2v1c [26.2 renekton TOP]  status=completed snapshot=18 minute=18.73 gold=1577 candidatePool=11 quality=98.91
- #6 cmobch5z800dqrora9ituv814 [26.2 ambessa TOP]  status=completed snapshot=7 minute=11.77 gold=3076 candidatePool=11 quality=77.41
- #7 cmobch5a800dfrorauoj6ah4t [26.2 corki TOP]  status=completed snapshot=23 minute=18.49 gold=1167 candidatePool=11 quality=85.22
- #8 cmobch4h000d4rorag8anw6sf [26.2 kennen TOP]  status=completed snapshot=10 minute=13.7 gold=1142 candidatePool=11 quality=80.56
- #9 cmobch3ds00ctrorabd12bcm0 [26.2 gnar TOP]  status=completed snapshot=18 minute=21.86 gold=1784 candidatePool=11 quality=90.22
- #10 cmobch2i900cirora9l8jybea [26.2 ryze MID]  status=completed snapshot=19 minute=19.68 gold=1246 candidatePool=11 quality=100

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
