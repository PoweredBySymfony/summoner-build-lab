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
  isMlGenerationConfigured,
  mapSnapshotToMlPayload,
  type MlPredictNextItemResponse,
  type MlPuzzleSnapshot,
} from "../lib/ml/mlPuzzle.js";
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
  seed: ReturnType<typeof buildBackendPuzzleSeed>;
  prediction: MlPredictNextItemResponse;
}) {
  const champion = await prisma.champion.findUnique({
    where: { slug: input.snapshot.championSlug },
  });
  if (!champion) {
    throw new HttpError(400, "Champion not found for AI-generated puzzle.");
  }

  const choiceSlugs = [input.seed.goodAnswer, ...input.seed.distractors].filter(
    (value): value is string => Boolean(value),
  );
  const itemIndex = await getItemsBySlugs(choiceSlugs);
  if (choiceSlugs.length !== 4 || choiceSlugs.some((slug) => !itemIndex.has(resolveItemSlug(slug)))) {
    throw new HttpError(500, "Unable to resolve AI-generated puzzle choices.");
  }

  const title = `${champion.name} AI item puzzle`;
  const slug = slugify(`${champion.slug}-ai-generated-${Date.now()}`);
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
      description: `Puzzle genere par le service ML pour ${champion.name}.`,
      shortPrompt: `Le modele propose le prochain item le plus coherent pour ${champion.name}.`,
      situation: `Tu joues ${champion.name} vers ${input.snapshot.timestampMinutes.toFixed(1)} minutes avec ${input.snapshot.goldAvailable} gold disponible.`,
      question: "Quel est le meilleur prochain achat dans cette situation ?",
      explanation: `La prediction ML privilegie ${itemIndex.get(resolveItemSlug(input.seed.goodAnswer!))?.name ?? input.seed.goodAnswer}.`,
      role: input.snapshot.role,
      championId: champion.id,
      isPublished: false,
      isDailyEligible: false,
      choices: {
        create: choiceSlugs.map((choiceSlug, index) => {
          const item = itemIndex.get(resolveItemSlug(choiceSlug))!;
          return {
            label: item.name,
            choiceType: item.isBoots ? PuzzleChoiceType.BOOTS : PuzzleChoiceType.ITEM,
            itemId: item.id,
            explanation:
              choiceSlug === input.seed.goodAnswer
                ? "Choix principal du modele ranking."
                : "Distracteur plausible propose pour revue manuelle.",
            isCorrect: choiceSlug === input.seed.goodAnswer,
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
          notes: `ML candidate pool size=${input.prediction.candidate_pool_size}. Model version=${input.prediction.model_version ?? "unknown"}.`,
        },
      },
      tags: {
        create: ["ai-generated", "ml", "next-item"].map((tag) => ({
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

  return puzzle;
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

  async generateFromImportedMatch(importedMatchId: string, userId: string) {
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

      if (seed.lowConfidence) {
        console.warn(
          `[ml-puzzle] low confidence for importedMatchId=${importedMatchId} confidence=${prediction.confidence ?? "n/a"}`,
        );
        await markRequestFailed(request.id, "low-confidence", {
          payload,
          prediction,
          seed,
        } as Prisma.InputJsonValue);
        throw new HttpError(422, "ML prediction was too ambiguous to create a publishable puzzle.");
      }

      const puzzle = await createAiGeneratedPuzzle({
        userId,
        importedMatchId,
        snapshot,
        scenario,
        seed,
        prediction,
      });

      await prisma.generatedPuzzleRequest.update({
        where: { id: request.id },
        data: {
          status: GeneratedPuzzleRequestStatus.COMPLETED,
          resultPuzzleId: puzzle.id,
          parameters: {
            payload,
            prediction,
            seed,
          },
        },
      });

      return {
        slug: puzzle.slug,
        slugs: [puzzle.slug],
        sourceType: "ai_generated",
        published: false,
      };
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 422)) {
        await markRequestFailed(
          request.id,
          error instanceof Error ? error.message : String(error),
        );
      }
      throw error;
    }
  },
};
