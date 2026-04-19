# Match-Based Validation Report

- Generated at: 2026-04-19T11:52:19.546Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 20
- Strict patch prefix: 26.
- Completed rate: 0.95
- No viable snapshot found rate: 0.05
- Distinct selected snapshots: 19
- Distinct selected snapshot signatures: 19
- Reused selected snapshot signatures: 0
- Distinct champions covered: 15

## Rejection Reasons
- low-confidence: 18
- publishability-insufficient-credible-distractors: 8
- choice-resolution-insufficient-distractors: 7
- choice-resolution-good-answer-exclusive-group: 1
- good-answer-exclusive-group: 1

## Snapshot Diversity
- early: 9
- mid: 9
- late: 1
- none: 1

## Generations
- #1 cmnmadc8v008oigraj17ehs4r [26.6 ambessa JUNGLE]  status=no_viable_snapshot_found snapshot=none minute=n/a gold=n/a candidatePool=n/a quality=n/a failure=no-accepted-snapshot
- #2 cmnmadbfd008digraf8ziqe0z [26.6 nautilus SUPPORT]  status=completed snapshot=32 minute=30.65 gold=2312 candidatePool=11 quality=94.11
- #3 cmnmadab30082igraordv86hf [26.6 yone MID]  status=completed snapshot=26 minute=22.51 gold=953 candidatePool=11 quality=100
- #4 cmnmad96l007rigra4rg8qdmx [26.6 yone MID]  status=completed snapshot=8 minute=8.23 gold=1169 candidatePool=11 quality=92.78
- #5 cmnmad8ae007gigra7m34ct8g [26.6 lucian MID]  status=completed snapshot=17 minute=19.62 gold=4605 candidatePool=11 quality=101.92
- #6 cmnmad79f0075igra7o6a9fno [26.6 jayce JUNGLE]  status=completed snapshot=10 minute=8.18 gold=1248 candidatePool=11 quality=88.72
- #7 cmnmad682006uigradvchbhe6 [26.6 ryze MID]  status=completed snapshot=24 minute=20.13 gold=2078 candidatePool=11 quality=104
- #8 cmnmad54c006jigrafwiii4jm [26.6 anivia SUPPORT]  status=completed snapshot=14 minute=12.57 gold=1512 candidatePool=11 quality=101.34
- #9 cmnmad4670068igra69qqo6bm [26.6 ahri MID]  status=completed snapshot=22 minute=20.21 gold=1702 candidatePool=11 quality=106
- #10 cmnmad31v005xigrai977po5l [26.6 vex MID]  status=completed snapshot=10 minute=11.67 gold=2859 candidatePool=11 quality=100
- #11 cmnmad1wm005migraho8xbqrt [26.6 anivia SUPPORT]  status=completed snapshot=8 minute=9.16 gold=1612 candidatePool=11 quality=101.86
- #12 cmnmad12k005bigra6hpqjyex [26.6 akali MID]  status=completed snapshot=11 minute=9.25 gold=2825 candidatePool=11 quality=97.92
- #13 cmnmad0980050igraoghwrq3h [26.6 galio MID]  status=completed snapshot=17 minute=13.52 gold=1864 candidatePool=11 quality=108
- #14 cmnmacz6q004pigraz9ilfpa1 [26.6 ryze MID]  status=completed snapshot=13 minute=11.15 gold=1846 candidatePool=11 quality=108
- #15 cmnmacy4b004eigra37zolaiq [26.6 aatrox TOP]  status=completed snapshot=21 minute=22.65 gold=1886 candidatePool=11 quality=105.91
- #16 cmnmacwyk0043igrai6z63blt [26.6 akali MID]  status=completed snapshot=18 minute=18.31 gold=1699 candidatePool=11 quality=103.64
- #17 cmnmacvv9003sigrat55wyplh [26.6 leblanc MID]  status=completed snapshot=12 minute=11.7 gold=2900 candidatePool=11 quality=100
- #18 cmnmacv0x003higraqonfa1to [26.7 mel MID]  status=completed snapshot=16 minute=15.78 gold=3060 candidatePool=11 quality=100
- #19 cmnmacty20036igra2s8z1gya [26.7 anivia MID]  status=completed snapshot=20 minute=21.1 gold=3524 candidatePool=11 quality=103
- #20 cmnmacsul002vigragorl4xle [26.7 aurora MID]  status=completed snapshot=25 minute=20.04 gold=2036 candidatePool=11 quality=104

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 20`
