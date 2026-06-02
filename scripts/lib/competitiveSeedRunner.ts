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

export async function resolveSeed(
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

export async function discoverSeeds(
  seeds: CompetitiveResolvedSeed[],
  discoveryCache: Map<string, CompetitiveSeedMatchDiscovery>,
  input: {
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
      seed: CompetitiveResolvedSeed & { puuid: string; cluster: NonNullable<CompetitiveResolvedSeed["cluster"]> };
    }) => Promise<void> | void;
  },
) {
  const activeSeeds = seeds.filter(
    (seed): seed is CompetitiveResolvedSeed & { puuid: string; cluster: NonNullable<CompetitiveResolvedSeed["cluster"]> } =>
      seed.resolutionStatus === "resolved" && Boolean(seed.puuid) && Boolean(seed.cluster),
  );

  const discoveries: CompetitiveSeedMatchDiscovery[] = [];
  let processedSeeds = 0;
  let consecutiveFailureSignature: string | null = null;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = input.maxConsecutiveFailures ?? 2;
  let stopReason: string | null = null;
  const authFailureCountsBySeedKey = new Map<string, number>();
  const authFailureCountsByRegion = new Map<string, number>();
  let lastFailureSeedKey: string | null = null;
  let lastFailureRegion: string | null = null;
  let lastFailureReason: string | null = null;
  for (const seed of activeSeeds) {
    processedSeeds += 1;
    if (typeof input.maxDiscoveredUniqueMatches === "number") {
      const currentUniqueCount = new Set(discoveries.flatMap((entry) => entry.matchIds)).size;
      if (currentUniqueCount >= input.maxDiscoveredUniqueMatches) {
        stopReason = `discovery-unique-budget:${currentUniqueCount}`;
        break;
      }
    }

    const seedKey = buildCompetitiveSeedKey(seed);
    if (input.quarantinedSeedKeys?.has(seedKey)) {
      console.info(
        `[competitive-ingestion] discover-seed-skipped quarantined seed=${seed.playerName} region=${seed.cluster}`,
      );
      await input.onProgress?.({
        processedSeeds,
        totalActiveSeeds: activeSeeds.length,
        discoveries,
        seed,
      });
      continue;
    }

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
      consecutiveFailures = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failureSignature = message.toLowerCase().trim();
      lastFailureSeedKey = seedKey;
      lastFailureRegion = seed.cluster;
      lastFailureReason = failureSignature;
      if (failureSignature.includes("authentication failed")) {
        authFailureCountsBySeedKey.set(seedKey, (authFailureCountsBySeedKey.get(seedKey) ?? 0) + 1);
        authFailureCountsByRegion.set(seed.cluster, (authFailureCountsByRegion.get(seed.cluster) ?? 0) + 1);
      }
      consecutiveFailures = consecutiveFailureSignature === failureSignature
        ? consecutiveFailures + 1
        : 1;
      consecutiveFailureSignature = failureSignature;
      console.warn(
        "[competitive-ingestion] discover-seed-failed",
        JSON.stringify({
          seed: seed.playerName,
          matchIdsCached: cached?.matchIds.length ?? 0,
          message,
          consecutiveFailures,
          maxConsecutiveFailures,
        }),
      );
      if (consecutiveFailures >= maxConsecutiveFailures) {
        stopReason = `discovery-failure-budget:${consecutiveFailures}`;
        console.warn(
          `[competitive-ingestion] discovery-stopped stopReason=${stopReason} lastSeed=${seed.playerName}`,
        );
        break;
      }
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
    lastFailureSeedKey,
    lastFailureRegion,
    lastFailureReason,
  };
}
