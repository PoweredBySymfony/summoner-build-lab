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
  type MlPuzzleSeed,
  type MlPredictNextItemResponse,
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
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/slug.js";
import { resolveItemSlug } from "../lib/itemSlugAliases.js";
import { HttpError } from "../utils/http.js";

type ImportedMatchForMl = Awaited<ReturnType<typeof prisma.importedMatch.findUnique>>;

type ScenarioMember = {
  championSlug: string;
  role: Role | null;
  items: string[];
};

const PHYSICAL_TAGS = new Set(["Marksman", "Assassin", "Fighter"]);
const MAGIC_TAGS = new Set(["Mage", "Support"]);
const FRONTLINE_TAGS = new Set(["Tank", "Fighter"]);

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
  snapshot: MlPuzzleSnapshot;
  prediction: MlPredictNextItemResponse;
  seed: MlPuzzleSeed;
  forcedDraft: boolean;
  payload: Record<string, unknown>;
  businessRules?: Prisma.InputJsonValue;
}): Prisma.InputJsonValue {
  return {
    payload: input.payload as Prisma.InputJsonValue,
    prediction: input.prediction as Prisma.InputJsonValue,
    seed: input.seed as Prisma.InputJsonValue,
    draft: {
      forced: input.forcedDraft,
      lowConfidence: input.seed.lowConfidence,
    } as Prisma.InputJsonValue,
    metrics: {
      confidenceScore: input.seed.confidenceScore,
      confidenceGap: input.seed.confidenceGap,
      candidatePoolSize: input.seed.candidatePoolSize,
      modelVersion: input.prediction.model_version,
      predictedItemSlug: input.prediction.predicted_item_slug,
      snapshotTimestampMinutes: input.snapshot.timestampMinutes,
    } as Prisma.InputJsonValue,
    businessRules: input.businessRules,
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

async function buildSnapshotFromImportedMatch(
  importedMatch: NonNullable<ImportedMatchForMl>,
): Promise<{
  snapshot: MlPuzzleSnapshot;
  scenario: {
    currentBuild: string[];
    allyTeam: ScenarioMember[];
    enemyTeam: ScenarioMember[];
  };
}> {
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
  let latestSnapshot: MlPuzzleSnapshot | null = null;
  let latestBuild: string[] = [];

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
        latestBuild = inventory
          .map((value) => itemSlugIndex.get(value))
          .filter((value): value is string => Boolean(value));
        latestSnapshot = {
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
          currentItems: latestBuild,
          allyFrontlineCount,
          allyMagicDamageCount,
          allyPhysicalDamageCount,
          allySupportCount,
          enemyFrontlineCount,
          enemyMagicDamageCount,
          enemyPhysicalDamageCount,
          enemySupportCount,
        };
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

  if (!latestSnapshot) {
    throw new HttpError(400, "No purchase snapshot could be reconstructed from the imported match.");
  }

  return {
    snapshot: latestSnapshot,
    scenario: {
      currentBuild: latestBuild,
      allyTeam,
      enemyTeam,
    },
  };
}

async function createAiGeneratedPuzzle(input: {
  userId: string;
  importedMatchId: string;
  snapshot: MlPuzzleSnapshot;
  scenario: { currentBuild: string[]; allyTeam: ScenarioMember[]; enemyTeam: ScenarioMember[] };
  seed: MlPuzzleSeed;
  prediction: MlPredictNextItemResponse;
  forcedDraft: boolean;
}) {
  const champion = await prisma.champion.findUnique({
    where: { slug: input.snapshot.championSlug },
  });
  if (!champion) {
    throw new HttpError(400, "Champion not found for AI-generated puzzle.");
  }

  const patchChoiceItems = await getPatchChoiceItems(input.snapshot.patch);
  const resolvedGoodAnswer = resolveMlChoiceItemRef(input.seed.goodAnswer, patchChoiceItems);
  if (!resolvedGoodAnswer) {
    const debugPayload = {
      patch: input.snapshot.patch,
      goodAnswer: input.seed.goodAnswer,
      candidatePoolSize: input.prediction.candidate_pool_size,
      reason: "good-answer-unresolved-before-business-rules",
    };
    console.error("[ml-puzzle] choice-resolution-failed", JSON.stringify(debugPayload));
    throw new HttpError(
      422,
      "ML output could not resolve the predicted item against the current patch catalog.",
      debugPayload,
    );
  }

  const rankedResolvedItems = input.prediction.top_k_predictions
    .map((entry) => resolveMlChoiceItemRef(entry.item_slug, patchChoiceItems))
    .filter((item): item is MlChoiceItem => Boolean(item));
  const previousChoiceSignatures = await getPreviousChoiceSignatures({
    importedMatchId: input.importedMatchId,
    userId: input.userId,
  });
  const variationSeed = `${input.importedMatchId}:${input.userId}:${Date.now()}`;
  const championTags = Array.isArray(champion.tags) ? champion.tags.map((tag) => String(tag)) : [];
  const businessRules = buildMlPuzzleBusinessRules({
    snapshot: input.snapshot,
    championTags,
    goodAnswer: resolvedGoodAnswer,
    rankedCandidates: rankedResolvedItems,
    availableItems: patchChoiceItems,
    previousChoiceSignatures,
    variationSeed,
  });
  if (businessRules.debug.goodAnswerViolations.length > 0) {
    const debugPayload = {
      patch: input.snapshot.patch,
      goodAnswer: resolvedGoodAnswer.slug,
      candidatePoolSize: input.prediction.candidate_pool_size,
      businessRules: businessRules.debug,
      reason: "good-answer-failed-business-rules",
    };
    console.error("[ml-puzzle] choice-resolution-failed", JSON.stringify(debugPayload));
    throw new HttpError(
      422,
      "La prediction ML principale n'est pas assez credible pour construire un puzzle exploitable.",
      debugPayload,
    );
  }
  if (businessRules.debug.candidatePoolSizeAfterFallback < 6) {
    const debugPayload = {
      patch: input.snapshot.patch,
      goodAnswer: resolvedGoodAnswer.slug,
      candidatePoolSize: input.prediction.candidate_pool_size,
      businessRules: businessRules.debug,
      reason: "candidate-pool-too-small-after-business-rules",
    };
    console.error("[ml-puzzle] choice-resolution-failed", JSON.stringify(debugPayload));
    throw new HttpError(
      422,
      "Le pool candidat reste trop faible apres filtrage metier pour creer un puzzle credible.",
      debugPayload,
    );
  }
  const choiceResolutionInput = {
    patch: input.snapshot.patch,
    currentItemSlugs: input.snapshot.currentItems,
    goodAnswer: input.seed.goodAnswer,
    distractors: businessRules.debug.selectedDistractors,
    rankedItemSlugs: businessRules.distractorCandidates.map((item) => item.slug),
    availableItems: [resolvedGoodAnswer, ...businessRules.distractorCandidates],
    fallbackItems: businessRules.distractorCandidates,
  };

  let resolvedChoices: ReturnType<typeof resolveMlPuzzleChoices>;
  try {
    resolvedChoices = resolveMlPuzzleChoices(choiceResolutionInput);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const debugPayload = {
      patch: input.snapshot.patch,
      goodAnswer: input.seed.goodAnswer,
        distractors: input.seed.distractors,
        candidatePoolSize: input.prediction.candidate_pool_size,
        rankedItemSlugs: input.prediction.top_k_predictions.map((entry) => entry.item_slug),
        currentItems: input.snapshot.currentItems,
        businessRules: businessRules.debug,
        reason,
      };
      console.error("[ml-puzzle] choice-resolution-failed", JSON.stringify(debugPayload));
      throw new HttpError(
        422,
      "ML output could not be converted into 1 valid answer and 3 valid distractors.",
      debugPayload,
    );
  }

  console.info(
    "[ml-puzzle] choice-resolution",
    JSON.stringify({
        patch: input.snapshot.patch,
        candidatePoolSize: input.prediction.candidate_pool_size,
        goodAnswer: input.seed.goodAnswer,
        distractors: input.seed.distractors,
        businessRules: businessRules.debug,
        ...toChoiceDebugPayload(resolvedChoices),
      }),
    );

  const choiceSignature = buildChoiceSignatureForHistory(
    resolvedChoices.goodAnswer.slug,
    resolvedChoices.distractors.map((item) => item.slug),
  );
  const orderedChoices = shuffleResolvedChoices(
    resolvedChoices.goodAnswer,
    resolvedChoices.distractors,
    variationSeed,
  );
  const choiceSlugs = [
    resolvedChoices.goodAnswer.slug,
    ...resolvedChoices.distractors.map((item) => item.slug),
  ];
  const itemIndex = await getItemsBySlugs(choiceSlugs);

  const title = `${champion.name} AI item puzzle`;
  const slug = slugify(`${champion.slug}-ai-generated-${Date.now()}`);
  const metadataSummary = [
    `lowConfidence=${input.seed.lowConfidence}`,
    `forcedDraft=${input.forcedDraft}`,
    `confidence=${input.seed.confidenceScore.toFixed(4)}`,
    `gap=${input.seed.confidenceGap.toFixed(4)}`,
    `candidatePoolSize=${input.seed.candidatePoolSize}`,
    `snapshotMinute=${input.snapshot.timestampMinutes.toFixed(2)}`,
    `modelVersion=${input.prediction.model_version ?? "unknown"}`,
    `candidatePoolAfterChampion=${businessRules.debug.candidatePoolSizeAfterChampion}`,
    `candidatePoolAfterGold=${businessRules.debug.candidatePoolSizeAfterGold}`,
    `candidatePoolAfterFallback=${businessRules.debug.candidatePoolSizeAfterFallback}`,
    `variationSeed=${variationSeed}`,
    `choiceSignature=${choiceSignature}`,
  ].join(" | ");
  const puzzle = await prisma.puzzle.create({
    data: {
      title,
      slug,
      mode: PuzzleMode.PERSONALIZED,
      sourceType: PuzzleSourceType.AI_GENERATED,
      difficulty:
        input.seed.difficulty === "easy"
          ? PuzzleDifficulty.BEGINNER
          : input.seed.difficulty === "medium"
            ? PuzzleDifficulty.INTERMEDIATE
            : PuzzleDifficulty.ADVANCED,
      patch: input.snapshot.patch,
      description: input.seed.lowConfidence
        ? `Brouillon genere par le service ML pour ${champion.name}, a revoir avant toute publication.`
        : `Puzzle genere par le service ML pour ${champion.name}.`,
      shortPrompt: input.seed.lowConfidence
        ? `Brouillon ML faible confiance pour ${champion.name}.`
        : `Le modele propose le prochain item le plus coherent pour ${champion.name}.`,
      situation: `Tu joues ${champion.name} vers ${input.snapshot.timestampMinutes.toFixed(1)} minutes avec ${input.snapshot.goldAvailable} gold disponible.`,
      question: "Quel est le meilleur prochain achat dans cette situation ?",
      explanation: `La prediction ML privilegie ${itemIndex.get(resolveItemSlug(input.seed.goodAnswer!))?.name ?? input.seed.goodAnswer}.`,
      role: input.snapshot.role,
      championId: champion.id,
        isPublished: false,
        isDailyEligible: false,
        choices: {
          create: orderedChoices.map(({ item: resolvedItem, isCorrect }, index) => {
            const item = itemIndex.get(resolveItemSlug(resolvedItem.slug))!;
            return {
              label: item.name,
              choiceType: item.isBoots ? PuzzleChoiceType.BOOTS : PuzzleChoiceType.ITEM,
              itemId: item.id,
              explanation:
                isCorrect
                  ? "Choix principal du modele ranking."
                  : "Distracteur plausible propose pour revue manuelle.",
              isCorrect,
              displayOrder: index + 1,
            };
          }),
        },
        scenario: {
        create: {
          playerChampionId: champion.id,
          playerRole: input.snapshot.role ?? Role.FLEX,
          gameMinute: Math.max(1, Math.round(input.snapshot.timestampMinutes)),
          playerGold: input.snapshot.goldAvailable,
          playerLevel: input.snapshot.level,
          kills: input.snapshot.kills,
          deaths: input.snapshot.deaths,
          assists: input.snapshot.assists,
            cs: input.snapshot.cs,
            currentBuild: input.scenario.currentBuild as Prisma.InputJsonValue,
            allyTeam: input.scenario.allyTeam as Prisma.InputJsonValue,
            enemyTeam: input.scenario.enemyTeam as Prisma.InputJsonValue,
            objectiveState: businessRules.objectiveState as Prisma.InputJsonValue,
            damageProfile: businessRules.damageProfile as Prisma.InputJsonValue,
            mapState: businessRules.mapState as Prisma.InputJsonValue,
            notes: `${businessRules.notes} ${metadataSummary}`,
          },
        },
        tags: {
        create: [
          "ai-generated",
          "ml",
          "next-item",
          "ml-draft",
          ...(input.seed.lowConfidence ? ["low-confidence"] : []),
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

  return {
    puzzle,
    businessRules,
    choiceSignature,
    variationSeed,
  };
}

async function markRequestFailed(
  requestId: string,
  reason: string,
  payload?: Prisma.InputJsonValue,
) {
  await prisma.generatedPuzzleRequest.update({
    where: { id: requestId },
    data: {
      status: GeneratedPuzzleRequestStatus.FAILED,
      parameters: {
        reason,
        payload,
      },
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
  ) {
    if (!isMlConfigured()) {
      throw new HttpError(503, "ML puzzle generation is not configured.");
    }

    const request = await prisma.generatedPuzzleRequest.create({
      data: {
        userId,
        type: GeneratedPuzzleRequestType.MATCH_BASED,
        importedMatchId,
        status: GeneratedPuzzleRequestStatus.PROCESSING,
        parameters: { mode: "ml-api" },
      },
    });

    try {
      const importedMatch = await prisma.importedMatch.findUnique({
        where: { id: importedMatchId },
      });
      if (!importedMatch) {
        throw new HttpError(404, "Imported match not found.");
      }

      const { snapshot, scenario } = await buildSnapshotFromImportedMatch(importedMatch);
      const payload = mapSnapshotToMlPayload(snapshot);
      const prediction = await postPrediction(payload);
      const seed = buildBackendPuzzleSeed(prediction);
      const allowLowConfidenceDraft = isLowConfidenceDraftAllowed({
        isAdmin: Boolean(options?.actorIsAdmin),
        envEnabled: env.ML_ALLOW_LOW_CONFIDENCE_DRAFTS,
        forceDraftOnLowConfidence: options?.forceDraftOnLowConfidence,
      });

      if (seed.lowConfidence) {
        console.warn(
          `[ml-puzzle] low confidence for importedMatchId=${importedMatchId} confidence=${prediction.confidence ?? "n/a"}`,
        );
        const lowConfidenceMetadata = buildMlRequestMetadata({
          snapshot,
          prediction,
          seed,
          forcedDraft: allowLowConfidenceDraft && seed.lowConfidence,
          payload,
        });
        if (!allowLowConfidenceDraft) {
          await markRequestFailed(request.id, "low-confidence", lowConfidenceMetadata as Prisma.InputJsonValue);
          throw new HttpError(
            422,
            "Le modele ML manque de confiance pour creer un puzzle publiable. Relance en mode brouillon admin si tu veux conserver ce resultat pour revue.",
            {
              requestId: request.id,
              lowConfidence: true,
              confidenceScore: seed.confidenceScore,
              confidenceGap: seed.confidenceGap,
              candidatePoolSize: seed.candidatePoolSize,
            },
          );
        }
      }

      const generation = await createAiGeneratedPuzzle({
        userId,
        importedMatchId,
        snapshot,
        scenario,
        seed,
        prediction,
        forcedDraft: allowLowConfidenceDraft && seed.lowConfidence,
      });
      const requestMetadata = buildMlRequestMetadata({
        snapshot,
        prediction,
        seed,
        forcedDraft: allowLowConfidenceDraft && seed.lowConfidence,
        payload,
        businessRules: {
          ...generation.businessRules.debug,
          choiceSignature: generation.choiceSignature,
          variationSeed: generation.variationSeed,
        } as Prisma.InputJsonValue,
      });

      await prisma.generatedPuzzleRequest.update({
        where: { id: request.id },
        data: {
          status: GeneratedPuzzleRequestStatus.COMPLETED,
          resultPuzzleId: generation.puzzle.id,
          parameters: requestMetadata,
        },
      });

      return {
        requestId: request.id,
        slug: generation.puzzle.slug,
        slugs: [generation.puzzle.slug],
        sourceType: "ai_generated",
        published: false,
        lowConfidence: seed.lowConfidence,
        draft: true,
      };
    } catch (error) {
      const alreadyHandledLowConfidence =
        error instanceof HttpError &&
        error.status === 422 &&
        error.message.includes("Relance en mode brouillon admin");

      if (!alreadyHandledLowConfidence) {
        await markRequestFailed(
          request.id,
          error instanceof Error ? error.message : String(error),
          error instanceof HttpError ? (error.details as Prisma.InputJsonValue | undefined) : undefined,
        );
      }
      throw error;
    }
  },
};
