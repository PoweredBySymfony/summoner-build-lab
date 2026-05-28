# Competitive Seed Fusion Audit

Date: 2026-04-23

## Scope

Audit of the available competitive seed candidates and their effect on volume and coverage:

- `data/seeds/competitive-seeds-2026.json`
- `data/seeds/competitive-seeds-2026-v3.json`
- `data/seeds/competitive-seeds-2026-v4.json`

## Findings

### Canonical baseline `v1`

- `324` seeds
- `pro = 94`
- `elite = 230`
- `resolved = 280 / 324 = 86.42%`

### Pro-only expansion candidate `v3`

- `307` seeds
- `pro = 307`
- `elite = 0`
- `resolved = 146 / 307 = 47.56%`

### Local fusion candidate `v4`

- `537` seeds
- `pro = 307`
- `elite = 230`
- `resolved = 376 / 537 = 70.02%`
- `94` overlapping identities removed during dedupe

## Interpretation

- `v3` alone is too lossy to become the canonical seed set.
- `v1` remains the highest-quality canonical set for resolution.
- `v4` is the best volume candidate because it preserves elite coverage while adding a large pro-only increment.

## Validation

- Preflight on `v4` passed.
- One controlled campaign stage on `v4` passed the quality gate and stopped on plateau.
- `completedRate = 0.9`
- `noViableSnapshotFoundRate = 0.1`

## Operational Fixes

- `server/src/lib/riot/competitiveSeeds.ts`
  - stop the seed prep job immediately on Riot failure instead of continuing platform by platform
- `scripts/importCompetitiveMatches.ts`
  - add `--max-seed-discovery-failures`
  - stop discovery after a small number of consecutive Riot failures

## Recommendation

- Keep `v1` as the safety baseline.
- Use `v4` as the next volume candidate.
- Do not promote `v4` to default until a larger controlled run confirms it increases actual imports without degrading quality.
