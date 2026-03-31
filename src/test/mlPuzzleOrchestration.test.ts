import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mlPuzzleGenerationServiceTestables } from "../../server/src/services/mlPuzzleGenerationService";

function createSnapshotCandidate(input: {
  snapshotIndex: number;
  minute: number;
  currentItems: string[];
  goldAvailable: number;
  relevanceScore?: number;
}) {
  return {
    snapshotIndex: input.snapshotIndex,
    rawPurchaseIndex: input.snapshotIndex,
    snapshot: {
      patch: "16.6",
      championSlug: "jinx",
      role: Role.ADC,
      goldAvailable: input.goldAvailable,
      level: 11,
      kills: 4,
      deaths: 2,
      assists: 5,
      cs: 120,
      timestampMinutes: input.minute,
      currentItems: input.currentItems,
      allyFrontlineCount: 2,
      allyMagicDamageCount: 2,
      allyPhysicalDamageCount: 2,
      allySupportCount: 1,
      enemyFrontlineCount: 2,
      enemyMagicDamageCount: 2,
      enemyPhysicalDamageCount: 3,
      enemySupportCount: 1,
    },
    scenario: {
      currentBuild: input.currentItems,
      allyTeam: [],
      enemyTeam: [],
    },
    relevanceScore: input.relevanceScore ?? 20,
  };
}

function createAcceptedAttempt(input: {
  snapshotIndex: number;
  qualityScore: number;
  lowConfidence?: boolean;
}) {
  return {
    status: "accepted" as const,
    snapshotIndex: input.snapshotIndex,
    rawPurchaseIndex: input.snapshotIndex,
    snapshot: createSnapshotCandidate({
      snapshotIndex: input.snapshotIndex,
      minute: 18 + input.snapshotIndex,
      currentItems: [`item-${input.snapshotIndex}`],
      goldAvailable: 1800,
    }).snapshot,
    scenario: {
      currentBuild: [],
      allyTeam: [],
      enemyTeam: [],
    },
    payload: {} as never,
    prediction: {
      model_ready: true,
      predicted_item_slug: "item-a",
      confidence: 0.55,
      candidate_pool_size: 9,
      top_k_predictions: [],
      model_version: "ranking-v1",
      message: "ok",
    },
    seed: {
      goodAnswer: "item-a",
      distractors: ["item-b", "item-c", "item-d"],
      difficulty: "medium" as const,
      lowConfidence: Boolean(input.lowConfidence),
      confidenceScore: input.lowConfidence ? 0.31 : 0.62,
      confidenceGap: input.lowConfidence ? 0.03 : 0.16,
      candidatePoolSize: 9,
    },
    resolvedChoices: {} as never,
    businessRules: {
      debug: {
        candidatePoolSizeAfterFallback: 9,
        goodAnswerViolations: [],
      },
    } as never,
    qualityScore: input.qualityScore,
    variationSeed: `seed-${input.snapshotIndex}`,
    choiceSignature: `sig-${input.snapshotIndex}`,
    debugSummary: {
      snapshotIndex: input.snapshotIndex,
      snapshotMinute: 18 + input.snapshotIndex,
      patch: "16.6",
      goldAvailable: 1800,
      rawCandidatePoolSize: 9,
      filteredCandidatePoolSize: 9,
      goodAnswer: "item-a",
      qualityScore: input.qualityScore,
      rejectionReasons: [],
      lowConfidence: Boolean(input.lowConfidence),
      confidenceScore: input.lowConfidence ? 0.31 : 0.62,
      confidenceGap: input.lowConfidence ? 0.03 : 0.16,
    },
  };
}

