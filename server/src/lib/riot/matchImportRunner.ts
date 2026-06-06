import { Prisma, Role } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../prisma.js";
import { importedMatchArchiveRepository } from "../../repositories/importedMatchArchiveRepository.js";
import { riotApiClient } from "./riotApiClient.js";
import { upsertIndexedAccount, resolveLeagueIdentity, type ResolvedImportIdentity } from "./riotIdentity.js";
import {
  type RiotImportMatchSummary,
  type RiotImportRunSummary,
} from "./riotBatch.js";
import { type RiotPlatform, type RiotRegion } from "./routing.js";
import { canonicalizePatch } from "./patchCanonical.js";
import { slugify } from "../slug.js";
import { HttpError } from "../../utils/http.js";

export type RiotImportSourceContext = {
  sourceKind?: string | null;
  sourceMetadata?: Prisma.InputJsonObject | null;
  syncPlayerProfile?: boolean;
  skipExistingWithDifferentTarget?: boolean;
};

export type RiotImportedMatchDetail = {
  riotMatchId: string;
  patch: string | null;
  sourceRegion: RiotRegion;
  timelineAvailable: boolean;
  timelineMissingReason: string | null;
  targetChampionSlug: string | null;
  targetRole: Role | null;
  gameCreationAt: Date | null;
  created: boolean;
  skippedReason: string | null;
};

type RiotMatchInfo = {
  gameVersion?: string;
  gameCreation?: number;
  gameDuration?: number;
  participants?: Array<Record<string, unknown>>;
};

function clampNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryRiotImport(error: unknown) {
  return (
    error instanceof HttpError &&
    (error.status === 429 || error.status === 502 || error.status === 503 || error.status === 504)
  );
}

function normalizeParticipantRole(value: unknown): Role | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

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

function resolveParticipantRole(participant: Record<string, unknown> | undefined) {
  return (
    normalizeParticipantRole(participant?.teamPosition) ??
    normalizeParticipantRole(participant?.individualPosition) ??
    normalizeParticipantRole(participant?.role) ??
    normalizeParticipantRole(participant?.lane)
  );
}

function buildSkippedMatchDetail(input: {
  riotMatchId: string;
  patch: string | null;
  sourceRegion: RiotRegion;
  timelineAvailable: boolean;
  timelineMissingReason: string | null;
  targetChampionSlug: string | null;
  targetRole: Role | null;
  gameCreationAt: Date | null;
  skippedReason: string;
}): RiotImportedMatchDetail {
  return {
    riotMatchId: input.riotMatchId,
    patch: input.patch,
    sourceRegion: input.sourceRegion,
    timelineAvailable: input.timelineAvailable,
    timelineMissingReason: input.timelineMissingReason,
    targetChampionSlug: input.targetChampionSlug,
    targetRole: input.targetRole,
    gameCreationAt: input.gameCreationAt,
    created: false,
    skippedReason: input.skippedReason,
  };
}

function hasDifferentExistingTarget(input: {
  skipExistingWithDifferentTarget?: boolean;
  existingMatch: { targetPuuid: string | null } | null;
  targetPuuid: string;
}) {
  return Boolean(
    input.skipExistingWithDifferentTarget
    && input.existingMatch?.targetPuuid
    && input.existingMatch.targetPuuid !== input.targetPuuid,
  );
}

async function upsertIndexedParticipants(participants: Array<Record<string, unknown>> | undefined) {
  await Promise.all(
    (participants ?? [])
      .filter(
        (entry) =>
          typeof entry.puuid === "string" &&
          typeof entry.riotIdGameName === "string" &&
          typeof entry.riotIdTagline === "string",
      )
      .map((entry) =>
        upsertIndexedAccount({
          puuid: String(entry.puuid),
          gameName: String(entry.riotIdGameName),
          tagLine: String(entry.riotIdTagline),
        }),
      ),
  );
}

