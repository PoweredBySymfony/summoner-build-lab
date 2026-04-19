# Match-Based Validation Report

- Generated at: 2026-04-19T11:46:01.196Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 0.8
- No viable snapshot found rate: 0.2
- Distinct selected snapshots: 8
- Distinct selected snapshot signatures: 8
- Reused selected snapshot signatures: 0
- Distinct champions covered: 9

## Rejection Reasons
- low-confidence: 17
- publishability-insufficient-credible-distractors: 4
- choice-resolution-good-answer-exclusive-group: 1
- good-answer-exclusive-group: 1

## Snapshot Diversity
- early: 3
- late: 3
- mid: 2
- none: 2

## Generations
- #1 cmnmai6eq00bqigradahjrk19 [26.3 kennen TOP]  status=no_viable_snapshot_found snapshot=none minute=10.99 gold=924 candidatePool=11 quality=0 failure=low-confidence
- #2 cmnmai5ip00bfigragxcwbv62 [26.6 bard SUPPORT]  status=completed snapshot=10 minute=10.38 gold=2824 candidatePool=11 quality=78.03
- #3 cmnmai4fl00b4igraptvqpstp [26.3 ornn TOP]  status=completed snapshot=20 minute=24.87 gold=2102 candidatePool=11 quality=108
- #4 cmnmai38b00atigraz7b8apz0 [26.6 rell SUPPORT]  status=completed snapshot=26 minute=24.12 gold=3175 candidatePool=11 quality=92.13
- #5 cmnmai24000aiigra799arnr1 [26.4 ksante TOP]  status=completed snapshot=9 minute=12.18 gold=3673 candidatePool=11 quality=92.29
- #6 cmnmai19g00a7igra52fqrmsy [26.6 bard SUPPORT]  status=completed snapshot=20 minute=17.2 gold=1309 candidatePool=11 quality=94.49
- #7 cmnmadgpd009wigranjn0cmnq [26.6 nidalee JUNGLE]  status=no_publishable_snapshot_found snapshot=none minute=10.87 gold=3475 candidatePool=11 quality=0 failure=low-confidence
- #8 cmnmadfoh009ligra4r4zgpnz [26.6 karma SUPPORT]  status=completed snapshot=27 minute=27.28 gold=1188 candidatePool=11 quality=94.91
- #9 cmnmadeld009aigrap100snt0 [26.6 jayce JUNGLE]  status=completed snapshot=19 minute=17.86 gold=1216 candidatePool=11 quality=86.59
- #10 cmnmadddb008zigraa7638vrq [26.6 akali MID]  status=completed snapshot=10 minute=12.04 gold=4077 candidatePool=11 quality=100

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
