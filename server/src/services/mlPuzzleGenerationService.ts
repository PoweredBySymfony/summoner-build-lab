import {
  GeneratedPuzzleRequestStatus,
  GeneratedPuzzleRequestType,
  Prisma,
  PuzzleChoiceType,
  PuzzleDifficulty,
  PuzzleMode,
  PuzzleSourceType,
  Role,
} from "@prisma/client";
import { env } from "../config/env.js";
import {
  buildBackendPuzzleSeed,
  isLowConfidenceDraftAllowed,
  isMlGenerationConfigured,
  mapSnapshotToMlPayload,
  type MlPredictNextItemResponse,
  type MlPuzzleSeed,
  type MlPuzzleSnapshot,
} from "../lib/ml/mlPuzzle.js";
import {
  buildChoiceSignatureForHistory,
  buildMlPuzzleBusinessRules,
  shuffleResolvedChoices,
} from "../lib/ml/puzzleBusinessRules.js";
import {
  resolveMlChoiceItemRef,
  resolveMlPuzzleChoices,
  toChoiceDebugPayload,
  type MlChoiceItem,
} from "../lib/ml/puzzleChoiceResolution.js";
import { resolveItemSlug } from "../lib/itemSlugAliases.js";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/slug.js";
import { HttpError } from "../utils/http.js";

type ImportedMatchForMl = Awaited<ReturnType<typeof prisma.importedMatch.findUnique>>;

type ScenarioMember = {
  championSlug: string;
  role: Role | null;
  items: string[];
};

type ScenarioSnapshot = {
  currentBuild: string[];
  allyTeam: ScenarioMember[];
  enemyTeam: ScenarioMember[];
};

type SnapshotCandidate = {
  snapshotIndex: number;
  rawPurchaseIndex: number;
  snapshot: MlPuzzleSnapshot;
  scenario: ScenarioSnapshot;
  relevanceScore: number;
};

type AttemptDebugSummary = {
  snapshotIndex: number;
  snapshotMinute: number;
  patch: string;
  goldAvailable: number;
  rawCandidatePoolSize: number;
  filteredCandidatePoolSize: number;
  goodAnswer: string | null;
  qualityScore: number;
  rejectionReasons: string[];
  lowConfidence: boolean;
  confidenceScore: number;
  confidenceGap: number;
};

type PreparedSnapshotAttempt = {
  status: "accepted";
  snapshotIndex: number;
  rawPurchaseIndex: number;
  snapshot: MlPuzzleSnapshot;
  scenario: ScenarioSnapshot;
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

type RejectedSnapshotAttempt = {
  status: "rejected";
  snapshotIndex: number;
  rawPurchaseIndex: number;
  snapshot: MlPuzzleSnapshot;
  payload: ReturnType<typeof mapSnapshotToMlPayload>;
  prediction: MlPredictNextItemResponse | null;
  seed: MlPuzzleSeed | null;
  rejectionReasons: string[];
  debugSummary: AttemptDebugSummary;
  details?: Prisma.InputJsonValue;
};

type SnapshotAttempt = PreparedSnapshotAttempt | RejectedSnapshotAttempt;

type MatchGenerationCompletedResponse = {
  generationStatus: "completed";
  requestId: string;
  slug: string;
  slugs: string[];
  sourceType: "ai_generated";
  published: false;
  lowConfidence: boolean;
  draft: boolean;
  message?: string;
};

type MatchGenerationNoViableResponse = {
  generationStatus: "no_viable_snapshot_found";
  requestId: string;
  slug: null;
  slugs: [];
  sourceType: "ai_generated";
  published: false;
  lowConfidence: false;
  draft: false;
  retrySuggested: true;
  message: string;
};

export type MatchGenerationResponse =
  | MatchGenerationCompletedResponse
  | MatchGenerationNoViableResponse;

const PHYSICAL_TAGS = new Set(["Marksman", "Assassin", "Fighter"]);
const MAGIC_TAGS = new Set(["Mage", "Support"]);
const FRONTLINE_TAGS = new Set(["Tank", "Fighter"]);
const MIN_SNAPSHOT_MINUTE = 8;
const MAX_SNAPSHOT_MINUTE = 32;
const MAX_SNAPSHOT_CANDIDATES = 8;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return 0;
}

function normalizeRole(value: unknown): Role | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  switch (normalized) {
    case "TOP":
      return Role.TOP;
    case "JUNGLE":
      return Role.JUNGLE;
    case "MIDDLE":
    case "MID":
      return Role.MID;
    case "BOTTOM":
    case "BOT":
    case "ADC":
    case "CARRY":
      return Role.ADC;
    case "UTILITY":
    case "SUPPORT":
      return Role.SUPPORT;
    default:
      return null;
  }
}

