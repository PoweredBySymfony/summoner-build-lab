# Match-Based Validation Report

- Generated at: 2026-04-23T10:50:53.169Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 20
- Strict patch prefix: 26.
- Completed rate: 0.9
- No viable snapshot found rate: 0.1
- Distinct selected snapshots: 18
- Distinct selected snapshot signatures: 18
- Reused selected snapshot signatures: 0
- Distinct champions covered: 18

## Rejection Reasons
- low-confidence: 37
- publishability-insufficient-credible-distractors: 7

## Snapshot Diversity
- mid: 9
- early: 5
- late: 4
- none: 2

## Generations
- #1 cmobd0mth00f9yorazqm1cef3 [26.1 karma SUPPORT]  status=completed snapshot=19 minute=13.68 gold=1004 candidatePool=11 quality=95.27
- #2 cmobd0m7p00eyyorawb2vwu6c [26.1 jayce JUNGLE]  status=completed snapshot=17 minute=17.08 gold=1390 candidatePool=11 quality=95.26
- #3 cmobd0lbr00enyorator7cqcp [26.1 tristana TOP]  status=completed snapshot=25 minute=28.87 gold=1610 candidatePool=11 quality=88.84
- #4 cmobd0kfl00ecyora8r8etwjw [26.1 irelia TOP]  status=completed snapshot=8 minute=10.82 gold=1151 candidatePool=11 quality=86.25
- #5 cmobd0jrr00e1yoradrnr8bgh [26.1 poppy SUPPORT]  status=completed snapshot=24 minute=20.3 gold=1455 candidatePool=11 quality=98.24
- #6 cmobd0iss00dqyoranfsp29je [26.1 alistar SUPPORT]  status=completed snapshot=14 minute=12.29 gold=1496 candidatePool=11 quality=91.39
- #7 cmobd0hnw00dfyoradm84p139 [26.1 thresh SUPPORT]  status=completed snapshot=23 minute=22.99 gold=2303 candidatePool=11 quality=93.68
- #8 cmobd0gkm00d4yorab4q3emte [26.1 lulu SUPPORT]  status=completed snapshot=13 minute=16.71 gold=1005 candidatePool=11 quality=99.8
- #9 cmobd0fin00ctyorappr5rzh1 [26.1 qiyana JUNGLE]  status=no_publishable_snapshot_found snapshot=none minute=9.43 gold=2073 candidatePool=11 quality=0 failure=publishability-insufficient-credible-distractors
- #10 cmobd0ewt00ciyorau7d50fsu [26.1 ambessa TOP]  status=completed snapshot=12 minute=15.98 gold=1403 candidatePool=11 quality=104.37
- #11 cmobd0dq800c7yorar2i786sx [26.1 rell SUPPORT]  status=completed snapshot=34 minute=29.91 gold=2441 candidatePool=11 quality=98.39
- #12 cmobd0cnj00bwyora9ebagp38 [26.1 gwen TOP]  status=completed snapshot=14 minute=15.64 gold=994 candidatePool=11 quality=92.01
- #13 cmobd0c2h00blyorac1potrqp [26.2 vladimir TOP]  status=completed snapshot=16 minute=21.6 gold=1446 candidatePool=11 quality=103.91
- #14 cmobd0b6500bayora1fbjw6k8 [26.2 zaahen TOP]  status=completed snapshot=25 minute=28.65 gold=1473 candidatePool=11 quality=103.01
- #15 cmobd0a2v00azyoraw604kcpj [26.2 akali TOP]  status=completed snapshot=12 minute=13.8 gold=3202 candidatePool=11 quality=80.9
- #16 cmobd090s00aoyorax4uk4t8z [26.2 nautilus SUPPORT]  status=completed snapshot=25 minute=20.08 gold=3360 candidatePool=11 quality=92.19
- #17 cmobd087e00adyorax3sg975k [26.2 varus TOP]  status=no_publishable_snapshot_found snapshot=none minute=11.21 gold=3715 candidatePool=11 quality=0 failure=low-confidence
- #18 cmobd07kg00a2yoraxpa5lcn9 [26.2 alistar SUPPORT]  status=completed snapshot=10 minute=10.61 gold=1151 candidatePool=11 quality=88.32
- #19 cmobd06ov009ryoratecrkiwj [26.2 ambessa TOP]  status=completed snapshot=19 minute=23.06 gold=1431 candidatePool=11 quality=94.34
- #20 cmobd05jl009gyora7k5lcnai [26.2 gangplank TOP]  status=completed snapshot=19 minute=21.64 gold=961 candidatePool=11 quality=92.46

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 20`
