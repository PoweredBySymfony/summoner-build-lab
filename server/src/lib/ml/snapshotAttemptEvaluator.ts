import { Prisma } from "@prisma/client";
import { getItemRestrictionDecision } from "../itemRestrictions.js";
import {
  buildBackendPuzzleSeed,
  mapSnapshotToMlPayload,
  type MlPredictNextItemResponse,
  type MlPuzzleSeed,
} from "./mlPuzzle.js";
import {
  buildChoiceSignatureForHistory,
  buildMlPuzzleBusinessRules,
} from "./puzzleBusinessRules.js";
import {
  resolveMlChoiceItemRef,
  resolveMlPuzzleChoices,
  toChoiceDebugPayload,
  type MlChoiceItem,
} from "./puzzleChoiceResolution.js";
import {
  assessSnapshotPublishability,
  calculateQualityScore,
  canOverrideLowConfidence,
} from "./snapshotQuality.js";
import {
  buildSnapshotSignature,
} from "./snapshotSeriesSelection.js";
import type { SnapshotCandidate } from "./snapshotCandidateBuilder.js";
import { HttpError } from "../../utils/http.js";

export type AttemptDebugSummary = {
  snapshotIndex: number;
  snapshotMinute: number;
  patch: string;
  goldAvailable: number;
  snapshotSignature: string;
  rerollDistanceScore?: number;
  rawCandidatePoolSize: number;
  filteredCandidatePoolSize: number;
  goodAnswer: string | null;
  qualityScore: number;
  rejectionReasons: string[];
  lowConfidence: boolean;
  confidenceScore: number;
  confidenceGap: number;
  technicalViable: boolean;
  publishable: boolean;
  publishabilityScore: number;
  publishabilityReasons: string[];
  goodAnswerSource?: "ml-prediction" | "actual-purchase-fallback";
};

export type PreparedSnapshotAttempt = {
  status: "accepted";
  technicalViable: true;
  snapshotIndex: number;
  rawPurchaseIndex: number;
  snapshot: SnapshotCandidate["snapshot"];
  scenario: SnapshotCandidate["scenario"];
  payload: ReturnType<typeof mapSnapshotToMlPayload>;
  prediction: MlPredictNextItemResponse;
  seed: MlPuzzleSeed;
  resolvedChoices: ReturnType<typeof resolveMlPuzzleChoices>;
  businessRules: ReturnType<typeof buildMlPuzzleBusinessRules>;
  qualityScore: number;
  variationSeed: string;
  choiceSignature: string;
  debugSummary: AttemptDebugSummary;
};

export type RejectedSnapshotAttempt = {
  status: "rejected";
  snapshotIndex: number;
  rawPurchaseIndex: number;
  snapshot: SnapshotCandidate["snapshot"];
  payload: ReturnType<typeof mapSnapshotToMlPayload>;
  prediction: MlPredictNextItemResponse | null;
  seed: MlPuzzleSeed | null;
  rejectionReasons: string[];
  debugSummary: AttemptDebugSummary;
  technicalViable: boolean;
  details?: Prisma.InputJsonValue;
};

export type SnapshotAttempt = PreparedSnapshotAttempt | RejectedSnapshotAttempt;
type BusinessRulesResult = ReturnType<typeof buildMlPuzzleBusinessRules>;
type GoodAnswerSource = "ml-prediction" | "actual-purchase-fallback";

