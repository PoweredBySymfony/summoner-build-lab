# Match-Based Validation Report

- Generated at: 2026-04-23T12:54:11.921Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 20
- Strict patch prefix: 26.
- Completed rate: 1
- No viable snapshot found rate: 0
- Distinct selected snapshots: 20
- Distinct selected snapshot signatures: 20
- Reused selected snapshot signatures: 0
- Distinct champions covered: 18

## Rejection Reasons
- low-confidence: 41
- choice-resolution-insufficient-distractors: 1

## Snapshot Diversity
- mid: 10
- early: 7
- late: 3

## Generations
- #1 cmobcnir6008j1crapey8l0nf [26.2 camille TOP]  status=completed snapshot=12 minute=14.01 gold=1660 candidatePool=11 quality=92.74
- #2 cmobcnhqb00881cra5kc0i71h [26.7 elise SUPPORT]  status=completed snapshot=15 minute=11.87 gold=1139 candidatePool=11 quality=90.02
- #3 cmobcngro007x1cra0a9dejuy [26.1 yunara ADC]  status=completed snapshot=25 minute=24.11 gold=1844 candidatePool=11 quality=91.72
- #4 cmobcng4c007m1craoy4pmbeo [26.2 zoe MID]  status=completed snapshot=19 minute=15.34 gold=1764 candidatePool=11 quality=100
- #5 cmobcnfjh007b1crabyydwl7n [26.2 ryze TOP]  status=completed snapshot=10 minute=12.76 gold=1830 candidatePool=11 quality=85.08
- #6 cmobcneos00701crawl49abwj [26.3 mel ADC]  status=completed snapshot=8 minute=8.06 gold=1764 candidatePool=11 quality=87.1
- #7 cmobcndmw006p1crad0ljuxom [26.7 ambessa JUNGLE]  status=completed snapshot=12 minute=13.69 gold=1286 candidatePool=11 quality=86.96
- #8 cmobcncp8006e1craixtykjjv [26.3 mel MID]  status=completed snapshot=17 minute=21.18 gold=1913 candidatePool=11 quality=100
- #9 cmobcnbjm00631cralmbt9wzu [26.4 ahri MID]  status=completed snapshot=17 minute=15.09 gold=2737 candidatePool=11 quality=103
- #10 cmobcnaud005s1crafhqb1ek9 [26.3 jarvan-iv JUNGLE]  status=completed snapshot=28 minute=29.34 gold=1182 candidatePool=11 quality=100.76
- #11 cmobcn9qw005h1crayh0ej2sa [26.4 yasuo MID]  status=completed snapshot=15 minute=14.92 gold=1599 candidatePool=11 quality=108
- #12 cmobcn8v300561cra2ohpzpxx [26.3 ahri MID]  status=completed snapshot=13 minute=12.2 gold=4240 candidatePool=11 quality=100
- #13 cmobcn815004v1cracjq9kx2s [26.4 aurora MID]  status=completed snapshot=13 minute=10.45 gold=3115 candidatePool=11 quality=100
- #14 cmobcn7dy004k1craoiu3zet9 [26.7 neeko SUPPORT]  status=completed snapshot=25 minute=22.45 gold=1351 candidatePool=11 quality=91.63
- #15 cmobcn6e900491craed7da9cl [26.3 jayce TOP]  status=completed snapshot=12 minute=12.77 gold=1913 candidatePool=11 quality=108
- #16 cmobcn59h003y1crakiseg70j [26.3 sion TOP]  status=completed snapshot=17 minute=19.7 gold=1245 candidatePool=11 quality=108
- #17 cmobcn4dw003n1cralmelec5u [26.4 taliyah MID]  status=completed snapshot=19 minute=17.83 gold=3220 candidatePool=11 quality=99.82
- #18 cmobcn3hb003c1cra1ynmlgh7 [26.7 leona SUPPORT]  status=completed snapshot=34 minute=31.31 gold=2667 candidatePool=11 quality=91.83
- #19 cmobcn2k500311craoipi849g [26.3 twisted-fate MID]  status=completed snapshot=15 minute=16.72 gold=2250 candidatePool=11 quality=100
- #20 cmobcn1y0002q1crabte4oewp [26.4 corki ADC]  status=completed snapshot=20 minute=22.36 gold=2169 candidatePool=11 quality=90.17

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 20`
