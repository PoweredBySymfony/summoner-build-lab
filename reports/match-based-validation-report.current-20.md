# Match-Based Validation Report

- Generated at: 2026-04-19T15:12:33.535Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 20
- Strict patch prefix: 26.
- Completed rate: 0.8
- No viable snapshot found rate: 0.2
- Distinct selected snapshots: 16
- Distinct selected snapshot signatures: 16
- Reused selected snapshot signatures: 0
- Distinct champions covered: 13

## Rejection Reasons
- low-confidence: 46
- publishability-insufficient-credible-distractors: 3
- choice-resolution-insufficient-distractors: 1

## Snapshot Diversity
- early: 9
- mid: 6
- none: 4
- late: 1

## Generations
- #1 cmo5wc6zh0031dcraai3rz7tv [26.4 aurora TOP]  status=no_viable_snapshot_found snapshot=none minute=9.4 gold=1494 candidatePool=11 quality=0 failure=low-confidence
- #2 cmo5wc5wb002qdcrag3exkl2s [26.4 rumble TOP]  status=completed snapshot=8 minute=10.43 gold=1384 candidatePool=11 quality=105.83
- #3 cmo5wc52r002fdcrasobq4xv4 [26.4 darius TOP]  status=completed snapshot=13 minute=14.51 gold=1848 candidatePool=11 quality=101.02
- #4 cmo5wc42m0024dcraeo6x8bpg [26.4 kennen TOP]  status=completed snapshot=11 minute=10.34 gold=1271 candidatePool=11 quality=99.22
- #5 cmo5wc37d001tdcrajhttkcx6 [26.4 rumble TOP]  status=completed snapshot=11 minute=13.91 gold=3286 candidatePool=11 quality=94.41
- #6 cmo5wc25y001idcrae4g5pwe6 [26.4 renekton TOP]  status=completed snapshot=13 minute=15.26 gold=1634 candidatePool=11 quality=108
- #7 cmo5wc11f0017dcrakcjxdp7c [26.4 yorick TOP]  status=completed snapshot=7 minute=8.5 gold=1825 candidatePool=11 quality=97.64
- #8 cmo5wc08e000wdcra42w2vydc [26.4 rumble TOP]  status=completed snapshot=11 minute=11.94 gold=3026 candidatePool=11 quality=91.21
- #9 cmo5wbzfg000ldcralsfq9nw5 [26.4 yorick TOP]  status=no_viable_snapshot_found snapshot=none minute=12.39 gold=4600 candidatePool=11 quality=0 failure=low-confidence
- #10 cmo5wbyic000adcrajvr55v1o [26.4 fizz JUNGLE]  status=completed snapshot=9 minute=9.73 gold=3794 candidatePool=11 quality=91.86
- #11 cmo5w7ssc003174raqyqyuje9 [26.4 vi JUNGLE]  status=no_viable_snapshot_found snapshot=none minute=14.57 gold=2392 candidatePool=11 quality=0 failure=low-confidence
- #12 cmo5w7rxg002q74rabe4hg69y [26.4 vi JUNGLE]  status=completed snapshot=12 minute=15.25 gold=1617 candidatePool=11 quality=93.67
- #13 cmo5w7qw9002f74rauhy62xwn [26.4 jax TOP]  status=completed snapshot=12 minute=16.61 gold=1764 candidatePool=11 quality=102.42
- #14 cmo5w7pwu002474ranv07i1d9 [26.4 ambessa TOP]  status=completed snapshot=8 minute=12.5 gold=1313 candidatePool=11 quality=95.86
- #15 cmo5w7p1k001t74raqp4u1ewc [26.4 rumble TOP]  status=no_viable_snapshot_found snapshot=none minute=10.62 gold=1771 candidatePool=11 quality=0 failure=low-confidence
- #16 cmo5w7o72001i74raronapa0s [26.4 gnar TOP]  status=completed snapshot=15 minute=19.26 gold=1285 candidatePool=11 quality=85.81
- #17 cmo5w7nbm001774ra8t8p97am [26.4 ksante TOP]  status=completed snapshot=7 minute=13.46 gold=2040 candidatePool=11 quality=100.91
- #18 cmo5w7mi6000w74raghp58jri [26.4 ambessa TOP]  status=completed snapshot=12 minute=19.63 gold=3315 candidatePool=11 quality=87.79
- #19 cmo5w7ln1000l74ra17j2n2uv [26.4 ryze MID]  status=completed snapshot=12 minute=11.68 gold=2704 candidatePool=11 quality=103
- #20 cmo5w7kt6000a74rabv182dzk [26.4 ambessa TOP]  status=completed snapshot=21 minute=28.39 gold=1203 candidatePool=11 quality=92.91

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 20`
