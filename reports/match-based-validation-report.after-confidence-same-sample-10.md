# Match-Based Validation Report

- Generated at: 2026-04-19T15:16:43.039Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 1
- No viable snapshot found rate: 0
- Distinct selected snapshots: 10
- Distinct selected snapshot signatures: 10
- Reused selected snapshot signatures: 0
- Distinct champions covered: 8

## Rejection Reasons
- low-confidence: 9
- publishability-insufficient-credible-distractors: 5
- choice-resolution-insufficient-distractors: 1

## Snapshot Diversity
- early: 6
- mid: 4

## Generations
- #1 cmo5w75u8000afcras10806ip [26.4 jayce TOP]  status=completed snapshot=11 minute=11.81 gold=3390 candidatePool=11 quality=88.28
- #2 cmo5vq7mh000au8ra5vnc8ejp [26.4 aurora TOP]  status=completed snapshot=8 minute=10.31 gold=2853 candidatePool=11 quality=83.2
- #3 cmo5uvvzt001iv4ra8omzlnsi [26.4 zaahen TOP]  status=completed snapshot=10 minute=11.96 gold=3399 candidatePool=11 quality=84.4
- #4 cmo5uvusp0017v4ra39fgp6hk [26.4 lulu SUPPORT]  status=completed snapshot=7 minute=8.43 gold=1248 candidatePool=11 quality=96.88
- #5 cmo5uvtw1000wv4rawimqz0dr [26.4 rumble TOP]  status=completed snapshot=10 minute=8.33 gold=1285 candidatePool=11 quality=85.02
- #6 cmo5uvsxw000lv4ra2imta7io [26.4 ambessa TOP]  status=completed snapshot=15 minute=21.93 gold=1495 candidatePool=11 quality=82.79
- #7 cmo5uvrsq000av4rak7oqzvjj [26.4 jayce TOP]  status=completed snapshot=15 minute=20.03 gold=3178 candidatePool=11 quality=85.19
- #8 cmo5ul6pe003124ra04ec77o7 [26.4 renekton MID]  status=completed snapshot=10 minute=15.75 gold=3742 candidatePool=11 quality=100
- #9 cmo5ul5iy002q24rat0vfqaad [26.4 gwen TOP]  status=completed snapshot=10 minute=11.7 gold=1129 candidatePool=11 quality=103.58
- #10 cmo5ul4ii002f24ra14ztumrv [26.4 gwen TOP]  status=completed snapshot=14 minute=15.82 gold=979 candidatePool=11 quality=91.19

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10 --imported-match-ids cmo5w75u8000afcras10806ip,cmo5vq7mh000au8ra5vnc8ejp,cmo5uvvzt001iv4ra8omzlnsi,cmo5uvusp0017v4ra39fgp6hk,cmo5uvtw1000wv4rawimqz0dr,cmo5uvsxw000lv4ra2imta7io,cmo5uvrsq000av4rak7oqzvjj,cmo5ul6pe003124ra04ec77o7,cmo5ul5iy002q24rat0vfqaad,cmo5ul4ii002f24ra14ztumrv --baseline-report reports/match-based-validation-report.current-10.json`
