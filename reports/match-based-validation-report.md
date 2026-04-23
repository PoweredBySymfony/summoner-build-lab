# Match-Based Validation Report

- Generated at: 2026-04-23T13:36:01.077Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 20
- Strict patch prefix: 26.
- Completed rate: 0.9
- No viable snapshot found rate: 0.1
- Distinct selected snapshots: 18
- Distinct selected snapshot signatures: 18
- Reused selected snapshot signatures: 0
- Distinct champions covered: 13

## Rejection Reasons
- low-confidence: 33
- publishability-insufficient-credible-distractors: 1

## Snapshot Diversity
- mid: 12
- early: 5
- none: 2
- late: 1

## Generations
- #1 cmobiv5rz001i7graltmmicmc [26.8 orianna MID]  status=completed snapshot=16 minute=15.87 gold=2035 candidatePool=11 quality=103
- #2 cmobiv4z400177grawfb3sb7h [26.8 aurora MID]  status=completed snapshot=16 minute=17.96 gold=1881 candidatePool=11 quality=100
- #3 cmobiv459000w7gra19j65qna [26.8 ryze MID]  status=completed snapshot=15 minute=11.27 gold=3053 candidatePool=11 quality=100
- #4 cmobiv327000l7gravm34arrq [26.8 karma SUPPORT]  status=completed snapshot=23 minute=19.88 gold=908 candidatePool=11 quality=80.43
- #5 cmobiv22c000a7gra2bk5r9hb [26.8 galio MID]  status=completed snapshot=20 minute=19.66 gold=2868 candidatePool=11 quality=100
- #6 cmobcbe86008jegra7rwzpkg2 [26.3 jayce TOP]  status=completed snapshot=12 minute=11.24 gold=1774 candidatePool=11 quality=112
- #7 cmobcbdbv0088egraljs08xwc [26.3 jayce TOP]  status=completed snapshot=17 minute=17.66 gold=1373 candidatePool=11 quality=112
- #8 cmobcbcod007xegra11663ddw [26.3 ambessa TOP]  status=completed snapshot=14 minute=23.47 gold=3861 candidatePool=11 quality=90.3
- #9 cmobcbbrp007megra82gi447o [26.3 jayce TOP]  status=completed snapshot=16 minute=17.9 gold=1303 candidatePool=11 quality=100.63
- #10 cmobcbawp007begrabg1fzc6c [26.3 gangplank TOP]  status=completed snapshot=16 minute=21.9 gold=1376 candidatePool=11 quality=106.86
- #11 cmobcba1y0070egrafjnqmltx [26.3 gnar TOP]  status=completed snapshot=18 minute=22.68 gold=3148 candidatePool=11 quality=84.17
- #12 cmobcb95m006pegra7770r3je [26.3 naafiri TOP]  status=completed snapshot=11 minute=17.86 gold=1505 candidatePool=11 quality=108
- #13 cmobcb896006eegraehxr1i3x [26.3 ambessa TOP]  status=no_publishable_snapshot_found snapshot=none minute=13.75 gold=3543 candidatePool=11 quality=0 failure=low-confidence
- #14 cmobcb7mt0063egra1hfaqb4m [26.3 ryze TOP]  status=completed snapshot=20 minute=20.68 gold=4163 candidatePool=11 quality=88.81
- #15 cmobcb6ro005segragbzt1bfj [26.3 olaf TOP]  status=completed snapshot=12 minute=12.9 gold=1302 candidatePool=11 quality=112
- #16 cmobcb5oh005hegra3ctbtzue [26.3 gnar TOP]  status=no_publishable_snapshot_found snapshot=none minute=10.63 gold=3450 candidatePool=11 quality=0 failure=low-confidence
- #17 cmobcb50c0056egrauzwrhb5s [26.3 ambessa JUNGLE]  status=completed snapshot=19 minute=19.51 gold=929 candidatePool=11 quality=89.48
- #18 cmobcb4bh004vegrao14sgjz6 [26.3 vi JUNGLE]  status=completed snapshot=13 minute=15.16 gold=1717 candidatePool=11 quality=112
- #19 cmobcb3ha004kegrae12w3x07 [26.3 rumble TOP]  status=completed snapshot=11 minute=8.02 gold=1679 candidatePool=11 quality=94.54
- #20 cmobcb2jp0049egrafd9f1j96 [26.3 jayce TOP]  status=completed snapshot=11 minute=12.98 gold=933 candidatePool=11 quality=89.43

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 20`
