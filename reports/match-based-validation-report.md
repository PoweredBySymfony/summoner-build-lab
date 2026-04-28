# Match-Based Validation Report

- Generated at: 2026-04-28T10:26:46.398Z
- Evaluation user: xtrouche@gmail.com
- Sample size: 20
- Strict patch prefix: 26.
- Completed rate: 0.95
- No viable snapshot found rate: 0.05
- Distinct selected snapshots: 19
- Distinct selected snapshot signatures: 19
- Reused selected snapshot signatures: 0
- Distinct champions covered: 17

## Rejection Reasons
- low-confidence: 30
- choice-resolution-insufficient-distractors: 1

## Snapshot Diversity
- mid: 11
- early: 6
- late: 2
- none: 1

## Generations
- #1 cmobkt91200g69crat77lsnmc [26.8 pyke SUPPORT]  status=completed snapshot=14 minute=16.2 gold=1291 candidatePool=11 quality=90.22
- #2 cmobkt7xr00fv9cragslepd43 [26.8 ahri MID]  status=completed snapshot=16 minute=18.96 gold=1645 candidatePool=11 quality=103
- #3 cmobkt72p00fk9crawiy1sbwy [26.8 alistar SUPPORT]  status=completed snapshot=12 minute=15 gold=932 candidatePool=11 quality=91.97
- #4 cmobkt6ek00f99craauenp158 [26.8 thresh SUPPORT]  status=completed snapshot=21 minute=22.44 gold=2666 candidatePool=11 quality=96.54
- #5 cmobkt5ir00ey9cradv533hl9 [26.8 bard SUPPORT]  status=completed snapshot=12 minute=14.78 gold=1405 candidatePool=11 quality=97.49
- #6 cmobkt4ov00en9craj1rtqbqp [26.8 anivia SUPPORT]  status=completed snapshot=9 minute=11.63 gold=1303 candidatePool=11 quality=98.85
- #7 cmobkt3uh00ec9craccpd1kqq [26.8 jayce MID]  status=completed snapshot=20 minute=16.44 gold=3519 candidatePool=11 quality=91.64
- #8 cmobkt2wu00e19crag8exs15q [26.8 vi JUNGLE]  status=completed snapshot=14 minute=25.52 gold=2109 candidatePool=11 quality=101.9
- #9 cmobkt1ze00dq9craki4m9jpf [26.8 rakan SUPPORT]  status=completed snapshot=20 minute=22.45 gold=2942 candidatePool=11 quality=97.15
- #10 cmobkt14e00df9cra2lygol52 [26.8 vayne TOP]  status=completed snapshot=9 minute=15.26 gold=1592 candidatePool=11 quality=85.68
- #11 cmobkt08e00d49cranxwffwir [26.8 jayce TOP]  status=completed snapshot=11 minute=15.05 gold=1423 candidatePool=11 quality=85.75
- #12 cmobksz8500ct9crafar21xhl [26.8 nidalee SUPPORT]  status=completed snapshot=9 minute=13.6 gold=1104 candidatePool=11 quality=90.49
- #13 cmobksyez00ci9cratqjmjqk9 [26.8 bard SUPPORT]  status=completed snapshot=18 minute=21.22 gold=1249 candidatePool=11 quality=96.09
- #14 cmobksxah00c79crakmanndwj [26.8 nidalee SUPPORT]  status=completed snapshot=14 minute=22.45 gold=970 candidatePool=11 quality=89.25
- #15 cmobkswde00bw9crams3vqo62 [26.8 annie MID]  status=completed snapshot=10 minute=13.13 gold=1484 candidatePool=11 quality=100
- #16 cmobksvr800bl9cra4obb3l8f [26.8 aurora MID]  status=completed snapshot=10 minute=10.63 gold=3010 candidatePool=11 quality=103
- #17 cmobksuw700ba9craeqat2vs7 [26.8 leblanc MID]  status=completed snapshot=7 minute=9.16 gold=3220 candidatePool=11 quality=100
- #18 cmobksu1y00az9craxpsl09b1 [26.8 lulu SUPPORT]  status=no_viable_snapshot_found snapshot=none minute=n/a gold=n/a candidatePool=n/a quality=n/a failure=no-accepted-snapshot
- #19 cmobkstgw00ao9crab3r4j7uf [26.8 caitlyn ADC]  status=completed snapshot=6 minute=9.07 gold=1600 candidatePool=11 quality=95.35
- #20 cmobkssbl00ad9craqr4yfqka [26.8 ezreal ADC]  status=completed snapshot=25 minute=29.36 gold=2289 candidatePool=11 quality=97.26

## Reproduction
- `npm run ml:export-raw`
- `cd ml`
- `.\.venv\Scripts\python.exe scripts\tasks.py build-dataset`
- `.\.venv\Scripts\python.exe scripts\tasks.py train-baseline`
- `npm run audit:match-based-validation -- --sample-size 20`
