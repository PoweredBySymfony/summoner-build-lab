import { describe, expect, it } from "vitest";

import {
  buildCompetitiveIngestionReport,
  buildCompetitiveMatchQueue,
  determineOpenedFallbackTiers,
  evaluateCompetitiveMatchPolicy,
  resolveCompetitiveIngestionPolicy,
  scoreCompetitiveMatch,
  type CompetitiveDiscoveredMatch,
  type CompetitiveIngestionPolicyConfig,
} from "../../server/src/lib/riot/competitiveIngestion";

const policy = resolveCompetitiveIngestionPolicy({
  version: 1,
  policyName: "test-policy",
  mode: "recent_preferred_with_controlled_fallback",
  preferredPatchPrefixes: ["26."],
  acceptedAdjacentPatchPrefixes: ["26.6", "26.5", "26.4", "26.3", "26.2"],
  preferredQueues: [420],
  acceptedFallbackQueues: [440],
  seasonWindowStart: "2026-01-01T00:00:00.000Z",
  seasonWindowEnd: null,
  autoEnrichEliteIfNeeded: true,
  allowFallbackTier5: false,
  fallbackCaps: {
    maxAdjacentPatchShare: 1,
    maxNonProShare: 1,
    maxImportsByTier: {},
  },
  priorityTiers: [
    {
      id: "tier1",
      enabled: true,
      sourceBuckets: ["pro"],
      patchBuckets: ["exact_target_patch"],
      queueBuckets: ["preferred_queue"],
      acceptedReason: "pro-exact-target",
      fallbackReason: null,
    },
    {
      id: "tier2",
      enabled: true,
      sourceBuckets: ["pro"],
      patchBuckets: ["adjacent_recent_patch"],
      queueBuckets: ["preferred_queue", "fallback_queue"],
      acceptedReason: "pro-adjacent-target",
      fallbackReason: "pro_adjacent_patch",
    },
    {
      id: "tier3",
      enabled: true,
      sourceBuckets: ["elite"],
      patchBuckets: ["exact_target_patch"],
      queueBuckets: ["preferred_queue"],
      acceptedReason: "elite-exact-target",
      fallbackReason: "elite_exact_patch",
    },
    {
      id: "tier4",
      enabled: true,
      sourceBuckets: ["elite"],
      patchBuckets: ["adjacent_recent_patch"],
      queueBuckets: ["preferred_queue", "fallback_queue"],
      acceptedReason: "elite-adjacent-target",
      fallbackReason: "elite_adjacent_patch",
    },
    {
      id: "tier5",
      enabled: false,
      sourceBuckets: ["fallback"],
      patchBuckets: ["exact_target_patch"],
      queueBuckets: ["preferred_queue", "fallback_queue"],
      acceptedReason: "fallback-exact-target",
      fallbackReason: "fallback_exact_patch",
    },
  ],
  whyZeroBefore: "strict filter",
  whatWasRelaxed: "adjacent + elite",
} satisfies CompetitiveIngestionPolicyConfig);

function makeMatch(overrides: Partial<CompetitiveDiscoveredMatch>): CompetitiveDiscoveredMatch {
  return {
    matchId: "match",
    seedKey: "seed",
    playerName: "Player",
    team: "Team",
    league: "LCK",
    competition: "LCK 2026",
    role: "MID",
    priorityTier: "pro",
    priorityScore: 100,
    platform: null,
    cluster: "asia",
    queueId: 420,
    patch: "26.1",
    gameCreationAt: "2026-03-10T00:00:00.000Z",
    acceptedByPolicy: true,
    acceptedReason: "pro-exact-target",
    rejectionReason: null,
    fallbackReason: null,
    policyMode: policy.mode,
    policyBucket: "exact_target_patch",
    queueBucket: "preferred_queue",
    sourceBucket: "pro",
    priorityBand: "tier1",
    matchPriorityScore: 1000,
    ...overrides,
  };
}

