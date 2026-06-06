import {
  buildCompetitiveSeedKey,
  type CompetitiveDiscoveryQueueState,
  type CompetitiveResolvedSeed,
  type CompetitiveSeedMatchDiscovery,
} from "../../server/src/lib/riot/competitiveIngestion.js";
import { riotApiClient } from "../../server/src/lib/riot/riotApiClient.js";
import { riotSyncService } from "../../server/src/services/riotSyncService.js";
import { type CompetitiveSeed } from "../../server/src/lib/riot/competitiveSeeds.js";

export function buildDiscoveryQuerySignature(input: {
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

function splitRiotId(riotId: string) {
  const [gameName, ...tagLineParts] = riotId.split("#");
  return {
    gameName: gameName.trim(),
    tagLine: tagLineParts.join("#").trim(),
  };
}

export function mergeResolvedSeed(seed: CompetitiveSeed, cached: CompetitiveResolvedSeed | undefined): CompetitiveResolvedSeed {
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

function buildUnresolvedSeed(input: {
  seed: CompetitiveSeed;
  cached: CompetitiveResolvedSeed | undefined;
  error: unknown;
  resolutionSource: CompetitiveResolvedSeed["resolutionSource"];
}): CompetitiveResolvedSeed {
  return {
    ...mergeResolvedSeed(input.seed, input.cached),
    resolutionStatus: "unresolved",
    resolutionError: input.error instanceof Error ? input.error.message : String(input.error),
    resolutionSource: input.resolutionSource,
  };
}

async function resolveSeedByPuuid(
  seed: CompetitiveSeed,
  cached: CompetitiveResolvedSeed | undefined,
): Promise<CompetitiveResolvedSeed> {
  try {
    const resolved = await riotSyncService.resolveImportIdentity({ type: "puuid", puuid: seed.puuid as string });
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
    return buildUnresolvedSeed({
      seed,
      cached,
      error,
      resolutionSource: "seed-puuid",
    });
  }
}

function getSeedRiotIdCandidates(seed: CompetitiveSeed) {
  return [seed.riotId, ...seed.riotIdCandidates].filter((value): value is string => Boolean(value));
}

function getRiotIdResolutionSource(seed: CompetitiveSeed, index: number) {
  return index === 0 && seed.riotId ? "seed-riot-id" : "candidate-riot-id";
}

async function resolveSeedByRiotIdCandidate(input: {
  seed: CompetitiveSeed;
  cached: CompetitiveResolvedSeed | undefined;
  candidate: string;
  index: number;
}) {
  const { gameName, tagLine } = splitRiotId(input.candidate);
  if (!gameName || !tagLine) {
    return null;
  }

  const resolved = await riotSyncService.resolveImportIdentity({
    type: "riot-id",
    gameName,
    tagLine,
  });
  return {
    ...mergeResolvedSeed(input.seed, input.cached),
    resolutionStatus: "resolved",
    resolutionError: null,
    resolutionSource: getRiotIdResolutionSource(input.seed, input.index),
    resolvedRiotId: `${resolved.gameName ?? gameName}#${resolved.tagLine ?? tagLine}`,
    puuid: resolved.puuid,
    platformHint: resolved.platform,
    cluster: resolved.region,
  } satisfies CompetitiveResolvedSeed;
}

export async function resolveSeed(
  seed: CompetitiveSeed,
  cached: CompetitiveResolvedSeed | undefined,
): Promise<CompetitiveResolvedSeed> {
  if (cached?.resolutionStatus === "resolved" && cached.puuid && cached.cluster) {
    return cached;
  }

  if (seed.puuid) {
    return resolveSeedByPuuid(seed, cached);
  }

  const candidateRiotIds = getSeedRiotIdCandidates(seed);
  if (candidateRiotIds.length === 0) {
    return {
      ...mergeResolvedSeed(seed, cached),
      resolutionStatus: "unresolved",
      resolutionError: "No Riot ID or PUUID candidate available in the seed.",
      resolutionSource: null,
    };
  }

  for (const [index, candidate] of candidateRiotIds.entries()) {
    try {
      const resolved = await resolveSeedByRiotIdCandidate({
        seed,
        cached,
        candidate,
        index,
      });
      if (resolved) {
        return resolved;
      }
    } catch (error) {
      if (index === candidateRiotIds.length - 1) {
        return buildUnresolvedSeed({
          seed,
          cached,
          error,
          resolutionSource: getRiotIdResolutionSource(seed, index),
        });
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

export async function resolveSeeds(
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

function cloneScanStateByQueue(input: {
  cached?: CompetitiveSeedMatchDiscovery;
  canReuseCache: boolean;
}) {
  return input.canReuseCache
    ? Object.fromEntries(
      Object.entries(input.cached?.scanStateByQueue ?? {}).map(([queue, state]) => [queue, { ...state }]),
    )
    : {};
}

function countRequestedDiscoveryIds(scanStateByQueue: Record<string, CompetitiveDiscoveryQueueState>) {
  return Object.values(scanStateByQueue).reduce((sum, state) => sum + (state.requests ?? 0), 0);
}

function getOrCreateQueueScanState(
  scanStateByQueue: Record<string, CompetitiveDiscoveryQueueState>,
  queue: number,
) {
  const queueKey = String(queue);
  const state = scanStateByQueue[queueKey] ?? {
    nextStart: 0,
    requests: 0,
    exhausted: false,
  };
  scanStateByQueue[queueKey] = state;
  return state;
}

function calculateDiscoveryRequestCount(input: {
  allMatchIdsSize: number;
  maxIdsPerSeed: number;
  pageSize: number;
  scanStateByQueue: Record<string, CompetitiveDiscoveryQueueState>;
  targetIds: number;
}) {
  const refreshedTotalRequested = countRequestedDiscoveryIds(input.scanStateByQueue);
  const refreshedRemainingBudget = input.maxIdsPerSeed - refreshedTotalRequested;
  const remainingTarget = input.targetIds - input.allMatchIdsSize;
  return Math.min(input.pageSize, refreshedRemainingBudget, remainingTarget);
}

async function discoverMatchIdsForQueue(input: {
  seed: CompetitiveResolvedSeed & { puuid: string; cluster: NonNullable<CompetitiveResolvedSeed["cluster"]> };
  queue: number;
  requestCount: number;
  state: CompetitiveDiscoveryQueueState;
  startTime: number | null;
  endTime: number | null;
}) {
  console.info(
    `[competitive-ingestion] discover-match-ids seed=${input.seed.playerName} queue=${input.queue} start=${input.state.nextStart} count=${input.requestCount} startTime=${input.startTime ?? "none"} endTime=${input.endTime ?? "none"}`,
  );

  const matchIds = await riotApiClient.getMatchIdsByPuuidOnRegion(input.seed.puuid, input.seed.cluster, input.requestCount, {
    queue: input.queue,
    start: input.state.nextStart,
    startTime: input.startTime ?? undefined,
    endTime: input.endTime ?? undefined,
  });

  input.state.nextStart += input.requestCount;
  input.state.requests += input.requestCount;
  if (matchIds.length < input.requestCount) {
    input.state.exhausted = true;
  }

  return matchIds;
}

function addDiscoveredMatchIds(allMatchIds: Set<string>, matchIds: string[]) {
  for (const matchId of matchIds) {
    allMatchIds.add(matchId);
  }
}

async function discoverMatchIdsForQueueRound(input: {
  seed: CompetitiveResolvedSeed & { puuid: string; cluster: NonNullable<CompetitiveResolvedSeed["cluster"]> };
  uniqueQueues: number[];
  allMatchIds: Set<string>;
  scanStateByQueue: Record<string, CompetitiveDiscoveryQueueState>;
  pageSize: number;
  maxIdsPerSeed: number;
  targetIds: number;
  startTime: number | null;
  endTime: number | null;
}) {
  let progressed = false;

  for (const queue of input.uniqueQueues) {
    const state = getOrCreateQueueScanState(input.scanStateByQueue, queue);

    if (state.exhausted) {
      continue;
    }

    const requestCount = calculateDiscoveryRequestCount({
      allMatchIdsSize: input.allMatchIds.size,
      maxIdsPerSeed: input.maxIdsPerSeed,
      pageSize: input.pageSize,
      scanStateByQueue: input.scanStateByQueue,
      targetIds: input.targetIds,
    });
    if (requestCount <= 0) {
      break;
    }

    const matchIds = await discoverMatchIdsForQueue({
      seed: input.seed,
      queue,
      requestCount,
      state,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    addDiscoveredMatchIds(input.allMatchIds, matchIds);
    progressed = progressed || matchIds.length > 0;

    if (input.allMatchIds.size >= input.targetIds) {
      break;
    }
  }

  return progressed;
}

export async function discoverMatchIdsForSeed(
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
  const scanStateByQueue: Record<string, CompetitiveDiscoveryQueueState> = cloneScanStateByQueue({
    cached: input.cached,
    canReuseCache,
  });

  while (allMatchIds.size < input.targetIds) {
    const totalRequested = countRequestedDiscoveryIds(scanStateByQueue);
    const remainingGlobalBudget = input.maxIdsPerSeed - totalRequested;
    if (remainingGlobalBudget <= 0) {
      break;
    }

    const progressed = await discoverMatchIdsForQueueRound({
      seed,
      uniqueQueues,
      allMatchIds,
      scanStateByQueue,
      pageSize: input.pageSize,
      maxIdsPerSeed: input.maxIdsPerSeed,
      targetIds: input.targetIds,
      startTime: input.startTime,
      endTime: input.endTime,
    });
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

type DiscoverableSeed = CompetitiveResolvedSeed & {
  puuid: string;
  cluster: NonNullable<CompetitiveResolvedSeed["cluster"]>;
};

type DiscoverSeedsInput = {
  pageSize: number;
  maxIdsPerSeed: number;
  targetIdsPerSeed: number;
  maxDiscoveredUniqueMatches?: number;
  queues: number[];
  startTime: number | null;
  endTime: number | null;
  maxConsecutiveFailures?: number;
  quarantinedSeedKeys?: Set<string>;
  quarantinedRegions?: Set<string>;
  onProgress?: (snapshot: {
    processedSeeds: number;
    totalActiveSeeds: number;
    discoveries: CompetitiveSeedMatchDiscovery[];
    seed: DiscoverableSeed;
  }) => Promise<void> | void;
};

type DiscoveryFailureState = {
  consecutiveFailureSignature: string | null;
  consecutiveFailures: number;
  lastFailureSeedKey: string | null;
  lastFailureRegion: string | null;
  lastFailureReason: string | null;
};

function isDiscoverableSeed(seed: CompetitiveResolvedSeed): seed is DiscoverableSeed {
  return seed.resolutionStatus === "resolved" && Boolean(seed.puuid) && Boolean(seed.cluster);
}

function getUniqueDiscoveredMatchCount(discoveries: CompetitiveSeedMatchDiscovery[]) {
  return new Set(discoveries.flatMap((entry) => entry.matchIds)).size;
}

function getUniqueDiscoveryStopReason(
  discoveries: CompetitiveSeedMatchDiscovery[],
  maxDiscoveredUniqueMatches: number | undefined,
) {
  if (typeof maxDiscoveredUniqueMatches !== "number") {
    return null;
  }

  const currentUniqueCount = getUniqueDiscoveredMatchCount(discoveries);
  return currentUniqueCount >= maxDiscoveredUniqueMatches
    ? `discovery-unique-budget:${currentUniqueCount}`
    : null;
}

function isCachedDiscoveryComplete(
  cached: CompetitiveSeedMatchDiscovery | undefined,
  input: DiscoverSeedsInput,
) {
  if (cached?.querySignature !== buildDiscoveryQuerySignature(input)) {
    return false;
  }

  const scanStates = Object.values(cached.scanStateByQueue ?? {});
  return cached.matchIds.length >= input.targetIdsPerSeed
    || (scanStates.length > 0 && scanStates.every((state) => state.exhausted));
}

async function notifyDiscoveryProgress(input: {
  onProgress: DiscoverSeedsInput["onProgress"];
  processedSeeds: number;
  totalActiveSeeds: number;
  discoveries: CompetitiveSeedMatchDiscovery[];
  seed: DiscoverableSeed;
}) {
  await input.onProgress?.({
    processedSeeds: input.processedSeeds,
    totalActiveSeeds: input.totalActiveSeeds,
    discoveries: input.discoveries,
    seed: input.seed,
  });
}

function buildEmptyDiscovery(seed: DiscoverableSeed, input: DiscoverSeedsInput, cached?: CompetitiveSeedMatchDiscovery) {
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
  } satisfies CompetitiveSeedMatchDiscovery;
}

function recordDiscoveryFailure(input: {
  error: unknown;
  seed: DiscoverableSeed;
  seedKey: string;
  cached?: CompetitiveSeedMatchDiscovery;
  state: DiscoveryFailureState;
  authFailureCountsBySeedKey: Map<string, number>;
  authFailureCountsByRegion: Map<string, number>;
  maxConsecutiveFailures: number;
}) {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const failureSignature = message.toLowerCase().trim();
  input.state.lastFailureSeedKey = input.seedKey;
  input.state.lastFailureRegion = input.seed.cluster;
  input.state.lastFailureReason = failureSignature;

  if (failureSignature.includes("authentication failed")) {
    input.authFailureCountsBySeedKey.set(
      input.seedKey,
      (input.authFailureCountsBySeedKey.get(input.seedKey) ?? 0) + 1,
    );
    input.authFailureCountsByRegion.set(
      input.seed.cluster,
      (input.authFailureCountsByRegion.get(input.seed.cluster) ?? 0) + 1,
    );
  }

  input.state.consecutiveFailures = input.state.consecutiveFailureSignature === failureSignature
    ? input.state.consecutiveFailures + 1
    : 1;
  input.state.consecutiveFailureSignature = failureSignature;

  console.warn(
    "[competitive-ingestion] discover-seed-failed",
    JSON.stringify({
      seed: input.seed.playerName,
      matchIdsCached: input.cached?.matchIds.length ?? 0,
      message,
      consecutiveFailures: input.state.consecutiveFailures,
      maxConsecutiveFailures: input.maxConsecutiveFailures,
    }),
  );

  return input.state.consecutiveFailures >= input.maxConsecutiveFailures
    ? `discovery-failure-budget:${input.state.consecutiveFailures}`
    : null;
}

export async function discoverSeeds(
  seeds: CompetitiveResolvedSeed[],
  discoveryCache: Map<string, CompetitiveSeedMatchDiscovery>,
  input: DiscoverSeedsInput,
) {
  const activeSeeds = seeds.filter(isDiscoverableSeed);

  const discoveries: CompetitiveSeedMatchDiscovery[] = [];
  let processedSeeds = 0;
  const failureState: DiscoveryFailureState = {
    consecutiveFailureSignature: null,
    consecutiveFailures: 0,
    lastFailureSeedKey: null,
    lastFailureRegion: null,
    lastFailureReason: null,
  };
  const maxConsecutiveFailures = input.maxConsecutiveFailures ?? 2;
  let stopReason: string | null = null;
  const authFailureCountsBySeedKey = new Map<string, number>();
  const authFailureCountsByRegion = new Map<string, number>();
  for (const seed of activeSeeds) {
    processedSeeds += 1;
    stopReason = getUniqueDiscoveryStopReason(discoveries, input.maxDiscoveredUniqueMatches);
    if (stopReason) {
      break;
    }

    const seedKey = buildCompetitiveSeedKey(seed);
    if (input.quarantinedSeedKeys?.has(seedKey)) {
      console.info(
        `[competitive-ingestion] discover-seed-skipped quarantined seed=${seed.playerName} region=${seed.cluster}`,
      );
      await notifyDiscoveryProgress({
        onProgress: input.onProgress,
        processedSeeds,
        totalActiveSeeds: activeSeeds.length,
        discoveries,
        seed,
      });
      continue;
    }

    const cached = discoveryCache.get(seedKey);
    if (isCachedDiscoveryComplete(cached, input)) {
      discoveries.push(cached);
      console.info(
        `[competitive-ingestion] discover-seed-progress processed=${discoveries.length}/${activeSeeds.length} seed=${seed.playerName} cached=yes matchIds=${cached.matchIds.length}`,
      );
      await notifyDiscoveryProgress({
        onProgress: input.onProgress,
        processedSeeds,
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
      failureState.consecutiveFailures = 0;
    } catch (error) {
      stopReason = recordDiscoveryFailure({
        error,
        seed,
        seedKey,
        cached,
        state: failureState,
        authFailureCountsBySeedKey,
        authFailureCountsByRegion,
        maxConsecutiveFailures,
      });
      if (stopReason) {
        console.warn(
          `[competitive-ingestion] discovery-stopped stopReason=${stopReason} lastSeed=${seed.playerName}`,
        );
        break;
      }
      discoveries.push(cached ?? buildEmptyDiscovery(seed, input, cached));
    }
    console.info(
      `[competitive-ingestion] discover-seed-progress processed=${discoveries.length}/${activeSeeds.length} seed=${seed.playerName} cached=no matchIds=${discoveries[discoveries.length - 1]?.matchIds.length ?? 0}`,
    );
    await notifyDiscoveryProgress({
      onProgress: input.onProgress,
      processedSeeds,
      totalActiveSeeds: activeSeeds.length,
      discoveries,
      seed,
    });
  }

  return {
    discoveries,
    stopReason,
    authFailureCountsBySeedKey,
    authFailureCountsByRegion,
    lastFailureSeedKey: failureState.lastFailureSeedKey,
    lastFailureRegion: failureState.lastFailureRegion,
    lastFailureReason: failureState.lastFailureReason,
  };
}
