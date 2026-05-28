# Match-Based Validation Report

- Generated at: 2026-04-23T10:47:03.876Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 20
- Strict patch prefix: 26.
- Completed rate: 1
- No viable snapshot found rate: 0
- Distinct selected snapshots: 20
- Distinct selected snapshot signatures: 20
- Reused selected snapshot signatures: 0
- Distinct champions covered: 10

## Rejection Reasons
- low-confidence: 11
- choice-resolution-insufficient-distractors: 3
- publishability-insufficient-credible-distractors: 3

## Snapshot Diversity
- early: 9
- mid: 8
- late: 3

## Generations
- #1 cmobcwwe400c7agracuaw610t [26.1 akali MID]  status=completed snapshot=18 minute=13.21 gold=1215 candidatePool=11 quality=97
- #2 cmobcwvhb00bwagraqym1dzts [26.2 nautilus SUPPORT]  status=completed snapshot=31 minute=22.68 gold=2350 candidatePool=11 quality=97.21
- #3 cmobcwucx00blagrawbppyd59 [26.1 anivia MID]  status=completed snapshot=13 minute=9.73 gold=2657 candidatePool=11 quality=103
- #4 cmobcwtp600baagraj8j2gojo [26.2 neeko SUPPORT]  status=completed snapshot=38 minute=26.42 gold=1220 candidatePool=11 quality=95.2
- #5 cmobcwsks00azagrag0izv7wm [26.1 ryze MID]  status=completed snapshot=14 minute=15.2 gold=2991 candidatePool=11 quality=103
- #6 cmobcwrme00aoagradup4pys5 [26.2 neeko SUPPORT]  status=completed snapshot=24 minute=21.45 gold=1697 candidatePool=11 quality=96.26
- #7 cmobcwqq500adagrayebktxl7 [26.1 nidalee TOP]  status=completed snapshot=21 minute=20.92 gold=2079 candidatePool=11 quality=96.29
- #8 cmobcwpkx00a2agraykajh8pw [26.1 corki MID]  status=completed snapshot=9 minute=9.41 gold=1604 candidatePool=11 quality=104
- #9 cmobcwopz009ragran3f51p1s [26.2 alistar SUPPORT]  status=completed snapshot=23 minute=18.12 gold=1250 candidatePool=11 quality=93.57
- #10 cmobcveyk009gagraz5s9kauk [26.3 bard SUPPORT]  status=completed snapshot=8 minute=8.09 gold=1487 candidatePool=11 quality=90.5
- #11 cmobcvdvm0095agraj8wfjmlj [26.3 nautilus SUPPORT]  status=completed snapshot=20 minute=19.65 gold=951 candidatePool=11 quality=98.36
- #12 cmobcvcs5008uagrahisgalzo [26.3 alistar SUPPORT]  status=completed snapshot=14 minute=12.93 gold=1103 candidatePool=11 quality=93.21
- #13 cmobcusvs008jagra67ck4xm7 [26.3 bard SUPPORT]  status=completed snapshot=20 minute=18.02 gold=1040 candidatePool=11 quality=93.75
- #14 cmobcurxv0088agravzkiuvkz [26.3 neeko SUPPORT]  status=completed snapshot=16 minute=11.64 gold=1012 candidatePool=11 quality=87.12
- #15 cmobcur8c007xagrad883k9su [26.3 karma SUPPORT]  status=completed snapshot=15 minute=12.79 gold=950 candidatePool=11 quality=97.55
- #16 cmobcuq1n007magrarxftvq06 [26.3 karma SUPPORT]  status=completed snapshot=10 minute=10.46 gold=2312 candidatePool=11 quality=74.74
- #17 cmobcubtg007bagraifoju2ef [26.3 karma SUPPORT]  status=completed snapshot=42 minute=31.26 gold=1228 candidatePool=11 quality=96.33
- #18 cmobcuaks0070agrajd9ykjgl [26.3 karma SUPPORT]  status=completed snapshot=11 minute=9.04 gold=2464 candidatePool=11 quality=82.94
- #19 cmobcu9on006pagram6y0vqwv [26.3 karma SUPPORT]  status=completed snapshot=26 minute=27.3 gold=2303 candidatePool=11 quality=95.27
- #20 cmobcu8f3006eagra24xtyzmf [26.3 karma SUPPORT]  status=completed snapshot=16 minute=17.7 gold=2603 candidatePool=11 quality=96.58

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 20`