async function resolveChampionSlugFromParticipant(participant: Record<string, unknown> | undefined) {
  const championKey = String(participant?.championName ?? "").trim();
  if (championKey) {
    const championByKey = await prisma.champion.findUnique({
      where: { championKey: championKey },
      select: { slug: true },
    });
    if (championByKey) {
      return championByKey.slug;
    }
  }

  const riotChampionId = Number(participant?.championId);
  if (Number.isFinite(riotChampionId) && riotChampionId > 0) {
    const championByRiotId = await prisma.champion.findUnique({
      where: { riotChampionId },
      select: { slug: true },
    });
    if (championByRiotId) {
      return championByRiotId.slug;
    }
  }

  return slugify(championKey);
}

export function normalizeSourceKind(sourceKind?: string | null) {
  const normalized = sourceKind?.trim();
  return normalized ? normalized : null;
}

export function buildImportedMatchMetadata(input: {
  riotMatchId: string;
  patch: string | null;
  sourceRegion: string;
  sourceKind: string | null;
  sourceMetadata: Prisma.InputJsonObject | null;
  targetPuuid: string;
  targetGameName: string | null;
  targetTagLine: string | null;
  participant: Record<string, unknown>;
  championSlug: string;
  targetRole: Role | null;
  gameCreationAt: Date | null;
  gameDurationSeconds: number | null;
}) {
  return {
    riotMatchId: input.riotMatchId,
    patch: input.patch,
    sourceRegion: input.sourceRegion,
    sourceKind: input.sourceKind,
    sourceMetadata: input.sourceMetadata,
    targetPuuid: input.targetPuuid,
    targetGameName: input.targetGameName,
    targetTagLine: input.targetTagLine,
    targetChampionId: Number(input.participant.championId) || null,
    targetChampionSlug: input.championSlug,
    targetRole: input.targetRole,
    gameCreationAt: input.gameCreationAt?.toISOString() ?? null,
    gameDurationSeconds: input.gameDurationSeconds,
  } satisfies Prisma.InputJsonObject;
}

function buildMatchPayload(input: {
  hasMongoPrimaryStorage: boolean;
  match: Record<string, unknown>;
  matchMetadata: Prisma.InputJsonObject;
}): Prisma.InputJsonObject {
  if (input.hasMongoPrimaryStorage) {
    return {
      storage: "mongo-primary",
      metadata: input.matchMetadata,
    };
  }

  return {
    raw: input.match as Prisma.InputJsonObject,
    metadata: input.matchMetadata,
  };
}

function countTimelineFrames(timeline: Record<string, unknown>) {
  const info = timeline.info;
  if (typeof info !== "object" || !info) {
    return 0;
  }

  const frames = (info as { frames?: unknown[] }).frames;
  return Array.isArray(frames) ? frames.length : 0;
}

function buildTimelinePayload(input: {
  hasMongoPrimaryStorage: boolean;
  riotMatchId: string;
  timeline: Record<string, unknown> | null;
}): Prisma.InputJsonObject | null {
  if (!input.timeline) {
    return null;
  }

  if (input.hasMongoPrimaryStorage) {
    return {
      storage: "mongo-primary",
      metadata: {
        riotMatchId: input.riotMatchId,
        frameCount: countTimelineFrames(input.timeline),
      } satisfies Prisma.InputJsonObject,
    };
  }

  return {
    raw: input.timeline as Prisma.InputJsonObject,
  };
}

export async function fetchMatchBundleWithRetry(matchId: string, region: RiotRegion, maxAttempts = 3) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const [match, timeline] = await Promise.all([
        riotApiClient.getMatchByIdOnRegion(matchId, region),
        riotApiClient.getMatchTimelineByIdOnRegion(matchId, region),
      ]);

      return { match, timeline };
    } catch (error) {
      lastError = error;
      if (!shouldRetryRiotImport(error) || attempt === maxAttempts) {
        throw error;
      }

      const backoffMs = attempt * 500;
      console.warn(
        `[riot-sync] retrying match bundle fetch for ${matchId} in ${backoffMs}ms after transient error`,
        error,
      );
      await sleep(backoffMs);
    }
  }

  throw lastError ?? new HttpError(500, "Unable to fetch Riot match bundle.");
}

