# Match-Based Validation Report

- Generated at: 2026-04-19T15:13:09.389Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 0.8
- No viable snapshot found rate: 0.2
- Distinct selected snapshots: 8
- Distinct selected snapshot signatures: 8
- Reused selected snapshot signatures: 0
- Distinct champions covered: 8

## Rejection Reasons
- low-confidence: 21
- publishability-insufficient-credible-distractors: 3
- choice-resolution-insufficient-distractors: 1

## Snapshot Diversity
- early: 4
- mid: 4
- none: 2

## Generations
- #1 cmo5w75u8000afcras10806ip [26.4 jayce TOP]  status=no_viable_snapshot_found snapshot=none minute=11.81 gold=3390 candidatePool=11 quality=0 failure=low-confidence
- #2 cmo5vq7mh000au8ra5vnc8ejp [26.4 aurora TOP]  status=completed snapshot=5 minute=8.28 gold=1646 candidatePool=11 quality=97.25
- #3 cmo5uvvzt001iv4ra8omzlnsi [26.4 zaahen TOP]  status=completed snapshot=16 minute=19.58 gold=1614 candidatePool=11 quality=105.81
- #4 cmo5uvusp0017v4ra39fgp6hk [26.4 lulu SUPPORT]  status=completed snapshot=10 minute=10.61 gold=2312 candidatePool=11 quality=93.63
- #5 cmo5uvtw1000wv4rawimqz0dr [26.4 rumble TOP]  status=completed snapshot=12 minute=11.42 gold=3190 candidatePool=11 quality=91.93
- #6 cmo5uvsxw000lv4ra2imta7io [26.4 ambessa TOP]  status=completed snapshot=12 minute=18.05 gold=3270 candidatePool=11 quality=88.59
- #7 cmo5uvrsq000av4rak7oqzvjj [26.4 jayce TOP]  status=no_viable_snapshot_found snapshot=none minute=8.11 gold=1772 candidatePool=11 quality=0 failure=low-confidence
- #8 cmo5ul6pe003124ra04ec77o7 [26.4 renekton MID]  status=completed snapshot=12 minute=17.18 gold=1532 candidatePool=11 quality=104
- #9 cmo5ul5iy002q24rat0vfqaad [26.4 gwen TOP]  status=completed snapshot=10 minute=11.7 gold=1129 candidatePool=11 quality=107.58
- #10 cmo5ul4ii002f24ra14ztumrv [26.4 gwen TOP]  status=completed snapshot=14 minute=15.82 gold=979 candidatePool=11 quality=91.19

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
