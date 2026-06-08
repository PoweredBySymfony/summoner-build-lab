import { Prisma } from "@prisma/client";

import { prisma } from "../server/src/lib/prisma.js";
import { canonicalizePatch } from "../server/src/lib/riot/patchCanonical.js";
import { riotApiClient } from "../server/src/lib/riot/riotApiClient.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeParticipantRole(value: unknown) {
  const normalized = (typeof value === "string" ? value : "").trim().toUpperCase();

  switch (normalized) {
    case "TOP":
      return "TOP";
    case "JUNGLE":
      return "JUNGLE";
    case "MIDDLE":
    case "MID":
      return "MID";
    case "BOTTOM":
    case "BOT":
    case "ADC":
    case "CARRY":
      return "ADC";
    case "UTILITY":
    case "SUPPORT":
      return "SUPPORT";
    default:
      return null;
  }
}

type MatchRegion = "europe" | "americas" | "asia" | "sea";

async function fetchTimelineWithRetry(matchId: string, region: MatchRegion) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await riotApiClient.getMatchTimelineByIdOnRegion(matchId, region);
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      console.warn(`[ml-backfill] retrying timeline fetch for ${matchId} (attempt ${attempt + 1}/3)`);
      await sleep(attempt * 500);
    }
  }

  throw new Error("unreachable");
}

type ImportedMatchWithUser = Prisma.ImportedMatchGetPayload<{
  include: { user: { include: { playerProfile: true } } };
}>;

type ProcessCounts = { updated: number; skipped: number };

async function processImportedMatch(importedMatch: ImportedMatchWithUser, counts: ProcessCounts) {
  const region = importedMatch.sourceRegion ?? importedMatch.user.playerProfile?.region;
  const targetPuuid = importedMatch.targetPuuid ?? importedMatch.user.playerProfile?.riotPuuid;

  if (!region || !targetPuuid) {
    counts.skipped += 1;
    console.warn(`[ml-backfill] skipping ${importedMatch.riotMatchId}: missing region or target puuid`);
    return;
  }

  const existingMatchData = importedMatch.matchData as Prisma.JsonObject;
  const rawMatch =
    existingMatchData.raw && typeof existingMatchData.raw === "object"
      ? (existingMatchData.raw as Prisma.JsonObject)
      : await riotApiClient.getMatchByIdOnRegion(importedMatch.riotMatchId, region as MatchRegion);

  const info = rawMatch.info as { gameVersion?: string; gameCreation?: number; gameDuration?: number; participants?: Array<Record<string, unknown>> } | undefined;
  const canonicalPatch = canonicalizePatch(
    info?.gameVersion,
    importedMatch.gameCreationAt ?? (info?.gameCreation ? new Date(info.gameCreation) : null),
  ).patchCanonical;
  const participant = info?.participants?.find((entry) => entry.puuid === targetPuuid);
  if (!participant) {
    counts.skipped += 1;
    console.warn(`[ml-backfill] skipping ${importedMatch.riotMatchId}: target participant not found`);
    return;
  }

  const timeline = await fetchTimelineWithRetry(importedMatch.riotMatchId, region as MatchRegion);
  const targetRole =
    normalizeParticipantRole(participant.teamPosition) ??
    normalizeParticipantRole(participant.individualPosition) ??
    normalizeParticipantRole(participant.role) ??
    normalizeParticipantRole(participant.lane);
  const metadataSlug = (existingMatchData.metadata as Prisma.JsonObject | undefined)?.targetChampionSlug;
  const targetChampionSlug =
    importedMatch.targetChampionSlug ??
    (typeof metadataSlug === "string" ? metadataSlug : null) ??
    (existingMatchData.playerChampionSlug as string | undefined) ??
    "";

  await prisma.importedMatch.update({
    where: { id: importedMatch.id },
    data: {
      patch: canonicalPatch ?? importedMatch.patch,
      sourceRegion: region,
      targetPuuid,
      targetGameName: importedMatch.targetGameName ?? importedMatch.user.playerProfile?.riotGameName ?? null,
      targetTagLine: importedMatch.targetTagLine ?? importedMatch.user.playerProfile?.riotTagLine ?? null,
      targetChampionId: importedMatch.targetChampionId ?? (Number(participant.championId) || null),
      targetChampionSlug: targetChampionSlug || null,
      targetRole: importedMatch.targetRole ?? targetRole,
      gameCreationAt: importedMatch.gameCreationAt ?? (info?.gameCreation ? new Date(info.gameCreation) : null),
      gameDurationSeconds: importedMatch.gameDurationSeconds ?? (typeof info?.gameDuration === "number" ? info.gameDuration : null),
      timelineFetchedAt: new Date(),
      timelineMissingReason: null,
      matchData: {
        raw: rawMatch as Prisma.InputJsonObject,
        metadata: {
          riotMatchId: importedMatch.riotMatchId,
          patch: canonicalPatch ?? importedMatch.patch,
          sourceRegion: region,
          targetPuuid,
          targetChampionId: importedMatch.targetChampionId ?? (Number(participant.championId) || null),
          targetChampionSlug: targetChampionSlug || null,
          targetRole: importedMatch.targetRole ?? targetRole,
        } as Prisma.InputJsonObject,
      },
      timelineData: { raw: timeline as Prisma.InputJsonObject },
    },
  });

  counts.updated += 1;
  console.info(`[ml-backfill] updated ${importedMatch.riotMatchId} with timeline data`);
}

async function main() {
  const matches = await prisma.importedMatch.findMany({
    where: {
      OR: [{ sourceRegion: null }, { targetPuuid: null }],
    },
    include: {
      user: {
        include: {
          playerProfile: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const counts: ProcessCounts = { updated: 0, skipped: 0 };
  for (const importedMatch of matches) {
    await processImportedMatch(importedMatch, counts);
  }
  console.info(`[ml-backfill] completed: updated=${counts.updated}, skipped=${counts.skipped}`);
}

try {
  await main();
} catch (error) {
  console.error("[ml-backfill] failed", error);
  process.exitCode = 1;
} finally {
  try { await prisma.$disconnect(); } catch { /* ignore */ }
}