async function fetchMatchForImport(matchId: string, region: RiotRegion) {
  try {
    const fetched = await fetchMatchBundleWithRetry(matchId, region);
    return {
      match: fetched.match,
      timeline: fetched.timeline,
      timelineMissingReason: null,
    };
  } catch (error) {
    const timelineMissingReason = error instanceof HttpError ? `timeline-fetch-${error.status}` : "timeline-fetch-error";
    console.warn(
      `[riot-sync] timeline fetch failed for ${matchId}, falling back to match-only import`,
      error,
    );

    return {
      match: await riotApiClient.getMatchByIdOnRegion(matchId, region),
      timeline: null,
      timelineMissingReason,
    };
  }
}

function buildTargetParticipantMissingDetail(input: {
  riotMatchId: string;
  info: RiotMatchInfo;
  region: RiotRegion;
  timeline: Record<string, unknown> | null;
}) {
  console.warn(`[riot-sync] target participant missing in match ${input.riotMatchId}, skipping`);
  const gameCreationAt = input.info.gameCreation ? new Date(input.info.gameCreation) : null;
  const canonicalPatch = canonicalizePatch(input.info.gameVersion, gameCreationAt);

  return buildSkippedMatchDetail({
    riotMatchId: input.riotMatchId,
    patch: canonicalPatch.patchCanonical,
    sourceRegion: input.region,
    timelineAvailable: Boolean(input.timeline),
    timelineMissingReason: input.timeline ? null : "target-participant-missing",
    targetChampionSlug: null,
    targetRole: null,
    gameCreationAt,
    skippedReason: "target-participant-missing",
  });
}

