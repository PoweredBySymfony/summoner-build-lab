# Match-Based Validation Report

- Generated at: 2026-04-23T10:30:43.324Z
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
- low-confidence: 15

## Snapshot Diversity
- early: 5
- late: 3
- mid: 2

## Generations
- #1 cmobcbvyu00f9egrap1pusaf7 [26.3 vi JUNGLE]  status=completed snapshot=30 minute=28.36 gold=1135 candidatePool=11 quality=102.64
- #2 cmobcbv0z00eyegra1xyeoxdt [26.3 ambessa TOP]  status=completed snapshot=10 minute=13.81 gold=1239 candidatePool=11 quality=108.75
- #3 cmobcbueq00enegran4ldr212 [26.3 gwen TOP]  status=completed snapshot=11 minute=12.19 gold=3579 candidatePool=11 quality=85.86
- #4 cmobcbtl600ecegrauminbgzn [26.3 rumble TOP]  status=completed snapshot=14 minute=10.83 gold=1403 candidatePool=11 quality=84.94
- #5 cmobcbsxz00e1egraktxonxnn [26.3 jayce TOP]  status=completed snapshot=10 minute=12.4 gold=1580 candidatePool=11 quality=98.34
- #6 cmobcbsbh00dqegraf6xozpuc [26.3 ksante TOP]  status=completed snapshot=20 minute=29.46 gold=1330 candidatePool=11 quality=86.96
- #7 cmobcbrao00dfegra1roc7u8d [26.3 ambessa JUNGLE]  status=completed snapshot=19 minute=22.06 gold=1600 candidatePool=11 quality=89.34
- #8 cmobcbqcs00d4egraoba5yz5l [26.3 rumble TOP]  status=completed snapshot=16 minute=18.27 gold=1978 candidatePool=11 quality=95.47
- #9 cmobcbpmc00ctegraixn8130f [26.3 viego JUNGLE]  status=completed snapshot=23 minute=25.17 gold=1563 candidatePool=11 quality=100.29
- #10 cmobcbosw00ciegraco4ktqgv [26.3 kennen TOP]  status=completed snapshot=10 minute=9.85 gold=1119 candidatePool=11 quality=95.31

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