describe("competitiveIngestion", () => {
  it("classifies canonical 26.x patches as exact target and still rejects invalid queues", () => {
    expect(
      evaluateCompetitiveMatchPolicy(
        {
          patch: "26.1",
          queueId: 420,
          gameCreationAt: new Date("2026-03-01T00:00:00.000Z"),
          priorityTier: "pro",
        },
        policy,
      ),
    ).toMatchObject({
      accepted: true,
      patchBucket: "exact_target_patch",
      queueBucket: "preferred_queue",
      priorityBand: "tier1",
    });

    expect(
      evaluateCompetitiveMatchPolicy(
        {
          patch: "26.6",
          queueId: 420,
          gameCreationAt: new Date("2026-03-01T00:00:00.000Z"),
          priorityTier: "pro",
        },
        policy,
      ),
    ).toMatchObject({
      accepted: true,
      patchBucket: "exact_target_patch",
      priorityBand: "tier1",
      fallbackReason: null,
    });

    expect(
      evaluateCompetitiveMatchPolicy(
        {
          patch: "26.6",
          queueId: 450,
          gameCreationAt: new Date("2026-03-01T00:00:00.000Z"),
          priorityTier: "elite",
        },
        policy,
      ),
    ).toMatchObject({
      accepted: false,
      queueBucket: "out_of_policy_queue",
      rejectionReason: "queue-not-allowed",
    });
  });

  it("scores pro exact target above elite exact target", () => {
    const proScore = scoreCompetitiveMatch({
      priorityTier: "pro",
      priorityScore: 100,
      patch: "26.2",
      gameCreationAt: new Date("2026-03-15T00:00:00.000Z"),
      patchBucket: "exact_target_patch",
      queueBucket: "preferred_queue",
      priorityBand: "tier1",
    });
    const eliteScore = scoreCompetitiveMatch({
      priorityTier: "elite",
      priorityScore: 80,
      patch: "26.2",
      gameCreationAt: new Date("2026-03-15T00:00:00.000Z"),
      patchBucket: "exact_target_patch",
      queueBucket: "preferred_queue",
      priorityBand: "tier3",
    });

    expect(proScore).toBeGreaterThan(eliteScore);
  });

  it("opens fallback tiers sequentially when tier1 volume is insufficient", () => {
    const plan = determineOpenedFallbackTiers({
      matches: [
        makeMatch({ matchId: "A" }),
        makeMatch({
          matchId: "B",
          patch: "25.9",
          acceptedByPolicy: false,
          acceptedReason: null,
          rejectionReason: "patch-not-allowed",
          policyBucket: "out_of_target_patch",
          priorityBand: null,
          fallbackReason: null,
        }),
        makeMatch({
          matchId: "C",
          priorityTier: "elite",
          sourceBucket: "elite",
          priorityBand: "tier3",
          priorityScore: 80,
        }),
      ],
      targetUniqueMatches: 3,
      policy,
    });

    expect(plan.activeBands).toEqual(["tier1", "tier2", "tier3", "tier4"]);
    expect(plan.openedFallbackTiers).toEqual([
      "fallback-opened: pro_adjacent_patch",
      "fallback-opened: elite_exact_patch",
      "fallback-opened: elite_adjacent_patch",
    ]);
  });

  it("builds a queue by tier order without jumping directly to deeper fallbacks", () => {
    const queue = buildCompetitiveMatchQueue({
      matches: [
        makeMatch({ matchId: "A", league: "LCK", priorityBand: "tier1" }),
        makeMatch({
          matchId: "C",
          priorityTier: "elite",
          sourceBucket: "elite",
          priorityBand: "tier3",
          priorityScore: 80,
        }),
      ],
      targetUniqueMatches: 3,
      policy,
      activeBands: ["tier1", "tier3"],
    });

    expect(queue.map((entry) => entry.matchId)).toEqual(["A", "C"]);
  });

  it("reports imported patch buckets and source tiers clearly", () => {
    const report = buildCompetitiveIngestionReport({
      persistedRows: [
        {
          patch: "26.1",
          queueId: 420,
          timelineMissingReason: null,
          gameCreationAt: new Date("2026-03-01T00:00:00.000Z"),
          timelineFetchedAt: new Date("2026-03-01T00:05:00.000Z"),
          targetRole: "ADC",
          sourceKind: "PRO_SEED",
          sourceLeague: "LCK",
          sourceCompetition: "LCK 2026",
          sourceRegion: "KR",
          priorityTier: "pro",
          patchBucket: "exact_target_patch",
          queueBucket: "preferred_queue",
          priorityBand: "tier1",
        },
        {
          patch: "25.9",
          queueId: 440,
          timelineMissingReason: null,
          gameCreationAt: new Date("2026-03-02T00:00:00.000Z"),
          timelineFetchedAt: new Date("2026-03-02T00:05:00.000Z"),
          targetRole: "MID",
          sourceKind: "ELITE_SEED",
          sourceLeague: "Riot Ranked Ladder",
          sourceCompetition: "KR CHALLENGER 2026",
          sourceRegion: "KR",
          priorityTier: "elite",
          patchBucket: "out_of_target_patch",
          queueBucket: "fallback_queue",
          priorityBand: "tier4",
        },
      ],
      discoveredMatches: [
        makeMatch({ matchId: "A" }),
        makeMatch({
          matchId: "B",
          priorityTier: "elite",
          sourceBucket: "elite",
          priorityBand: "tier4",
          patch: "25.9",
          acceptedByPolicy: false,
          acceptedReason: null,
          rejectionReason: "patch-not-allowed",
          policyBucket: "out_of_target_patch",
          queueId: 440,
          queueBucket: "fallback_queue",
        }),
      ],
      discoveries: [
        {
          seedKey: "seed",
          playerName: "Player",
          team: "Team",
          league: "LCK",
          competition: "LCK 2026",
          role: "MID",
          priorityTier: "pro",
          priorityScore: 100,
          puuid: "puuid",
          region: "asia",
          matchIds: ["A", "B"],
        },
      ],
      resolvedSeeds: [
        {
          playerName: "Player",
          team: "Team",
          league: "LCK",
          competition: "LCK 2026",
          role: "MID",
          region: "KR",
          riotId: "player#KR1",
          riotIdCandidates: [],
          puuid: "puuid",
          priorityTier: "pro",
          priorityScore: 100,
          discoverySource: "leaguepedia",
          seedSetVersion: "v1",
          platformHint: "kr",
          cluster: "asia",
          season: "2026",
          sourceTournamentDate: "2026-01-01",
          resolutionStatus: "resolved",
          resolutionError: null,
          resolutionSource: "seed-riot-id",
          resolvedRiotId: "player#KR1",
        },
      ],
      failedMatches: [],
      openedFallbackTiers: ["fallback-opened: pro_adjacent_patch"],
      whyZeroBefore: "strict filter",
      whatWasRelaxed: "adjacent + elite",
    });

    expect(report.matchesImportedExactTargetPatch).toBe(1);
    expect(report.matchesImportedAdjacentRecentPatch).toBe(0);
    expect(report.matchesImportedOutOfTargetPatch).toBe(1);
    expect(report.matchesImportedPro).toBe(1);
    expect(report.matchesImportedElite).toBe(1);
    expect(report.fallbackActivations).toEqual(["fallback-opened: pro_adjacent_patch"]);
  });
});
