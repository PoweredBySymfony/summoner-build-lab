import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@prisma/client";

import { prisma } from "../server/src/lib/prisma.js";
import {
  buildProIngestionReport,
  buildRoundRobinMatchQueue,
  buildSeedKey,
  loadProIngestionCheckpoint,
  saveProIngestionCheckpoint,
  type ProIngestionAttemptSummary,
  type ProIngestionCheckpoint,
  type ProResolvedSeed,
  type ProSeedMatchDiscovery,
} from "../server/src/lib/riot/proIngestion.js";
import { riotApiClient } from "../server/src/lib/riot/riotApiClient.js";
import { type ProPlayerSeed } from "../server/src/lib/riot/proSeeds.js";
import { riotSyncService } from "../server/src/services/riotSyncService.js";

type CliOptions = {
  ownerUserId?: string;
  ownerEmail?: string;
  seedPath: string;
  checkpointPath: string;
  reportPath: string;
  targetMatches: number;
  countPerSeed: number;
};

type ActiveProSeed = ProResolvedSeed & {
  puuid: string;
  cluster: NonNullable<ProResolvedSeed["cluster"]>;
};

type ProMatchQueueEntry = ReturnType<typeof buildRoundRobinMatchQueue>[number];
type ImportedProMatch = Awaited<ReturnType<typeof riotSyncService.importMatchForIdentity>>;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    seedPath: path.join("data", "pro-seeds", "major-pros-recent.json"),
    checkpointPath: path.join("data", "runtime", "pro-ingestion", "checkpoint.json"),
    reportPath: path.join("data", "runtime", "pro-ingestion", "report.json"),
    targetMatches: 600,
    countPerSeed: 18,
  };

  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    index += 1;
    const next = argv[index];

    switch (arg) {
      case "--owner-user-id":
        options.ownerUserId = next;
        index += 1;
        break;
      case "--owner-email":
        options.ownerEmail = next;
        index += 1;
        break;
      case "--seed-path":
        if (next) {
          options.seedPath = next;
        }
        index += 1;
        break;
      case "--checkpoint-path":
        if (next) {
          options.checkpointPath = next;
        }
        index += 1;
        break;
      case "--report-path":
        if (next) {
          options.reportPath = next;
        }
        index += 1;
        break;
      case "--target-matches":
        options.targetMatches = Number(next ?? "600");
        index += 1;
        break;
      case "--count-per-seed":
        options.countPerSeed = Number(next ?? "18");
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

function splitRiotId(riotId: string) {
  const [gameName, ...tagLineParts] = riotId.split("#");
  return {
    gameName: gameName.trim(),
    tagLine: tagLineParts.join("#").trim(),
  };
}

async function loadSeeds(seedPath: string) {
  const absolutePath = path.resolve(seedPath);
  const raw = JSON.parse(await readFile(absolutePath, "utf-8")) as { players?: ProPlayerSeed[] } | ProPlayerSeed[];
  const players = Array.isArray(raw) ? raw : raw.players ?? [];
  if (players.length === 0) {
    throw new Error(`Seed list at ${absolutePath} is empty.`);
  }
  return { absolutePath, players };
}

async function resolveOwnerUserId(options: CliOptions) {
  if (options.ownerUserId) {
    return options.ownerUserId;
  }

  if (!options.ownerEmail) {
    throw new Error("Provide --owner-user-id or --owner-email for pro match imports.");
  }

  const user = await prisma.user.findUnique({
    where: { email: options.ownerEmail },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`No user found for owner email ${options.ownerEmail}.`);
  }

  return user.id;
}

function mergeResolvedSeed(seed: ProPlayerSeed, cached: ProResolvedSeed | undefined): ProResolvedSeed {
  return {
    ...seed,
    resolutionStatus: cached?.resolutionStatus ?? "unresolved",
    resolutionError: cached?.resolutionError ?? null,
    resolutionSource: cached?.resolutionSource ?? null,
    resolvedRiotId: cached?.resolvedRiotId ?? seed.riotId ?? null,
    puuid: cached?.puuid ?? seed.puuid ?? null,
    platformHint: cached?.platformHint ?? seed.platformHint ?? null,
    cluster: cached?.cluster ?? seed.cluster ?? null,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function buildUnresolvedSeed(
  seed: ProPlayerSeed,
  cached: ProResolvedSeed | undefined,
  resolutionError: string,
  resolutionSource: ProResolvedSeed["resolutionSource"],
): ProResolvedSeed {
  return {
    ...mergeResolvedSeed(seed, cached),
    resolutionStatus: "unresolved",
    resolutionError,
    resolutionSource,
  };
}

async function resolveSeedByPuuid(seed: ProPlayerSeed, cached: ProResolvedSeed | undefined) {
  try {
    const resolved = await riotSyncService.resolveImportIdentity({ type: "puuid", puuid: seed.puuid! });
    return {
      ...mergeResolvedSeed(seed, cached),
      resolutionStatus: "resolved",
      resolutionError: null,
      resolutionSource: "seed-puuid",
      resolvedRiotId:
        resolved.gameName && resolved.tagLine ? `${resolved.gameName}#${resolved.tagLine}` : (seed.riotId ?? null),
      puuid: resolved.puuid,
      platformHint: resolved.platform,
      cluster: resolved.region,
    } satisfies ProResolvedSeed;
  } catch (error) {
    return buildUnresolvedSeed(seed, cached, getErrorMessage(error), "seed-puuid");
  }
}

function getCandidateRiotIds(seed: ProPlayerSeed) {
  return [seed.riotId, ...seed.riotIdCandidates].filter((value): value is string => Boolean(value));
}

function getCandidateResolutionSource(seed: ProPlayerSeed, index: number): ProResolvedSeed["resolutionSource"] {
  return index === 0 && seed.riotId ? "seed-riot-id" : "candidate-riot-id";
}

async function resolveRiotIdCandidate(
  seed: ProPlayerSeed,
  cached: ProResolvedSeed | undefined,
  candidate: string,
  index: number,
): Promise<ProResolvedSeed | null> {
  const { gameName, tagLine } = splitRiotId(candidate);
  if (!gameName || !tagLine) {
    return null;
  }

  const resolved = await riotSyncService.resolveImportIdentity({
    type: "riot-id",
    gameName,
    tagLine,
  });

  return {
    ...mergeResolvedSeed(seed, cached),
    resolutionStatus: "resolved",
    resolutionError: null,
    resolutionSource: getCandidateResolutionSource(seed, index),
    resolvedRiotId: `${resolved.gameName ?? gameName}#${resolved.tagLine ?? tagLine}`,
    puuid: resolved.puuid,
    platformHint: resolved.platform,
    cluster: resolved.region,
  } satisfies ProResolvedSeed;
}

async function resolveSeedByRiotIdCandidates(seed: ProPlayerSeed, cached: ProResolvedSeed | undefined) {
  const candidateRiotIds = getCandidateRiotIds(seed);

  if (candidateRiotIds.length === 0) {
    return buildUnresolvedSeed(seed, cached, "No Riot ID or PUUID candidate available in the seed.", null);
  }

  for (let index = 0; index < candidateRiotIds.length; index += 1) {
    const candidate = candidateRiotIds[index]!;

    try {
      const resolved = await resolveRiotIdCandidate(seed, cached, candidate, index);
      if (resolved) {
        return resolved;
      }
    } catch (error) {
      if (index === candidateRiotIds.length - 1) {
        return buildUnresolvedSeed(seed, cached, getErrorMessage(error), getCandidateResolutionSource(seed, index));
      }
    }
  }

  return buildUnresolvedSeed(seed, cached, "Unable to resolve Riot identity.", null);
}

async function resolveSeed(seed: ProPlayerSeed, cached: ProResolvedSeed | undefined): Promise<ProResolvedSeed> {
  if (cached?.resolutionStatus === "resolved" && cached.puuid && cached.cluster) {
    return cached;
  }

  return seed.puuid
    ? resolveSeedByPuuid(seed, cached)
    : resolveSeedByRiotIdCandidates(seed, cached);
}

function buildSourceMetadata(seed: ProResolvedSeed, queueOrder: number, targetUniqueMatches: number): Prisma.InputJsonObject {
  return {
    seed: {
      playerName: seed.playerName,
      playerPage: seed.playerPage,
      team: seed.team,
      league: seed.league,
      competition: seed.competition,
      role: seed.role,
      region: seed.region,
      riotId: seed.resolvedRiotId,
      puuid: seed.puuid,
      platform: seed.platformHint,
      cluster: seed.cluster,
      source: seed.source,
      sourceTournamentDate: seed.sourceTournamentDate,
    },
    ingestion: {
      queueOrder,
      targetUniqueMatches,
      importedAt: new Date().toISOString(),
    },
  } as Prisma.InputJsonObject;
}

function validateOptions(options: CliOptions) {
  if (!Number.isFinite(options.targetMatches) || options.targetMatches <= 0) {
    throw new Error("--target-matches must be a positive integer.");
  }
  if (!Number.isFinite(options.countPerSeed) || options.countPerSeed <= 0) {
    throw new Error("--count-per-seed must be a positive integer.");
  }
}

function createInitialCheckpoint(options: CliOptions): ProIngestionCheckpoint {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    targetUniqueMatches: options.targetMatches,
    resolvedSeeds: [],
    discoveredMatches: [],
    attemptedMatchIds: [],
    importedMatchIds: [],
    failedMatches: [],
  };
}

async function resolveSeeds(players: ProPlayerSeed[], checkpoint: ProIngestionCheckpoint) {
  const resolvedSeedCache = new Map(checkpoint.resolvedSeeds.map((seed) => [buildSeedKey(seed), seed]));
  const resolvedSeeds: ProResolvedSeed[] = [];

  for (const seed of players) {
    const resolved = await resolveSeed(seed, resolvedSeedCache.get(buildSeedKey(seed)));
    resolvedSeeds.push(resolved);
  }

  return resolvedSeeds;
}

function getActiveSeeds(resolvedSeeds: ProResolvedSeed[]) {
  return resolvedSeeds.filter(
    (seed): seed is ActiveProSeed =>
      seed.resolutionStatus === "resolved" && Boolean(seed.puuid) && Boolean(seed.cluster),
  );
}

async function discoverSeedMatches(
  activeSeeds: ActiveProSeed[],
  checkpoint: ProIngestionCheckpoint,
  countPerSeed: number,
) {
  const discoveredCache = new Map(checkpoint.discoveredMatches.map((seed) => [seed.seedKey, seed]));
  const discoveries: ProSeedMatchDiscovery[] = [];

  for (const seed of activeSeeds) {
    const seedKey = buildSeedKey(seed);
    const cached = discoveredCache.get(seedKey);
    if (cached && cached.matchIds.length >= countPerSeed) {
      discoveries.push(cached);
      continue;
    }

    const matchIds = await riotApiClient.getMatchIdsByPuuidOnRegion(seed.puuid, seed.cluster, countPerSeed);
    discoveries.push({
      seedKey,
      playerName: seed.playerName,
      team: seed.team,
      league: seed.league,
      competition: seed.competition,
      role: seed.role,
      puuid: seed.puuid,
      region: seed.cluster,
      matchIds,
    });
  }

  return discoveries;
}

function buildSkippedMatchFailure(candidate: ProMatchQueueEntry, seed: ActiveProSeed, imported: ImportedProMatch) {
  return {
    matchId: candidate.matchId,
    seedKey: candidate.seedKey,
    playerName: seed.playerName,
    team: seed.team,
    league: seed.league,
    competition: seed.competition,
    role: seed.role,
    region: seed.cluster,
    patch: imported.patch,
    timelineAvailable: imported.timelineAvailable,
    timelineMissingReason: imported.timelineMissingReason,
    targetChampionSlug: imported.targetChampionSlug,
    targetRole: imported.targetRole,
    gameCreationAt: imported.gameCreationAt?.toISOString() ?? null,
    created: imported.created,
    failureReason: imported.skippedReason,
  };
}

function buildErroredMatchFailure(candidate: ProMatchQueueEntry, seed: ActiveProSeed, error: unknown) {
  return {
    matchId: candidate.matchId,
    seedKey: candidate.seedKey,
    playerName: seed.playerName,
    team: seed.team,
    league: seed.league,
    competition: seed.competition,
    role: seed.role,
    region: seed.cluster,
    patch: null,
    timelineAvailable: false,
    timelineMissingReason: null,
    targetChampionSlug: null,
    targetRole: null,
    gameCreationAt: null,
    created: false,
    failureReason: getErrorMessage(error),
  };
}

function buildImportIdentity(seed: ActiveProSeed) {
  const riotId = seed.resolvedRiotId ? splitRiotId(seed.resolvedRiotId) : null;

  return {
    puuid: seed.puuid,
    gameName: riotId?.gameName ?? null,
    tagLine: riotId?.tagLine ?? null,
    region: seed.cluster,
    platform: seed.platformHint ?? "euw1",
  };
}

async function importProMatch(input: {
  ownerUserId: string;
  candidate: ProMatchQueueEntry;
  seed: ActiveProSeed;
  targetMatches: number;
}) {
  return riotSyncService.importMatchForIdentity(
    input.ownerUserId,
    input.candidate.matchId,
    buildImportIdentity(input.seed),
    {
      sourceKind: "PRO_SEED",
      sourceMetadata: buildSourceMetadata(input.seed, input.candidate.order, input.targetMatches),
      skipExistingWithDifferentTarget: true,
    },
  );
}

async function saveCheckpoint(input: {
  checkpointPath: string;
  options: CliOptions;
  resolvedSeeds: ProResolvedSeed[];
  discoveries: ProSeedMatchDiscovery[];
  attemptedMatchIds: Set<string>;
  importedMatchIds: Set<string>;
  failedMatches: ProIngestionAttemptSummary[];
}) {
  await saveProIngestionCheckpoint(input.checkpointPath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    targetUniqueMatches: input.options.targetMatches,
    resolvedSeeds: input.resolvedSeeds,
    discoveredMatches: input.discoveries,
    attemptedMatchIds: [...input.attemptedMatchIds],
    importedMatchIds: [...input.importedMatchIds],
    failedMatches: input.failedMatches,
  });
}

async function importQueuedMatches(input: {
  ownerUserId: string;
  options: CliOptions;
  checkpointPath: string;
  checkpoint: ProIngestionCheckpoint;
  activeSeeds: ActiveProSeed[];
  resolvedSeeds: ProResolvedSeed[];
  discoveries: ProSeedMatchDiscovery[];
  queue: ProMatchQueueEntry[];
  currentProMatches: number;
}) {
  const attemptedMatchIds = new Set(input.checkpoint.attemptedMatchIds);
  const importedMatchIds = new Set(input.checkpoint.importedMatchIds);
  const failedMatches = [...input.checkpoint.failedMatches];
  const seedIndex = new Map(input.activeSeeds.map((seed) => [buildSeedKey(seed), seed]));
  let totalProMatches = input.currentProMatches;

  for (const candidate of input.queue) {
    if (totalProMatches >= input.options.targetMatches) {
      break;
    }
    if (attemptedMatchIds.has(candidate.matchId)) {
      continue;
    }

    const seed = seedIndex.get(candidate.seedKey);
    if (!seed) {
      continue;
    }

    attemptedMatchIds.add(candidate.matchId);
    try {
      const imported = await importProMatch({
        ownerUserId: input.ownerUserId,
        candidate,
        seed,
        targetMatches: input.options.targetMatches,
      });

      if (imported.created) {
        importedMatchIds.add(imported.riotMatchId);
        totalProMatches += 1;
      }

      if (imported.skippedReason) {
        failedMatches.push(buildSkippedMatchFailure(candidate, seed, imported));
      }
    } catch (error) {
      failedMatches.push(buildErroredMatchFailure(candidate, seed, error));
    }

    await saveCheckpoint({
      checkpointPath: input.checkpointPath,
      options: input.options,
      resolvedSeeds: input.resolvedSeeds,
      discoveries: input.discoveries,
      attemptedMatchIds,
      importedMatchIds,
      failedMatches,
    });

    if (attemptedMatchIds.size % 25 === 0 || totalProMatches >= input.options.targetMatches) {
      console.info(
        `[pro-ingestion] progress attempted=${attemptedMatchIds.size} created=${importedMatchIds.size} totalProMatches=${totalProMatches}/${input.options.targetMatches}`,
      );
    }
  }

  return {
    attemptedMatchIds,
    importedMatchIds,
    failedMatches,
    totalProMatches,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  validateOptions(options);

  const ownerUserId = await resolveOwnerUserId(options);
  const { absolutePath: seedAbsolutePath, players } = await loadSeeds(options.seedPath);
  const checkpointPath = path.resolve(options.checkpointPath);
  const reportPath = path.resolve(options.reportPath);
  const checkpoint = (await loadProIngestionCheckpoint(checkpointPath)) ?? createInitialCheckpoint(options);

  console.info(`[pro-ingestion] resolving ${players.length} seed players from ${seedAbsolutePath}`);
  const resolvedSeeds = await resolveSeeds(players, checkpoint);
  const activeSeeds = getActiveSeeds(resolvedSeeds);

  if (activeSeeds.length === 0) {
    throw new Error("No professional seeds could be resolved to Riot accounts.");
  }

  const discoveries = await discoverSeedMatches(activeSeeds, checkpoint, options.countPerSeed);
  const currentProMatches = await prisma.importedMatch.count({
    where: { sourceKind: "PRO_SEED" },
  });
  const discoveredUniqueMatches = new Set(discoveries.flatMap((seed) => seed.matchIds)).size;
  const queue = buildRoundRobinMatchQueue(discoveries, discoveredUniqueMatches);

  console.info(
    `[pro-ingestion] starting activeSeeds=${activeSeeds.length} existingProMatches=${currentProMatches} queueCandidates=${queue.length} target=${options.targetMatches}`,
  );

  const { attemptedMatchIds, importedMatchIds, failedMatches } = await importQueuedMatches({
    ownerUserId,
    options,
    checkpointPath,
    checkpoint,
    activeSeeds,
    resolvedSeeds,
    discoveries,
    queue,
    currentProMatches,
  });

  const persistedRows = await prisma.importedMatch.findMany({
    where: {
      sourceKind: "PRO_SEED",
    },
    select: {
      patch: true,
      timelineMissingReason: true,
      gameCreationAt: true,
      timelineFetchedAt: true,
      targetRole: true,
      sourceKind: true,
      sourceMetadata: true,
    },
  });
  const report = buildProIngestionReport(
    persistedRows.map((row) => {
      const metadata = (row.sourceMetadata ?? {}) as {
        seed?: { league?: string | null; competition?: string | null };
      };

      return {
        patch: row.patch,
        timelineMissingReason: row.timelineMissingReason,
        gameCreationAt: row.gameCreationAt,
        timelineFetchedAt: row.timelineFetchedAt,
        targetRole: row.targetRole,
        sourceKind: row.sourceKind,
        sourceLeague: metadata.seed?.league ?? null,
        sourceCompetition: metadata.seed?.competition ?? null,
      };
    }),
  );

  const unresolvedSeeds = resolvedSeeds.filter((seed) => seed.resolutionStatus !== "resolved");
  const reportPayload = {
    generatedAt: new Date().toISOString(),
    seedPath: seedAbsolutePath,
    checkpointPath,
    targetMatches: options.targetMatches,
    countPerSeed: options.countPerSeed,
    totalSeeds: players.length,
    resolvedSeedCount: activeSeeds.length,
    unresolvedSeedCount: unresolvedSeeds.length,
    unresolvedSeeds: unresolvedSeeds.slice(0, 25).map((seed) => ({
      playerName: seed.playerName,
      team: seed.team,
      league: seed.league,
      role: seed.role,
      resolutionError: seed.resolutionError,
    })),
    discoveredUniqueMatches,
    attemptedMatches: attemptedMatchIds.size,
    createdMatches: importedMatchIds.size,
    totalProMatchesInDb: persistedRows.length,
    failedMatchesCount: failedMatches.length,
    topFailureReasons: Object.entries(
      failedMatches.reduce<Record<string, number>>((accumulator, failure) => {
        const key = failure.failureReason ?? "unknown";
        accumulator[key] = (accumulator[key] ?? 0) + 1;
        return accumulator;
      }, {}),
    )
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
      .slice(0, 10),
    riotApiMetrics: riotApiClient.getMetricsSnapshot(),
    ...report,
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(reportPayload, null, 2), "utf-8");

  console.info(JSON.stringify(reportPayload, null, 2));
}

try {
  await main();
} catch (error) {
  console.error("[pro-ingestion] failed", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
