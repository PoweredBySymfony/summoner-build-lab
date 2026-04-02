# Match-Based Validation Report

- Generated at: 2026-04-02T07:33:26.762Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 20
- Strict patch prefix: 26.
- Completed rate: 0.6
- No viable snapshot found rate: 0.4
- Distinct selected snapshots: 12
- Distinct selected snapshot signatures: 12
- Reused selected snapshot signatures: 0
- Distinct champions covered: 18

## Rejection Reasons
- low-confidence: 96
- good-answer-too-cheap: 76
- good-answer-unresolved: 7
- good-answer-incoherent-with-champion: 5
- choice-resolution-good-answer-role-restricted: 1
- choice-resolution-insufficient-distractors: 1
- good-answer-role-restricted: 1

## Snapshot Diversity
- none: 8
- early: 5
- mid: 4
- late: 3

## Generations
- #1 cmnf200uz042y9crakzs5b6nq [26.6 tristana MID]  status=no_viable_snapshot_found snapshot=none minute=9.26 gold=1431 candidatePool=11 quality=0 failure=low-confidence
- #2 cmnf20025042n9cra09dpaeau [26.6 ashe ADC]  status=completed snapshot=21 minute=22.62 gold=1599 candidatePool=11 quality=96.48
- #3 cmnf1zymw04219cray0vt9xcz [26.6 ambessa TOP]  status=completed snapshot=9 minute=10.43 gold=1238 candidatePool=11 quality=105.6
- #4 cmnf1zxwn041q9crai8nqj1ef [26.6 varus TOP]  status=no_viable_snapshot_found snapshot=none minute=13.76 gold=2109 candidatePool=11 quality=0 failure=low-confidence
- #5 cmnf1zx2u041f9crab70wrnfn [26.2 fiora SUPPORT]  status=no_viable_snapshot_found snapshot=none minute=10.1 gold=700 candidatePool=11 quality=0 failure=low-confidence, good-answer-too-cheap
- #6 cmnf1zwgo040y9crafcfv37ev [26.5 seraphine SUPPORT]  status=completed snapshot=11 minute=11.18 gold=1257 candidatePool=11 quality=91.43
- #7 cmnf1zvbm040n9crasqzp2ty8 [26.6 karma SUPPORT]  status=no_viable_snapshot_found snapshot=none minute=8.65 gold=1355 candidatePool=11 quality=0 failure=low-confidence
- #8 cmnf1zugt040c9cra1lwvcsm8 [26.6 azir MID]  status=no_viable_snapshot_found snapshot=none minute=12.22 gold=3520 candidatePool=11 quality=0 failure=good-answer-too-cheap
- #9 cmnf1zti304019cra3hefi44x [26.6 tristana MID]  status=completed snapshot=7 minute=8.18 gold=1749 candidatePool=11 quality=94.07
- #10 cmnf1zskq03zq9crapn4pw9tt [26.6 jhin ADC]  status=completed snapshot=31 minute=28.04 gold=1531 candidatePool=11 quality=91.62
- #11 cmnf1zrqb03zf9crajx79w7a5 [26.1 jayce JUNGLE]  status=completed snapshot=12 minute=13.08 gold=1412 candidatePool=11 quality=95.67
- #12 cmnf1zr8s03z49crak8zt2odo [26.5 zoe MID]  status=no_viable_snapshot_found snapshot=none minute=10.22 gold=1427 candidatePool=11 quality=0 failure=good-answer-too-cheap
- #13 cmnf1zq3t03yt9cra82vutd1c [26.6 gwen JUNGLE]  status=completed snapshot=29 minute=27.58 gold=1262 candidatePool=11 quality=104
- #14 cmnf1zoy303yi9crafw3dr6e2 [26.6 gnar TOP]  status=no_viable_snapshot_found snapshot=none minute=9.28 gold=2092 candidatePool=11 quality=0 failure=low-confidence
- #15 cmnf1zo3q03y79cra536mnx6i [26.6 nocturne JUNGLE]  status=completed snapshot=26 minute=27.7 gold=2048 candidatePool=11 quality=100
- #16 cmnf1zn3v03xw9craukopte0e [26.6 jarvan-iv JUNGLE]  status=completed snapshot=16 minute=18.39 gold=1633 candidatePool=11 quality=88.13
- #17 cmnf1zm6103xl9cra67cjfypg [26.6 jayce TOP]  status=no_viable_snapshot_found snapshot=none minute=8.17 gold=1737 candidatePool=11 quality=0 failure=low-confidence
- #18 cmnf1zkdt03wz9cramxjdmcxk [26.6 reksai JUNGLE]  status=completed snapshot=18 minute=21.88 gold=1249 candidatePool=11 quality=96.25
- #19 cmnf1zjlz03wo9cra875a64ye [26.6 renekton TOP]  status=completed snapshot=14 minute=18.55 gold=1213 candidatePool=11 quality=93.06
- #20 cmnf1zj8903wd9craeramwyov [26.6 anivia SUPPORT]  status=completed snapshot=8 minute=10.34 gold=1684 candidatePool=11 quality=109

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 20`
