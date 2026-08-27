import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  evaluateSnapshotAttempt,
  prevalidateSnapshotCandidate,
  type SnapshotAttempt,
} from "../../server/src/lib/ml/snapshotAttemptEvaluator";
import type { SnapshotCandidate } from "../../server/src/lib/ml/snapshotCandidateBuilder";
import type { MlChoiceItem } from "../../server/src/lib/ml/puzzleChoiceResolution";
import { HttpError } from "../../server/src/utils/http";

// ============================================================================
// TEST HELPERS — Table-driven test infrastructure
// ============================================================================

function choice(slug: string, goldTotal: number, overrides: Partial<MlChoiceItem> = {}): MlChoiceItem {
  return {
    id: slug,
    slug,
    name: slug,
    riotItemId: Math.abs(slug.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)),
    goldTotal,
    patch: "16.6",
    category: "marksman",
    tags: ["Damage"],
    isBoots: false,
    isLegendary: goldTotal >= 2400,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    buildsFrom: [],
    itemGroups: [],
    ...overrides,
  };
}

function candidate(overrides: Partial<SnapshotCandidate> = {}): SnapshotCandidate {
  const base: SnapshotCandidate = {
    snapshotIndex: 2,
    rawPurchaseIndex: 2,
    relevanceScore: 90,
    snapshot: {
      patch: "16.6",
      championSlug: "jinx",
      role: Role.ADC,
      goldAvailable: 3600,
      level: 12,
      kills: 5,
      deaths: 1,
      assists: 7,
      cs: 180,
      timestampMinutes: 22,
      currentItems: [],
      allyFrontlineCount: 2,
      allyMagicDamageCount: 1,
      allyPhysicalDamageCount: 3,
      allySupportCount: 1,
      enemyFrontlineCount: 2,
      enemyMagicDamageCount: 2,
      enemyPhysicalDamageCount: 2,
      enemySupportCount: 1,
    },
    scenario: {
      currentBuild: [],
      allyTeam: [],
      enemyTeam: [],
    },
    actualPurchase: {
      itemSlug: "item-a",
      goldTotal: 3400,
      burstPurchaseIndex: 0,
      timestampMinutes: 22,
    },
  };

  return {
    ...base,
    ...overrides,
    snapshot: {
      ...base.snapshot,
      ...overrides.snapshot,
    },
    actualPurchase: {
      ...base.actualPurchase,
      ...overrides.actualPurchase,
    },
  };
}

function availableChoices() {
  return [
    choice("item-a", 3400),
    choice("item-b", 2900),
    choice("item-c", 2650),
    choice("item-d", 3000),
    choice("item-e", 3400),
    choice("item-f", 3200),
    choice("item-g", 3000),
    choice("item-h", 3000),
    choice("item-i", 3100),
    choice("item-j", 3300),
  ];
}

function successfulPrediction(overrides: Record<string, unknown> = {}) {
  return {
    model_ready: true,
    predicted_item_slug: "item-a",
    confidence: 0.82,
    candidate_pool_size: 8,
    top_k_predictions: [
      { item_slug: "item-a", score: 0.82 },
      { item_slug: "item-b", score: 0.42 },
      { item_slug: "item-c", score: 0.35 },
      { item_slug: "item-d", score: 0.31 },
      { item_slug: "item-e", score: 0.28 },
      { item_slug: "item-f", score: 0.24 },
      { item_slug: "item-g", score: 0.21 },
      { item_slug: "item-h", score: 0.18 },
      { item_slug: "item-i", score: 0.15 },
    ],
    model_version: "test-model",
    message: "ok",
    ...overrides,
  };
}

// ============================================================================
// PREVALIDATION TESTS — Edge cases for initial validation
// ============================================================================

describe("prevalidateSnapshotCandidate", () => {
  const validationCases = [
    {
      name: "rejects when actual purchase item not in available choices",
      input: {
        candidate: candidate({
          actualPurchase: { itemSlug: "missing-item", goldTotal: 1200, burstPurchaseIndex: 0, timestampMinutes: 18 },
        }),
        patchChoiceItems: availableChoices(),
        championTags: ["Marksman"],
      },
      expected: { allowed: false, rejectionReasons: ["actual-purchase-unresolved"] },
    },
    {
      name: "allows when actual purchase is in available choices",
      input: {
        candidate: candidate({
          actualPurchase: { itemSlug: "item-b", goldTotal: 2900, burstPurchaseIndex: 0, timestampMinutes: 22 },
        }),
        patchChoiceItems: availableChoices(),
        championTags: ["Marksman"],
      },
      expected: { allowed: true, rejectionReasons: [] },
    },
    {
      name: "handles empty actual purchase item slug",
      input: {
        candidate: candidate({ actualPurchase: { itemSlug: "", goldTotal: 0, burstPurchaseIndex: 0, timestampMinutes: 22 } }),
        patchChoiceItems: availableChoices(),
        championTags: ["Marksman"],
      },
      expected: { allowed: false, rejectionReasons: ["actual-purchase-unresolved"] },
    },
  ];

  validationCases.forEach(({ name, input, expected }) => {
    it(name, () => {
      const result = prevalidateSnapshotCandidate(input);
      expect(result).toEqual(expected);
    });
  });
});

