import type {
  MlPredictNextItemResponse,
  MlPuzzleSeed,
  MlPuzzleSnapshot,
} from "./mlPuzzle.js";
import type { MlPuzzleBusinessRulesResult } from "./puzzleBusinessRules.js";
import type {
  MlChoiceItem,
  MlChoiceResolutionResult,
} from "./puzzleChoiceResolution.js";

const MIN_SNAPSHOT_MINUTE = 8;
const MAX_SNAPSHOT_MINUTE = 32;
export const MIN_MEANINGFUL_PURCHASE_GOLD = 900;

type MeaningfulPurchaseSnapshotCandidate = {
  snapshot: MlPuzzleSnapshot;
  actualPurchase: {
    goldTotal: number | null;
    burstPurchaseIndex: number;
  };
};

export function scoreSnapshotCandidate(snapshot: MlPuzzleSnapshot) {
  let score = 0;
  const minute = snapshot.timestampMinutes;

  if (minute < MIN_SNAPSHOT_MINUTE || minute > MAX_SNAPSHOT_MINUTE) {
    return -1;
  }
  score += Math.max(0, 42 - Math.abs(minute - 18) * 2.2);
  score += snapshot.currentItems.length >= 2 && snapshot.currentItems.length <= 4 ? 18 : 6;
  score += snapshot.goldAvailable >= 900 && snapshot.goldAvailable <= 2800 ? 16 : 4;
  score += snapshot.level >= 8 ? 10 : 0;
  score += snapshot.cs >= 80 ? 8 : 0;
  score += snapshot.kills + snapshot.assists >= snapshot.deaths ? 6 : 2;

  return score;
}

export function getPublishabilityFloorGold(snapshotGold: number) {
  return Math.max(900, Math.round(Math.max(0, snapshotGold) * 0.35));
}

export function isMeaningfulPurchaseSnapshotCandidate(candidate: MeaningfulPurchaseSnapshotCandidate) {
  if (candidate.snapshot.currentItems.length < 1 || candidate.snapshot.currentItems.length > 5) {
    return false;
  }
  if (candidate.snapshot.level < 6) {
    return false;
  }
  const publishabilityFloor = getPublishabilityFloorGold(candidate.snapshot.goldAvailable);
  if (
    candidate.actualPurchase.burstPurchaseIndex > 0
    && (candidate.actualPurchase.goldTotal ?? 0) < Math.max(MIN_MEANINGFUL_PURCHASE_GOLD, publishabilityFloor)
  ) {
    return false;
  }
  return true;
}

function getDistractorDecisionBand(goodAnswerGold: number, snapshotGold: number) {
  const baseline = Math.max(goodAnswerGold, getPublishabilityFloorGold(snapshotGold));
  return Math.max(750, Math.round(baseline * 0.55));
}

function isPublishabilityCredibleDistractor(input: {
  item: MlChoiceItem;
  goodAnswer: MlChoiceItem;
  snapshotGold: number;
}) {
  const allowedGap = getDistractorDecisionBand(input.goodAnswer.goldTotal, input.snapshotGold);
  const costGap = Math.abs(input.item.goldTotal - input.goodAnswer.goldTotal);
  if (costGap <= allowedGap) {
    return true;
  }

  const sharedCategory = Boolean(input.item.category) && input.item.category === input.goodAnswer.category;
  const sharedTagCount = input.item.tags.filter((tag) => input.goodAnswer.tags.includes(tag)).length;
  const sameUpgradeFamily = input.item.itemGroups.some((group) => input.goodAnswer.itemGroups.includes(group));
  const sameTier = input.item.isLegendary === input.goodAnswer.isLegendary;
  const softGap = allowedGap + 450;

  return (
    costGap <= softGap
    && !input.item.isConsumable
    && !input.item.isStarter
    && !input.item.isTrinket
    && (
      sharedCategory
      || sharedTagCount >= 2
      || sameUpgradeFamily
      || sameTier
    )
  );
}

