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
  actualPurchaseGoldTotal?: number;
  burstPurchaseIndex?: number;
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
    actualPurchase: {
      itemSlug: `actual-item-${input.snapshotIndex}`,
      goldTotal: input.actualPurchaseGoldTotal ?? 1500,
      burstPurchaseIndex: input.burstPurchaseIndex ?? 0,
      timestampMinutes: input.minute,
    },
  };
}

function createAcceptedAttempt(input: {
  snapshotIndex: number;
  qualityScore: number;
  lowConfidence?: boolean;
}) {
  return {
    status: "accepted" as const,
    technicalViable: true as const,
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
      technicalViable: true,
      publishable: true,
      publishabilityScore: 92,
      publishabilityReasons: [],
      goodAnswerSource: "ml-prediction",
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
    technicalViable: false,
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
      technicalViable: false,
      publishable: false,
      publishabilityScore: 0,
      publishabilityReasons: [],
      goodAnswerSource: "ml-prediction",
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

  it("computes a stronger reroll distance score for clearly different snapshots", () => {
    const nearScore = mlPuzzleGenerationServiceTestables.computeSnapshotDistanceScore({
      current: {
        snapshotMinute: 18.4,
        goldAvailable: 1820,
        currentItems: ["item-a", "item-b"],
      },
      previous: {
        snapshotMinute: 18.1,
        goldAvailable: 1800,
        currentItems: ["item-a", "item-b"],
      },
    });
    const farScore = mlPuzzleGenerationServiceTestables.computeSnapshotDistanceScore({
      current: {
        snapshotMinute: 26.2,
        goldAvailable: 2900,
        currentItems: ["item-c", "item-d", "item-e"],
      },
      previous: {
        snapshotMinute: 15.1,
        goldAvailable: 1200,
        currentItems: ["item-a"],
      },
    });

    expect(farScore).toBeGreaterThan(nearScore);
  });

  it("drops trivial sub-purchases inside the same shopping burst", () => {
    const meaningful = mlPuzzleGenerationServiceTestables.isMeaningfulPurchaseSnapshotCandidate(
      createSnapshotCandidate({
        snapshotIndex: 0,
        minute: 18,
        currentItems: ["item-a", "item-b"],
        goldAvailable: 1500,
        actualPurchaseGoldTotal: 1200,
        burstPurchaseIndex: 0,
      }),
    );
    const trivialBurstContinuation = mlPuzzleGenerationServiceTestables.isMeaningfulPurchaseSnapshotCandidate(
      createSnapshotCandidate({
        snapshotIndex: 1,
        minute: 18.1,
        currentItems: ["item-a", "item-b", "item-c"],
        goldAvailable: 1100,
        actualPurchaseGoldTotal: 300,
        burstPurchaseIndex: 1,
      }),
    );

    expect(meaningful).toBe(true);
    expect(trivialBurstContinuation).toBe(false);
  });

  it("surfaces dominant rejection reasons when no viable snapshot remains", () => {
    const diagnostics = mlPuzzleGenerationServiceTestables.summarizeNoViableDiagnostics({
      snapshotCandidates: [
        createSnapshotCandidate({ snapshotIndex: 0, minute: 12, currentItems: ["item-a"], goldAvailable: 800 }),
        createSnapshotCandidate({ snapshotIndex: 1, minute: 18, currentItems: ["item-b"], goldAvailable: 1600 }),
      ],
      attempts: [createRejectedAttempt(1, "low-confidence")],
      prevalidationRejections: {
        0: ["good-answer-too-cheap", "good-answer-too-cheap"],
      },
    });

    expect(diagnostics.snapshotsEvaluated).toBe(2);
    expect(diagnostics.viableSnapshots).toBe(0);
    expect(diagnostics.dominantRejectionReasons[0]).toBe("good-answer-too-cheap");
  });

  it("rejects publishability when the good answer is trivial and distractors are off-band", () => {
    const assessment = mlPuzzleGenerationServiceTestables.assessSnapshotPublishability({
      snapshot: createSnapshotCandidate({
        snapshotIndex: 7,
        minute: 11.8,
        currentItems: ["lame-de-doran"],
        goldAvailable: 2594,
      }).snapshot,
      goodAnswer: {
        id: "dague",
        slug: "dague",
        name: "Dague",
        riotItemId: 1042,
        goldTotal: 250,
        patch: "26.7",
        category: "crit",
        tags: ["AttackSpeed"],
        isBoots: false,
        isLegendary: false,
        isConsumable: false,
        isStarter: false,
        isTrinket: false,
        isActive: true,
        buildsFrom: [],
        itemGroups: [],
      },
      distractors: [
        {
          id: "bf",
          slug: "bf-glaive",
          name: "BF Glaive",
          riotItemId: 1038,
          goldTotal: 1300,
          patch: "26.7",
          category: "crit",
          tags: ["Damage"],
          isBoots: false,
          isLegendary: false,
          isConsumable: false,
          isStarter: false,
          isTrinket: false,
          isActive: true,
          buildsFrom: [],
          itemGroups: [],
        },
        {
          id: "last-whisper",
          slug: "dernier-souffle",
          name: "Dernier souffle",
          riotItemId: 3035,
          goldTotal: 1450,
          patch: "26.7",
          category: "crit",
          tags: ["Damage"],
          isBoots: false,
          isLegendary: false,
          isConsumable: false,
          isStarter: false,
          isTrinket: false,
          isActive: true,
          buildsFrom: [],
          itemGroups: ["LastWhisper"],
        },
        {
          id: "axiom",
          slug: "arc-axiomatique",
          name: "Arc axiomatique",
          riotItemId: 6696,
          goldTotal: 3000,
          patch: "26.7",
          category: "fighter",
          tags: ["Damage"],
          isBoots: false,
          isLegendary: true,
          isConsumable: false,
          isStarter: false,
          isTrinket: false,
          isActive: true,
          buildsFrom: [],
          itemGroups: [],
        },
      ],
      businessRules: {
        debug: {
          goodAnswerGoldAssessment: "too-cheap",
          goodAnswerViolations: ["too-cheap"],
        },
      } as never,
    });

    expect(assessment.publishable).toBe(false);
    expect(assessment.reasons).toContain("publishability-trivial-good-answer");
    expect(assessment.reasons).toContain("publishability-insufficient-credible-distractors");
  });

  it("counts viable but non-publishable snapshots separately from accepted ones", () => {
    const diagnostics = mlPuzzleGenerationServiceTestables.summarizeNoViableDiagnostics({
      snapshotCandidates: [
        createSnapshotCandidate({ snapshotIndex: 0, minute: 12, currentItems: ["item-a"], goldAvailable: 1800 }),
      ],
      attempts: [
        {
          ...createRejectedAttempt(0, "publishability-trivial-good-answer"),
          technicalViable: true,
          debugSummary: {
            ...createRejectedAttempt(0, "publishability-trivial-good-answer").debugSummary,
            technicalViable: true,
            publishabilityReasons: ["publishability-trivial-good-answer"],
            publishabilityScore: 24,
          },
        },
      ],
    });

    expect(diagnostics.viableSnapshots).toBe(1);
    expect(diagnostics.publishableSnapshots).toBe(0);
    expect(diagnostics.nonPublishableButViableSnapshots).toBe(1);
  });
});