function buildRejectedAttempt(input: {
  candidate: SnapshotCandidate;
  payload: ReturnType<typeof mapSnapshotToMlPayload>;
  prediction?: MlPredictNextItemResponse | null;
  seed?: MlPuzzleSeed | null;
  rawCandidatePoolSize: number;
  filteredCandidatePoolSize: number;
  goodAnswer: string | null;
  rejectionReasons: string[];
  qualityScore?: number;
  technicalViable?: boolean;
  publishabilityScore?: number;
  publishabilityReasons?: string[];
  goodAnswerSource?: "ml-prediction" | "actual-purchase-fallback";
  details?: Prisma.InputJsonValue;
}): RejectedSnapshotAttempt {
  return {
    status: "rejected",
    snapshotIndex: input.candidate.snapshotIndex,
    rawPurchaseIndex: input.candidate.rawPurchaseIndex,
    snapshot: input.candidate.snapshot,
    payload: input.payload,
    prediction: input.prediction ?? null,
    seed: input.seed ?? null,
    rejectionReasons: input.rejectionReasons,
    technicalViable: Boolean(input.technicalViable),
    debugSummary: {
      snapshotIndex: input.candidate.snapshotIndex,
      snapshotMinute: Number(input.candidate.snapshot.timestampMinutes.toFixed(2)),
      patch: input.candidate.snapshot.patch,
      goldAvailable: input.candidate.snapshot.goldAvailable,
      snapshotSignature: buildSnapshotSignature({
        snapshotMinute: input.candidate.snapshot.timestampMinutes,
        goldAvailable: input.candidate.snapshot.goldAvailable,
        role: input.candidate.snapshot.role,
        currentItems: input.candidate.snapshot.currentItems,
      }),
      rawCandidatePoolSize: input.rawCandidatePoolSize,
      filteredCandidatePoolSize: input.filteredCandidatePoolSize,
      goodAnswer: input.goodAnswer,
      qualityScore: input.qualityScore ?? 0,
      rejectionReasons: input.rejectionReasons,
      lowConfidence: input.seed?.lowConfidence ?? false,
      confidenceScore: input.seed?.confidenceScore ?? 0,
      confidenceGap: input.seed?.confidenceGap ?? 0,
      technicalViable: Boolean(input.technicalViable),
      publishable: false,
      publishabilityScore: input.publishabilityScore ?? 0,
      publishabilityReasons: input.publishabilityReasons ?? [],
      goodAnswerSource: input.goodAnswerSource,
    },
    details: input.details,
  };
}

export function logSnapshotAttempt(requestId: string, importedMatchId: string, attempt: SnapshotAttempt) {
  console.info(
    "[ml-puzzle] snapshot-attempt",
    JSON.stringify({
      requestId,
      importedMatchId,
      ...attempt.debugSummary,
      selected: attempt.status === "accepted",
    }),
  );
}

export function prevalidateSnapshotCandidate(input: {
  candidate: SnapshotCandidate;
  patchChoiceItems: MlChoiceItem[];
  championTags: string[];
}) {
  const actualPurchaseSlug = input.candidate.actualPurchase.itemSlug;
  const actualPurchaseItem = actualPurchaseSlug
    ? resolveMlChoiceItemRef(actualPurchaseSlug, input.patchChoiceItems)
    : null;
  const rejectionReasons: string[] = [];

  if (!actualPurchaseItem) {
    rejectionReasons.push("actual-purchase-unresolved");
    return {
      allowed: false,
      rejectionReasons,
    };
  }

  const restriction = getItemRestrictionDecision(actualPurchaseItem.slug, {
    patch: input.candidate.snapshot.patch,
    role: input.candidate.snapshot.role,
  });
  if (!restriction.allowed) {
    rejectionReasons.push(...restriction.reasons.map((reason) => `actual-purchase-${reason}`));
  }

  const businessRules = buildMlPuzzleBusinessRules({
    snapshot: input.candidate.snapshot,
    championTags: input.championTags,
    goodAnswer: actualPurchaseItem,
    rankedCandidates: [actualPurchaseItem],
    availableItems: input.patchChoiceItems,
    previousChoiceSignatures: [],
    variationSeed: `prevalidate:${input.candidate.snapshotIndex}:${actualPurchaseItem.slug}`,
  });
  rejectionReasons.push(
    ...businessRules.debug.goodAnswerViolations.map((reason) => `good-answer-${reason}`),
  );
  if (businessRules.debug.candidatePoolSizeAfterFallback < 6) {
    rejectionReasons.push("candidate-pool-too-small");
  }

  return {
    allowed: rejectionReasons.length === 0,
    rejectionReasons,
  };
}

function resolveActualPurchaseFallback(input: {
  itemSlug: string | null;
  patchChoiceItems: MlChoiceItem[];
}) {
  return input.itemSlug
    ? resolveMlChoiceItemRef(input.itemSlug, input.patchChoiceItems)
    : null;
}

