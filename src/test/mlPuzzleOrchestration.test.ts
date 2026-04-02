import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mlPuzzleGenerationServiceTestables } from "../../server/src/services/mlPuzzleGenerationService";

function createPreviousSnapshotEntry(input: { snapshotIndex: number; snapshotMinute: number; signature?: string }) {
  return {
    snapshotIndex: input.snapshotIndex,
    snapshotMinute: input.snapshotMinute,
    key: `${input.snapshotIndex}:${input.snapshotMinute.toFixed(2)}`,
    signature: input.signature ?? `ADC::${input.snapshotMinute.toFixed(2)}::1800::item-${input.snapshotIndex}`,
    createdAt: new Date("2026-04-02T08:00:00.000Z"),
  };
}

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
      snapshotSignature: `ADC::${18 + input.snapshotIndex}.00::1800::item-${input.snapshotIndex}`,
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
      snapshotSignature: `ADC::${12 + snapshotIndex}.00::1000::item-${snapshotIndex}`,
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

  it("preserves segment coverage before filling the global snapshot cap", () => {
    const snapshots = [
      createSnapshotCandidate({ snapshotIndex: 0, minute: 10.5, currentItems: ["a"], goldAvailable: 700, relevanceScore: 28 }),
      createSnapshotCandidate({ snapshotIndex: 1, minute: 11.2, currentItems: ["b"], goldAvailable: 760, relevanceScore: 27 }),
      createSnapshotCandidate({ snapshotIndex: 2, minute: 15.4, currentItems: ["c", "d"], goldAvailable: 1400, relevanceScore: 95 }),
      createSnapshotCandidate({ snapshotIndex: 3, minute: 16.1, currentItems: ["e", "f"], goldAvailable: 1450, relevanceScore: 93 }),
      createSnapshotCandidate({ snapshotIndex: 4, minute: 17.8, currentItems: ["g", "h"], goldAvailable: 1500, relevanceScore: 90 }),
      createSnapshotCandidate({ snapshotIndex: 5, minute: 19.4, currentItems: ["i", "j"], goldAvailable: 1620, relevanceScore: 88 }),
      createSnapshotCandidate({ snapshotIndex: 6, minute: 25.2, currentItems: ["k", "l", "m"], goldAvailable: 2100, relevanceScore: 32 }),
    ];

    const result = mlPuzzleGenerationServiceTestables.dedupeAndRankSnapshots(snapshots);

    expect(result.some((entry) => entry.snapshotIndex === 0 || entry.snapshotIndex === 1)).toBe(true);
    expect(result.some((entry) => entry.snapshotIndex === 6)).toBe(true);
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

  it("maps snapshots into early, mid and late segments with stable boundaries", () => {
    expect(mlPuzzleGenerationServiceTestables.getSnapshotSegment(8)).toBe("early");
    expect(mlPuzzleGenerationServiceTestables.getSnapshotSegment(13.99)).toBe("early");
    expect(mlPuzzleGenerationServiceTestables.getSnapshotSegment(14)).toBe("mid");
    expect(mlPuzzleGenerationServiceTestables.getSnapshotSegment(22.99)).toBe("mid");
    expect(mlPuzzleGenerationServiceTestables.getSnapshotSegment(23)).toBe("late");
    expect(mlPuzzleGenerationServiceTestables.getSnapshotSegment(32)).toBe("late");
    expect(mlPuzzleGenerationServiceTestables.getSnapshotSegment(7.99)).toBeNull();
  });

  it("reconstructs gold before purchases when multiple buys happen in the same frame", () => {
    const goldBeforeFirstPurchase = mlPuzzleGenerationServiceTestables.calculateGoldBeforePurchaseFromFrame({
      events: [
        { type: "ITEM_PURCHASED", participantId: 1, itemId: 1001 },
        { type: "ITEM_PURCHASED", participantId: 1, itemId: 2003 },
      ],
      participantId: 1,
      purchaseEventIndex: 0,
      endingGold: 150,
      itemGoldIndex: new Map([
        [1001, { goldTotal: 300, goldSell: 210 }],
        [2003, { goldTotal: 50, goldSell: 20 }],
      ]),
    });
    const goldBeforeSecondPurchase = mlPuzzleGenerationServiceTestables.calculateGoldBeforePurchaseFromFrame({
      events: [
        { type: "ITEM_PURCHASED", participantId: 1, itemId: 1001 },
        { type: "ITEM_PURCHASED", participantId: 1, itemId: 2003 },
      ],
      participantId: 1,
      purchaseEventIndex: 1,
      endingGold: 150,
      itemGoldIndex: new Map([
        [1001, { goldTotal: 300, goldSell: 210 }],
        [2003, { goldTotal: 50, goldSell: 20 }],
      ]),
    });

    expect(goldBeforeFirstPurchase).toBe(500);
    expect(goldBeforeSecondPurchase).toBe(200);
  });

  it("selects up to one high-quality published snapshot per segment", () => {
    const selection = mlPuzzleGenerationServiceTestables.selectAttemptsForSeries({
      attempts: [
        {
          ...createAcceptedAttempt({ snapshotIndex: 0, qualityScore: 70 }),
          snapshot: {
            ...createAcceptedAttempt({ snapshotIndex: 0, qualityScore: 70 }).snapshot,
            timestampMinutes: 10.5,
          },
        },
        {
          ...createAcceptedAttempt({ snapshotIndex: 1, qualityScore: 82 }),
          snapshot: {
            ...createAcceptedAttempt({ snapshotIndex: 1, qualityScore: 82 }).snapshot,
            timestampMinutes: 18.2,
          },
        },
        {
          ...createAcceptedAttempt({ snapshotIndex: 2, qualityScore: 76 }),
          snapshot: {
            ...createAcceptedAttempt({ snapshotIndex: 2, qualityScore: 76 }).snapshot,
            timestampMinutes: 27.4,
          },
        },
      ],
      allowLowConfidenceDraft: false,
      previousSnapshots: [],
    });

    expect(selection.draft).toBe(false);
    expect(selection.primaryAttempt?.snapshotIndex).toBe(1);
    expect(selection.selectedAttempts.map((attempt) => attempt.snapshotIndex)).toEqual([1, 0, 2]);
    expect(selection.segmentSummaries.map((entry) => entry.selectedSnapshotIndex)).toEqual([0, 1, 2]);
  });

  it("avoids re-serving the exact same snapshot when another candidate exists in the segment", () => {
    const selection = mlPuzzleGenerationServiceTestables.selectAttemptsForSeries({
      attempts: [
        {
          ...createAcceptedAttempt({ snapshotIndex: 0, qualityScore: 84 }),
          snapshot: {
            ...createAcceptedAttempt({ snapshotIndex: 0, qualityScore: 84 }).snapshot,
            timestampMinutes: 18.2,
          },
        },
        {
          ...createAcceptedAttempt({ snapshotIndex: 1, qualityScore: 79 }),
          snapshot: {
            ...createAcceptedAttempt({ snapshotIndex: 1, qualityScore: 79 }).snapshot,
            timestampMinutes: 19.1,
          },
        },
      ],
      allowLowConfidenceDraft: false,
      previousSnapshots: [createPreviousSnapshotEntry({ snapshotIndex: 0, snapshotMinute: 18.2, signature: "ADC::18.20::1800::item-0" })],
    });

    expect(selection.primaryAttempt?.snapshotIndex).toBe(1);
    expect(selection.selectedAttempts.map((attempt) => attempt.snapshotIndex)).toEqual([1]);
    expect(selection.repetitionExcluded).toEqual([
      {
        segment: "mid",
        snapshotIndex: 0,
        snapshotMinute: 18.2,
        qualityScore: 84,
      },
    ]);
  });

  it("falls back to a repeated snapshot only when the segment has no fresh alternative", () => {
    const selection = mlPuzzleGenerationServiceTestables.selectAttemptsForSeries({
      attempts: [
        {
          ...createAcceptedAttempt({ snapshotIndex: 3, qualityScore: 74 }),
          snapshot: {
            ...createAcceptedAttempt({ snapshotIndex: 3, qualityScore: 74 }).snapshot,
            timestampMinutes: 26.6,
          },
        },
      ],
      allowLowConfidenceDraft: false,
      previousSnapshots: [createPreviousSnapshotEntry({ snapshotIndex: 3, snapshotMinute: 26.6, signature: "ADC::26.60::1800::item-3" })],
    });

    expect(selection.primaryAttempt?.snapshotIndex).toBe(3);
    expect(selection.segmentSummaries.find((entry) => entry.segment === "late")?.selectedFromHistoryFallback).toBe(true);
  });

  it("penalizes recently reused snapshot signatures even when the minute differs slightly", () => {
    const baseAttempt = {
      ...createAcceptedAttempt({ snapshotIndex: 0, qualityScore: 88 }),
      snapshot: {
        ...createAcceptedAttempt({ snapshotIndex: 0, qualityScore: 88 }).snapshot,
        timestampMinutes: 18.24,
      },
      debugSummary: {
        ...createAcceptedAttempt({ snapshotIndex: 0, qualityScore: 88 }).debugSummary,
        snapshotMinute: 18.24,
        snapshotSignature: "ADC::18.24::1800::item-0",
      },
    };
    const alternativeAttempt = {
      ...createAcceptedAttempt({ snapshotIndex: 1, qualityScore: 81 }),
      snapshot: {
        ...createAcceptedAttempt({ snapshotIndex: 1, qualityScore: 81 }).snapshot,
        timestampMinutes: 19.1,
      },
      debugSummary: {
        ...createAcceptedAttempt({ snapshotIndex: 1, qualityScore: 81 }).debugSummary,
        snapshotMinute: 19.1,
        snapshotSignature: "ADC::19.10::1800::item-1",
      },
    };

    const selection = mlPuzzleGenerationServiceTestables.selectAttemptsForSeries({
      attempts: [baseAttempt, alternativeAttempt],
      allowLowConfidenceDraft: false,
      previousSnapshots: [createPreviousSnapshotEntry({ snapshotIndex: 9, snapshotMinute: 18.24, signature: "ADC::18.24::1800::item-0" })],
      now: new Date("2026-04-02T10:00:00.000Z"),
    });

    expect(selection.primaryAttempt?.snapshotIndex).toBe(1);
  });
});