function createRejectedAttempt(snapshotIndex: number, reason: string) {
  return {
    status: "rejected" as const,
    snapshotIndex,
    rawPurchaseIndex: snapshotIndex,
    snapshot: createSnapshotCandidate({
      snapshotIndex,
      minute: 12 + snapshotIndex,
      currentItems: [`item-${snapshotIndex}`],
      goldAvailable: 1000,
    }).snapshot,
    payload: {} as never,
    prediction: null,
    seed: null,
    rejectionReasons: [reason],
    debugSummary: {
      snapshotIndex,
      snapshotMinute: 12 + snapshotIndex,
      patch: "16.6",
      goldAvailable: 1000,
      rawCandidatePoolSize: 3,
      filteredCandidatePoolSize: 2,
      goodAnswer: null,
      qualityScore: 0,
      rejectionReasons: [reason],
      lowConfidence: false,
      confidenceScore: 0,
      confidenceGap: 0,
    },
  };
}

describe("mlPuzzleGenerationService orchestration", () => {
  it("keeps only the best-ranked distinct snapshots", () => {
    const snapshots = [
      createSnapshotCandidate({ snapshotIndex: 0, minute: 17, currentItems: ["a", "b"], goldAvailable: 1700, relevanceScore: 40 }),
      createSnapshotCandidate({ snapshotIndex: 1, minute: 18, currentItems: ["a", "b"], goldAvailable: 1750, relevanceScore: 39 }),
      createSnapshotCandidate({ snapshotIndex: 2, minute: 24, currentItems: ["a", "c", "d"], goldAvailable: 2200, relevanceScore: 34 }),
    ];

    const result = mlPuzzleGenerationServiceTestables.dedupeAndRankSnapshots(snapshots);

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.snapshotIndex)).toEqual([0, 2]);
  });

  it("prefers the best non-low-confidence snapshot when several attempts exist", () => {
    const selection = mlPuzzleGenerationServiceTestables.selectBestAttempt({
      attempts: [
        createRejectedAttempt(0, "low-confidence"),
        createAcceptedAttempt({ snapshotIndex: 1, qualityScore: 72 }),
        createAcceptedAttempt({ snapshotIndex: 2, qualityScore: 81 }),
      ],
      allowLowConfidenceDraft: false,
    });

    expect(selection.selectedAttempt?.snapshotIndex).toBe(2);
    expect(selection.draft).toBe(false);
  });

  it("returns no selected snapshot when every attempt is rejected in standard mode", () => {
    const selection = mlPuzzleGenerationServiceTestables.selectBestAttempt({
      attempts: [
        createRejectedAttempt(0, "candidate-pool-too-small"),
        createRejectedAttempt(1, "good-answer-too-cheap"),
      ],
      allowLowConfidenceDraft: false,
    });

    expect(selection.selectedAttempt).toBeNull();
    expect(selection.draft).toBe(false);
  });

  it("keeps admin/test compatibility by selecting the best low-confidence draft when allowed", () => {
    const selection = mlPuzzleGenerationServiceTestables.selectBestAttempt({
      attempts: [
        createAcceptedAttempt({ snapshotIndex: 0, qualityScore: 58, lowConfidence: true }),
        createAcceptedAttempt({ snapshotIndex: 1, qualityScore: 63, lowConfidence: true }),
      ],
      allowLowConfidenceDraft: true,
    });

    expect(selection.selectedAttempt?.snapshotIndex).toBe(1);
    expect(selection.draft).toBe(true);
  });

  it("scores mid-game snapshots above weak early snapshots", () => {
    const early = mlPuzzleGenerationServiceTestables.scoreSnapshotCandidate(
      createSnapshotCandidate({ snapshotIndex: 0, minute: 6, currentItems: ["dague"], goldAvailable: 600 }).snapshot,
    );
    const mid = mlPuzzleGenerationServiceTestables.scoreSnapshotCandidate(
      createSnapshotCandidate({ snapshotIndex: 1, minute: 18, currentItems: ["item-a", "item-b"], goldAvailable: 1900 }).snapshot,
    );

    expect(mid).toBeGreaterThan(early);
  });
});