function resolveParticipantRole(participant: Record<string, unknown>) {
  return (
    normalizeRole(participant.teamPosition) ??
    normalizeRole(participant.individualPosition) ??
    normalizeRole(participant.role) ??
    normalizeRole(participant.lane)
  );
}

function removeItemOnce(items: number[], itemId: number) {
  const index = items.indexOf(itemId);
  if (index >= 0) {
    items.splice(index, 1);
  }
}

function buildChampionProfile(tags: string[]) {
  return {
    frontline: Number(tags.some((tag) => FRONTLINE_TAGS.has(tag))),
    physical: Number(tags.some((tag) => PHYSICAL_TAGS.has(tag))),
    magic: Number(tags.some((tag) => MAGIC_TAGS.has(tag))),
    support: Number(tags.includes("Support")),
  };
}

function isMlConfigured() {
  return isMlGenerationConfigured({
    enabled: env.ML_ENABLED,
    apiUrl: env.ML_API_URL,
  });
}

function buildMlRequestMetadata(input: {
  generationStatus: MatchGenerationResponse["generationStatus"];
  selectedAttempt?: PreparedSnapshotAttempt;
  attemptSummaries: AttemptDebugSummary[];
  payload?: Record<string, unknown>;
}) {
  return {
    generationStatus: input.generationStatus,
    selectedSnapshot:
      input.selectedAttempt
        ? {
            snapshotIndex: input.selectedAttempt.snapshotIndex,
            rawPurchaseIndex: input.selectedAttempt.rawPurchaseIndex,
            snapshotMinute: input.selectedAttempt.snapshot.timestampMinutes,
            qualityScore: input.selectedAttempt.qualityScore,
            variationSeed: input.selectedAttempt.variationSeed,
            choiceSignature: input.selectedAttempt.choiceSignature,
          }
        : null,
    attemptsSummary: {
      snapshotsEvaluated: input.attemptSummaries.length,
      successfulSnapshots: input.attemptSummaries.filter((entry) => entry.rejectionReasons.length === 0).length,
      attempts: input.attemptSummaries,
    },
    payload: input.payload as Prisma.InputJsonValue | undefined,
    prediction: input.selectedAttempt?.prediction as Prisma.InputJsonValue | undefined,
    seed: input.selectedAttempt?.seed as Prisma.InputJsonValue | undefined,
    businessRules: input.selectedAttempt
      ? ({
          ...input.selectedAttempt.businessRules.debug,
          choiceSignature: input.selectedAttempt.choiceSignature,
          variationSeed: input.selectedAttempt.variationSeed,
        } as Prisma.InputJsonValue)
      : undefined,
  } as Prisma.InputJsonValue;
}