function resolveGoodAnswerCandidate(input: {
  predictedGoodAnswer: MlChoiceItem | null;
  actualPurchaseFallback: MlChoiceItem | null;
  actualPurchaseAllowed: boolean;
}) {
  if (input.predictedGoodAnswer) {
    return {
      resolvedGoodAnswer: input.predictedGoodAnswer,
      goodAnswerSource: "ml-prediction" as GoodAnswerSource,
    };
  }

  if (input.actualPurchaseFallback && input.actualPurchaseAllowed) {
    return {
      resolvedGoodAnswer: input.actualPurchaseFallback,
      goodAnswerSource: "actual-purchase-fallback" as GoodAnswerSource,
    };
  }

  return {
    resolvedGoodAnswer: null,
    goodAnswerSource: "ml-prediction" as GoodAnswerSource,
  };
}

function shouldFallbackToActualPurchase(input: {
  goodAnswerSource: GoodAnswerSource;
  actualPurchaseFallback: MlChoiceItem | null;
  actualPurchaseAllowed: boolean;
  businessRules: BusinessRulesResult;
}) {
  return (
    input.goodAnswerSource === "ml-prediction"
    && input.actualPurchaseFallback
    && input.actualPurchaseAllowed
    && input.businessRules.debug.goodAnswerViolations.some((reason) =>
      reason === "too-cheap" || reason === "too-expensive" || reason === "incoherent-with-champion",
    )
  );
}

function logRestrictedCandidateSamples(
  snapshot: SnapshotCandidate["snapshot"],
  businessRules: BusinessRulesResult,
) {
  if (businessRules.debug.restrictedCandidateSamples.length === 0) {
    return;
  }

  console.info(
    "[ml-puzzle] restriction-reject",
    JSON.stringify({
      scope: "candidate-pool",
      patch: snapshot.patch,
      role: snapshot.role,
      rejected: businessRules.debug.restrictedCandidateSamples,
      counts: {
        roleRestricted: businessRules.debug.filterReasonCounts["role-restricted"],
        patchRestricted: businessRules.debug.filterReasonCounts["patch-restricted"],
      },
    }),
  );
}

function collectBusinessRuleRejections(businessRules: BusinessRulesResult) {
  const rejectionReasons = businessRules.debug.goodAnswerViolations.map(
    (reason) => `good-answer-${reason}`,
  );

  if (businessRules.debug.candidatePoolSizeAfterFallback < 6) {
    rejectionReasons.push("candidate-pool-too-small");
  }

  return rejectionReasons;
}