export async function importMatchForIdentityInternal(
  identity: ResolvedImportIdentity,
  input: {
    userId: string;
    matchId: string;
    sourceKind?: string | null;
    sourceMetadata?: Prisma.InputJsonObject | null;
    skipExistingWithDifferentTarget?: boolean;
  },
): Promise<RiotImportedMatchDetail> {
  const { match, timeline, timelineMissingReason } = await fetchMatchForImport(input.matchId, identity.region);

  const metadata = match.metadata as { matchId?: string; participants?: string[] };
  const info = match.info as RiotMatchInfo;
  const participant = info.participants?.find((entry) => entry.puuid === identity.puuid);
  const riotMatchId = metadata.matchId ?? input.matchId;

  if (!participant) {
    return buildTargetParticipantMissingDetail({
      riotMatchId,
      info,
      region: identity.region,
      timeline,
    });
  }

  await upsertIndexedParticipants(info.participants);

  const championSlug = await resolveChampionSlugFromParticipant(participant);
  const targetRole = resolveParticipantRole(participant);
  const gameCreationAt = info.gameCreation ? new Date(info.gameCreation) : null;
  const patch = canonicalizePatch(info.gameVersion, gameCreationAt).patchCanonical;
  const sourceKind = normalizeSourceKind(input.sourceKind);
  const sourceMetadata = input.sourceMetadata ?? null;
  const resolvedTimelineMissingReason = timeline ? null : (timelineMissingReason ?? "timeline-unavailable-during-import");
  const existingMatch = await prisma.importedMatch.findUnique({
    where: { riotMatchId },
    select: { id: true, targetPuuid: true, sourceKind: true },
  });
  if (hasDifferentExistingTarget({
    skipExistingWithDifferentTarget: input.skipExistingWithDifferentTarget,
    existingMatch,
    targetPuuid: identity.puuid,
  })) {
    console.warn(
      `[riot-sync] skipping ${riotMatchId} because it already exists for target ${existingMatch.targetPuuid}`,
    );
    return buildSkippedMatchDetail({
      riotMatchId,
      patch: patch ?? null,
      sourceRegion: identity.region,
      timelineAvailable: Boolean(timeline),
      timelineMissingReason: resolvedTimelineMissingReason,
      targetChampionSlug: championSlug,
      targetRole,
      gameCreationAt,
      skippedReason: "existing-match-different-target",
    });
  }
  const matchMetadata = buildImportedMatchMetadata({
    riotMatchId,
    patch,
    sourceRegion: identity.region,
    sourceKind,
    sourceMetadata,
    targetPuuid: identity.puuid,
    targetGameName: identity.gameName,
    targetTagLine: identity.tagLine,
    participant,
    championSlug,
    targetRole,
    gameCreationAt,
    gameDurationSeconds: clampNumber(info.gameDuration) || null,
  });
  const mongoRefs = await importedMatchArchiveRepository.persistImportedMatchArtifacts({
    riotMatchId,
    patch: patch ?? null,
    sourceRegion: identity.region,
    sourceKind,
    sourceMetadata,
    matchMetadata,
    targetPuuid: identity.puuid,
    targetGameName: identity.gameName,
    targetTagLine: identity.tagLine,
    userId: input.userId,
    matchRaw: match as Prisma.InputJsonObject,
    timelineRaw: timeline ? (timeline as Prisma.InputJsonObject) : null,
    gameCreationAt,
  });
  const hasMongoPrimaryStorage = Boolean(mongoRefs.mongoMatchImportRef);
  const matchPayload = buildMatchPayload({
    hasMongoPrimaryStorage,
    match,
    matchMetadata,
  });
  const timelinePayload = buildTimelinePayload({
    hasMongoPrimaryStorage,
    riotMatchId,
    timeline,
  });

  await prisma.importedMatch.upsert({
    where: { riotMatchId },
    update: {
      patch,
      sourceRegion: identity.region,
      sourceKind,
      sourceMetadata,
      targetPuuid: identity.puuid,
      targetGameName: identity.gameName,
      targetTagLine: identity.tagLine,
      targetChampionId: Number(participant.championId) || null,
      targetChampionSlug: championSlug,
      targetRole,
      gameCreationAt,
      gameDurationSeconds: clampNumber(info.gameDuration) || null,
      timelineFetchedAt: timeline ? new Date() : null,
      timelineMissingReason: resolvedTimelineMissingReason,
      mongoMatchImportRef: mongoRefs.mongoMatchImportRef,
      mongoTimelineRef: mongoRefs.mongoTimelineRef,
      mongoBackfilledAt: mongoRefs.mongoMatchImportRef ? new Date() : null,
      matchData: matchPayload,
      timelineData: timelinePayload,
    },
    create: {
      userId: input.userId,
      riotMatchId,
      patch,
      sourceRegion: identity.region,
      sourceKind,
      sourceMetadata,
      targetPuuid: identity.puuid,
      targetGameName: identity.gameName,
      targetTagLine: identity.tagLine,
      targetChampionId: Number(participant.championId) || null,
      targetChampionSlug: championSlug,
      targetRole,
      gameCreationAt,
      gameDurationSeconds: clampNumber(info.gameDuration) || null,
      timelineFetchedAt: timeline ? new Date() : null,
      timelineMissingReason: resolvedTimelineMissingReason,
      mongoMatchImportRef: mongoRefs.mongoMatchImportRef,
      mongoTimelineRef: mongoRefs.mongoTimelineRef,
      mongoBackfilledAt: mongoRefs.mongoMatchImportRef ? new Date() : null,
      matchData: matchPayload,
      timelineData: timelinePayload,
    },
  });

  console.info(
    `[riot-sync] imported ${riotMatchId} patch=${patch ?? "unknown"} timeline=${timeline ? "yes" : "no"} champion=${championSlug} source=${sourceKind ?? "user-sync"}`,
  );

  return {
    riotMatchId,
    patch: patch ?? null,
    sourceRegion: identity.region,
    timelineAvailable: Boolean(timeline),
    timelineMissingReason: resolvedTimelineMissingReason,
    targetChampionSlug: championSlug,
    targetRole,
    gameCreationAt,
    created: !existingMatch,
    skippedReason: null,
  };
}