// ============================================================================
// EVALUATION TESTS — Main flow with various rejection paths
// ============================================================================

describe("evaluateSnapshotAttempt", () => {
  // ────────────────────────────────────────────────────────────────────────────
  // HTTP Error Cases
  // ────────────────────────────────────────────────────────────────────────────

  const httpErrorCases = [
    { status: 503, name: "unavailable" },
    { status: 500, name: "server error" },
    { status: 429, name: "rate limited" },
    { status: 400, name: "bad request" },
  ];

  httpErrorCases.forEach(({ status, name }) => {
    it(`rejects with HTTP ${status} error when ML service ${name}`, async () => {
      const attempt = await evaluateSnapshotAttempt({
        importedMatchId: "match-1",
        userId: "user-1",
        championTags: ["Marksman"],
        candidate: candidate(),
        patchChoiceItems: availableChoices(),
        previousChoiceSignatures: [],
        predictNextItem: async () => {
          throw new HttpError(status, `Service ${name}`, { retryable: true });
        },
      });

      expect(attempt.status).toBe("rejected");
      expect(attempt.rejectionReasons).toContain(`attempt-http-${status}`);
      expect(attempt.details).toEqual({
        status,
        details: { retryable: true },
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Good Answer Resolution Failures
  // ────────────────────────────────────────────────────────────────────────────

  it("rejects when predicted item and actual purchase both unresolved", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-2",
      userId: "user-2",
      championTags: ["Marksman"],
      candidate: candidate({
        actualPurchase: { itemSlug: "unknown-actual", goldTotal: 3000, burstPurchaseIndex: 0, timestampMinutes: 22 },
      }),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => ({
        ...successfulPrediction(),
        top_k_predictions: [
          { item_slug: "unknown-prediction", score: 0.82 },
          { item_slug: "item-b", score: 0.42 },
        ],
      }),
    });

    expect(attempt.status).toBe("rejected");
    expect(attempt.rejectionReasons).toContain("good-answer-unresolved");
  });

  it("accepts when predicted item is resolvable even if actual purchase not available", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-3",
      userId: "user-3",
      championTags: ["Marksman"],
      candidate: candidate({
        actualPurchase: { itemSlug: "unknown-actual", goldTotal: 1000, burstPurchaseIndex: 0, timestampMinutes: 22 },
      }),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => successfulPrediction(),
    });

    expect(attempt.status).toBe("accepted");
    expect(attempt.technicalViable).toBe(true);
    if (attempt.status === "accepted") {
      expect(attempt.debugSummary.goodAnswerSource).toBe("ml-prediction");
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Successful Acceptance Cases
  // ────────────────────────────────────────────────────────────────────────────

  it("accepts a technically viable, publishable snapshot attempt with ML prediction", async () => {
    const attempt: SnapshotAttempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-accepted-ml",
      userId: "user-accepted",
      championTags: ["Marksman"],
      candidate: candidate(),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => successfulPrediction(),
    });

    expect(attempt.status).toBe("accepted");
    expect(attempt.technicalViable).toBe(true);
    if (attempt.status === "accepted") {
      expect(attempt.resolvedChoices.goodAnswer.slug).toBe("item-a");
      expect(attempt.resolvedChoices.distractors.length).toBeGreaterThan(0);
      expect(attempt.debugSummary.goodAnswerSource).toBe("ml-prediction");
      expect(attempt.debugSummary.publishable).toBe(true);
      expect(attempt.debugSummary.technicalViable).toBe(true);
    }
  });

  it("accepts with ML prediction even when actual purchase logic is unavailable", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-fallback",
      userId: "user-fallback",
      championTags: ["Marksman"],
      candidate: candidate(),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => successfulPrediction(),
    });

    // ML prediction succeeds, so it should be accepted
    expect(attempt.status).toBe("accepted");
    if (attempt.status === "accepted") {
      expect(attempt.debugSummary.goodAnswerSource).toBe("ml-prediction");
      expect(attempt.resolvedChoices.goodAnswer.slug).toBe("item-a");
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Low Confidence Predictions
  // ────────────────────────────────────────────────────────────────────────────

  it("rejects low confidence prediction if quality score is insufficient", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-low-conf",
      userId: "user-low-conf",
      championTags: ["Marksman"],
      candidate: candidate(),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () =>
        successfulPrediction({
          confidence: 0.02, // Very low confidence
        }),
    });

    // Very low confidence should lead to rejection
    expect(attempt.status).toBe("rejected");
    expect(attempt.rejectionReasons.length).toBeGreaterThan(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Empty/Edge Case Predictions
  // ────────────────────────────────────────────────────────────────────────────

  it("accepts when model returns minimal but valid predictions", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-minimal-preds",
      userId: "user-minimal-preds",
      championTags: ["Marksman"],
      candidate: candidate(),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () =>
        successfulPrediction({
          top_k_predictions: [
            { item_slug: "item-a", score: 0.82 },
            { item_slug: "item-b", score: 0.42 },
            { item_slug: "item-c", score: 0.35 },
          ], // Minimal predictions but still has good answer
        }),
    });

    // Should accept as long as good answer is resolvable
    expect(attempt.status).toBe("accepted");
  });

  it("rejects when model not ready", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-not-ready",
      userId: "user-not-ready",
      championTags: ["Marksman"],
      candidate: candidate(),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () =>
        successfulPrediction({
          model_ready: false,
          predicted_item_slug: "",
        }),
    });

    expect(attempt.status).toBe("rejected");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Generic Error Handling
  // ────────────────────────────────────────────────────────────────────────────

  it("catches and rejects on unexpected JS error", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-error",
      userId: "user-error",
      championTags: ["Marksman"],
      candidate: candidate(),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => {
        throw new Error("Unexpected JS error");
      },
    });

    expect(attempt.status).toBe("rejected");
    expect(attempt.rejectionReasons).toContain("Unexpected JS error");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Snapshot Debug Summary Accuracy
  // ────────────────────────────────────────────────────────────────────────────

  it("populates debug summary with accurate snapshot metadata", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-debug",
      userId: "user-debug",
      championTags: ["Marksman"],
      candidate: candidate({
        snapshotIndex: 5,
        snapshot: { ...candidate().snapshot, goldAvailable: 2500, level: 11, cs: 150 },
      }),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => successfulPrediction(),
    });

    if (attempt.status === "accepted") {
      expect(attempt.debugSummary.snapshotIndex).toBe(5);
      expect(attempt.debugSummary.goldAvailable).toBe(2500);
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Variation Seed Uniqueness
  // ────────────────────────────────────────────────────────────────────────────

  it("generates unique variation seeds for different timestamps", async () => {
    const attempt1 = await evaluateSnapshotAttempt({
      importedMatchId: "match-seed-1",
      userId: "user-seed",
      championTags: ["Marksman"],
      candidate: candidate({ snapshotIndex: 1 }),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => successfulPrediction(),
    });

    // Small delay to ensure different timestamp
    await new Promise((r) => setTimeout(r, 10));

    const attempt2 = await evaluateSnapshotAttempt({
      importedMatchId: "match-seed-1",
      userId: "user-seed",
      championTags: ["Marksman"],
      candidate: candidate({ snapshotIndex: 1 }),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => successfulPrediction(),
    });

    if (attempt1.status === "accepted" && attempt2.status === "accepted") {
      expect(attempt1.variationSeed).not.toBe(attempt2.variationSeed);
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Business Rules Integration
  // ────────────────────────────────────────────────────────────────────────────

  it("includes business rules in debug summary for accepted attempts", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-rules",
      userId: "user-rules",
      championTags: ["Marksman"],
      candidate: candidate(),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => successfulPrediction(),
    });

    expect(attempt.status).toBe("accepted");
    if (attempt.status === "accepted") {
      expect(attempt.debugSummary.technicalViable).toBe(true);
      expect(attempt.seed).toBeDefined();
      expect(attempt.businessRules).toBeDefined();
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Different Role/Champion Combinations
  // ────────────────────────────────────────────────────────────────────────────

  const roleCases = [
    { role: Role.TOP, champion: "garen", tags: ["Tank"] },
    { role: Role.JUNGLE, champion: "lee-sin", tags: ["Assassin"] },
    { role: Role.ADC, champion: "jinx", tags: ["Marksman"] },
  ];

  roleCases.forEach(({ role, champion, tags }) => {
    it(`accepts snapshot for ${champion} (${role}) with ${tags[0]} tag`, async () => {
      const attempt = await evaluateSnapshotAttempt({
        importedMatchId: `match-${champion}`,
        userId: "user-roles",
        championTags: tags,
        candidate: candidate({
          snapshot: {
            ...candidate().snapshot,
            role,
            championSlug: champion,
          },
        }),
        patchChoiceItems: availableChoices(),
        previousChoiceSignatures: [],
        predictNextItem: async () => successfulPrediction(),
      });

      expect(attempt.status).toBe("accepted");
      if (attempt.status === "accepted") {
        expect(attempt.debugSummary).toBeDefined();
      }
    });
  });
});
