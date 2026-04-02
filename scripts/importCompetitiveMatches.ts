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
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    seedPath: path.join("data", "seeds", "competitive-seeds-2026.json"),
    policyPath: path.join("data", "config", "competitive-ingestion-policy-2026.json"),
    checkpointPath: path.join("data", "runtime", "competitive-ingestion", "checkpoint.json"),
    reportPath: path.join("data", "runtime", "competitive-ingestion", "report.json"),
    markdownReportPath: path.join("data", "runtime", "competitive-ingestion", "report.md"),
    targetMatches: 2000,
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
  if (!options.ownerEmail) {
    throw new Error("Provide --owner-user-id or --owner-email for competitive imports.");
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
) {
  const resolvedSeeds: CompetitiveResolvedSeed[] = [];
  for (const seed of seeds) {
    resolvedSeeds.push(await resolveSeed(seed, resolvedSeedCache.get(buildCompetitiveSeedKey(seed))));
  }
  return resolvedSeeds;
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
      continue;
    }

    discoveries.push(await discoverMatchIdsForSeed(seed, {
      pageSize: input.pageSize,
      maxIdsPerSeed: input.maxIdsPerSeed,
      targetIds: input.targetIdsPerSeed,
      queues: input.queues,
      startTime: input.startTime,
      endTime: input.endTime,
      cached,
    }));
  }

  return discoveries;
}

async function classifyDiscoveredMatches(
  discoveries: CompetitiveSeedMatchDiscovery[],
  policy: ReturnType<typeof resolveCompetitiveIngestionPolicy>,
  matchMetadataCache: Map<string, CompetitiveCachedMatchMetadata>,
) {
  const discoveredMatches: CompetitiveDiscoveredMatch[] = [];

  for (const discovery of discoveries) {
    for (const matchId of discovery.matchIds) {
      const cachedMetadata = matchMetadataCache.get(matchId);
      const cachedGameCreationAt = cachedMetadata?.gameCreationAt ? new Date(cachedMetadata.gameCreationAt) : null;
      let gameCreationAt = cachedGameCreationAt;
      let effectivePatch = cachedMetadata?.patch ?? null;
      let effectiveQueueId = cachedMetadata?.queueId ?? null;

      if (!cachedMetadata) {
        const match = await riotApiClient.getMatchByIdOnRegion(matchId, discovery.region);
        effectivePatch = normalizePatch(match);
        effectiveQueueId = normalizeQueueId(match);
        gameCreationAt = normalizeGameCreationAt(match);
        matchMetadataCache.set(matchId, {
          patch: effectivePatch,
          queueId: effectiveQueueId,
          gameCreationAt: gameCreationAt?.toISOString() ?? null,
        });
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
  const options = parseArgs(process.argv.slice(2));
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
  const checkpoint = (!options.resetCheckpoint ? await loadCompetitiveIngestionCheckpoint(checkpointPath) : null) ?? {
    version: 3,
    generatedAt: new Date().toISOString(),
    seedSetVersion: manifest.seedSetVersion,
    targetUniqueMatches: options.targetMatches,
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

  console.info(
    `[competitive-ingestion] resolving ${manifest.players.length} seeds from ${seedAbsolutePath} mode=${policy.mode}`,
  );
  console.info(
    `[competitive-ingestion] match-v5 filters queue=${policy.preferredQueues.join(",")} fallbackQueues=${policy.acceptedFallbackQueues.join(",")} startTime=${startTime ?? "none"} endTime=${endTime ?? "none"} dryRun=${options.dryRun ? "yes" : "no"}`,
  );

  let workingSeeds = manifest.players;
  let resolvedSeeds = await resolveSeeds(workingSeeds, resolvedSeedCache);
  let discoveries: CompetitiveSeedMatchDiscovery[] = [];
  let discoveredMatches: CompetitiveDiscoveredMatch[] = [];
  let currentTargetIdsPerSeed = Math.min(options.countPerSeed, options.maxIdsPerSeed);

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
      },
    );
    for (const discovery of discoveries) {
      discoveryCache.set(discovery.seedKey, discovery);
    }
    discoveredMatches = await classifyDiscoveredMatches(discoveries, policy, matchMetadataCache);
  };

  await refreshDiscoveryState();

  workingSeeds = await maybeEnrichEliteSeeds({
    manifestPlayers: workingSeeds,
    discoveredMatches,
    policy,
  });

  if (workingSeeds.length !== manifest.players.length) {
    resolvedSeeds = await resolveSeeds(workingSeeds, resolvedSeedCache);
    await refreshDiscoveryState();
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
  let lastFallbackPlan = determineOpenedFallbackTiers({
    matches: discoveredMatches,
    targetUniqueMatches: options.targetMatches,
    alreadyCountedMatchIds: new Set([...attemptedMatchIds, ...importedMatchIds]),
    policy,
  });

  const duplicateLikeReasons = new Set(["existing-match-different-target"]);
  let discoveryPass = 0;

  while (createdCandidates.length < options.targetMatches) {
    discoveryPass += 1;
    const alreadyCountedMatchIds = new Set([...attemptedMatchIds, ...importedMatchIds]);
    const fallbackPlan = determineOpenedFallbackTiers({
      matches: discoveredMatches,
      targetUniqueMatches: options.targetMatches,
      alreadyCountedMatchIds,
      policy,
    });
    lastFallbackPlan = fallbackPlan;

    for (const opened of fallbackPlan.openedFallbackTiers) {
      console.info(`[competitive-ingestion] ${opened}`);
    }

    const queue = buildCompetitiveMatchQueue({
      matches: discoveredMatches,
      targetUniqueMatches: options.targetMatches,
      policy,
      activeBands: fallbackPlan.activeBands,
      excludedMatchIds: alreadyCountedMatchIds,
    });

    console.info(
      `[competitive-ingestion] pass=${discoveryPass} queueCandidates=${queue.length} createdSoFar=${createdCandidates.length} target=${options.targetMatches} idsPerSeed=${currentTargetIdsPerSeed}`,
    );

    if (options.dryRun || queue.length === 0) {
      break;
    }

    let passCreated = 0;
    let passDuplicateLike = 0;

    for (const candidate of queue) {
      if (createdCandidates.length >= options.targetMatches) {
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
    }

    const remainingTarget = options.targetMatches - createdCandidates.length;
    const shouldDeepenDiscovery =
      remainingTarget > 0
      && currentTargetIdsPerSeed < options.maxIdsPerSeed
      && (
        passCreated === 0
        || queue.length < remainingTarget
        || passDuplicateLike >= Math.max(5, passCreated * 2)
      );

    if (!shouldDeepenDiscovery) {
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
    targetUniqueMatches: options.targetMatches,
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
  });
