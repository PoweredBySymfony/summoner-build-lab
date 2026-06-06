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

function successfulPrediction() {
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
  };
}

describe("snapshotAttemptEvaluator", () => {
  it("prevalidates unresolved actual purchases before calling the model", () => {
    expect(
      prevalidateSnapshotCandidate({
        candidate: candidate({
          actualPurchase: {
            itemSlug: "missing-item",
            goldTotal: 1200,
            burstPurchaseIndex: 0,
            timestampMinutes: 18,
          },
        }),
        patchChoiceItems: availableChoices(),
        championTags: ["Marksman"],
      }),
    ).toEqual({
      allowed: false,
      rejectionReasons: ["actual-purchase-unresolved"],
    });
  });

  it("returns a rejected attempt when the ML predictor raises an HTTP error", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-1",
      userId: "user-1",
      championTags: ["Marksman"],
      candidate: candidate(),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => {
        throw new HttpError(503, "ML unavailable", { retryable: true });
      },
    });

    expect(attempt.status).toBe("rejected");
    expect(attempt.rejectionReasons).toEqual(["attempt-http-503"]);
    expect(attempt.details).toEqual({
      status: 503,
      details: { retryable: true },
    });
  });

  it("rejects attempts when the predicted and fallback good answers cannot be resolved", async () => {
    const attempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-1",
      userId: "user-1",
      championTags: ["Marksman"],
      candidate: candidate({
        actualPurchase: {
          itemSlug: "unknown-actual",
          goldTotal: 3000,
          burstPurchaseIndex: 0,
          timestampMinutes: 22,
        },
      }),
      patchChoiceItems: availableChoices(),
      previousChoiceSignatures: [],
      predictNextItem: async () => ({
        ...successfulPrediction(),
        top_k_predictions: [
          { item_slug: "unknown-prediction", score: 0.82 },
          { item_slug: "item-b", score: 0.42 },
          { item_slug: "item-c", score: 0.35 },
          { item_slug: "item-d", score: 0.31 },
        ],
      }),
    });

    expect(attempt.status).toBe("rejected");
    expect(attempt.rejectionReasons).toEqual(["good-answer-unresolved"]);
  });

  it("accepts a technically viable, publishable snapshot attempt", async () => {
    const attempt: SnapshotAttempt = await evaluateSnapshotAttempt({
      importedMatchId: "match-accepted",
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
      expect(attempt.resolvedChoices.distractors).toHaveLength(3);
      expect(attempt.debugSummary.goodAnswerSource).toBe("ml-prediction");
      expect(attempt.debugSummary.publishable).toBe(true);
    }
  });
});
