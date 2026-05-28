# Match-Based Validation Report

- Generated at: 2026-04-23T10:43:43.914Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 1
- No viable snapshot found rate: 0
- Distinct selected snapshots: 10
- Distinct selected snapshot signatures: 10
- Reused selected snapshot signatures: 0
- Distinct champions covered: 9

## Rejection Reasons
- low-confidence: 12
- publishability-insufficient-credible-distractors: 3
- choice-resolution-good-answer-exclusive-group: 1
- good-answer-exclusive-group: 1

## Snapshot Diversity
- mid: 5
- early: 4
- late: 1

## Generations
- #1 cmobcsf2g00f91cras11zih2n [26.2 sylas MID]  status=completed snapshot=17 minute=18.47 gold=4207 candidatePool=11 quality=100
- #2 cmobcse1k00ey1craur1ytrqo [26.3 yunara ADC]  status=completed snapshot=26 minute=26.88 gold=1784 candidatePool=11 quality=103.77
- #3 cmobcscx100en1craw4pbqu6s [26.4 neeko SUPPORT]  status=completed snapshot=11 minute=9.62 gold=2774 candidatePool=11 quality=87.46
- #4 cmobcsbve00ec1cra2alahdox [26.3 jarvan-iv JUNGLE]  status=completed snapshot=18 minute=19.59 gold=1459 candidatePool=11 quality=96
- #5 cmobcqajz00e11craoedbu8kp [26.4 poppy SUPPORT]  status=completed snapshot=13 minute=10.93 gold=2388 candidatePool=11 quality=84.84
- #6 cmobco29i00dq1crarqf9a24e [26.2 twisted-fate MID]  status=completed snapshot=18 minute=21.37 gold=1317 candidatePool=11 quality=108
- #7 cmobcnuur00df1craghor1iio [26.5 rakan SUPPORT]  status=completed snapshot=12 minute=10.47 gold=2463 candidatePool=11 quality=93.2
- #8 cmobcnu8o00d41crawv4h66b2 [26.1 yunara ADC]  status=completed snapshot=13 minute=11.54 gold=1370 candidatePool=11 quality=83.55
- #9 cmobcntm900ct1crau9xq732j [26.2 yone MID]  status=completed snapshot=15 minute=15.08 gold=1447 candidatePool=11 quality=112
- #10 cmobcnt1k00ci1crako2g5chy [26.5 bard SUPPORT]  status=completed snapshot=21 minute=17.39 gold=1366 candidatePool=11 quality=100.53

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
