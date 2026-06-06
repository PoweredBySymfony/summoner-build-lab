import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../server/src/lib/prisma.js";
import {
  buildCompetitiveIngestionReport,
  buildCompetitiveMatchQueue,
  buildCompetitiveSeedKey,
  buildSeedSummaries,
  determineOpenedFallbackTiers,
  loadCompetitiveIngestionCheckpoint,
  loadCompetitiveIngestionPolicy,
  resolveCompetitiveIngestionPolicy,
  saveCompetitiveIngestionCheckpoint,
  type CompetitiveDiscoveredMatch,
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
import { applyTranchePreset, parseArgs, type CliOptions } from "./lib/competitiveImportCli.js";
import {
  loadDiscoveryQuarantine,
  saveDiscoveryQuarantine,
  type CompetitiveDiscoveryQuarantine,
  type CompetitiveDiscoveryQuarantineEntry,
} from "./lib/competitiveDiscoveryQuarantine.js";
import {
  canReuseDiscoveryCheckpointState,
  canReuseResolvedSeedCheckpointState,
  rebuildDiscoveredMatchesFromCheckpoint,
} from "./lib/competitiveDiscoveryCheckpoint.js";
import { renderMarkdownReport } from "./lib/competitiveImportReport.js";
import {
  buildDiscoveryQuerySignature,
  discoverSeeds,
  resolveSeeds,
} from "./lib/competitiveSeedRunner.js";
import {
  buildRejectedMatches,
  buildSourceMetadata,
  classifyDiscoveredMatches,
} from "./lib/competitiveClassificationRunner.js";

const PROGRESS_PERSIST_ATTEMPT_INTERVAL = 50;
const PROGRESS_PERSIST_CREATED_INTERVAL = 10;

function toUnixSeconds(timestampMs: number | null) {
  return timestampMs === null ? null : Math.floor(timestampMs / 1000);
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

function toSourceKind(priorityTier: CompetitiveSeed["priorityTier"]) {
  return priorityTier === "pro" ? "PRO_SEED" : priorityTier === "elite" ? "ELITE_SEED" : "FALLBACK_SEED";
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
  const discoveryQuarantinePath = path.resolve(options.quarantinePath);
  const existingQuarantine = await loadDiscoveryQuarantine(discoveryQuarantinePath, manifest.seedSetVersion);
  const quarantinedSeedKeys = new Set(Object.keys(existingQuarantine?.seedKeys ?? {}));
  const quarantinedRegions = new Set(Object.keys(existingQuarantine?.regions ?? {}));
  const canReuseResolvedSeeds = canReuseResolvedSeedCheckpointState({
    checkpoint,
    manifestSeedSetVersion: manifest.seedSetVersion,
    policy,
    startTime,
    endTime,
  });
  const canReuseDiscoveryCheckpoint = canReuseDiscoveryCheckpointState({
    checkpoint,
    manifestSeedSetVersion: manifest.seedSetVersion,
    policy,
    startTime,
    endTime,
    classificationBudget,
    refreshDiscovery: options.refreshDiscovery,
    hasActiveQuarantine: quarantinedSeedKeys.size > 0,
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

  let resolvedSeeds = canReuseResolvedSeeds
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
  let discoveries: CompetitiveSeedMatchDiscovery[] = canReuseDiscoveryCheckpoint ? checkpoint.discoveredMatches : [];
  let discoveredMatches: CompetitiveDiscoveredMatch[] = canReuseDiscoveryCheckpoint
    ? rebuildDiscoveredMatchesFromCheckpoint({
      checkpoint,
      resolvedSeeds,
      policy,
      matchMetadataCache,
    })
    : [];
  let currentTargetIdsPerSeed = Math.min(options.countPerSeed, options.maxIdsPerSeed);
  let discoveryPass = 0;
  let stopReason: string | null = null;
  let discoveryStopReason: string | null = null;
  const authFailureCountsBySeedKey = new Map<string, number>();
  const authFailureCountsByRegion = new Map<string, number>();
  const desiredCreatedBudget = options.maxCreatedPerRun
    ? Math.max(options.maxCreatedPerRun * 4, options.maxCreatedPerRun + 50)
    : remainingTargetMatches;
  const discoveryUniqueBudget = Math.max(
    150,
    Math.min(remainingTargetMatches, classificationBudget, desiredCreatedBudget),
  );

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
    const discoveryResult = await discoverSeeds(
      resolvedSeeds,
      discoveryCache,
      {
        pageSize: options.countPerSeed,
        maxIdsPerSeed: options.maxIdsPerSeed,
        targetIdsPerSeed: currentTargetIdsPerSeed,
        maxDiscoveredUniqueMatches: discoveryUniqueBudget,
        queues: [...policy.preferredQueues, ...policy.acceptedFallbackQueues],
        startTime,
        endTime,
        maxConsecutiveFailures: options.maxSeedDiscoveryFailures ?? 2,
        quarantinedSeedKeys,
        quarantinedRegions,
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
    discoveries = discoveryResult.discoveries;
    if (discoveryResult.stopReason) {
      discoveryStopReason = discoveryResult.stopReason;
    }
    if (discoveryResult.stopReason?.startsWith("discovery-failure-budget:")) {
      if (discoveryResult.lastFailureSeedKey) {
        authFailureCountsBySeedKey.set(
          discoveryResult.lastFailureSeedKey,
          Math.max(authFailureCountsBySeedKey.get(discoveryResult.lastFailureSeedKey) ?? 0, 2),
        );
      }
      if (discoveryResult.lastFailureRegion) {
        authFailureCountsByRegion.set(
          discoveryResult.lastFailureRegion,
          Math.max(authFailureCountsByRegion.get(discoveryResult.lastFailureRegion) ?? 0, 2),
        );
      }
    }
    for (const [seedKey, count] of discoveryResult.authFailureCountsBySeedKey) {
      authFailureCountsBySeedKey.set(seedKey, (authFailureCountsBySeedKey.get(seedKey) ?? 0) + count);
    }
    for (const [region, count] of discoveryResult.authFailureCountsByRegion) {
      authFailureCountsByRegion.set(region, (authFailureCountsByRegion.get(region) ?? 0) + count);
    }
    for (const discovery of discoveries) {
      discoveryCache.set(discovery.seedKey, discovery);
    }
    const discoveredUniqueMatches = new Set(discoveries.flatMap((discovery) => discovery.matchIds)).size;
    const maxUniqueMatchesToClassify = discoveryUniqueBudget;
    console.info(
      `[competitive-ingestion] classify-budget uniqueCap=${maxUniqueMatchesToClassify} discoveredUnique=${discoveredUniqueMatches}`,
    );
    discoveredMatches = await classifyDiscoveredMatches(discoveries, policy, matchMetadataCache, {
      maxUniqueMatchesToClassify,
      concurrency: options.trancheSize ? Math.max(4, Math.min(12, Math.ceil(options.trancheSize / 10))) : 6,
      onProgress: async (snapshot) => {
        await persistClassificationProgress({
          classifiedUniqueMatches: snapshot.classifiedUniqueMatches,
          maxUniqueMatchesToClassify: snapshot.maxUniqueMatchesToClassify,
          currentMatchId: snapshot.currentMatchId,
        });
      },
    });
  };

  if (canReuseDiscoveryCheckpoint) {
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
      discoveryStopReason,
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
      stopReason: stopReason ?? discoveryStopReason,
      runAttemptCount: getRunAttemptCount(),
      runCreatedCount: createdCandidates.length,
      runAuthFailureCount: getRunAuthFailureCount(),
      discoveryStopReason,
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
      if (!candidate) {
        continue;
      }
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
        const failureMessage = error instanceof Error ? error.message : String(error);
        if (failureMessage.toLowerCase().includes("authentication failed")) {
          authFailureCountsBySeedKey.set(candidate.seedKey, (authFailureCountsBySeedKey.get(candidate.seedKey) ?? 0) + 1);
          authFailureCountsByRegion.set(candidate.cluster, (authFailureCountsByRegion.get(candidate.cluster) ?? 0) + 1);
        }
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
          failureReason: failureMessage,
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
    discoveryStopReason,
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
    stopReason: stopReason ?? discoveryStopReason,
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

  const quarantinedAt = new Date().toISOString();
  const nextQuarantine: CompetitiveDiscoveryQuarantine = existingQuarantine ?? {
    version: 1,
    generatedAt: quarantinedAt,
    seedSetVersion: manifest.seedSetVersion,
    seedKeys: {},
    regions: {},
  };
  nextQuarantine.generatedAt = quarantinedAt;

  const mergeQuarantineEntry = (
    bucket: Record<string, CompetitiveDiscoveryQuarantineEntry>,
    key: string,
    count: number,
    reason: string,
  ) => {
    const existing = bucket[key];
    if (existing) {
      existing.count += count;
      existing.lastSeenAt = quarantinedAt;
      existing.reason = reason;
      if (existing.count >= 2) {
        existing.quarantinedAt = quarantinedAt;
      }
      return;
    }
    bucket[key] = {
      reason,
      count,
      firstSeenAt: quarantinedAt,
      lastSeenAt: quarantinedAt,
      quarantinedAt,
    };
  };

  for (const [seedKey, count] of authFailureCountsBySeedKey) {
    if (count >= 2) {
      mergeQuarantineEntry(nextQuarantine.seedKeys, seedKey, count, "authentication-failed");
    }
  }
  for (const [region, count] of authFailureCountsByRegion) {
    if (count >= 2) {
      mergeQuarantineEntry(nextQuarantine.regions, region, count, "authentication-failed");
    }
  }

  await saveDiscoveryQuarantine(discoveryQuarantinePath, nextQuarantine);

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
