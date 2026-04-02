# Match-Based Validation Delta Report

- Generated at: 2026-04-02T07:34:01.296Z

## sample-10

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| completedRate | 0.6 | 0.4 | -0.2 |
| patch-catalog-fallback occurrences | n/a | 0 | n/a |
| top rejection reasons | good-answer-too-cheap:44, low-confidence:25, good-answer-incoherent-with-champion:5 | good-answer-too-cheap:38, low-confidence:36, good-answer-unresolved:4 | n/a |
| segments | early:0, mid:6, late:0, none:4 | early:1, mid:1, late:2, none:6 | n/a |

## sample-20

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| completedRate | n/a | 0.6 | n/a |
| patch-catalog-fallback occurrences | n/a | 0 | n/a |
| top rejection reasons | n/a | low-confidence:96, good-answer-too-cheap:76, good-answer-unresolved:7 | n/a |
| segments | n/a | early:5, mid:4, late:3, none:8 | n/a |
| gate >= 0.4 on 20 | 0.4 | 0.6 | PASS |

Decision: OK pour relancer import vers 2000

