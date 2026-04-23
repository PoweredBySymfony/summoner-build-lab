import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@prisma/client";

import { prisma } from "../server/src/lib/prisma.js";
import { canonicalizePatch } from "../server/src/lib/riot/patchCanonical.js";
import {
  buildCompetitiveIngestionReport,
  buildCompetitiveMatchQueue,
  buildCompetitiveSeedKey,
  buildSeedSummaries,
  determineOpenedFallbackTiers,
  evaluateCompetitiveMatchPolicy,
  loadCompetitiveIngestionCheckpoint,
  loadCompetitiveIngestionPolicy,
  resolveCompetitiveIngestionPolicy,
  saveCompetitiveIngestionCheckpoint,
  scoreCompetitiveMatch,
  type CompetitiveDiscoveredMatch,
  type CompetitiveCachedMatchMetadata,
  type CompetitiveDiscoveryQueueState,
  type CompetitiveIngestionAttemptSummary,
  type CompetitiveIngestionCheckpoint,
  type CompetitiveIngestionPolicyConfig,
  type CompetitiveResolvedSeed,
  type CompetitiveSeedMatchDiscovery,
} from "../server/src/lib/riot/competitiveIngestion.js";
import {
  dedupeCompetitiveSeeds,
  fetchEliteLadderSeeds,
  type CompetitiveSeed,
  type CompetitiveSeedManifest,
} from "../server/src/lib/riot/competitiveSeeds.js";
import { riotApiClient } from "../server/src/lib/riot/riotApiClient.js";
import { riotSyncService } from "../server/src/services/riotSyncService.js";
import {
  mergeCompetitiveSourceMetadata,
} from "./lib/competitiveImportedMatchProvenance.js";

type CliOptions = {
  ownerUserId?: string;
  ownerEmail?: string;
  seedPath: string;
  policyPath: string;
  checkpointPath: string;
  reportPath: string;
  markdownReportPath: string;
  targetMatches: number;
  countPerSeed: number;
  maxIdsPerSeed: number;
  startTime?: number;
  endTime?: number | null;
  dryRun: boolean;
  resetCheckpoint: boolean;
  preferredQueues?: number[];
  fallbackQueues?: number[];
  preferredPatchPrefixes?: string[];
  adjacentPatchPrefixes?: string[];
  maxAttemptsPerRun?: number;
  maxCreatedPerRun?: number;
  maxAuthFailuresPerRun?: number;
  trancheSize?: number;
  maxClassifiedPerRun?: number;
};

const PROGRESS_PERSIST_ATTEMPT_INTERVAL = 50;
const PROGRESS_PERSIST_CREATED_INTERVAL = 10;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    seedPath: path.join("data", "seeds", "competitive-seeds-2026.json"),
    policyPath: path.join("data", "config", "competitive-ingestion-policy-2026.json"),
    checkpointPath: path.join("data", "runtime", "competitive-ingestion", "checkpoint.json"),
    reportPath: path.join("data", "runtime", "competitive-ingestion", "report.json"),
    markdownReportPath: path.join("data", "runtime", "competitive-ingestion", "report.md"),
    ownerEmail: "xtrouche@gmail.com",
    targetMatches: 10000,
    countPerSeed: 30,
    maxIdsPerSeed: 300,
    dryRun: false,
    resetCheckpoint: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
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
        if (next) options.seedPath = next;
        index += 1;
        break;
      case "--policy-path":
        if (next) options.policyPath = next;
        index += 1;
        break;
      case "--checkpoint-path":
        if (next) options.checkpointPath = next;
        index += 1;
        break;
      case "--report-path":
        if (next) options.reportPath = next;
        index += 1;
        break;
      case "--markdown-report-path":
        if (next) options.markdownReportPath = next;
        index += 1;
        break;
      case "--target-matches":
        options.targetMatches = Number(next ?? "2000");
        index += 1;
        break;
      case "--count-per-seed":
        options.countPerSeed = Number(next ?? "30");
        index += 1;
        break;
      case "--max-ids-per-seed":
        options.maxIdsPerSeed = Number(next ?? "300");
        index += 1;
        break;
      case "--start-time":
        options.startTime = Number(next ?? "0");
        index += 1;
        break;
      case "--end-time":
        options.endTime = next ? Number(next) : null;
        index += 1;
        break;
      case "--preferred-queues":
        if (next) {
          options.preferredQueues = next.split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
        }
        index += 1;
        break;
      case "--fallback-queues":
        if (next) {
          options.fallbackQueues = next.split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
        }
        index += 1;
        break;
      case "--preferred-patch-prefixes":
        if (next) {
          options.preferredPatchPrefixes = next.split(",").map((value) => value.trim()).filter(Boolean);
        }
        index += 1;
        break;
      case "--adjacent-patch-prefixes":
        if (next) {
          options.adjacentPatchPrefixes = next.split(",").map((value) => value.trim()).filter(Boolean);
        }
        index += 1;
        break;
      case "--max-attempts-per-run":
        options.maxAttemptsPerRun = Number(next ?? "0");
        index += 1;
        break;
      case "--max-created-per-run":
        options.maxCreatedPerRun = Number(next ?? "0");
        index += 1;
        break;
      case "--max-auth-failures-per-run":
        options.maxAuthFailuresPerRun = Number(next ?? "0");
        index += 1;
        break;
      case "--tranche-size":
        options.trancheSize = Number(next ?? "0");
        index += 1;
        break;
      case "--max-classified-per-run":
        options.maxClassifiedPerRun = Number(next ?? "0");
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--reset-checkpoint":
        options.resetCheckpoint = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function applyTranchePreset(options: CliOptions) {
  if (!options.trancheSize || !Number.isFinite(options.trancheSize) || options.trancheSize <= 0) {
    return options;
  }

  return {
    ...options,
    maxCreatedPerRun: options.maxCreatedPerRun ?? options.trancheSize,
    maxAttemptsPerRun: options.maxAttemptsPerRun ?? Math.max(options.trancheSize * 2, options.trancheSize + 10),
    maxAuthFailuresPerRun: options.maxAuthFailuresPerRun ?? 3,
    maxClassifiedPerRun: options.maxClassifiedPerRun ?? Math.max(options.trancheSize * 12, options.trancheSize * 6),
  };
}

function toUnixSeconds(timestampMs: number | null) {
  return timestampMs === null ? null : Math.floor(timestampMs / 1000);
}

function buildDiscoveryQuerySignature(input: {
  queues: number[];
  startTime: number | null;
  endTime: number | null;
  pageSize: number;
  maxIdsPerSeed: number;
}) {
  return JSON.stringify({
    queues: [...new Set(input.queues)],
    startTime: input.startTime,
    endTime: input.endTime,
    pageSize: input.pageSize,
    maxIdsPerSeed: input.maxIdsPerSeed,
  });
}