export async function importRecentMatchesInternal(
  userId: string,
  puuid: string,
  count = 5,
  options: RiotImportSourceContext = {},
): Promise<RiotImportRunSummary> {
  let indexed = await prisma.riotAccountIndex.findUnique({ where: { puuid } });

  if ((!indexed?.region || !indexed?.platform) && indexed?.gameName && indexed?.tagLine) {
    await resolveLeagueIdentity(indexed.gameName, indexed.tagLine);
    indexed = await prisma.riotAccountIndex.findUnique({ where: { puuid } });
  }

  const region = indexed?.region as RiotRegion | undefined;
  if (!region) {
    throw new HttpError(400, "Unable to determine Riot region for this player. Open the profile first.");
  }

  const ids = await riotApiClient.getMatchIdsByPuuidOnRegion(puuid, region, count);
  const imported = [];
  const matches: RiotImportMatchSummary[] = [];
  let skippedMatchCount = 0;
  console.info(`[riot-sync] importing ${ids.length} matches for ${puuid} from ${region}`);

  const identity: ResolvedImportIdentity = {
    puuid,
    gameName: indexed?.gameName ?? null,
    tagLine: indexed?.tagLine ?? null,
    region,
    platform: (indexed?.platform as RiotPlatform | undefined) ?? env.RIOT_PLATFORM as RiotPlatform,
  };

  for (const matchId of ids) {
    const result = await importMatchForIdentityInternal(identity, {
      userId,
      matchId,
      sourceKind: options.sourceKind,
      sourceMetadata: options.sourceMetadata,
      skipExistingWithDifferentTarget: options.skipExistingWithDifferentTarget,
    });

    if (result.skippedReason === "target-participant-missing") {
      skippedMatchCount += 1;
      matches.push({
        riotMatchId: result.riotMatchId,
        timelineAvailable: result.timelineAvailable,
        timelineMissingReason: result.timelineMissingReason,
      });
      continue;
    }

    imported.push(result.riotMatchId);
    matches.push({
      riotMatchId: result.riotMatchId,
      timelineAvailable: result.timelineAvailable,
      timelineMissingReason: result.timelineMissingReason,
    });
  }

  if (options.syncPlayerProfile !== false) {
    await prisma.playerProfile.upsert({
      where: { userId },
      update: {
        riotPuuid: puuid,
        riotGameName: indexed?.gameName,
        riotTagLine: indexed?.tagLine,
        lastSyncAt: new Date(),
        region: region,
      },
      create: {
        userId,
        riotPuuid: puuid,
        riotGameName: indexed?.gameName,
        riotTagLine: indexed?.tagLine,
        lastSyncAt: new Date(),
        region: region,
      },
    });
  }

  await importedMatchArchiveRepository.recordIngestionRun({
    kind: options.sourceKind ?? "USER_SYNC",
    targetPuuid: puuid,
    userId,
    requestedMatchCount: ids.length,
    importedMatchCount: imported.length,
    skippedMatchCount,
    timelineOkCount: matches.filter((match) => match.timelineAvailable).length,
    matches: matches.map((match) => ({
      riotMatchId: match.riotMatchId,
      timelineAvailable: match.timelineAvailable,
      timelineMissingReason: match.timelineMissingReason,
    })),
  });

  return {
    requestedMatchCount: ids.length,
    importedMatchCount: imported.length,
    skippedMatchCount,
    matches,
  };
}