async function postPrediction(payload: object): Promise<MlPredictNextItemResponse> {
  if (!env.ML_API_URL) {
    throw new HttpError(503, "ML_API_URL is not configured.");
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= env.ML_API_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ML_API_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.ML_API_URL.replace(/\/$/, "")}/predict-next-item`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpError(response.status, `ML API request failed with status ${response.status}.`);
      }

      return (await response.json()) as MlPredictNextItemResponse;
    } catch (error) {
      lastError = error;
      if (attempt === env.ML_API_RETRY_COUNT) {
        break;
      }
      await sleep(200 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof HttpError) {
    throw lastError;
  }
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new HttpError(504, "ML API request timed out.");
  }
  throw new HttpError(502, "Unable to reach ML API.");
}

async function getItemsBySlugs(slugs: string[]) {
  const requested = [...new Set(slugs.map((slug) => resolveItemSlug(slug)))];
  const items = await prisma.item.findMany({
    where: {
      slug: { in: requested },
    },
  });
  return new Map(items.map((item) => [item.slug, item]));
}

async function getPatchChoiceItems(patch: string) {
  const items = await prisma.item.findMany({
    where: {
      isActive: true,
      patch: {
        startsWith: patch,
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      riotItemId: true,
      goldTotal: true,
      patch: true,
      category: true,
      tags: true,
      isBoots: true,
      isLegendary: true,
      isConsumable: true,
      isStarter: true,
      isTrinket: true,
      isActive: true,
    },
  });

  return items.map(
    (item): MlChoiceItem => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
    }),
  );
}

async function getPreviousChoiceSignatures(input: {
  importedMatchId: string;
  userId: string;
}) {
  const requests = await prisma.generatedPuzzleRequest.findMany({
    where: {
      importedMatchId: input.importedMatchId,
      userId: input.userId,
      status: GeneratedPuzzleRequestStatus.COMPLETED,
      resultPuzzleId: { not: null },
    },
    select: {
      resultPuzzle: {
        select: {
          sourceType: true,
          choices: {
            select: {
              item: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return requests
    .filter((requestRecord) => requestRecord.resultPuzzle?.sourceType === PuzzleSourceType.AI_GENERATED)
    .map((requestRecord) =>
      requestRecord.resultPuzzle?.choices
        .map((choice) => choice.item?.slug)
        .filter((slug): slug is string => Boolean(slug)) ?? [],
    )
    .filter((slugs) => slugs.length === 4)
    .map((slugs) => [...slugs].sort().join("|"));
}

function scoreSnapshotCandidate(snapshot: MlPuzzleSnapshot) {
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

function dedupeAndRankSnapshots(candidates: SnapshotCandidate[]) {
  const sorted = [...candidates]
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .filter((candidate) => candidate.relevanceScore >= 0);
  const kept: SnapshotCandidate[] = [];

  for (const candidate of sorted) {
    const candidateSignature = [...candidate.snapshot.currentItems].sort().join("|");
    const duplicate = kept.find((existing) => {
      const existingSignature = [...existing.snapshot.currentItems].sort().join("|");
      return (
        candidateSignature === existingSignature
        && Math.abs(existing.snapshot.timestampMinutes - candidate.snapshot.timestampMinutes) < 3
      );
    });
    if (duplicate) {
      continue;
    }
    kept.push(candidate);
    if (kept.length >= MAX_SNAPSHOT_CANDIDATES) {
      break;
    }
  }

  return kept.sort((left, right) => left.snapshot.timestampMinutes - right.snapshot.timestampMinutes);
}

async function buildSnapshotCandidatesFromImportedMatch(
  importedMatch: NonNullable<ImportedMatchForMl>,
): Promise<SnapshotCandidate[]> {
  const matchData = importedMatch.matchData as Prisma.JsonObject;
  const timelineData = importedMatch.timelineData as Prisma.JsonObject | null;
  const matchRaw = matchData.raw as Prisma.JsonObject | undefined;
  const timelineRaw = timelineData?.raw as Prisma.JsonObject | undefined;
  const info = matchRaw?.info as Prisma.JsonObject | undefined;
  const timelineInfo = timelineRaw?.info as Prisma.JsonObject | undefined;
  const participants = Array.isArray(info?.participants)
    ? (info?.participants as Array<Record<string, unknown>>)
    : [];
  const frames = Array.isArray(timelineInfo?.frames)
    ? (timelineInfo?.frames as Array<Record<string, unknown>>)
    : [];

  if (!participants.length || !frames.length || !importedMatch.targetPuuid) {
    throw new HttpError(400, "Imported match does not contain enough data for ML generation.");
  }

  const targetParticipant = participants.find(
    (entry) => String(entry.puuid ?? "") === importedMatch.targetPuuid,
  );
  if (!targetParticipant) {
    throw new HttpError(400, "Target participant was not found in imported match data.");
  }

  const participantId = safeInt(targetParticipant.participantId);
  const ownTeamId = safeInt(targetParticipant.teamId);
  const championIds = [...new Set(participants.map((entry) => safeInt(entry.championId)).filter((id) => id > 0))];
  const champions = await prisma.champion.findMany({
    where: {
      riotChampionId: { in: championIds },
    },
    select: {
      riotChampionId: true,
      slug: true,
      tags: true,
    },
  });
  const championIndex = new Map(
    champions.map((champion) => [
      champion.riotChampionId ?? 0,
      {
        slug: champion.slug,
        tags: Array.isArray(champion.tags) ? champion.tags.map((tag) => String(tag)) : [],
      },
    ]),
  );

  const itemIdsSeen = new Set<number>();
  for (const frame of frames) {
    const events = Array.isArray(frame.events) ? (frame.events as Array<Record<string, unknown>>) : [];
    for (const event of events) {
      if (safeInt(event.participantId) !== participantId) {
        continue;
      }
      const itemId = safeInt(event.itemId);
      const beforeId = safeInt(event.beforeId);
      const afterId = safeInt(event.afterId);
      if (itemId > 0) {
        itemIdsSeen.add(itemId);
      }
      if (beforeId > 0) {
        itemIdsSeen.add(beforeId);
      }
      if (afterId > 0) {
        itemIdsSeen.add(afterId);
      }
    }
  }

  const itemRows = itemIdsSeen.size
    ? await prisma.item.findMany({
        where: {
          riotItemId: { in: [...itemIdsSeen] },
        },
        select: {
          riotItemId: true,
          slug: true,
        },
      })
    : [];
  const itemSlugIndex = new Map(itemRows.map((item) => [item.riotItemId, item.slug]));

  const allyTeam: ScenarioMember[] = [];
  const enemyTeam: ScenarioMember[] = [];
  let allyFrontlineCount = 0;
  let allyMagicDamageCount = 0;
  let allyPhysicalDamageCount = 0;
  let allySupportCount = 0;
  let enemyFrontlineCount = 0;
  let enemyMagicDamageCount = 0;
  let enemyPhysicalDamageCount = 0;
  let enemySupportCount = 0;

  for (const participant of participants) {
    const champion = championIndex.get(safeInt(participant.championId));
    if (!champion) {
      continue;
    }

    const profile = buildChampionProfile(champion.tags);
    const member = {
      championSlug: champion.slug,
      role: resolveParticipantRole(participant),
      items: [],
    };

    if (safeInt(participant.teamId) === ownTeamId) {
      allyTeam.push(member);
      allyFrontlineCount += profile.frontline;
      allyMagicDamageCount += profile.magic;
      allyPhysicalDamageCount += profile.physical;
      allySupportCount += profile.support;
    } else {
      enemyTeam.push(member);
      enemyFrontlineCount += profile.frontline;
      enemyMagicDamageCount += profile.magic;
      enemyPhysicalDamageCount += profile.physical;
      enemySupportCount += profile.support;
    }
  }

  const sortedFrames = frames
    .filter((frame) => typeof frame === "object" && frame !== null)
    .sort((left, right) => safeInt(left.timestamp) - safeInt(right.timestamp));
  const inventory: number[] = [];
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  const rawCandidates: SnapshotCandidate[] = [];

  for (const frame of sortedFrames) {
    const participantFrames = frame.participantFrames as Record<string, Record<string, unknown>> | undefined;
    const participantFrame = participantFrames?.[String(participantId)] ?? {};
    const events = Array.isArray(frame.events) ? (frame.events as Array<Record<string, unknown>>) : [];

    for (const event of events) {
      const eventType = String(event.type ?? "");
      const eventParticipantId = safeInt(event.participantId);

      if (eventType === "CHAMPION_KILL") {
        if (safeInt(event.killerId) === participantId) {
          kills += 1;
        }
        if (safeInt(event.victimId) === participantId) {
          deaths += 1;
        }
        if (
          Array.isArray(event.assistingParticipantIds) &&
          event.assistingParticipantIds.map((value) => safeInt(value)).includes(participantId)
        ) {
          assists += 1;
        }
      }

      if (eventParticipantId !== participantId) {
        continue;
      }

      const itemId = safeInt(event.itemId);
      if (eventType === "ITEM_PURCHASED" && itemId > 0) {
        const currentBuild = inventory
          .map((value) => itemSlugIndex.get(value))
          .filter((value): value is string => Boolean(value));
        const snapshot = {
          patch: importedMatch.patch ?? "unknown",
          championSlug: importedMatch.targetChampionSlug ?? "",
          role: importedMatch.targetRole,
          goldAvailable: safeInt(participantFrame.currentGold),
          level: safeInt(participantFrame.level),
          kills,
          deaths,
          assists,
          cs: safeInt(participantFrame.minionsKilled) + safeInt(participantFrame.jungleMinionsKilled),
          timestampMinutes: safeInt(event.timestamp) / 60000,
          currentItems: currentBuild,
          allyFrontlineCount,
          allyMagicDamageCount,
          allyPhysicalDamageCount,
          allySupportCount,
          enemyFrontlineCount,
          enemyMagicDamageCount,
          enemyPhysicalDamageCount,
          enemySupportCount,
        } satisfies MlPuzzleSnapshot;
        rawCandidates.push({
          snapshotIndex: rawCandidates.length,
          rawPurchaseIndex: rawCandidates.length,
          snapshot,
          scenario: {
            currentBuild,
            allyTeam,
            enemyTeam,
          },
          relevanceScore: scoreSnapshotCandidate(snapshot),
        });
        inventory.push(itemId);
        continue;
      }

      if ((eventType === "ITEM_SOLD" || eventType === "ITEM_DESTROYED") && itemId > 0) {
        removeItemOnce(inventory, itemId);
      }
      if (eventType === "ITEM_UNDO") {
        removeItemOnce(inventory, safeInt(event.beforeId));
        if (safeInt(event.afterId) > 0) {
          inventory.push(safeInt(event.afterId));
        }
      }
    }
  }

  const filtered = rawCandidates.filter(
    (candidate) =>
      candidate.snapshot.currentItems.length >= 1
      && candidate.snapshot.currentItems.length <= 5
      && candidate.snapshot.level >= 6,
  );
  const deduped = dedupeAndRankSnapshots(filtered);

  if (deduped.length > 0) {
    return deduped;
  }
  if (rawCandidates.length > 0) {
    return [rawCandidates[rawCandidates.length - 1]];
  }
  throw new HttpError(400, "No purchase snapshot could be reconstructed from the imported match.");
}

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
    debugSummary: {
      snapshotIndex: input.candidate.snapshotIndex,
      snapshotMinute: Number(input.candidate.snapshot.timestampMinutes.toFixed(2)),
      patch: input.candidate.snapshot.patch,
      goldAvailable: input.candidate.snapshot.goldAvailable,
      rawCandidatePoolSize: input.rawCandidatePoolSize,
      filteredCandidatePoolSize: input.filteredCandidatePoolSize,
      goodAnswer: input.goodAnswer,
      qualityScore: input.qualityScore ?? 0,
      rejectionReasons: input.rejectionReasons,
      lowConfidence: input.seed?.lowConfidence ?? false,
      confidenceScore: input.seed?.confidenceScore ?? 0,
      confidenceGap: input.seed?.confidenceGap ?? 0,
    },
    details: input.details,
  };
}

function calculateQualityScore(input: {
  seed: MlPuzzleSeed;
  prediction: MlPredictNextItemResponse;
  businessRules: ReturnType<typeof buildMlPuzzleBusinessRules>;
  resolvedChoices: ReturnType<typeof resolveMlPuzzleChoices>;
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

function logSnapshotAttempt(requestId: string, importedMatchId: string, attempt: SnapshotAttempt) {
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

async function prepareSnapshotAttempt(input: {
  importedMatchId: string;
  userId: string;
  championTags: string[];
  candidate: SnapshotCandidate;
  patchChoiceItems: MlChoiceItem[];
  previousChoiceSignatures: string[];
}): Promise<SnapshotAttempt> {
  const payload = mapSnapshotToMlPayload(input.candidate.snapshot);

  try {
    const prediction = await postPrediction(payload);
    const seed = buildBackendPuzzleSeed(prediction);
    const resolvedGoodAnswer = resolveMlChoiceItemRef(seed.goodAnswer, input.patchChoiceItems);
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
      });
    }

    const variationSeed = `${input.importedMatchId}:${input.userId}:${input.candidate.snapshotIndex}:${Date.now()}`;
    const rankedResolvedItems = prediction.top_k_predictions
      .map((entry) => resolveMlChoiceItemRef(entry.item_slug, input.patchChoiceItems))
      .filter((item): item is MlChoiceItem => Boolean(item));
    const businessRules = buildMlPuzzleBusinessRules({
      snapshot: input.candidate.snapshot,
      championTags: input.championTags,
      goodAnswer: resolvedGoodAnswer,
      rankedCandidates: rankedResolvedItems,
      availableItems: input.patchChoiceItems,
      previousChoiceSignatures: input.previousChoiceSignatures,
      variationSeed,
    });

    const rejectionReasons: string[] = [];
    if (seed.lowConfidence) {
      rejectionReasons.push("low-confidence");
    }
    if (businessRules.debug.goodAnswerViolations.length > 0) {
      rejectionReasons.push(...businessRules.debug.goodAnswerViolations.map((reason) => `good-answer-${reason}`));
    }
    if (businessRules.debug.candidatePoolSizeAfterFallback < 6) {
      rejectionReasons.push("candidate-pool-too-small");
    }

    const choiceResolutionInput = {
      patch: input.candidate.snapshot.patch,
      currentItemSlugs: input.candidate.snapshot.currentItems,
      goodAnswer: seed.goodAnswer,
      distractors: businessRules.debug.selectedDistractors,
      rankedItemSlugs: businessRules.distractorCandidates.map((item) => item.slug),
      availableItems: [resolvedGoodAnswer, ...businessRules.distractorCandidates],
      fallbackItems: businessRules.distractorCandidates,
    };

    let resolvedChoices: ReturnType<typeof resolveMlPuzzleChoices> | null = null;
    try {
      resolvedChoices = resolveMlPuzzleChoices(choiceResolutionInput);
    } catch (error) {
      rejectionReasons.push(`choice-resolution-${error instanceof Error ? error.message : String(error)}`);
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
        details: {
          businessRules: businessRules.debug,
          choiceResolution: resolvedChoices ? toChoiceDebugPayload(resolvedChoices) : null,
        } as Prisma.InputJsonValue,
      });
    }

    const qualityScore = calculateQualityScore({
      seed,
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
      snapshotIndex: input.candidate.snapshotIndex,
      rawPurchaseIndex: input.candidate.rawPurchaseIndex,
      snapshot: input.candidate.snapshot,
      scenario: input.candidate.scenario,
      payload,
      prediction,
      seed,
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
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: businessRules.debug.candidatePoolSizeAfterFallback,
        goodAnswer: resolvedChoices.goodAnswer.slug,
        qualityScore,
        rejectionReasons: [],
        lowConfidence: seed.lowConfidence,
        confidenceScore: seed.confidenceScore,
        confidenceGap: seed.confidenceGap,
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
      details:
        error instanceof HttpError
          ? ({ status: error.status, details: error.details } as Prisma.InputJsonValue)
          : undefined,
    });
  }
}

function selectBestAttempt(input: {
  attempts: SnapshotAttempt[];
  allowLowConfidenceDraft: boolean;
}) {
  const accepted = input.attempts.filter((attempt): attempt is PreparedSnapshotAttempt => attempt.status === "accepted");
  const publishedCandidates = accepted.filter((attempt) => !attempt.seed.lowConfidence);
  const draftCandidates = accepted.filter((attempt) => attempt.seed.lowConfidence);
  const byScore = (left: PreparedSnapshotAttempt, right: PreparedSnapshotAttempt) =>
    right.qualityScore - left.qualityScore;

  if (publishedCandidates.length > 0) {
    return {
      selectedAttempt: [...publishedCandidates].sort(byScore)[0],
      draft: false,
    };
  }

  if (input.allowLowConfidenceDraft && draftCandidates.length > 0) {
    return {
      selectedAttempt: [...draftCandidates].sort(byScore)[0],
      draft: true,
    };
  }

  return {
    selectedAttempt: null,
    draft: false,
  };
}

async function persistAiGeneratedPuzzle(input: {
  championId: string;
  championName: string;
  championSlug: string;
  attempt: PreparedSnapshotAttempt;
  draft: boolean;
}) {
  const choiceSlugs = [
    input.attempt.resolvedChoices.goodAnswer.slug,
    ...input.attempt.resolvedChoices.distractors.map((item) => item.slug),
  ];
  const itemIndex = await getItemsBySlugs(choiceSlugs);
  const orderedChoices = shuffleResolvedChoices(
    input.attempt.resolvedChoices.goodAnswer,
    input.attempt.resolvedChoices.distractors,
    input.attempt.variationSeed,
  );
  const metadataSummary = [
    `lowConfidence=${input.attempt.seed.lowConfidence}`,
    `confidence=${input.attempt.seed.confidenceScore.toFixed(4)}`,
    `gap=${input.attempt.seed.confidenceGap.toFixed(4)}`,
    `candidatePoolSize=${input.attempt.seed.candidatePoolSize}`,
    `snapshotMinute=${input.attempt.snapshot.timestampMinutes.toFixed(2)}`,
    `snapshotIndex=${input.attempt.snapshotIndex}`,
    `qualityScore=${input.attempt.qualityScore.toFixed(2)}`,
    `variationSeed=${input.attempt.variationSeed}`,
    `choiceSignature=${input.attempt.choiceSignature}`,
  ].join(" | ");

  return prisma.puzzle.create({
    data: {
      title: `${input.championName} AI item puzzle`,
      slug: slugify(`${input.championSlug}-ai-generated-${Date.now()}`),
      mode: PuzzleMode.PERSONALIZED,
      sourceType: PuzzleSourceType.AI_GENERATED,
      difficulty:
        input.attempt.seed.difficulty === "easy"
          ? PuzzleDifficulty.BEGINNER
          : input.attempt.seed.difficulty === "medium"
            ? PuzzleDifficulty.INTERMEDIATE
            : PuzzleDifficulty.ADVANCED,
      patch: input.attempt.snapshot.patch,
      description: input.draft
        ? `Brouillon genere par le service ML pour ${input.championName}, a revoir avant toute publication.`
        : `Puzzle genere par le service ML pour ${input.championName}.`,
      shortPrompt: input.draft
        ? `Brouillon ML faible confiance pour ${input.championName}.`
        : `Le modele propose le prochain item le plus coherent pour ${input.championName}.`,
      situation: `Tu joues ${input.championName} vers ${input.attempt.snapshot.timestampMinutes.toFixed(1)} minutes avec ${input.attempt.snapshot.goldAvailable} gold disponible.`,
      question: "Quel est le meilleur prochain achat dans cette situation ?",
      explanation: `La prediction ML privilegie ${itemIndex.get(resolveItemSlug(input.attempt.resolvedChoices.goodAnswer.slug))?.name ?? input.attempt.resolvedChoices.goodAnswer.slug}.`,
      role: input.attempt.snapshot.role,
      championId: input.championId,
      isPublished: false,
      isDailyEligible: false,
      choices: {
        create: orderedChoices.map(({ item: resolvedItem, isCorrect }, index) => {
          const item = itemIndex.get(resolveItemSlug(resolvedItem.slug))!;
          return {
            label: item.name,
            choiceType: item.isBoots ? PuzzleChoiceType.BOOTS : PuzzleChoiceType.ITEM,
            itemId: item.id,
            explanation: isCorrect
              ? "Choix principal du modele ranking."
              : "Distracteur plausible propose pour revue manuelle.",
            isCorrect,
            displayOrder: index + 1,
          };
        }),
      },
      scenario: {
        create: {
          playerChampionId: input.championId,
          playerRole: input.attempt.snapshot.role ?? Role.FLEX,
          gameMinute: Math.max(1, Math.round(input.attempt.snapshot.timestampMinutes)),
          playerGold: input.attempt.snapshot.goldAvailable,
          playerLevel: input.attempt.snapshot.level,
          kills: input.attempt.snapshot.kills,
          deaths: input.attempt.snapshot.deaths,
          assists: input.attempt.snapshot.assists,
          cs: input.attempt.snapshot.cs,
          currentBuild: input.attempt.scenario.currentBuild as Prisma.InputJsonValue,
          allyTeam: input.attempt.scenario.allyTeam as Prisma.InputJsonValue,
          enemyTeam: input.attempt.scenario.enemyTeam as Prisma.InputJsonValue,
          objectiveState: input.attempt.businessRules.objectiveState as Prisma.InputJsonValue,
          damageProfile: input.attempt.businessRules.damageProfile as Prisma.InputJsonValue,
          mapState: input.attempt.businessRules.mapState as Prisma.InputJsonValue,
          notes: `${input.attempt.businessRules.notes} ${metadataSummary}`,
        },
      },
      tags: {
        create: [
          "ai-generated",
          "ml",
          "next-item",
          "ml-draft",
          ...(input.draft ? ["low-confidence"] : []),
        ].map((tag) => ({
          tag: {
            connectOrCreate: {
              where: { slug: slugify(tag) },
              create: { slug: slugify(tag), name: tag },
            },
          },
        })),
      },
    },
  });
}

async function updateGeneratedRequest(input: {
  requestId: string;
  status: GeneratedPuzzleRequestStatus;
  parameters: Prisma.InputJsonValue;
  resultPuzzleId?: string;
}) {
  await prisma.generatedPuzzleRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.status,
      parameters: input.parameters,
      resultPuzzleId: input.resultPuzzleId,
    },
  });
}

export const mlPuzzleGenerationService = {
  isConfigured() {
    return isMlConfigured();
  },

  async generateFromImportedMatch(
    importedMatchId: string,
    userId: string,
    options?: {
      forceDraftOnLowConfidence?: boolean;
      actorIsAdmin?: boolean;
    },
  ): Promise<MatchGenerationResponse> {
    if (!isMlConfigured()) {
      throw new HttpError(503, "ML puzzle generation is not configured.");
    }

    const request = await prisma.generatedPuzzleRequest.create({
      data: {
        userId,
        type: GeneratedPuzzleRequestType.MATCH_BASED,
        importedMatchId,
        status: GeneratedPuzzleRequestStatus.PROCESSING,
        parameters: { mode: "ml-api-multi-snapshot" },
      },
    });

    try {
      const importedMatch = await prisma.importedMatch.findUnique({
        where: { id: importedMatchId },
      });
      if (!importedMatch) {
        throw new HttpError(404, "Imported match not found.");
      }

      const champion = await prisma.champion.findUnique({
        where: { slug: importedMatch.targetChampionSlug ?? "" },
      });
      if (!champion) {
        throw new HttpError(400, "Champion not found for AI-generated puzzle.");
      }

      const allowLowConfidenceDraft = isLowConfidenceDraftAllowed({
        isAdmin: Boolean(options?.actorIsAdmin),
        envEnabled: env.ML_ALLOW_LOW_CONFIDENCE_DRAFTS,
        forceDraftOnLowConfidence: options?.forceDraftOnLowConfidence,
      });
      const snapshotCandidates = await buildSnapshotCandidatesFromImportedMatch(importedMatch);
      const patchChoiceItems = await getPatchChoiceItems(importedMatch.patch ?? snapshotCandidates[0]?.snapshot.patch ?? "unknown");
      const previousChoiceSignatures = await getPreviousChoiceSignatures({
        importedMatchId,
        userId,
      });
      const championTags = Array.isArray(champion.tags) ? champion.tags.map((tag) => String(tag)) : [];
      const attempts: SnapshotAttempt[] = [];

      for (const candidate of snapshotCandidates) {
        const attempt = await prepareSnapshotAttempt({
          importedMatchId,
          userId,
          championTags,
          candidate,
          patchChoiceItems,
          previousChoiceSignatures,
        });
        attempts.push(attempt);
        logSnapshotAttempt(request.id, importedMatchId, attempt);
      }

      const selection = selectBestAttempt({
        attempts,
        allowLowConfidenceDraft,
      });

      if (selection.selectedAttempt) {
        const puzzle = await persistAiGeneratedPuzzle({
          championId: champion.id,
          championName: champion.name,
          championSlug: champion.slug,
          attempt: selection.selectedAttempt,
          draft: selection.draft,
        });
        await updateGeneratedRequest({
          requestId: request.id,
          status: GeneratedPuzzleRequestStatus.COMPLETED,
          resultPuzzleId: puzzle.id,
          parameters: buildMlRequestMetadata({
            generationStatus: "completed",
            selectedAttempt: selection.selectedAttempt,
            attemptSummaries: attempts.map((attempt) => attempt.debugSummary),
            payload: selection.selectedAttempt.payload,
          }),
        });
        console.info(
          "[ml-puzzle] selected-snapshot",
          JSON.stringify({
            requestId: request.id,
            importedMatchId,
            selectedSnapshotIndex: selection.selectedAttempt.snapshotIndex,
            snapshotMinute: selection.selectedAttempt.snapshot.timestampMinutes,
            qualityScore: selection.selectedAttempt.qualityScore,
            lowConfidence: selection.selectedAttempt.seed.lowConfidence,
            draft: selection.draft,
          }),
        );

        return {
          generationStatus: "completed",
          requestId: request.id,
          slug: puzzle.slug,
          slugs: [puzzle.slug],
          sourceType: "ai_generated",
          published: false,
          lowConfidence: selection.selectedAttempt.seed.lowConfidence,
          draft: selection.draft,
        };
      }

      await updateGeneratedRequest({
        requestId: request.id,
        status: GeneratedPuzzleRequestStatus.FAILED,
        parameters: buildMlRequestMetadata({
          generationStatus: "no_viable_snapshot_found",
          attemptSummaries: attempts.map((attempt) => attempt.debugSummary),
        }),
      });
      console.warn(
        "[ml-puzzle] no-viable-snapshot",
        JSON.stringify({
          requestId: request.id,
          importedMatchId,
          snapshotsEvaluated: attempts.length,
        }),
      );

      return {
        generationStatus: "no_viable_snapshot_found",
        requestId: request.id,
        slug: null,
        slugs: [],
        sourceType: "ai_generated",
        published: false,
        lowConfidence: false,
        draft: false,
        retrySuggested: true,
        message: "Aucun snapshot suffisamment credible n'a ete trouve sur cette partie. Le backend a essaye plusieurs moments d'achat et tu peux relancer plus tard apres enrichissement du modele.",
      };
    } catch (error) {
      await updateGeneratedRequest({
        requestId: request.id,
        status: GeneratedPuzzleRequestStatus.FAILED,
        parameters: {
          generationStatus: "failed",
          reason: error instanceof Error ? error.message : String(error),
        } as Prisma.InputJsonValue,
      });
      throw error;
    }
  },
};

export const mlPuzzleGenerationServiceTestables = {
  scoreSnapshotCandidate,
  dedupeAndRankSnapshots,
  selectBestAttempt,
};