function tryResolvePuzzleChoices(input: Parameters<typeof resolveMlPuzzleChoices>[0]) {
  try {
    return {
      resolvedChoices: resolveMlPuzzleChoices(input),
      rejectionReason: null,
    };
  } catch (error) {
    return {
      resolvedChoices: null,
      rejectionReason: `choice-resolution-${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function evaluateSnapshotAttempt(input: {
  importedMatchId: string;
  userId: string;
  championTags: string[];
  candidate: SnapshotCandidate;
  patchChoiceItems: MlChoiceItem[];
  previousChoiceSignatures: string[];
  predictNextItem: (payload: ReturnType<typeof mapSnapshotToMlPayload>) => Promise<MlPredictNextItemResponse>;
}): Promise<SnapshotAttempt> {
  const payload = mapSnapshotToMlPayload(input.candidate.snapshot);

  try {
    const prediction = await input.predictNextItem(payload);
    const seed = buildBackendPuzzleSeed(prediction);
    const predictedGoodAnswer = resolveMlChoiceItemRef(seed.goodAnswer, input.patchChoiceItems);
    const actualPurchaseFallback = resolveActualPurchaseFallback({
      itemSlug: input.candidate.actualPurchase.itemSlug,
      patchChoiceItems: input.patchChoiceItems,
    });
    const actualPurchaseVerdict = prevalidateSnapshotCandidate({
      candidate: input.candidate,
      patchChoiceItems: input.patchChoiceItems,
      championTags: input.championTags,
    });

    let { resolvedGoodAnswer, goodAnswerSource } = resolveGoodAnswerCandidate({
      predictedGoodAnswer,
      actualPurchaseFallback,
      actualPurchaseAllowed: actualPurchaseVerdict.allowed,
    });

    if (!resolvedGoodAnswer) {
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: 0,
        goodAnswer: seed.goodAnswer,
        rejectionReasons: ["good-answer-unresolved"],
        details: {
          actualPurchaseItemSlug: input.candidate.actualPurchase.itemSlug,
          actualPurchaseVerdict,
        } satisfies Prisma.InputJsonValue,
      });
    }

    const goodAnswerRestriction = getItemRestrictionDecision(resolvedGoodAnswer.slug, {
      patch: input.candidate.snapshot.patch,
      role: input.candidate.snapshot.role,
    });
    if (!goodAnswerRestriction.allowed) {
      console.info(
        "[ml-puzzle] restriction-reject",
        JSON.stringify({
          scope: "good-answer",
          patch: input.candidate.snapshot.patch,
          role: input.candidate.snapshot.role,
          slug: resolvedGoodAnswer.slug,
          reasons: goodAnswerRestriction.reasons,
        }),
      );
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: 0,
        goodAnswer: resolvedGoodAnswer.slug,
        rejectionReasons: goodAnswerRestriction.reasons.map((reason) => `good-answer-${reason}`),
        details: {
          goodAnswerSource,
          actualPurchaseItemSlug: input.candidate.actualPurchase.itemSlug,
        } satisfies Prisma.InputJsonValue,
      });
    }

    const variationSeed = `${input.importedMatchId}:${input.userId}:${input.candidate.snapshotIndex}:${Date.now()}`;
    const rankedResolvedItems = prediction.top_k_predictions
      .map((entry) => resolveMlChoiceItemRef(entry.item_slug, input.patchChoiceItems))
      .filter((item): item is MlChoiceItem => Boolean(item));
    let businessRules = buildMlPuzzleBusinessRules({
      snapshot: input.candidate.snapshot,
      championTags: input.championTags,
      goodAnswer: resolvedGoodAnswer,
      rankedCandidates: rankedResolvedItems,
      availableItems: input.patchChoiceItems,
      previousChoiceSignatures: input.previousChoiceSignatures,
      variationSeed,
    });
    if (shouldFallbackToActualPurchase({
      goodAnswerSource,
      actualPurchaseFallback,
      actualPurchaseAllowed: actualPurchaseVerdict.allowed,
      businessRules,
    })) {
      const fallbackGoodAnswer = actualPurchaseFallback;
      if (!fallbackGoodAnswer) {
        throw new HttpError(500, "Actual purchase fallback was expected but unresolved.");
      }
      resolvedGoodAnswer = fallbackGoodAnswer;
      goodAnswerSource = "actual-purchase-fallback";
      businessRules = buildMlPuzzleBusinessRules({
        snapshot: input.candidate.snapshot,
        championTags: input.championTags,
        goodAnswer: fallbackGoodAnswer,
        rankedCandidates: [fallbackGoodAnswer, ...rankedResolvedItems],
        availableItems: input.patchChoiceItems,
        previousChoiceSignatures: input.previousChoiceSignatures,
        variationSeed: `${variationSeed}:actual-purchase`,
      });
    }
    logRestrictedCandidateSamples(input.candidate.snapshot, businessRules);

    const rejectionReasons = collectBusinessRuleRejections(businessRules);

    const choiceResolutionInput = {
      patch: input.candidate.snapshot.patch,
      role: input.candidate.snapshot.role,
      currentItemSlugs: input.candidate.snapshot.currentItems,
      goodAnswer: resolvedGoodAnswer.slug,
      distractors: businessRules.debug.selectedDistractors,
      rankedItemSlugs: businessRules.distractorCandidates.map((item) => item.slug),
      availableItems: input.patchChoiceItems,
      fallbackItems: businessRules.distractorCandidates,
    };

    const choiceResolution = tryResolvePuzzleChoices(choiceResolutionInput);
    const resolvedChoices = choiceResolution.resolvedChoices;
    if (choiceResolution.rejectionReason) {
      rejectionReasons.push(choiceResolution.rejectionReason);
    }

    if (!resolvedChoices || rejectionReasons.length > 0) {
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: businessRules.debug.candidatePoolSizeAfterFallback,
        goodAnswer: resolvedGoodAnswer.slug,
        rejectionReasons,
        goodAnswerSource,
        details: {
          goodAnswerSource,
          businessRules: businessRules.debug,
          choiceResolution: resolvedChoices ? toChoiceDebugPayload(resolvedChoices) : null,
        } as Prisma.InputJsonValue,
      });
    }

    const publishabilityAssessment = assessSnapshotPublishability({
      snapshot: input.candidate.snapshot,
      goodAnswer: resolvedChoices.goodAnswer,
      distractors: resolvedChoices.distractors,
      businessRules,
    });
    if (!publishabilityAssessment.publishable) {
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: businessRules.debug.candidatePoolSizeAfterFallback,
        goodAnswer: resolvedChoices.goodAnswer.slug,
        rejectionReasons: publishabilityAssessment.reasons,
        technicalViable: true,
        publishabilityScore: publishabilityAssessment.publishabilityScore,
        publishabilityReasons: publishabilityAssessment.reasons,
        goodAnswerSource,
        details: {
          goodAnswerSource,
          businessRules: businessRules.debug,
          publishability: publishabilityAssessment,
          choiceResolution: toChoiceDebugPayload(resolvedChoices),
        } as Prisma.InputJsonValue,
      });
    }

    const effectiveLowConfidence = !canOverrideLowConfidence({
      seed,
      prediction,
      publishabilityScore: publishabilityAssessment.publishabilityScore,
      candidatePoolSizeAfterFallback: businessRules.debug.candidatePoolSizeAfterFallback,
      goodAnswerSource,
    }) && seed.lowConfidence;
    if (effectiveLowConfidence) {
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: businessRules.debug.candidatePoolSizeAfterFallback,
        goodAnswer: resolvedChoices.goodAnswer.slug,
        rejectionReasons: ["low-confidence"],
        technicalViable: true,
        publishabilityScore: publishabilityAssessment.publishabilityScore,
        publishabilityReasons: [],
        goodAnswerSource,
        details: {
          goodAnswerSource,
          businessRules: businessRules.debug,
          publishability: publishabilityAssessment,
          choiceResolution: toChoiceDebugPayload(resolvedChoices),
        } as Prisma.InputJsonValue,
      });
    }

    const qualityScore = calculateQualityScore({
      seed: {
        ...seed,
        lowConfidence: effectiveLowConfidence,
      },
      prediction,
      businessRules,
      resolvedChoices,
    });
    const choiceSignature = buildChoiceSignatureForHistory(
      resolvedChoices.goodAnswer.slug,
      resolvedChoices.distractors.map((item) => item.slug),
    );

    return {
      status: "accepted",
      technicalViable: true,
      snapshotIndex: input.candidate.snapshotIndex,
      rawPurchaseIndex: input.candidate.rawPurchaseIndex,
      snapshot: input.candidate.snapshot,
      scenario: input.candidate.scenario,
      payload,
      prediction,
      seed: {
        ...seed,
        lowConfidence: effectiveLowConfidence,
      },
      resolvedChoices,
      businessRules,
      qualityScore,
      variationSeed,
      choiceSignature,
      debugSummary: {
        snapshotIndex: input.candidate.snapshotIndex,
        snapshotMinute: Number(input.candidate.snapshot.timestampMinutes.toFixed(2)),
        patch: input.candidate.snapshot.patch,
        goldAvailable: input.candidate.snapshot.goldAvailable,
        snapshotSignature: buildSnapshotSignature({
          snapshotMinute: input.candidate.snapshot.timestampMinutes,
          goldAvailable: input.candidate.snapshot.goldAvailable,
          role: input.candidate.snapshot.role,
          currentItems: input.candidate.snapshot.currentItems,
        }),
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: businessRules.debug.candidatePoolSizeAfterFallback,
        goodAnswer: resolvedChoices.goodAnswer.slug,
        qualityScore,
        rejectionReasons: [],
        lowConfidence: effectiveLowConfidence,
        confidenceScore: seed.confidenceScore,
        confidenceGap: seed.confidenceGap,
        technicalViable: true,
        publishable: true,
        publishabilityScore: publishabilityAssessment.publishabilityScore,
        publishabilityReasons: [],
        goodAnswerSource,
      },
    };
  } catch (error) {
    return buildRejectedAttempt({
      candidate: input.candidate,
      payload,
      rawCandidatePoolSize: 0,
      filteredCandidatePoolSize: 0,
      goodAnswer: null,
      rejectionReasons: [
        error instanceof HttpError ? `attempt-http-${error.status}` : error instanceof Error ? error.message : String(error),
      ],
      goodAnswerSource: "ml-prediction",
      details:
        error instanceof HttpError
          ? ({ status: error.status, details: error.details } as Prisma.InputJsonValue)
          : undefined,
    });
  }
}
