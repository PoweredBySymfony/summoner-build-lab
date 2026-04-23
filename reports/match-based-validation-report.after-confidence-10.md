# Match-Based Validation Report

- Generated at: 2026-04-19T15:16:24.454Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 10
- Strict patch prefix: 26.
- Completed rate: 0.7
- No viable snapshot found rate: 0.3
- Distinct selected snapshots: 7
- Distinct selected snapshot signatures: 7
- Reused selected snapshot signatures: 0
- Distinct champions covered: 5

## Rejection Reasons
- low-confidence: 18
- publishability-insufficient-credible-distractors: 1

## Snapshot Diversity
- early: 5
- none: 3
- mid: 2

## Generations
- #1 cmo5ul3jb002424raxotnquz0 [26.4 jayce TOP]  status=completed snapshot=5 minute=9.8 gold=2947 candidatePool=11 quality=95
- #2 cmo5ul2qq001t24rae323pxbt [26.4 zaahen TOP]  status=no_publishable_snapshot_found snapshot=none minute=9.25 gold=1387 candidatePool=11 quality=0 failure=low-confidence
- #3 cmo5ul1uy001i24ra6ekkgkcv [26.4 pantheon SUPPORT]  status=completed snapshot=12 minute=10.28 gold=1275 candidatePool=11 quality=95.26
- #4 cmo5ul0qp001724ra06vx864t [26.4 zaahen TOP]  status=completed snapshot=11 minute=11.79 gold=1310 candidatePool=11 quality=105.18
- #5 cmo5ul02v000w24ra3s9vc5i9 [26.4 gwen TOP]  status=completed snapshot=14 minute=15.26 gold=3478 candidatePool=11 quality=85.41
- #6 cmo5ukyy0000l24raftdh4r8y [26.4 jayce TOP]  status=completed snapshot=10 minute=10.76 gold=1306 candidatePool=11 quality=95
- #7 cmo5uky0z000a24rabt1bwx8q [26.4 gwen TOP]  status=completed snapshot=12 minute=14.09 gold=1647 candidatePool=11 quality=91.39
- #8 cmo5tpkrh00ciw0raqtgstrtd [26.5 jayce TOP]  status=no_publishable_snapshot_found snapshot=none minute=10.8 gold=2825 candidatePool=11 quality=0 failure=low-confidence
- #9 cmo5tpjxl00c7w0ra66md2s3v [26.5 kennen TOP]  status=no_publishable_snapshot_found snapshot=none minute=9.35 gold=3460 candidatePool=11 quality=0 failure=low-confidence
- #10 cmo5tpj9100bww0rai3n4kd23 [26.5 pantheon SUPPORT]  status=completed snapshot=13 minute=10.43 gold=3719 candidatePool=11 quality=90.26

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 10`