export function canOverrideLowConfidence(input: {
  seed: MlPuzzleSeed;
  prediction: MlPredictNextItemResponse;
  publishabilityScore: number;
  candidatePoolSizeAfterFallback: number;
  goodAnswerSource: "ml-prediction" | "actual-purchase-fallback";
}) {
  if (!input.seed.lowConfidence || !input.prediction.model_ready) {
    return false;
  }

  if (input.publishabilityScore < 94 || input.candidatePoolSizeAfterFallback < 8) {
    return false;
  }

  if (input.seed.confidenceScore >= 0.33 && input.seed.confidenceGap >= 0.05) {
    return true;
  }

  return (
    input.goodAnswerSource === "actual-purchase-fallback"
    && input.seed.confidenceScore >= 0.28
    && input.seed.confidenceGap >= 0.04
  );
}

export function assessSnapshotPublishability(input: {
  snapshot: MlPuzzleSnapshot;
  goodAnswer: MlChoiceItem;
  distractors: MlChoiceItem[];
  businessRules: MlPuzzleBusinessRulesResult;
}) {
  const reasons: string[] = [];
  const floorGold = getPublishabilityFloorGold(input.snapshot.goldAvailable);
  const goodAnswerAssessment = input.businessRules.debug.goodAnswerGoldAssessment;
  const goodAnswerIsLegitimateComponent = goodAnswerAssessment === "legitimate-component";
  const goodAnswerIsTrivial =
    input.goodAnswer.goldTotal < floorGold
    && !goodAnswerIsLegitimateComponent;

  if (goodAnswerIsTrivial) {
    reasons.push("publishability-trivial-good-answer");
  }

  const credibleDistractors = input.distractors.filter((item) => {
    return isPublishabilityCredibleDistractor({
      item,
      goodAnswer: input.goodAnswer,
      snapshotGold: input.snapshot.goldAvailable,
    });
  });
  const allowedGap = getDistractorDecisionBand(input.goodAnswer.goldTotal, input.snapshot.goldAvailable);

  if (credibleDistractors.length < 3) {
    reasons.push("publishability-insufficient-credible-distractors");
  }

  const publishabilityScore =
    (goodAnswerIsTrivial ? 0 : 60)
    + Math.min(40, credibleDistractors.length * 12)
    - Math.max(0, input.businessRules.debug.goodAnswerViolations.length * 20);

  return {
    publishable: reasons.length === 0,
    reasons,
    publishabilityScore: Number(Math.max(0, publishabilityScore).toFixed(2)),
    floorGold,
    credibleDistractorCount: credibleDistractors.length,
    distractorBandMaxGap: allowedGap,
  };
}

export function calculateQualityScore(input: {
  seed: MlPuzzleSeed;
  prediction: MlPredictNextItemResponse;
  businessRules: MlPuzzleBusinessRulesResult;
  resolvedChoices: MlChoiceResolutionResult;
}) {
  const uniqueCategories = new Set(
    input.resolvedChoices.resolvedItems.map((item) => String(item.category ?? "unknown")),
  ).size;
  const uniqueCostBuckets = new Set(
    input.resolvedChoices.resolvedItems.map((item) => Math.round(item.goldTotal / 500)),
  ).size;

  let score = 0;
  score += Math.min(22, input.businessRules.debug.candidatePoolSizeAfterFallback * 2);
  score += Math.max(0, Math.min(18, input.seed.confidenceScore * 20));
  score += Math.max(0, Math.min(18, input.seed.confidenceGap * 90));
  score += Math.max(0, 14 - input.businessRules.debug.goodAnswerViolations.length * 7);
  score += uniqueCategories * 4;
  score += uniqueCostBuckets * 3;
  score += input.seed.lowConfidence ? 0 : 12;
  score += input.prediction.model_ready ? 6 : 0;
  return Number(score.toFixed(2));
}