function arraysEqualIgnoringOrder<T extends string | number>(left: T[], right: T[]) {
  if (left.length !== right.length) {
    return false;
  }

  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function splitRiotId(riotId: string) {
  const [gameName, ...tagLineParts] = riotId.split("#");
  return {
    gameName: gameName.trim(),
    tagLine: tagLineParts.join("#").trim(),
  };
}

async function resolveOwnerUserId(options: CliOptions) {
  if (options.ownerUserId) {
    return options.ownerUserId;
  }
  const user = await prisma.user.findUnique({
    where: { email: options.ownerEmail ?? "xtrouche@gmail.com" },
    select: { id: true },
  });
  if (!user) {
    throw new Error(`No user found for owner email ${options.ownerEmail ?? "xtrouche@gmail.com"}.`);
  }
  return user.id;
}

async function loadManifest(seedPath: string) {
  const absolutePath = path.resolve(seedPath);
  const manifest = JSON.parse(await readFile(absolutePath, "utf-8")) as CompetitiveSeedManifest;
  if (!Array.isArray(manifest.players) || manifest.players.length === 0) {
    throw new Error(`Competitive seed manifest at ${absolutePath} is empty.`);
  }
  return {
    absolutePath,
    manifest,
  };
}

function withPolicyOverrides(
  policy: CompetitiveIngestionPolicyConfig,
  options: CliOptions,
): CompetitiveIngestionPolicyConfig {
  return {
    ...policy,
    preferredPatchPrefixes: options.preferredPatchPrefixes ?? policy.preferredPatchPrefixes,
    acceptedAdjacentPatchPrefixes: options.adjacentPatchPrefixes ?? policy.acceptedAdjacentPatchPrefixes,
    preferredQueues: options.preferredQueues ?? policy.preferredQueues,
    acceptedFallbackQueues: options.fallbackQueues ?? policy.acceptedFallbackQueues,
    seasonWindowStart:
      typeof options.startTime === "number"
        ? new Date(options.startTime * 1000).toISOString()
        : policy.seasonWindowStart,
    seasonWindowEnd:
      typeof options.endTime !== "undefined"
        ? (options.endTime ? new Date(options.endTime * 1000).toISOString() : null)
        : policy.seasonWindowEnd,
  };
}

function normalizePatch(match: Record<string, unknown>) {
  const info = match.info as { gameVersion?: string; gameCreation?: number } | undefined;
  const gameCreationAt = typeof info?.gameCreation === "number" ? new Date(info.gameCreation) : null;
  return canonicalizePatch(info?.gameVersion, gameCreationAt).patchCanonical;
}

function normalizeQueueId(match: Record<string, unknown>) {
  const info = match.info as { queueId?: number } | undefined;
  const queueId = Number(info?.queueId ?? Number.NaN);
  return Number.isFinite(queueId) ? queueId : null;
}

function normalizeGameCreationAt(match: Record<string, unknown>) {
  const info = match.info as { gameCreation?: number } | undefined;
  const gameCreation = Number(info?.gameCreation ?? Number.NaN);
  if (!Number.isFinite(gameCreation)) {
    return null;
  }
  return new Date(gameCreation);
}

function toSourceKind(priorityTier: CompetitiveSeed["priorityTier"]) {
  return priorityTier === "pro" ? "PRO_SEED" : priorityTier === "elite" ? "ELITE_SEED" : "FALLBACK_SEED";
}

function mergeResolvedSeed(seed: CompetitiveSeed, cached: CompetitiveResolvedSeed | undefined): CompetitiveResolvedSeed {
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

async function resolveSeed(
  seed: CompetitiveSeed,
  cached: CompetitiveResolvedSeed | undefined,
): Promise<CompetitiveResolvedSeed> {
  if (cached?.resolutionStatus === "resolved" && cached.puuid && cached.cluster) {
    return cached;
  }

  if (seed.puuid) {
    try {
      const resolved = await riotSyncService.resolveImportIdentity({ type: "puuid", puuid: seed.puuid });
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
      };
    } catch (error) {
      return {
        ...mergeResolvedSeed(seed, cached),
        resolutionStatus: "unresolved",
        resolutionError: error instanceof Error ? error.message : String(error),
        resolutionSource: "seed-puuid",
      };
    }
  }

  const candidateRiotIds = [seed.riotId, ...seed.riotIdCandidates].filter((value): value is string => Boolean(value));
  if (candidateRiotIds.length === 0) {
    return {
      ...mergeResolvedSeed(seed, cached),
      resolutionStatus: "unresolved",
      resolutionError: "No Riot ID or PUUID candidate available in the seed.",
      resolutionSource: null,
    };
  }

  for (const [index, candidate] of candidateRiotIds.entries()) {
    const { gameName, tagLine } = splitRiotId(candidate);
    if (!gameName || !tagLine) {
      continue;
    }

    try {
      const resolved = await riotSyncService.resolveImportIdentity({
        type: "riot-id",
        gameName,
        tagLine,
      });
      return {
        ...mergeResolvedSeed(seed, cached),
        resolutionStatus: "resolved",
        resolutionError: null,
        resolutionSource: index === 0 && seed.riotId ? "seed-riot-id" : "candidate-riot-id",
        resolvedRiotId: `${resolved.gameName ?? gameName}#${resolved.tagLine ?? tagLine}`,
        puuid: resolved.puuid,
        platformHint: resolved.platform,
        cluster: resolved.region,
      };
    } catch (error) {
      if (index === candidateRiotIds.length - 1) {
        return {
          ...mergeResolvedSeed(seed, cached),
          resolutionStatus: "unresolved",
          resolutionError: error instanceof Error ? error.message : String(error),
          resolutionSource: index === 0 && seed.riotId ? "seed-riot-id" : "candidate-riot-id",
        };
      }
    }
  }

  return {
    ...mergeResolvedSeed(seed, cached),
    resolutionStatus: "unresolved",
    resolutionError: "Unable to resolve Riot identity.",
    resolutionSource: null,
  };
}

async function resolveSeeds(
  seeds: CompetitiveSeed[],
  resolvedSeedCache: Map<string, CompetitiveResolvedSeed>,
  input?: {
    onProgress?: (snapshot: {
      processedSeeds: number;
      totalSeeds: number;
      resolvedSeeds: CompetitiveResolvedSeed[];
      seed: CompetitiveSeed;
    }) => Promise<void> | void;
  },
) {
  const resolvedSeeds: CompetitiveResolvedSeed[] = [];
  for (const seed of seeds) {
    resolvedSeeds.push(await resolveSeed(seed, resolvedSeedCache.get(buildCompetitiveSeedKey(seed))));
    console.info(
      `[competitive-ingestion] resolve-seed-progress processed=${resolvedSeeds.length}/${seeds.length} seed=${seed.playerName} status=${resolvedSeeds[resolvedSeeds.length - 1]?.resolutionStatus ?? "unknown"}`,
    );
    await input?.onProgress?.({
      processedSeeds: resolvedSeeds.length,
      totalSeeds: seeds.length,
      resolvedSeeds,
      seed,
    });
  }
  return resolvedSeeds;
}

function canReuseCheckpointState(input: {
  checkpoint: CompetitiveIngestionCheckpoint;
  manifestSeedSetVersion: string;
  policy: ReturnType<typeof resolveCompetitiveIngestionPolicy>;
  startTime: number | null;
  endTime: number | null;
  classificationBudget: number;
}) {
  const { checkpoint, manifestSeedSetVersion, policy, startTime, endTime, classificationBudget } = input;
  if (checkpoint.seedSetVersion !== manifestSeedSetVersion) {
    return false;
  }

  if ((checkpoint.policyMode ?? "strict_recent_competitive") !== policy.mode) {
    return false;
  }

  if (
    checkpoint.seasonWindow.startTime !== startTime
    || checkpoint.seasonWindow.endTime !== endTime
  ) {
    return false;
  }

  if (
    !arraysEqualIgnoringOrder(
      checkpoint.queueWhitelist ?? [],
      [...policy.preferredQueues, ...policy.acceptedFallbackQueues],
    )
  ) {
    return false;
  }

  if (
    !arraysEqualIgnoringOrder(
      checkpoint.patchAllowPrefixes ?? [],
      [...policy.preferredPatchPrefixes, ...policy.acceptedAdjacentPatchPrefixes],
    )
  ) {
    return false;
  }

  if ((checkpoint.classificationBudget ?? 0) !== classificationBudget) {
    return false;
  }

  return checkpoint.resolvedSeeds.length > 0 && checkpoint.discoveredMatches.length > 0;
}

function rebuildDiscoveredMatchesFromCheckpoint(input: {
  checkpoint: CompetitiveIngestionCheckpoint;
  resolvedSeeds: CompetitiveResolvedSeed[];
  policy: ReturnType<typeof resolveCompetitiveIngestionPolicy>;
  matchMetadataCache: Map<string, CompetitiveCachedMatchMetadata>;
}) {
  const policyDecisionByMatchId = input.checkpoint.policyDecisionByMatchId ?? {};
  const classifiedMatchIds = new Set(Object.keys(policyDecisionByMatchId));
  if (classifiedMatchIds.size === 0) {
    return [];
  }

  const seedIndex = new Map(
    input.resolvedSeeds.map((seed) => [buildCompetitiveSeedKey(seed), seed]),
  );
  const discoveryByMatchId = new Map<string, CompetitiveSeedMatchDiscovery>();

  for (const discovery of input.checkpoint.discoveredMatches) {
    for (const matchId of discovery.matchIds) {
      if (!classifiedMatchIds.has(matchId) || discoveryByMatchId.has(matchId)) {
        continue;
      }
      discoveryByMatchId.set(matchId, discovery);
      if (discoveryByMatchId.size >= classifiedMatchIds.size) {
        break;
      }
    }
    if (discoveryByMatchId.size >= classifiedMatchIds.size) {
      break;
    }
  }

  const rebuilt: CompetitiveDiscoveredMatch[] = [];
  for (const [matchId, decision] of Object.entries(policyDecisionByMatchId)) {
    const discovery = discoveryByMatchId.get(matchId);
    if (!discovery) {
      continue;
    }

    const seed = seedIndex.get(discovery.seedKey);
    const metadata = input.matchMetadataCache.get(matchId);
    const gameCreationAt = metadata?.gameCreationAt ?? null;
    const gameCreationDate = gameCreationAt ? new Date(gameCreationAt) : null;

    rebuilt.push({
      matchId,
      seedKey: discovery.seedKey,
      playerName: discovery.playerName,
      team: discovery.team,
      league: discovery.league,
      competition: discovery.competition,
      role: discovery.role,
      priorityTier: discovery.priorityTier,
      priorityScore: discovery.priorityScore,
      platform: seed?.platformHint ?? null,
      cluster: discovery.region,
      queueId: metadata?.queueId ?? null,
      patch: metadata?.patch ?? null,
      gameCreationAt,
      acceptedByPolicy: decision.acceptedByPolicy,
      acceptedReason: decision.acceptedReason,
      rejectionReason: decision.rejectionReason,
      fallbackReason: decision.fallbackReason,
      policyMode: decision.policyMode,
      policyBucket: decision.policyBucket,
      queueBucket: decision.queueBucket,
      sourceBucket: decision.sourceBucket,
      priorityBand: decision.priorityBand,
      matchPriorityScore: scoreCompetitiveMatch({
        priorityTier: discovery.priorityTier,
        priorityScore: discovery.priorityScore,
        patch: metadata?.patch ?? null,
        gameCreationAt: gameCreationDate,
        patchBucket: decision.policyBucket,
        queueBucket: decision.queueBucket,
        priorityBand: decision.priorityBand,
      }),
    });
  }

  return rebuilt;
}

async function discoverMatchIdsForSeed(
  seed: CompetitiveResolvedSeed & { puuid: string; cluster: NonNullable<CompetitiveResolvedSeed["cluster"]> },
  input: {
    pageSize: number;
    maxIdsPerSeed: number;
    targetIds: number;
    queues: number[];
    startTime: number | null;
    endTime: number | null;
    cached?: CompetitiveSeedMatchDiscovery;
  },
) {
  const uniqueQueues = [...new Set(input.queues)];
  const querySignature = buildDiscoveryQuerySignature({
    queues: uniqueQueues,
    startTime: input.startTime,
    endTime: input.endTime,
    pageSize: input.pageSize,
    maxIdsPerSeed: input.maxIdsPerSeed,
  });
  const canReuseCache = input.cached?.querySignature === querySignature;
  const allMatchIds = new Set<string>(canReuseCache ? input.cached?.matchIds ?? [] : []);
  const scanStateByQueue: Record<string, CompetitiveDiscoveryQueueState> = canReuseCache
    ? Object.fromEntries(
      Object.entries(input.cached?.scanStateByQueue ?? {}).map(([queue, state]) => [queue, { ...state }]),
    )
    : {};

  while (allMatchIds.size < input.targetIds) {
    let progressed = false;
    const totalRequested = Object.values(scanStateByQueue).reduce((sum, state) => sum + (state.requests ?? 0), 0);
    const remainingGlobalBudget = input.maxIdsPerSeed - totalRequested;
    if (remainingGlobalBudget <= 0) {
      break;
    }

    for (const queue of uniqueQueues) {
      const queueKey = String(queue);
      const state = scanStateByQueue[queueKey] ?? {
        nextStart: 0,
        requests: 0,
        exhausted: false,
      };
      scanStateByQueue[queueKey] = state;

      if (state.exhausted) {
        continue;
      }

      const refreshedTotalRequested = Object.values(scanStateByQueue).reduce((sum, entry) => sum + (entry.requests ?? 0), 0);
      const refreshedRemainingBudget = input.maxIdsPerSeed - refreshedTotalRequested;
      const remainingTarget = input.targetIds - allMatchIds.size;
      const requestCount = Math.min(input.pageSize, refreshedRemainingBudget, remainingTarget);
      if (requestCount <= 0) {
        break;
      }

      console.info(
        `[competitive-ingestion] discover-match-ids seed=${seed.playerName} queue=${queue} start=${state.nextStart} count=${requestCount} startTime=${input.startTime ?? "none"} endTime=${input.endTime ?? "none"}`,
      );

      const matchIds = await riotApiClient.getMatchIdsByPuuidOnRegion(seed.puuid, seed.cluster, requestCount, {
        queue,
        start: state.nextStart,
        startTime: input.startTime ?? undefined,
        endTime: input.endTime ?? undefined,
      });

      state.nextStart += requestCount;
      state.requests += requestCount;
      if (matchIds.length < requestCount) {
        state.exhausted = true;
      }

      for (const matchId of matchIds) {
        allMatchIds.add(matchId);
      }
      progressed = progressed || matchIds.length > 0;

      if (allMatchIds.size >= input.targetIds) {
        break;
      }
    }

    if (!progressed) {
      break;
    }
  }

  return {
    seedKey: buildCompetitiveSeedKey(seed),
    playerName: seed.playerName,
    team: seed.team,
    league: seed.league,
    competition: seed.competition,
    role: seed.role,
    priorityTier: seed.priorityTier,
    priorityScore: seed.priorityScore,
    puuid: seed.puuid,
    region: seed.cluster,
    matchIds: [...allMatchIds],
    querySignature,
    appliedFilters: {
      queues: uniqueQueues,
      startTime: input.startTime,
      endTime: input.endTime,
      pageSize: input.pageSize,
      maxIdsPerSeed: input.maxIdsPerSeed,
    },
    scanStateByQueue,
  } satisfies CompetitiveSeedMatchDiscovery;
}

async function discoverSeeds(
  seeds: CompetitiveResolvedSeed[],
  discoveryCache: Map<string, CompetitiveSeedMatchDiscovery>,
  input: {
    pageSize: number;
    maxIdsPerSeed: number;
    targetIdsPerSeed: number;
    queues: number[];
    startTime: number | null;
    endTime: number | null;
    onProgress?: (snapshot: {
      processedSeeds: number;
      totalActiveSeeds: number;
      discoveries: CompetitiveSeedMatchDiscovery[];
      seed: CompetitiveResolvedSeed & { puuid: string; cluster: NonNullable<CompetitiveResolvedSeed["cluster"]> };
    }) => Promise<void> | void;
  },
) {
  const activeSeeds = seeds.filter(
    (seed): seed is CompetitiveResolvedSeed & { puuid: string; cluster: NonNullable<CompetitiveResolvedSeed["cluster"]> } =>
      seed.resolutionStatus === "resolved" && Boolean(seed.puuid) && Boolean(seed.cluster),
  );

  const discoveries: CompetitiveSeedMatchDiscovery[] = [];
  for (const seed of activeSeeds) {
    const seedKey = buildCompetitiveSeedKey(seed);
    const cached = discoveryCache.get(seedKey);
    const hasCachedScanState = Object.keys(cached?.scanStateByQueue ?? {}).length > 0;
    if (
      cached?.querySignature === buildDiscoveryQuerySignature(input)
      && (cached.matchIds.length >= input.targetIdsPerSeed || (hasCachedScanState && Object.values(cached.scanStateByQueue ?? {}).every((state) => state.exhausted)))
    ) {
      discoveries.push(cached);
      console.info(
        `[competitive-ingestion] discover-seed-progress processed=${discoveries.length}/${activeSeeds.length} seed=${seed.playerName} cached=yes matchIds=${cached.matchIds.length}`,
      );
      await input.onProgress?.({
        processedSeeds: discoveries.length,
        totalActiveSeeds: activeSeeds.length,
        discoveries,
        seed,
      });
      continue;
    }

    try {
      discoveries.push(await discoverMatchIdsForSeed(seed, {
        pageSize: input.pageSize,
        maxIdsPerSeed: input.maxIdsPerSeed,
        targetIds: input.targetIdsPerSeed,
        queues: input.queues,
        startTime: input.startTime,
        endTime: input.endTime,
        cached,
      }));
    } catch (error) {
      console.warn(
        "[competitive-ingestion] discover-seed-failed",
        JSON.stringify({
          seed: seed.playerName,
          matchIdsCached: cached?.matchIds.length ?? 0,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      discoveries.push(cached ?? {
        seedKey,
        playerName: seed.playerName,
        team: seed.team,
        league: seed.league,
        competition: seed.competition,
        role: seed.role,
        priorityTier: seed.priorityTier,
        priorityScore: seed.priorityScore,
        puuid: seed.puuid,
        region: seed.cluster,
        matchIds: [],
        querySignature: buildDiscoveryQuerySignature(input),
        appliedFilters: {
          queues: [...new Set(input.queues)],
          startTime: input.startTime,
          endTime: input.endTime,
          pageSize: input.pageSize,
          maxIdsPerSeed: input.maxIdsPerSeed,
        },
        scanStateByQueue: cached?.scanStateByQueue ?? {},
      });
    }
    console.info(
      `[competitive-ingestion] discover-seed-progress processed=${discoveries.length}/${activeSeeds.length} seed=${seed.playerName} cached=no matchIds=${discoveries[discoveries.length - 1]?.matchIds.length ?? 0}`,
    );
    await input.onProgress?.({
      processedSeeds: discoveries.length,
      totalActiveSeeds: activeSeeds.length,
      discoveries,
      seed,
    });
  }

  return discoveries;
}

async function classifyDiscoveredMatches(
  discoveries: CompetitiveSeedMatchDiscovery[],
  policy: ReturnType<typeof resolveCompetitiveIngestionPolicy>,
  matchMetadataCache: Map<string, CompetitiveCachedMatchMetadata>,
  options?: {
    maxUniqueMatchesToClassify?: number;
    onProgress?: (snapshot: {
      classifiedUniqueMatches: number;
      maxUniqueMatchesToClassify: number;
      discoveredMatches: CompetitiveDiscoveredMatch[];
      currentMatchId: string;
    }) => Promise<void> | void;
  },
) {
  const discoveredMatches: CompetitiveDiscoveredMatch[] = [];
  const classifiedMatchIds = new Set<string>();
  const maxUniqueMatchesToClassify = options?.maxUniqueMatchesToClassify ?? Number.POSITIVE_INFINITY;

  for (const discovery of discoveries) {
    for (const matchId of discovery.matchIds) {
      if (!classifiedMatchIds.has(matchId)) {
        if (classifiedMatchIds.size >= maxUniqueMatchesToClassify) {
          continue;
        }
        classifiedMatchIds.add(matchId);
        if (classifiedMatchIds.size % 100 === 0 || classifiedMatchIds.size === maxUniqueMatchesToClassify) {
          console.info(
            `[competitive-ingestion] classify-progress classified=${classifiedMatchIds.size}/${maxUniqueMatchesToClassify} matchId=${matchId}`,
          );
          await options?.onProgress?.({
            classifiedUniqueMatches: classifiedMatchIds.size,
            maxUniqueMatchesToClassify,
            discoveredMatches,
            currentMatchId: matchId,
          });
        }
      }

      const cachedMetadata = matchMetadataCache.get(matchId);
      const cachedGameCreationAt = cachedMetadata?.gameCreationAt ? new Date(cachedMetadata.gameCreationAt) : null;
      let gameCreationAt = cachedGameCreationAt;
      let effectivePatch = cachedMetadata?.patch ?? null;
      let effectiveQueueId = cachedMetadata?.queueId ?? null;

      if (!cachedMetadata) {
        try {
          const match = await riotApiClient.getMatchByIdOnRegion(matchId, discovery.region);
          effectivePatch = normalizePatch(match);
          effectiveQueueId = normalizeQueueId(match);
          gameCreationAt = normalizeGameCreationAt(match);
          matchMetadataCache.set(matchId, {
            patch: effectivePatch,
            queueId: effectiveQueueId,
            gameCreationAt: gameCreationAt?.toISOString() ?? null,
          });
        } catch (error) {
          console.warn(
            "[competitive-ingestion] classify-match-failed",
            JSON.stringify({
              matchId,
              seed: discovery.playerName,
              region: discovery.region,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
          continue;
        }
      }

      const policyResult = evaluateCompetitiveMatchPolicy(
        {
          patch: effectivePatch,
          queueId: effectiveQueueId,
          gameCreationAt,
          priorityTier: discovery.priorityTier,
        },
        policy,
      );
      const matchPriorityScore = scoreCompetitiveMatch({
        priorityTier: discovery.priorityTier,
        priorityScore: discovery.priorityScore,
        patch: effectivePatch,
        gameCreationAt,
        patchBucket: policyResult.patchBucket,
        queueBucket: policyResult.queueBucket,
        priorityBand: policyResult.priorityBand,
      });

      discoveredMatches.push({
        matchId,
        seedKey: discovery.seedKey,
        playerName: discovery.playerName,
        team: discovery.team,
        league: discovery.league,
        competition: discovery.competition,
        role: discovery.role,
        priorityTier: discovery.priorityTier,
        priorityScore: discovery.priorityScore,
        platform: null,
        cluster: discovery.region,
        queueId: effectiveQueueId,
        patch: effectivePatch,
        gameCreationAt: gameCreationAt?.toISOString() ?? null,
        acceptedByPolicy: policyResult.accepted,
        acceptedReason: policyResult.acceptedReason,
        rejectionReason: policyResult.rejectionReason,
        fallbackReason: policyResult.fallbackReason,
        policyMode: policyResult.policyMode,
        policyBucket: policyResult.patchBucket,
        queueBucket: policyResult.queueBucket,
        sourceBucket: policyResult.sourceBucket,
        priorityBand: policyResult.priorityBand,
        matchPriorityScore,
      });
    }
  }

  return discoveredMatches;
}

function buildRejectedMatches(discoveredMatches: CompetitiveDiscoveredMatch[]) {
  const rejectedSeen = new Set<string>();
  return discoveredMatches.flatMap((match) => {
    if (match.acceptedByPolicy) {
      return [];
    }
    const key = `${match.matchId}:${match.rejectionReason ?? "policy-rejected"}`;
    if (rejectedSeen.has(key)) {
      return [];
    }
    rejectedSeen.add(key);
    return [{
      matchId: match.matchId,
      seedKey: match.seedKey,
      reason: match.rejectionReason ?? "policy-rejected",
      patch: match.patch,
      queueId: match.queueId,
      priorityTier: match.priorityTier,
      gameCreationAt: match.gameCreationAt,
      policyBucket: match.policyBucket,
      queueBucket: match.queueBucket,
      sourceBucket: match.sourceBucket,
      priorityBand: match.priorityBand,
    }];
  });
}

function buildSourceMetadata(
  seed: CompetitiveResolvedSeed,
  candidate: CompetitiveDiscoveredMatch,
  policy: ReturnType<typeof resolveCompetitiveIngestionPolicy>,
): Prisma.InputJsonObject {
  return {
    seed: {
      playerName: seed.playerName,
      playerPage: seed.playerPage ?? null,
      team: seed.team,
      league: seed.league,
      competition: seed.competition,
      role: seed.role,
      region: seed.region,
      riotId: seed.resolvedRiotId,
      puuid: seed.puuid,
      platform: seed.platformHint,
      cluster: seed.cluster,
      priorityTier: seed.priorityTier,
      priorityScore: seed.priorityScore,
      discoverySource: seed.discoverySource,
      seedSetVersion: seed.seedSetVersion,
      season: seed.season,
      sourceTournamentDate: seed.sourceTournamentDate,
      sourceUrl: seed.sourceUrl ?? null,
    },
    ingestion: {
      queueId: candidate.queueId,
      matchPriorityScore: candidate.matchPriorityScore,
      acceptedByPolicy: candidate.acceptedByPolicy,
      acceptedReason: candidate.acceptedReason,
      rejectionReason: candidate.rejectionReason,
      fallbackReason: candidate.fallbackReason,
      policyMode: candidate.policyMode,
      patchBucket: candidate.policyBucket,
      queueBucket: candidate.queueBucket,
      sourceBucket: candidate.sourceBucket,
      priorityBand: candidate.priorityBand,
      preferredPatchPrefixes: policy.preferredPatchPrefixes,
      acceptedAdjacentPatchPrefixes: policy.acceptedAdjacentPatchPrefixes,
      preferredQueues: policy.preferredQueues,
      acceptedFallbackQueues: policy.acceptedFallbackQueues,
      seasonWindowStart: policy.seasonWindowStart,
      seasonWindowEnd: policy.seasonWindowEnd,
    },
  } as Prisma.InputJsonObject;
}

async function repairImportedMatchProvenance(input: {
  riotMatchId: string;
  sourceKind: string;
  sourceRegion: string | null;
  sourceMetadata: Prisma.InputJsonObject;
}) {
  await prisma.importedMatch.updateMany({
    where: {
      riotMatchId: input.riotMatchId,
    },
    data: {
      sourceKind: input.sourceKind,
      sourceRegion: input.sourceRegion,
      sourceMetadata: mergeCompetitiveSourceMetadata({
        sourceKind: input.sourceKind,
        sourceRegion: input.sourceRegion,
        existingMetadata: input.sourceMetadata,
      }),
    },
  });
}

function renderMarkdownReport(report: Record<string, unknown>) {
  const patchDistribution = Array.isArray(report.patchDistribution)
    ? (report.patchDistribution as Array<{ patch: string; count: number }>)
    : [];
  const tierDistribution = Array.isArray(report.tierDistribution)
    ? (report.tierDistribution as Array<{ tier: string; count: number }>)
    : [];
  const patchBucketDistribution = Array.isArray(report.patchBucketDistribution)
    ? (report.patchBucketDistribution as Array<{ bucket: string; count: number }>)
    : [];
  const queueDistribution = Array.isArray(report.queueDistribution)
    ? (report.queueDistribution as Array<{ queueId: string; count: number }>)
    : [];

  return [
    "# Competitive Ingestion Report",
    "",
    `- Generated at: ${String(report.generatedAt ?? "")}`,
    `- Policy mode: ${String(report.policyMode ?? "")}`,
    `- Total seeds: ${String(report.totalSeeds ?? 0)}`,
    `- Resolved seeds: ${String(report.resolvedSeedCount ?? 0)}`,
    `- Resolved but no matches: ${String(report.resolvedButNoMatches ?? 0)}`,
    `- Resolved but rejected by policy: ${String(report.resolvedButRejectedByPolicy ?? 0)}`,
    `- Discovered: ${String(report.discoveredUniqueMatches ?? 0)}`,
    `- Discovered after time filter: ${String(report.discoveredUniqueMatchesAfterTimeFilter ?? 0)}`,
    `- Policy accepted: ${String(report.policyAcceptedMatches ?? 0)}`,
    `- Attempted: ${String(report.attemptedMatches ?? 0)}`,
    `- Imported: ${String(report.createdMatches ?? 0)}`,
    `- Rejected by policy: ${String(report.rejectedMatches ?? 0)}`,
    `- Failed fetch/import: ${String(report.failedMatchesCount ?? 0)}`,
    `- Dry run: ${String(report.dryRun ?? false)}`,
    `- Exact target imports: ${String(report.matchesImportedExactTargetPatch ?? 0)}`,
    `- Adjacent recent imports: ${String(report.matchesImportedAdjacentRecentPatch ?? 0)}`,
    `- Pro imports: ${String(report.matchesImportedPro ?? 0)}`,
    `- Elite imports: ${String(report.matchesImportedElite ?? 0)}`,
    "",
    "## Rejection Fractions",
    `- before-season-window: ${String(((report.rejectedReasonFractions as { beforeSeasonWindow?: number } | undefined)?.beforeSeasonWindow ?? 0).toFixed?.(4) ?? 0)}`,
    `- patch-not-allowed: ${String(((report.rejectedReasonFractions as { patchNotAllowed?: number } | undefined)?.patchNotAllowed ?? 0).toFixed?.(4) ?? 0)}`,
    `- queue-not-allowed: ${String(((report.rejectedReasonFractions as { queueNotAllowed?: number } | undefined)?.queueNotAllowed ?? 0).toFixed?.(4) ?? 0)}`,
    "",
    "## Patch Buckets",
    ...patchBucketDistribution.map((entry) => `- ${entry.bucket}: ${entry.count}`),
    "",
    "## Queue Distribution",
    ...queueDistribution.map((entry) => `- ${entry.queueId}: ${entry.count}`),
    "",
    "## Tier Distribution",
    ...tierDistribution.map((entry) => `- ${entry.tier}: ${entry.count}`),
    "",
    "## Patch Distribution",
    ...patchDistribution.slice(0, 12).map((entry) => `- ${entry.patch}: ${entry.count}`),
    "",
    `- Why zero before: ${String(report.whyZeroBefore ?? "")}`,
    `- What was relaxed: ${String(report.whatWasRelaxed ?? "")}`,
    "",
  ].join("\n");
}

async function maybeEnrichEliteSeeds(input: {
  manifestPlayers: CompetitiveSeed[];
  discoveredMatches: CompetitiveDiscoveredMatch[];
  policy: ReturnType<typeof resolveCompetitiveIngestionPolicy>;
}) {
  const hasEliteSeeds = input.manifestPlayers.some((seed) => seed.priorityTier === "elite");
  if (hasEliteSeeds || !input.policy.autoEnrichEliteIfNeeded) {
    return input.manifestPlayers;
  }

  const acceptedProMatches = new Set(
    input.discoveredMatches
      .filter((match) => match.acceptedByPolicy && match.sourceBucket === "pro")
      .map((match) => match.matchId),
  ).size;
  if (acceptedProMatches > 0) {
    return input.manifestPlayers;
  }

  console.info("[competitive-ingestion] fallback-opened: elite_seed_discovery");
  const eliteSeeds = await fetchEliteLadderSeeds();
  return dedupeCompetitiveSeeds([...input.manifestPlayers, ...eliteSeeds]);
}

async function main() {
  const options = applyTranchePreset(parseArgs(process.argv.slice(2)));
  const { absolutePath: seedAbsolutePath, manifest } = await loadManifest(options.seedPath);
  const policyConfig = withPolicyOverrides(
    await loadCompetitiveIngestionPolicy(path.resolve(options.policyPath)),
    options,
  );
  const policy = resolveCompetitiveIngestionPolicy(policyConfig);
  const checkpointPath = path.resolve(options.checkpointPath);
  const reportPath = path.resolve(options.reportPath);
  const markdownReportPath = path.resolve(options.markdownReportPath);
  const startTime = toUnixSeconds(policy.seasonWindowStartMs);
  const endTime = toUnixSeconds(policy.seasonWindowEndMs);
  const ownerUserId = options.dryRun ? null : await resolveOwnerUserId(options);
  const baselineTotalMatchesBefore = options.dryRun ? 0 : await prisma.importedMatch.count();
  const baselineCompetitiveMatchesBefore = options.dryRun
    ? 0
    : await prisma.importedMatch.count({
      where: {
        sourceKind: {
          in: ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"],
        },
      },
    });
  const existingCompetitiveMatchIds = options.dryRun
    ? new Set<string>()
    : new Set(
      (
        await prisma.importedMatch.findMany({
          where: {
            sourceKind: {
              in: ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"],
            },
          },
          select: { riotMatchId: true },
        })
      ).map((row) => row.riotMatchId),
    );
  const remainingTargetMatches = Math.max(0, options.targetMatches - baselineCompetitiveMatchesBefore);
  const classificationBudget = options.maxClassifiedPerRun
    ?? Math.max(300, (options.trancheSize ?? 25) * 12);
  const checkpoint = (!options.resetCheckpoint ? await loadCompetitiveIngestionCheckpoint(checkpointPath) : null) ?? {
    version: 3,
    generatedAt: new Date().toISOString(),
    seedSetVersion: manifest.seedSetVersion,
    targetUniqueMatches: remainingTargetMatches,
    classificationBudget,
    queueWhitelist: [...policy.preferredQueues, ...policy.acceptedFallbackQueues],
    patchAllowPrefixes: [...policy.preferredPatchPrefixes, ...policy.acceptedAdjacentPatchPrefixes],
    seasonWindow: {
      startTime,
      endTime,
    },
    policyMode: policy.mode,
    openedFallbackTiers: [],
    seedResolutionSummary: undefined,
    seedDiscoverySummary: undefined,
    policyDecisionByMatchId: {},
    importCountsByTier: {},
    importCountsByPatchBucket: {},
    importCountsByQueueBucket: {},
    matchMetadataById: {},
    resolvedSeeds: [],
    discoveredMatches: [],
    attemptedMatchIds: [],
    importedMatchIds: [],
    rejectedMatchIds: [],
    failedMatches: [],
  } satisfies CompetitiveIngestionCheckpoint;

  const resolvedSeedCache = new Map(checkpoint.resolvedSeeds.map((seed) => [buildCompetitiveSeedKey(seed), seed]));
  const discoveryCache = new Map(checkpoint.discoveredMatches.map((seed) => [seed.seedKey, seed]));
  const matchMetadataCache = new Map(Object.entries(checkpoint.matchMetadataById ?? {}));
  const canReuseCheckpoint = canReuseCheckpointState({
    checkpoint,
    manifestSeedSetVersion: manifest.seedSetVersion,
    policy,
    startTime,
    endTime,
    classificationBudget,
  });

  console.info(
    `[competitive-ingestion] resolving ${manifest.players.length} seeds from ${seedAbsolutePath} mode=${policy.mode}`,
  );
  console.info(
    `[competitive-ingestion] match-v5 filters queue=${policy.preferredQueues.join(",")} fallbackQueues=${policy.acceptedFallbackQueues.join(",")} startTime=${startTime ?? "none"} endTime=${endTime ?? "none"} dryRun=${options.dryRun ? "yes" : "no"}`,
  );

  let workingSeeds = manifest.players;
  const persistResolutionProgress = async (input: {
    processedSeeds: number;
    totalSeeds: number;
    resolvedSeeds: CompetitiveResolvedSeed[];
    seedName: string;
  }) => {
    const payload = {
      generatedAt: new Date().toISOString(),
      progressStage: "resolution-running",
      checkpointPath,
      seedPath: seedAbsolutePath,
      policyMode: policy.mode,
      targetMatches: options.targetMatches,
      totalSeeds: workingSeeds.length,
      resolvedSeedCount: input.resolvedSeeds.filter((seed) => seed.resolutionStatus === "resolved").length,
      unresolvedSeedCount: input.resolvedSeeds.filter((seed) => seed.resolutionStatus !== "resolved").length,
      resolutionProcessedSeeds: input.processedSeeds,
      resolutionTotalSeeds: input.totalSeeds,
      resolutionCurrentSeed: input.seedName,
      attemptedMatches: 0,
      createdMatches: 0,
      failedMatchesCount: 0,
      riotApiMetrics: riotApiClient.getMetricsSnapshot(),
      progressDiscoveryPass: 0,
      progressIdsPerSeed: 0,
    };

    await mkdir(path.dirname(reportPath), { recursive: true });
    await Promise.all([
      writeFile(reportPath, JSON.stringify(payload, null, 2), "utf-8"),
      writeFile(markdownReportPath, renderMarkdownReport(payload), "utf-8"),
    ]);
  };

  let resolvedSeeds = canReuseCheckpoint
    ? checkpoint.resolvedSeeds
    : await resolveSeeds(workingSeeds, resolvedSeedCache, {
      onProgress: async (snapshot) => {
        if (snapshot.processedSeeds % 10 !== 0 && snapshot.processedSeeds !== snapshot.totalSeeds) {
          return;
        }
        await persistResolutionProgress({
          processedSeeds: snapshot.processedSeeds,
          totalSeeds: snapshot.totalSeeds,
          resolvedSeeds: snapshot.resolvedSeeds,
          seedName: snapshot.seed.playerName,
        });
      },
    });
  let discoveries: CompetitiveSeedMatchDiscovery[] = canReuseCheckpoint ? checkpoint.discoveredMatches : [];
  let discoveredMatches: CompetitiveDiscoveredMatch[] = canReuseCheckpoint
    ? rebuildDiscoveredMatchesFromCheckpoint({
      checkpoint,
      resolvedSeeds,
      policy,
      matchMetadataCache,
    })
    : [];
  let currentTargetIdsPerSeed = Math.min(options.countPerSeed, options.maxIdsPerSeed);
  let discoveryPass = 0;

  const persistDiscoveryProgress = async (input: {
    processedSeeds: number;
    totalActiveSeeds: number;
    discoveries: CompetitiveSeedMatchDiscovery[];
    seedName: string;
  }) => {
    const discoveredUniqueMatches = new Set(input.discoveries.flatMap((discovery) => discovery.matchIds)).size;
    const payload = {
      generatedAt: new Date().toISOString(),
      progressStage: "discovery-running",
      checkpointPath,
      seedPath: seedAbsolutePath,
      policyMode: policy.mode,
      targetMatches: options.targetMatches,
      totalSeeds: workingSeeds.length,
      resolvedSeedCount: resolvedSeeds.filter((seed) => seed.resolutionStatus === "resolved").length,
      unresolvedSeedCount: resolvedSeeds.filter((seed) => seed.resolutionStatus !== "resolved").length,
      discoveryProcessedSeeds: input.processedSeeds,
      discoveryTotalActiveSeeds: input.totalActiveSeeds,
      discoveryCurrentSeed: input.seedName,
      discoveredUniqueMatches,
      attemptedMatches: 0,
      createdMatches: 0,
      failedMatchesCount: 0,
      riotApiMetrics: riotApiClient.getMetricsSnapshot(),
      progressDiscoveryPass: discoveryPass,
      progressIdsPerSeed: currentTargetIdsPerSeed,
    };

    await mkdir(path.dirname(reportPath), { recursive: true });
    await Promise.all([
      writeFile(reportPath, JSON.stringify(payload, null, 2), "utf-8"),
      writeFile(markdownReportPath, renderMarkdownReport(payload), "utf-8"),
    ]);
  };

  const persistClassificationProgress = async (input: {
    classifiedUniqueMatches: number;
    maxUniqueMatchesToClassify: number;
    currentMatchId: string;
  }) => {
    const payload = {
      generatedAt: new Date().toISOString(),
      progressStage: "classification-running",
      checkpointPath,
      seedPath: seedAbsolutePath,
      policyMode: policy.mode,
      targetMatches: options.targetMatches,
      totalSeeds: workingSeeds.length,
      resolvedSeedCount: resolvedSeeds.filter((seed) => seed.resolutionStatus === "resolved").length,
      unresolvedSeedCount: resolvedSeeds.filter((seed) => seed.resolutionStatus !== "resolved").length,
      discoveredUniqueMatches: new Set(discoveries.flatMap((discovery) => discovery.matchIds)).size,
      classificationProcessedUniqueMatches: input.classifiedUniqueMatches,
      classificationTargetUniqueMatches: input.maxUniqueMatchesToClassify,
      classificationCurrentMatchId: input.currentMatchId,
      attemptedMatches: 0,
      createdMatches: 0,
      failedMatchesCount: 0,
      riotApiMetrics: riotApiClient.getMetricsSnapshot(),
      progressDiscoveryPass: discoveryPass,
      progressIdsPerSeed: currentTargetIdsPerSeed,
    };

    await mkdir(path.dirname(reportPath), { recursive: true });
    await Promise.all([
      writeFile(reportPath, JSON.stringify(payload, null, 2), "utf-8"),
      writeFile(markdownReportPath, renderMarkdownReport(payload), "utf-8"),
    ]);
  };

  const refreshDiscoveryState = async () => {
    discoveries = await discoverSeeds(
      resolvedSeeds,
      discoveryCache,
      {
        pageSize: options.countPerSeed,
        maxIdsPerSeed: options.maxIdsPerSeed,
        targetIdsPerSeed: currentTargetIdsPerSeed,
        queues: [...policy.preferredQueues, ...policy.acceptedFallbackQueues],
        startTime,
        endTime,
        onProgress: async (snapshot) => {
          if (snapshot.processedSeeds % 10 !== 0 && snapshot.processedSeeds !== snapshot.totalActiveSeeds) {
            return;
          }
          await persistDiscoveryProgress({
            processedSeeds: snapshot.processedSeeds,
            totalActiveSeeds: snapshot.totalActiveSeeds,
            discoveries: snapshot.discoveries,
            seedName: snapshot.seed.playerName,
          });
        },
      },
    );
    for (const discovery of discoveries) {
      discoveryCache.set(discovery.seedKey, discovery);
    }
    const discoveredUniqueMatches = new Set(discoveries.flatMap((discovery) => discovery.matchIds)).size;
    const maxUniqueMatchesToClassify = Math.max(150, Math.min(remainingTargetMatches, classificationBudget));
    console.info(
      `[competitive-ingestion] classify-budget uniqueCap=${maxUniqueMatchesToClassify} discoveredUnique=${discoveredUniqueMatches}`,
    );
    discoveredMatches = await classifyDiscoveredMatches(discoveries, policy, matchMetadataCache, {
      maxUniqueMatchesToClassify,
      onProgress: async (snapshot) => {
        await persistClassificationProgress({
          classifiedUniqueMatches: snapshot.classifiedUniqueMatches,
          maxUniqueMatchesToClassify: snapshot.maxUniqueMatchesToClassify,
          currentMatchId: snapshot.currentMatchId,
        });
      },
    });
  };

  if (canReuseCheckpoint) {
    console.info(
      `[competitive-ingestion] reusing-checkpoint resolvedSeeds=${resolvedSeeds.length} discoveries=${discoveries.length} classifiedMatches=${discoveredMatches.length}`,
    );
  } else {
    await refreshDiscoveryState();
  }

  let initialDiscoveryProgressStage = "discovery-initial";

  workingSeeds = await maybeEnrichEliteSeeds({
    manifestPlayers: workingSeeds,
    discoveredMatches,
    policy,
  });

  if (workingSeeds.length !== manifest.players.length) {
    resolvedSeeds = await resolveSeeds(workingSeeds, resolvedSeedCache, {
      onProgress: async (snapshot) => {
        if (snapshot.processedSeeds % 10 !== 0 && snapshot.processedSeeds !== snapshot.totalSeeds) {
          return;
        }
        await persistResolutionProgress({
          processedSeeds: snapshot.processedSeeds,
          totalSeeds: snapshot.totalSeeds,
          resolvedSeeds: snapshot.resolvedSeeds,
          seedName: snapshot.seed.playerName,
        });
      },
    });
    await refreshDiscoveryState();
    initialDiscoveryProgressStage = "discovery-elite-refresh";
  }

  const attemptedMatchIds = new Set(checkpoint.attemptedMatchIds);
  const importedMatchIds = new Set(checkpoint.importedMatchIds);
  const failedMatches = [...checkpoint.failedMatches];
  const seedIndex = new Map(
    resolvedSeeds
      .filter((seed): seed is CompetitiveResolvedSeed & { puuid: string; cluster: NonNullable<CompetitiveResolvedSeed["cluster"]> } =>
        seed.resolutionStatus === "resolved" && Boolean(seed.puuid) && Boolean(seed.cluster),
      )
      .map((seed) => [buildCompetitiveSeedKey(seed), seed]),
  );
  const createdCandidates: CompetitiveDiscoveredMatch[] = [];
  const initialAttemptedCount = attemptedMatchIds.size;
  const initialFailedAuthCount = failedMatches.filter(
    (failure) => failure.failureReason === "Riot API authentication failed.",
  ).length;
  let stopReason: string | null = null;
  let lastFallbackPlan = determineOpenedFallbackTiers({
    matches: discoveredMatches,
    targetUniqueMatches: remainingTargetMatches,
    alreadyCountedMatchIds: new Set([...existingCompetitiveMatchIds, ...attemptedMatchIds, ...importedMatchIds]),
    policy,
  });

  const duplicateLikeReasons = new Set(["existing-match-different-target"]);
  let lastPersistedAttemptCount = attemptedMatchIds.size;
  let lastPersistedCreatedCount = createdCandidates.length;

  const getRunAttemptCount = () => attemptedMatchIds.size - initialAttemptedCount;
  const getRunAuthFailureCount = () => failedMatches.filter(
    (failure) => failure.failureReason === "Riot API authentication failed.",
  ).length - initialFailedAuthCount;
  const updateStopReason = () => {
    if (stopReason) {
      return stopReason;
    }
    if (
      typeof options.maxAttemptsPerRun === "number"
      && options.maxAttemptsPerRun > 0
      && getRunAttemptCount() >= options.maxAttemptsPerRun
    ) {
      stopReason = `max-attempts-per-run:${options.maxAttemptsPerRun}`;
      return stopReason;
    }
    if (
      typeof options.maxCreatedPerRun === "number"
      && options.maxCreatedPerRun > 0
      && createdCandidates.length >= options.maxCreatedPerRun
    ) {
      stopReason = `max-created-per-run:${options.maxCreatedPerRun}`;
      return stopReason;
    }
    if (
      typeof options.maxAuthFailuresPerRun === "number"
      && options.maxAuthFailuresPerRun > 0
      && getRunAuthFailureCount() >= options.maxAuthFailuresPerRun
    ) {
      stopReason = `max-auth-failures-per-run:${options.maxAuthFailuresPerRun}`;
      return stopReason;
    }
    return null;
  };

  const persistIntermediateProgress = async (progressStage: string) => {
    const seedSummaries = buildSeedSummaries({
      resolvedSeeds,
      discoveries,
      discoveredMatches,
    });
    const rejectedMatches = buildRejectedMatches(discoveredMatches);
    const createdCountsByTier = createdCandidates.reduce<Record<string, number>>((accumulator, candidate) => {
      const key = candidate.priorityBand ?? "unknown";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});
    const createdCountsByPatchBucket = createdCandidates.reduce<Record<string, number>>((accumulator, candidate) => {
      accumulator[candidate.policyBucket] = (accumulator[candidate.policyBucket] ?? 0) + 1;
      return accumulator;
    }, {});
    const createdCountsByQueueBucket = createdCandidates.reduce<Record<string, number>>((accumulator, candidate) => {
      accumulator[candidate.queueBucket] = (accumulator[candidate.queueBucket] ?? 0) + 1;
      return accumulator;
    }, {});
    const policyDecisionByMatchId = discoveredMatches.reduce<NonNullable<CompetitiveIngestionCheckpoint["policyDecisionByMatchId"]>>(
      (accumulator, match) => {
        accumulator[match.matchId] = {
          acceptedByPolicy: match.acceptedByPolicy,
          acceptedReason: match.acceptedReason,
          rejectionReason: match.rejectionReason,
          fallbackReason: match.fallbackReason,
          policyMode: match.policyMode,
          policyBucket: match.policyBucket,
          queueBucket: match.queueBucket,
          sourceBucket: match.sourceBucket,
          priorityBand: match.priorityBand,
        };
        return accumulator;
      },
      {},
    );

    await saveCompetitiveIngestionCheckpoint(checkpointPath, {
      version: 3,
      generatedAt: new Date().toISOString(),
      seedSetVersion: manifest.seedSetVersion,
      targetUniqueMatches: remainingTargetMatches,
      classificationBudget,
      queueWhitelist: [...policy.preferredQueues, ...policy.acceptedFallbackQueues],
      patchAllowPrefixes: [...policy.preferredPatchPrefixes, ...policy.acceptedAdjacentPatchPrefixes],
      seasonWindow: {
        startTime,
        endTime,
      },
      policyMode: policy.mode,
      openedFallbackTiers: lastFallbackPlan.openedFallbackTiers,
      seedResolutionSummary: seedSummaries.seedResolutionSummary,
      seedDiscoverySummary: seedSummaries.seedDiscoverySummary,
      policyDecisionByMatchId,
      importCountsByTier: createdCountsByTier,
      importCountsByPatchBucket: createdCountsByPatchBucket,
      importCountsByQueueBucket: createdCountsByQueueBucket,
      matchMetadataById: Object.fromEntries(matchMetadataCache.entries()),
      resolvedSeeds,
      discoveredMatches: discoveries,
      attemptedMatchIds: [...attemptedMatchIds],
      importedMatchIds: [...importedMatchIds],
      rejectedMatchIds: rejectedMatches,
      failedMatches,
    });

    const totalImportedMatchesOverall = options.dryRun ? baselineTotalMatchesBefore : await prisma.importedMatch.count();
    const totalCompetitiveMatchesInDb = options.dryRun
      ? baselineCompetitiveMatchesBefore + createdCandidates.length
      : await prisma.importedMatch.count({
        where: {
          sourceKind: {
            in: ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"],
          },
        },
      });

    const progressPayload = {
      generatedAt: new Date().toISOString(),
      progressStage,
      policyMode: policy.mode,
      checkpointPath,
      seedPath: seedAbsolutePath,
      targetMatches: options.targetMatches,
      targetCreatesNeeded: remainingTargetMatches,
      totalSeeds: workingSeeds.length,
      resolvedSeedCount: seedSummaries.seedResolutionSummary.resolved,
      unresolvedSeedCount: seedSummaries.seedResolutionSummary.unresolved,
      resolvedButNoMatches: seedSummaries.seedDiscoverySummary.resolvedButNoMatches,
      resolvedButRejectedByPolicy: seedSummaries.seedDiscoverySummary.resolvedButRejectedByPolicy,
      resolvedWithAcceptedMatches: seedSummaries.seedDiscoverySummary.resolvedWithAcceptedMatches,
      discoveredUniqueMatches: new Set(discoveredMatches.map((entry) => entry.matchId)).size,
      policyAcceptedMatches: new Set(discoveredMatches.filter((entry) => entry.acceptedByPolicy).map((entry) => entry.matchId)).size,
      attemptedMatches: attemptedMatchIds.size,
      createdMatches: Math.max(0, totalImportedMatchesOverall - baselineTotalMatchesBefore),
      createdCandidatesCount: createdCandidates.length,
      failedMatchesCount: failedMatches.length,
      totalImportedMatchesOverall,
      totalCompetitiveMatchesInDb,
      importCountsByTier: createdCountsByTier,
      importCountsByPatchBucket: createdCountsByPatchBucket,
      importCountsByQueueBucket: createdCountsByQueueBucket,
      fallbackActivations: lastFallbackPlan.openedFallbackTiers,
      riotApiMetrics: riotApiClient.getMetricsSnapshot(),
      progressDiscoveryPass: discoveryPass,
      progressIdsPerSeed: currentTargetIdsPerSeed,
      stopReason,
      runAttemptCount: getRunAttemptCount(),
      runCreatedCount: createdCandidates.length,
      runAuthFailureCount: getRunAuthFailureCount(),
    };

    await mkdir(path.dirname(reportPath), { recursive: true });
    await Promise.all([
      writeFile(reportPath, JSON.stringify(progressPayload, null, 2), "utf-8"),
      writeFile(markdownReportPath, renderMarkdownReport(progressPayload), "utf-8"),
    ]);

    console.info(
      `[competitive-ingestion] persisted-progress stage=${progressStage} pass=${discoveryPass} attempted=${attemptedMatchIds.size} created=${progressPayload.createdMatches} competitiveDb=${totalCompetitiveMatchesInDb}`,
    );
  };

  await persistIntermediateProgress(initialDiscoveryProgressStage);

  while (createdCandidates.length < remainingTargetMatches) {
    if (updateStopReason()) {
      break;
    }
    discoveryPass += 1;
    const alreadyCountedMatchIds = new Set([...existingCompetitiveMatchIds, ...attemptedMatchIds, ...importedMatchIds]);
    const fallbackPlan = determineOpenedFallbackTiers({
      matches: discoveredMatches,
      targetUniqueMatches: remainingTargetMatches,
      alreadyCountedMatchIds,
      policy,
    });
    lastFallbackPlan = fallbackPlan;

    for (const opened of fallbackPlan.openedFallbackTiers) {
      console.info(`[competitive-ingestion] ${opened}`);
    }

    const queue = buildCompetitiveMatchQueue({
      matches: discoveredMatches,
      targetUniqueMatches: remainingTargetMatches,
      policy,
      activeBands: fallbackPlan.activeBands,
      excludedMatchIds: alreadyCountedMatchIds,
    });

    console.info(
      `[competitive-ingestion] pass=${discoveryPass} queueCandidates=${queue.length} createdSoFar=${createdCandidates.length} targetRemaining=${remainingTargetMatches} targetTotal=${options.targetMatches} idsPerSeed=${currentTargetIdsPerSeed}`,
    );

    if (options.dryRun || queue.length === 0) {
      break;
    }

    let passCreated = 0;
    let passDuplicateLike = 0;

    for (const candidate of queue) {
      if (updateStopReason()) {
        break;
      }
      if (createdCandidates.length >= remainingTargetMatches) {
        break;
      }
      if (attemptedMatchIds.has(candidate.matchId)) {
        continue;
      }

      const seed = seedIndex.get(candidate.seedKey);
      if (!seed?.puuid || !seed.cluster || !ownerUserId) {
        continue;
      }

      attemptedMatchIds.add(candidate.matchId);
      try {
        const sourceKind = toSourceKind(seed.priorityTier);
        const sourceMetadata = buildSourceMetadata(seed, candidate, policy);
        const imported = await riotSyncService.importMatchForIdentity(
          ownerUserId,
          candidate.matchId,
          {
            puuid: seed.puuid,
            gameName: seed.resolvedRiotId ? splitRiotId(seed.resolvedRiotId).gameName : null,
            tagLine: seed.resolvedRiotId ? splitRiotId(seed.resolvedRiotId).tagLine : null,
            region: seed.cluster,
            platform: seed.platformHint ?? "euw1",
          },
          {
            sourceKind,
            sourceMetadata,
            skipExistingWithDifferentTarget: true,
          },
        );

        await repairImportedMatchProvenance({
          riotMatchId: candidate.matchId,
          sourceKind,
          sourceRegion: seed.region,
          sourceMetadata,
        });

        if (imported.created) {
          importedMatchIds.add(imported.riotMatchId);
          createdCandidates.push(candidate);
          passCreated += 1;
          if (createdCandidates.length % PROGRESS_PERSIST_CREATED_INTERVAL === 0) {
            console.info(
              `[competitive-ingestion] created-progress created=${createdCandidates.length}/${remainingTargetMatches} attempted=${attemptedMatchIds.size} latest=${candidate.matchId} tier=${candidate.priorityTier} patch=${candidate.patch ?? "unknown"} queue=${candidate.queueId ?? "unknown"}`,
            );
          }
        } else if (imported.skippedReason === null || duplicateLikeReasons.has(imported.skippedReason)) {
          passDuplicateLike += 1;
        }

        if (imported.skippedReason) {
          failedMatches.push({
            matchId: candidate.matchId,
            seedKey: candidate.seedKey,
            playerName: seed.playerName,
            team: seed.team,
            league: seed.league,
            competition: seed.competition,
            role: seed.role,
            region: seed.cluster,
            priorityTier: seed.priorityTier,
            patch: imported.patch,
            queueId: candidate.queueId,
            policyBucket: candidate.policyBucket,
            queueBucket: candidate.queueBucket,
            sourceBucket: candidate.sourceBucket,
            priorityBand: candidate.priorityBand,
            timelineAvailable: imported.timelineAvailable,
            timelineMissingReason: imported.timelineMissingReason,
            targetChampionSlug: imported.targetChampionSlug,
            targetRole: imported.targetRole,
            gameCreationAt: imported.gameCreationAt?.toISOString() ?? null,
            created: imported.created,
            failureReason: imported.skippedReason,
          });
        }
      } catch (error) {
        failedMatches.push({
          matchId: candidate.matchId,
          seedKey: candidate.seedKey,
          playerName: candidate.playerName,
          team: candidate.team,
          league: candidate.league,
          competition: candidate.competition,
          role: candidate.role,
          region: candidate.cluster,
          priorityTier: candidate.priorityTier,
          patch: candidate.patch,
          queueId: candidate.queueId,
          policyBucket: candidate.policyBucket,
          queueBucket: candidate.queueBucket,
          sourceBucket: candidate.sourceBucket,
          priorityBand: candidate.priorityBand,
          timelineAvailable: false,
          timelineMissingReason: null,
          targetChampionSlug: null,
          targetRole: null,
          gameCreationAt: candidate.gameCreationAt,
          created: false,
          failureReason: error instanceof Error ? error.message : String(error),
        });
      }

      const shouldPersistMidPass =
        attemptedMatchIds.size - lastPersistedAttemptCount >= PROGRESS_PERSIST_ATTEMPT_INTERVAL
        || createdCandidates.length - lastPersistedCreatedCount >= PROGRESS_PERSIST_CREATED_INTERVAL;

      if (shouldPersistMidPass) {
        await persistIntermediateProgress("import-mid-pass");
        lastPersistedAttemptCount = attemptedMatchIds.size;
        lastPersistedCreatedCount = createdCandidates.length;
      }

      if (updateStopReason()) {
        await persistIntermediateProgress("run-bounded-stop");
        lastPersistedAttemptCount = attemptedMatchIds.size;
        lastPersistedCreatedCount = createdCandidates.length;
        break;
      }
    }

    await persistIntermediateProgress("import-pass-complete");
    lastPersistedAttemptCount = attemptedMatchIds.size;
    lastPersistedCreatedCount = createdCandidates.length;

    const remainingTarget = remainingTargetMatches - createdCandidates.length;
    const shouldDeepenDiscovery =
      remainingTarget > 0
      && currentTargetIdsPerSeed < options.maxIdsPerSeed
      && (
        passCreated === 0
        || queue.length < remainingTarget
        || passDuplicateLike >= Math.max(5, passCreated * 2)
      );

    if (stopReason || !shouldDeepenDiscovery) {
      break;
    }

    const nextTargetIdsPerSeed = Math.min(
      options.maxIdsPerSeed,
      Math.max(currentTargetIdsPerSeed + options.countPerSeed, Math.ceil(currentTargetIdsPerSeed * 1.5)),
    );
    if (nextTargetIdsPerSeed <= currentTargetIdsPerSeed) {
      break;
    }

    console.info(
      `[competitive-ingestion] deepening-discovery reason=duplicate-pressure nextIdsPerSeed=${nextTargetIdsPerSeed} duplicateLike=${passDuplicateLike} created=${passCreated}`,
    );
    currentTargetIdsPerSeed = nextTargetIdsPerSeed;
    await refreshDiscoveryState();
    await persistIntermediateProgress("discovery-deepened");
  }

  const seedSummaries = buildSeedSummaries({
    resolvedSeeds,
    discoveries,
    discoveredMatches,
  });

  const rejectedMatches = buildRejectedMatches(discoveredMatches);
  const createdCountsByTier = createdCandidates.reduce<Record<string, number>>((accumulator, candidate) => {
    const key = candidate.priorityBand ?? "unknown";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
  const createdCountsByPatchBucket = createdCandidates.reduce<Record<string, number>>((accumulator, candidate) => {
    accumulator[candidate.policyBucket] = (accumulator[candidate.policyBucket] ?? 0) + 1;
    return accumulator;
  }, {});
  const createdCountsByQueueBucket = createdCandidates.reduce<Record<string, number>>((accumulator, candidate) => {
    accumulator[candidate.queueBucket] = (accumulator[candidate.queueBucket] ?? 0) + 1;
    return accumulator;
  }, {});
  const policyDecisionByMatchId = discoveredMatches.reduce<NonNullable<CompetitiveIngestionCheckpoint["policyDecisionByMatchId"]>>(
    (accumulator, match) => {
      accumulator[match.matchId] = {
        acceptedByPolicy: match.acceptedByPolicy,
        acceptedReason: match.acceptedReason,
        rejectionReason: match.rejectionReason,
        fallbackReason: match.fallbackReason,
        policyMode: match.policyMode,
        policyBucket: match.policyBucket,
        queueBucket: match.queueBucket,
        sourceBucket: match.sourceBucket,
        priorityBand: match.priorityBand,
      };
      return accumulator;
    },
    {},
  );

  await saveCompetitiveIngestionCheckpoint(checkpointPath, {
    version: 3,
    generatedAt: new Date().toISOString(),
    seedSetVersion: manifest.seedSetVersion,
    targetUniqueMatches: remainingTargetMatches,
    classificationBudget,
    queueWhitelist: [...policy.preferredQueues, ...policy.acceptedFallbackQueues],
    patchAllowPrefixes: [...policy.preferredPatchPrefixes, ...policy.acceptedAdjacentPatchPrefixes],
    seasonWindow: {
      startTime,
      endTime,
    },
    policyMode: policy.mode,
    openedFallbackTiers: lastFallbackPlan.openedFallbackTiers,
    seedResolutionSummary: seedSummaries.seedResolutionSummary,
    seedDiscoverySummary: seedSummaries.seedDiscoverySummary,
    policyDecisionByMatchId,
    importCountsByTier: createdCountsByTier,
    importCountsByPatchBucket: createdCountsByPatchBucket,
    importCountsByQueueBucket: createdCountsByQueueBucket,
    matchMetadataById: Object.fromEntries(matchMetadataCache.entries()),
    resolvedSeeds,
    discoveredMatches: discoveries,
    attemptedMatchIds: [...attemptedMatchIds],
    importedMatchIds: [...importedMatchIds],
    rejectedMatchIds: rejectedMatches,
    failedMatches,
  });

  const baselineTotalMatches = options.dryRun ? baselineTotalMatchesBefore : await prisma.importedMatch.count();
  const persistedRows = options.dryRun
    ? []
    : await prisma.importedMatch.findMany({
      where: {
        sourceKind: {
          in: ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"],
        },
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

  const report = buildCompetitiveIngestionReport({
    persistedRows: persistedRows.map((row) => {
      const metadata = (row.sourceMetadata ?? {}) as {
        seed?: {
          league?: string | null;
          competition?: string | null;
          region?: string | null;
          priorityTier?: string | null;
        };
        ingestion?: {
          queueId?: number | null;
          patchBucket?: CompetitiveDiscoveredMatch["policyBucket"];
          queueBucket?: CompetitiveDiscoveredMatch["queueBucket"];
          priorityBand?: CompetitiveDiscoveredMatch["priorityBand"];
        };
      };

      return {
        patch: row.patch,
        queueId: metadata.ingestion?.queueId ?? null,
        timelineMissingReason: row.timelineMissingReason,
        gameCreationAt: row.gameCreationAt,
        timelineFetchedAt: row.timelineFetchedAt,
        targetRole: row.targetRole,
        sourceKind: row.sourceKind,
        sourceLeague: metadata.seed?.league ?? null,
        sourceCompetition: metadata.seed?.competition ?? null,
        sourceRegion: metadata.seed?.region ?? null,
        priorityTier: metadata.seed?.priorityTier ?? null,
        patchBucket: metadata.ingestion?.patchBucket ?? null,
        queueBucket: metadata.ingestion?.queueBucket ?? null,
        priorityBand: metadata.ingestion?.priorityBand ?? null,
      };
    }),
    discoveredMatches,
    discoveries,
    resolvedSeeds,
    failedMatches,
    openedFallbackTiers: lastFallbackPlan.openedFallbackTiers,
    whyZeroBefore: policy.whyZeroBefore,
    whatWasRelaxed: policy.whatWasRelaxed,
  });

  const unresolvedSeeds = resolvedSeeds.filter((seed) => seed.resolutionStatus !== "resolved");
  const topFailureReasons = Object.entries(
    failedMatches.reduce<Record<string, number>>((accumulator, failure) => {
      const key = failure.failureReason ?? "unknown";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
    .slice(0, 10);

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    seedPath: seedAbsolutePath,
    policyPath: path.resolve(options.policyPath),
    checkpointPath,
    policyMode: policy.mode,
    seedSetVersion: manifest.seedSetVersion,
    targetMatches: options.targetMatches,
    targetCreatesNeeded: remainingTargetMatches,
    countPerSeed: options.countPerSeed,
    maxIdsPerSeed: options.maxIdsPerSeed,
    dryRun: options.dryRun,
    resetCheckpoint: options.resetCheckpoint,
    queueWhitelist: [...policy.preferredQueues, ...policy.acceptedFallbackQueues],
    patchAllowPrefixes: [...policy.preferredPatchPrefixes, ...policy.acceptedAdjacentPatchPrefixes],
    startTime,
    endTime,
    totalSeeds: workingSeeds.length,
    resolvedSeedCount: seedSummaries.seedResolutionSummary.resolved,
    unresolvedSeedCount: seedSummaries.seedResolutionSummary.unresolved,
    resolvedButNoMatches: seedSummaries.seedDiscoverySummary.resolvedButNoMatches,
    resolvedButRejectedByPolicy: seedSummaries.seedDiscoverySummary.resolvedButRejectedByPolicy,
    resolvedWithAcceptedMatches: seedSummaries.seedDiscoverySummary.resolvedWithAcceptedMatches,
    discoveredUniqueMatches: new Set(discoveredMatches.map((entry) => entry.matchId)).size,
    discoveredUniqueMatchesAfterTimeFilter: report.discoveredUniqueMatchesAfterTimeFilter,
    policyAcceptedMatches: new Set(discoveredMatches.filter((entry) => entry.acceptedByPolicy).map((entry) => entry.matchId)).size,
    attemptedMatches: attemptedMatchIds.size,
    createdMatches: Math.max(0, baselineTotalMatches - baselineTotalMatchesBefore),
    promotedExistingMatches: Math.max(0, persistedRows.length - baselineCompetitiveMatchesBefore - createdCandidates.length),
    rejectedMatches: rejectedMatches.length,
    rejectedByReason: report.rejectedByReason,
    rejectedReasonFractions: report.rejectedReasonFractions,
    failedMatchesCount: failedMatches.length,
    totalImportedMatchesOverall: baselineTotalMatches,
    totalCompetitiveMatchesInDb: persistedRows.length,
    unresolvedSeeds: unresolvedSeeds.slice(0, 25).map((seed) => ({
      playerName: seed.playerName,
      team: seed.team,
      league: seed.league,
      priorityTier: seed.priorityTier,
      resolutionError: seed.resolutionError,
    })),
    topFailureReasons,
    fallbackActivations: lastFallbackPlan.openedFallbackTiers,
    importCountsByTier: createdCountsByTier,
    importCountsByPatchBucket: createdCountsByPatchBucket,
    importCountsByQueueBucket: createdCountsByQueueBucket,
    riotApiMetrics: riotApiClient.getMetricsSnapshot(),
    stopReason,
    runAttemptCount: getRunAttemptCount(),
    runCreatedCount: createdCandidates.length,
    runAuthFailureCount: getRunAuthFailureCount(),
    ...report,
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await Promise.all([
    writeFile(reportPath, JSON.stringify(reportPayload, null, 2), "utf-8"),
    writeFile(markdownReportPath, renderMarkdownReport(reportPayload), "utf-8"),
  ]);

  console.info(JSON.stringify(reportPayload, null, 2));
}

main()
  .catch((error) => {
    console.error("[competitive-ingestion] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
