# Match-Based Validation Report

- Generated at: 2026-04-23T10:52:16.552Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 20
- Strict patch prefix: 26.
- Completed rate: 0.85
- No viable snapshot found rate: 0.15
- Distinct selected snapshots: 17
- Distinct selected snapshot signatures: 17
- Reused selected snapshot signatures: 0
- Distinct champions covered: 16

## Rejection Reasons
- low-confidence: 33
- choice-resolution-insufficient-distractors: 1
- publishability-insufficient-credible-distractors: 1

## Snapshot Diversity
- early: 8
- mid: 7
- none: 3
- late: 2

## Generations
- #1 cmobd3hjd000wg0radwwkke7w [26.1 jhin ADC]  status=completed snapshot=24 minute=29.01 gold=1563 candidatePool=11 quality=99.84
- #2 cmobd3gfe000lg0rabsmt66mx [26.1 rell SUPPORT]  status=completed snapshot=10 minute=11.1 gold=2522 candidatePool=11 quality=73.37
- #3 cmobd3fly000ag0raligfc2zf [26.1 alistar SUPPORT]  status=completed snapshot=16 minute=15.49 gold=1372 candidatePool=11 quality=92.19
- #4 cmobd04n30095yorabdcap3hy [26.2 nautilus SUPPORT]  status=completed snapshot=17 minute=13.12 gold=1710 candidatePool=11 quality=79.39
- #5 cmobd040i008uyorarxe10cef [26.2 nautilus SUPPORT]  status=completed snapshot=21 minute=17.33 gold=1089 candidatePool=11 quality=96.28
- #6 cmobd034t008jyora7zj3sf0m [26.2 neeko SUPPORT]  status=no_publishable_snapshot_found snapshot=none minute=13.79 gold=2759 candidatePool=11 quality=0 failure=low-confidence
- #7 cmobd02b40088yoraugc11gg4 [26.2 aatrox TOP]  status=completed snapshot=18 minute=21.38 gold=1369 candidatePool=11 quality=85.08
- #8 cmobd01ff007xyora1sk5kehk [26.2 alistar SUPPORT]  status=completed snapshot=26 minute=22.68 gold=2639 candidatePool=11 quality=98.14
- #9 cmobd00cd007myoraqviamv4t [26.2 gnar TOP]  status=completed snapshot=12 minute=21.85 gold=1882 candidatePool=11 quality=108.72
- #10 cmobczzbj007byora2yb54jyg [26.2 darius TOP]  status=completed snapshot=10 minute=10.36 gold=1792 candidatePool=11 quality=80.66
- #11 cmobczylp0070yora7iflvn6v [26.2 jayce JUNGLE]  status=completed snapshot=8 minute=11.29 gold=4312 candidatePool=11 quality=80.92
- #12 cmobczxz9006pyorabnxlbany [26.2 yorick TOP]  status=completed snapshot=7 minute=10.85 gold=3453 candidatePool=11 quality=80.04
- #13 cmobczx09006eyora2xtczyw0 [26.2 varus TOP]  status=completed snapshot=19 minute=27.06 gold=1884 candidatePool=11 quality=86.23
- #14 cmobczw310063yoraf8f52e1e [26.2 kennen TOP]  status=completed snapshot=8 minute=8.27 gold=3323 candidatePool=11 quality=94.32
- #15 cmobczv7n005syora8loehckr [26.2 gwen TOP]  status=no_publishable_snapshot_found snapshot=none minute=11 gold=3100 candidatePool=11 quality=0 failure=low-confidence
- #16 cmobczu6d005hyoraakfyfd9s [26.2 viktor MID]  status=completed snapshot=8 minute=10.31 gold=3079 candidatePool=11 quality=100
- #17 cmobczte00056yorayllopvx5 [26.2 gnar TOP]  status=completed snapshot=12 minute=16.45 gold=1449 candidatePool=11 quality=85.14
- #18 cmobczse6004vyora7wnog0su [26.2 varus TOP]  status=no_publishable_snapshot_found snapshot=none minute=10.3 gold=1022 candidatePool=11 quality=0 failure=low-confidence
- #19 cmobczrc2004kyoraxoktievs [26.2 ambessa TOP]  status=completed snapshot=6 minute=8.3 gold=3469 candidatePool=11 quality=74.29
- #20 cmobczqft0049yora1wgr6o3b [26.2 zaahen TOP]  status=completed snapshot=15 minute=16.09 gold=1759 candidatePool=11 quality=108

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 20`
