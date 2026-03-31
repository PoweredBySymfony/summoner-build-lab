import { Role } from "@prisma/client";

export type MlPredictNextItemRequest = {
  patch: string;
  champion_slug: string;
  role: string | null;
  gold_available: number;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  timestamp_minutes: number;
  current_items: string[];
  candidate_pool?: string[];
  ally_frontline_count: number;
  ally_magic_damage_count: number;
  ally_physical_damage_count: number;
  ally_support_count: number;
  enemy_frontline_count: number;
  enemy_magic_damage_count: number;
  enemy_physical_damage_count: number;
  enemy_support_count: number;
};

export type MlRankedPrediction = {
  item_slug: string;
  score: number;
};

export type MlPredictNextItemResponse = {
  model_ready: boolean;
  predicted_item_slug: string | null;
  confidence: number | null;
  candidate_pool_size: number;
  top_k_predictions: MlRankedPrediction[];
  model_version: string | null;
  message: string;
};

export type MlPuzzleSnapshot = {
  patch: string;
  championSlug: string;
  role: Role | null;
  goldAvailable: number;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  timestampMinutes: number;
  currentItems: string[];
  allyFrontlineCount: number;
  allyMagicDamageCount: number;
  allyPhysicalDamageCount: number;
  allySupportCount: number;
  enemyFrontlineCount: number;
  enemyMagicDamageCount: number;
  enemyPhysicalDamageCount: number;
  enemySupportCount: number;
};

export type MlPuzzleSeed = {
  goodAnswer: string | null;
  distractors: string[];
  difficulty: "easy" | "medium" | "hard";
  lowConfidence: boolean;
};

const DEFAULT_MIN_CONFIDENCE = 0.35;
const DEFAULT_MIN_CONFIDENCE_GAP = 0.08;
const DEFAULT_DISTRACTOR_COUNT = 3;

export function isMlGenerationConfigured(input: {
  enabled: boolean;
  apiUrl?: string | null;
}) {
  return input.enabled && Boolean(input.apiUrl?.trim());
}

export function mapSnapshotToMlPayload(snapshot: MlPuzzleSnapshot): MlPredictNextItemRequest {
  return {
    patch: snapshot.patch,
    champion_slug: snapshot.championSlug,
    role: snapshot.role,
    gold_available: snapshot.goldAvailable,
    level: snapshot.level,
    kills: snapshot.kills,
    deaths: snapshot.deaths,
    assists: snapshot.assists,
    cs: snapshot.cs,
    timestamp_minutes: snapshot.timestampMinutes,
    current_items: snapshot.currentItems,
    ally_frontline_count: snapshot.allyFrontlineCount,
    ally_magic_damage_count: snapshot.allyMagicDamageCount,
    ally_physical_damage_count: snapshot.allyPhysicalDamageCount,
    ally_support_count: snapshot.allySupportCount,
    enemy_frontline_count: snapshot.enemyFrontlineCount,
    enemy_magic_damage_count: snapshot.enemyMagicDamageCount,
    enemy_physical_damage_count: snapshot.enemyPhysicalDamageCount,
    enemy_support_count: snapshot.enemySupportCount,
  };
}

export function buildBackendPuzzleSeed(
  prediction: MlPredictNextItemResponse,
  options?: {
    minConfidence?: number;
    minConfidenceGap?: number;
    distractorCount?: number;
  },
): MlPuzzleSeed {
  const minConfidence = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const minConfidenceGap = options?.minConfidenceGap ?? DEFAULT_MIN_CONFIDENCE_GAP;
  const distractorCount = options?.distractorCount ?? DEFAULT_DISTRACTOR_COUNT;
  const topPredictions = prediction.top_k_predictions;
  const confidence = prediction.confidence ?? 0;
  const secondScore = topPredictions[1]?.score ?? 0;
  const confidenceGap = confidence - secondScore;
  const goodAnswer = topPredictions[0]?.item_slug ?? null;
  const distractors = topPredictions
    .slice(1, 1 + distractorCount)
    .map((entry) => entry.item_slug);
  const lowConfidence = (
    !prediction.model_ready
    || !goodAnswer
    || confidence < minConfidence
    || confidenceGap < minConfidenceGap
    || prediction.candidate_pool_size < distractorCount + 1
    || distractors.length < distractorCount
  );

  let difficulty: "easy" | "medium" | "hard" = "hard";
  if (confidence >= 0.7 && confidenceGap >= 0.2) {
    difficulty = "easy";
  } else if (confidence >= 0.45 && confidenceGap >= 0.1) {
    difficulty = "medium";
  }

  return {
    goodAnswer,
    distractors,
    difficulty,
    lowConfidence,
  };
}
