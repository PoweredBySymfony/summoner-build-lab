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
const COMPETITIVE_SOURCE_KINDS = ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"] as const;

type CompetitivePolicy = ReturnType<typeof resolveCompetitiveIngestionPolicy>;
type ActiveCompetitiveSeed = CompetitiveResolvedSeed & {
  puuid: string;
  cluster: NonNullable<CompetitiveResolvedSeed["cluster"]>;
};
type CompetitiveQueueCandidate = ReturnType<typeof buildCompetitiveMatchQueue>[number];
type ImportedCompetitiveMatch = Awaited<ReturnType<typeof riotSyncService.importMatchForIdentity>>;
type CompetitiveFallbackPlan = ReturnType<typeof determineOpenedFallbackTiers>;
type ImportAttemptResult = {
  created: boolean;
  duplicateLike: boolean;
  importedMatchId?: string;
  failure?: CompetitiveIngestionAttemptSummary;
};
type ResolutionProgressSnapshot = Parameters<NonNullable<NonNullable<Parameters<typeof resolveSeeds>[2]>["onProgress"]>>[0];
type DiscoveryProgressSnapshot = Parameters<NonNullable<Parameters<typeof discoverSeeds>[2]["onProgress"]>>[0];

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isAuthenticationFailure(message: string) {
  return message.toLowerCase().includes("authentication failed");
}

function getCompetitiveSourceWhere() {
  return {
    sourceKind: {
      in: [...COMPETITIVE_SOURCE_KINDS],
    },
  };
}

async function countImportedMatches(dryRun: boolean) {
  return dryRun ? 0 : prisma.importedMatch.count();
}

async function countCompetitiveMatches(dryRun: boolean) {
  return dryRun
    ? 0
    : prisma.importedMatch.count({
      where: getCompetitiveSourceWhere(),
    });
}

async function loadExistingCompetitiveMatchIds(dryRun: boolean) {
  if (dryRun) {
    return new Set<string>();
  }

  const rows = await prisma.importedMatch.findMany({
    where: getCompetitiveSourceWhere(),
    select: { riotMatchId: true },
  });

  return new Set(rows.map((row) => row.riotMatchId));
}

function buildInitialCheckpoint(input: {
  manifest: CompetitiveSeedManifest;
  remainingTargetMatches: number;
  classificationBudget: number;
  policy: CompetitivePolicy;
  startTime: number | null;
  endTime: number | null;
}): CompetitiveIngestionCheckpoint {
  return {
    version: 3,
    generatedAt: new Date().toISOString(),
    seedSetVersion: input.manifest.seedSetVersion,
    targetUniqueMatches: input.remainingTargetMatches,
    classificationBudget: input.classificationBudget,
    queueWhitelist: [...input.policy.preferredQueues, ...input.policy.acceptedFallbackQueues],
    patchAllowPrefixes: [...input.policy.preferredPatchPrefixes, ...input.policy.acceptedAdjacentPatchPrefixes],
    seasonWindow: {
      startTime: input.startTime,
      endTime: input.endTime,
    },
    policyMode: input.policy.mode,
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
  };
}

function isActiveCompetitiveSeed(seed: CompetitiveResolvedSeed): seed is ActiveCompetitiveSeed {
  return seed.resolutionStatus === "resolved" && Boolean(seed.puuid) && Boolean(seed.cluster);
}

function buildSeedIndex(resolvedSeeds: CompetitiveResolvedSeed[]) {
  return new Map(
    resolvedSeeds
      .filter(isActiveCompetitiveSeed)
      .map((seed) => [buildCompetitiveSeedKey(seed), seed]),
  );
}

function countBy<T>(values: T[], getKey: (value: T) => string) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    const key = getKey(value);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function buildPolicyDecisionByMatchId(discoveredMatches: CompetitiveDiscoveredMatch[]) {
  return discoveredMatches.reduce<NonNullable<CompetitiveIngestionCheckpoint["policyDecisionByMatchId"]>>(
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
}

function buildImportIdentity(seed: ActiveCompetitiveSeed) {
  const riotId = seed.resolvedRiotId ? splitRiotId(seed.resolvedRiotId) : null;

  return {
    puuid: seed.puuid,
    gameName: riotId?.gameName ?? null,
    tagLine: riotId?.tagLine ?? null,
    region: seed.cluster,
    platform: seed.platformHint ?? "euw1",
  };
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

function buildSkippedImportFailure(
  candidate: CompetitiveQueueCandidate,
  seed: ActiveCompetitiveSeed,
  imported: ImportedCompetitiveMatch,
): CompetitiveIngestionAttemptSummary {
  return {
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
  };
}

function buildErroredImportFailure(
  candidate: CompetitiveQueueCandidate,
  failureMessage: string,
): CompetitiveIngestionAttemptSummary {
  return {
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
  };
}

async function importCompetitiveCandidate(input: {
  ownerUserId: string;
  seed: ActiveCompetitiveSeed;
  candidate: CompetitiveQueueCandidate;
  policy: CompetitivePolicy;
  duplicateLikeReasons: Set<string>;
}) {
  try {
    const sourceKind = toSourceKind(input.seed.priorityTier);
    const sourceMetadata = buildSourceMetadata(input.seed, input.candidate, input.policy);
    const imported = await riotSyncService.importMatchForIdentity(
      input.ownerUserId,
      input.candidate.matchId,
      buildImportIdentity(input.seed),
      {
        sourceKind,
        sourceMetadata,
        skipExistingWithDifferentTarget: true,
      },
    );

    await repairImportedMatchProvenance({
      riotMatchId: input.candidate.matchId,
      sourceKind,
      sourceRegion: input.seed.region,
      sourceMetadata,
    });

    return {
      created: imported.created,
      duplicateLike: !imported.created && (imported.skippedReason === null || input.duplicateLikeReasons.has(imported.skippedReason)),
      importedMatchId: imported.created ? imported.riotMatchId : undefined,
      failure: imported.skippedReason ? buildSkippedImportFailure(input.candidate, input.seed, imported) : undefined,
    } satisfies ImportAttemptResult;
  } catch (error) {
    return {
      created: false,
      duplicateLike: false,
      failure: buildErroredImportFailure(input.candidate, getErrorMessage(error)),
    } satisfies ImportAttemptResult;
  }
}

function buildCreatedCounts(createdCandidates: CompetitiveDiscoveredMatch[]) {
  return {
    byTier: countBy(createdCandidates, (candidate) => candidate.priorityBand ?? "unknown"),
    byPatchBucket: countBy(createdCandidates, (candidate) => candidate.policyBucket),
    byQueueBucket: countBy(createdCandidates, (candidate) => candidate.queueBucket),
  };
}

function shouldPersistMidPass(input: {
  attemptedMatchIds: Set<string>;
  createdCandidates: CompetitiveDiscoveredMatch[];
  lastPersistedAttemptCount: number;
  lastPersistedCreatedCount: number;
}) {
  return input.attemptedMatchIds.size - input.lastPersistedAttemptCount >= PROGRESS_PERSIST_ATTEMPT_INTERVAL
    || input.createdCandidates.length - input.lastPersistedCreatedCount >= PROGRESS_PERSIST_CREATED_INTERVAL;
}

function shouldDeepenDiscovery(input: {
  remainingTarget: number;
  currentTargetIdsPerSeed: number;
  maxIdsPerSeed: number;
  passCreated: number;
  queueLength: number;
  passDuplicateLike: number;
}) {
  return input.remainingTarget > 0
    && input.currentTargetIdsPerSeed < input.maxIdsPerSeed
    && (
      input.passCreated === 0
      || input.queueLength < input.remainingTarget
      || input.passDuplicateLike >= Math.max(5, input.passCreated * 2)
    );
}

function getNextTargetIdsPerSeed(input: {
  currentTargetIdsPerSeed: number;
  countPerSeed: number;
  maxIdsPerSeed: number;
}) {
  return Math.min(
    input.maxIdsPerSeed,
    Math.max(input.currentTargetIdsPerSeed + input.countPerSeed, Math.ceil(input.currentTargetIdsPerSeed * 1.5)),
  );
}

function refreshPersistedCounts(input: {
  attemptedMatchIds: Set<string>;
  createdCandidates: CompetitiveDiscoveredMatch[];
  persistedCounts: {
    lastPersistedAttemptCount: number;
    lastPersistedCreatedCount: number;
  };
}) {
  input.persistedCounts.lastPersistedAttemptCount = input.attemptedMatchIds.size;
  input.persistedCounts.lastPersistedCreatedCount = input.createdCandidates.length;
}

function shouldStopImportQueue(input: {
  getStopReason: () => string | null;
  createdCandidates: CompetitiveDiscoveredMatch[];
  remainingTargetMatches: number;
}) {
  return Boolean(input.getStopReason()) || input.createdCandidates.length >= input.remainingTargetMatches;
}

function recordSuccessfulImport(input: {
  candidate: CompetitiveQueueCandidate;
  attemptedMatchIds: Set<string>;
  importedMatchIds: Set<string>;
  createdCandidates: CompetitiveDiscoveredMatch[];
  remainingTargetMatches: number;
  importedMatchId?: string;
}) {
  input.importedMatchIds.add(input.importedMatchId ?? input.candidate.matchId);
  input.createdCandidates.push(input.candidate);
  if (input.createdCandidates.length % PROGRESS_PERSIST_CREATED_INTERVAL === 0) {
    console.info(
      `[competitive-ingestion] created-progress created=${input.createdCandidates.length}/${input.remainingTargetMatches} attempted=${input.attemptedMatchIds.size} latest=${input.candidate.matchId} tier=${input.candidate.priorityTier} patch=${input.candidate.patch ?? "unknown"} queue=${input.candidate.queueId ?? "unknown"}`,
    );
  }
}

function recordImportFailure(input: {
  candidate: CompetitiveQueueCandidate;
  failure: CompetitiveIngestionAttemptSummary;
  failedMatches: CompetitiveIngestionAttemptSummary[];
  authFailureCountsBySeedKey: Map<string, number>;
  authFailureCountsByRegion: Map<string, number>;
}) {
  if (isAuthenticationFailure(input.failure.failureReason ?? "")) {
    input.authFailureCountsBySeedKey.set(
      input.candidate.seedKey,
      (input.authFailureCountsBySeedKey.get(input.candidate.seedKey) ?? 0) + 1,
    );
    input.authFailureCountsByRegion.set(
      input.candidate.cluster,
      (input.authFailureCountsByRegion.get(input.candidate.cluster) ?? 0) + 1,
    );
  }
  input.failedMatches.push(input.failure);
}

function recordImportAttempt(input: {
  candidate: CompetitiveQueueCandidate;
  importResult: ImportAttemptResult;
  attemptedMatchIds: Set<string>;
  importedMatchIds: Set<string>;
  failedMatches: CompetitiveIngestionAttemptSummary[];
  createdCandidates: CompetitiveDiscoveredMatch[];
  remainingTargetMatches: number;
  authFailureCountsBySeedKey: Map<string, number>;
  authFailureCountsByRegion: Map<string, number>;
}) {
  if (input.importResult.created) {
    recordSuccessfulImport({
      candidate: input.candidate,
      attemptedMatchIds: input.attemptedMatchIds,
      importedMatchIds: input.importedMatchIds,
      createdCandidates: input.createdCandidates,
      remainingTargetMatches: input.remainingTargetMatches,
      importedMatchId: input.importResult.importedMatchId,
    });
  }

  if (input.importResult.failure) {
    recordImportFailure({
      candidate: input.candidate,
      failure: input.importResult.failure,
      failedMatches: input.failedMatches,
      authFailureCountsBySeedKey: input.authFailureCountsBySeedKey,
      authFailureCountsByRegion: input.authFailureCountsByRegion,
    });
  }

  return {
    created: input.importResult.created ? 1 : 0,
    duplicateLike: input.importResult.duplicateLike ? 1 : 0,
  };
}

async function persistQueueProgressIfNeeded(input: {
  attemptedMatchIds: Set<string>;
  createdCandidates: CompetitiveDiscoveredMatch[];
  persistedCounts: {
    lastPersistedAttemptCount: number;
    lastPersistedCreatedCount: number;
  };
  persistIntermediateProgress: (stage: string) => Promise<void>;
}) {
  if (!shouldPersistMidPass({
    attemptedMatchIds: input.attemptedMatchIds,
    createdCandidates: input.createdCandidates,
    lastPersistedAttemptCount: input.persistedCounts.lastPersistedAttemptCount,
    lastPersistedCreatedCount: input.persistedCounts.lastPersistedCreatedCount,
  })) {
    return;
  }

  await input.persistIntermediateProgress("import-mid-pass");
  refreshPersistedCounts(input);
}

async function persistQueueStopIfRequested(input: {
  getStopReason: () => string | null;
  attemptedMatchIds: Set<string>;
  createdCandidates: CompetitiveDiscoveredMatch[];
  persistedCounts: {
    lastPersistedAttemptCount: number;
    lastPersistedCreatedCount: number;
  };
  persistIntermediateProgress: (stage: string) => Promise<void>;
}) {
  if (!input.getStopReason()) {
    return false;
  }

  await input.persistIntermediateProgress("run-bounded-stop");
  refreshPersistedCounts(input);
  return true;
}

async function processCompetitiveImportQueue(input: {
  queue: CompetitiveQueueCandidate[];
  ownerUserId: string | null;
  policy: CompetitivePolicy;
  seedIndex: Map<string, ActiveCompetitiveSeed>;
  remainingTargetMatches: number;
  attemptedMatchIds: Set<string>;
  importedMatchIds: Set<string>;
  failedMatches: CompetitiveIngestionAttemptSummary[];
  createdCandidates: CompetitiveDiscoveredMatch[];
  duplicateLikeReasons: Set<string>;
  authFailureCountsBySeedKey: Map<string, number>;
  authFailureCountsByRegion: Map<string, number>;
  getStopReason: () => string | null;
  persistIntermediateProgress: (stage: string) => Promise<void>;
  persistedCounts: {
    lastPersistedAttemptCount: number;
    lastPersistedCreatedCount: number;
  };
}) {
  let passCreated = 0;
  let passDuplicateLike = 0;

  for (const candidate of input.queue) {
    if (shouldStopImportQueue(input)) {
      break;
    }
    if (input.attemptedMatchIds.has(candidate.matchId)) {
      continue;
    }

    const seed = input.seedIndex.get(candidate.seedKey);
    if (!seed || !input.ownerUserId) {
      continue;
    }

    input.attemptedMatchIds.add(candidate.matchId);
    const importResult = await importCompetitiveCandidate({
      ownerUserId: input.ownerUserId,
      seed,
      candidate,
      policy: input.policy,
      duplicateLikeReasons: input.duplicateLikeReasons,
    });

    const attemptCounts = recordImportAttempt({
      candidate,
      importResult,
      attemptedMatchIds: input.attemptedMatchIds,
      importedMatchIds: input.importedMatchIds,
      failedMatches: input.failedMatches,
      createdCandidates: input.createdCandidates,
      remainingTargetMatches: input.remainingTargetMatches,
      authFailureCountsBySeedKey: input.authFailureCountsBySeedKey,
      authFailureCountsByRegion: input.authFailureCountsByRegion,
    });
    passCreated += attemptCounts.created;
    passDuplicateLike += attemptCounts.duplicateLike;

    await persistQueueProgressIfNeeded(input);

    if (await persistQueueStopIfRequested(input)) {
      break;
    }
  }

  return { passCreated, passDuplicateLike };
}

async function runCompetitiveImportPasses(input: {
  options: CliOptions;
  policy: CompetitivePolicy;
  ownerUserId: string | null;
  remainingTargetMatches: number;
  existingCompetitiveMatchIds: Set<string>;
  attemptedMatchIds: Set<string>;
  importedMatchIds: Set<string>;
  failedMatches: CompetitiveIngestionAttemptSummary[];
  createdCandidates: CompetitiveDiscoveredMatch[];
  seedIndex: Map<string, ActiveCompetitiveSeed>;
  duplicateLikeReasons: Set<string>;
  authFailureCountsBySeedKey: Map<string, number>;
  authFailureCountsByRegion: Map<string, number>;
  getDiscoveredMatches: () => CompetitiveDiscoveredMatch[];
  getCurrentTargetIdsPerSeed: () => number;
  setCurrentTargetIdsPerSeed: (value: number) => void;
  incrementDiscoveryPass: () => number;
  setLastFallbackPlan: (plan: CompetitiveFallbackPlan) => void;
  getStopReason: () => string | null;
  persistIntermediateProgress: (stage: string) => Promise<void>;
  refreshDiscoveryState: () => Promise<void>;
}) {
  const persistedCounts = {
    lastPersistedAttemptCount: input.attemptedMatchIds.size,
    lastPersistedCreatedCount: input.createdCandidates.length,
  };

  while (input.createdCandidates.length < input.remainingTargetMatches) {
    if (input.getStopReason()) {
      break;
    }

    const discoveryPass = input.incrementDiscoveryPass();
    const alreadyCountedMatchIds = new Set([...input.existingCompetitiveMatchIds, ...input.attemptedMatchIds, ...input.importedMatchIds]);
    const fallbackPlan = determineOpenedFallbackTiers({
      matches: input.getDiscoveredMatches(),
      targetUniqueMatches: input.remainingTargetMatches,
      alreadyCountedMatchIds,
      policy: input.policy,
    });
    input.setLastFallbackPlan(fallbackPlan);
    fallbackPlan.openedFallbackTiers.forEach((opened) => console.info(`[competitive-ingestion] ${opened}`));

    const queue = buildCompetitiveMatchQueue({
      matches: input.getDiscoveredMatches(),
      targetUniqueMatches: input.remainingTargetMatches,
      policy: input.policy,
      activeBands: fallbackPlan.activeBands,
      excludedMatchIds: alreadyCountedMatchIds,
    });

    console.info(
      `[competitive-ingestion] pass=${discoveryPass} queueCandidates=${queue.length} createdSoFar=${input.createdCandidates.length} targetRemaining=${input.remainingTargetMatches} targetTotal=${input.options.targetMatches} idsPerSeed=${input.getCurrentTargetIdsPerSeed()}`,
    );

    if (input.options.dryRun || queue.length === 0) {
      break;
    }

    const { passCreated, passDuplicateLike } = await processCompetitiveImportQueue({
      queue,
      ownerUserId: input.ownerUserId,
      policy: input.policy,
      seedIndex: input.seedIndex,
      remainingTargetMatches: input.remainingTargetMatches,
      attemptedMatchIds: input.attemptedMatchIds,
      importedMatchIds: input.importedMatchIds,
      failedMatches: input.failedMatches,
      createdCandidates: input.createdCandidates,
      duplicateLikeReasons: input.duplicateLikeReasons,
      authFailureCountsBySeedKey: input.authFailureCountsBySeedKey,
      authFailureCountsByRegion: input.authFailureCountsByRegion,
      getStopReason: input.getStopReason,
      persistIntermediateProgress: input.persistIntermediateProgress,
      persistedCounts,
    });

    await input.persistIntermediateProgress("import-pass-complete");
    persistedCounts.lastPersistedAttemptCount = input.attemptedMatchIds.size;
    persistedCounts.lastPersistedCreatedCount = input.createdCandidates.length;

    const remainingTarget = input.remainingTargetMatches - input.createdCandidates.length;
    const deepenDiscovery = shouldDeepenDiscovery({
      remainingTarget,
      currentTargetIdsPerSeed: input.getCurrentTargetIdsPerSeed(),
      maxIdsPerSeed: input.options.maxIdsPerSeed,
      passCreated,
      queueLength: queue.length,
      passDuplicateLike,
    });

    if (input.getStopReason() || !deepenDiscovery) {
      break;
    }

    const nextTargetIdsPerSeed = getNextTargetIdsPerSeed({
      currentTargetIdsPerSeed: input.getCurrentTargetIdsPerSeed(),
      countPerSeed: input.options.countPerSeed,
      maxIdsPerSeed: input.options.maxIdsPerSeed,
    });
    if (nextTargetIdsPerSeed <= input.getCurrentTargetIdsPerSeed()) {
      break;
    }

    console.info(
      `[competitive-ingestion] deepening-discovery reason=duplicate-pressure nextIdsPerSeed=${nextTargetIdsPerSeed} duplicateLike=${passDuplicateLike} created=${passCreated}`,
    );
    input.setCurrentTargetIdsPerSeed(nextTargetIdsPerSeed);
    await input.refreshDiscoveryState();
    await input.persistIntermediateProgress("discovery-deepened");
  }
}

function shouldPersistSeedProgress(input: {
  processedSeeds: number;
  totalSeeds: number;
}) {
  return input.processedSeeds % 10 === 0 || input.processedSeeds === input.totalSeeds;
}

async function persistResolutionSnapshot(input: {
  snapshot: ResolutionProgressSnapshot;
  persistResolutionProgress: (progress: {
    processedSeeds: number;
    totalSeeds: number;
    resolvedSeeds: CompetitiveResolvedSeed[];
    seedName: string;
  }) => Promise<void>;
}) {
  if (!shouldPersistSeedProgress(input.snapshot)) {
    return;
  }

  await input.persistResolutionProgress({
    processedSeeds: input.snapshot.processedSeeds,
    totalSeeds: input.snapshot.totalSeeds,
    resolvedSeeds: input.snapshot.resolvedSeeds,
    seedName: input.snapshot.seed.playerName,
  });
}

async function persistDiscoverySnapshot(input: {
  snapshot: DiscoveryProgressSnapshot;
  persistDiscoveryProgress: (progress: {
    processedSeeds: number;
    totalActiveSeeds: number;
    discoveries: CompetitiveSeedMatchDiscovery[];
    seedName: string;
  }) => Promise<void>;
}) {
  if (!shouldPersistSeedProgress({
    processedSeeds: input.snapshot.processedSeeds,
    totalSeeds: input.snapshot.totalActiveSeeds,
  })) {
    return;
  }

  await input.persistDiscoveryProgress({
    processedSeeds: input.snapshot.processedSeeds,
    totalActiveSeeds: input.snapshot.totalActiveSeeds,
    discoveries: input.snapshot.discoveries,
    seedName: input.snapshot.seed.playerName,
  });
}

function getCompetitiveRunStopReason(input: {
  options: CliOptions;
  runAttemptCount: number;
  runCreatedCount: number;
  runAuthFailureCount: number;
}) {
  if (
    typeof input.options.maxAttemptsPerRun === "number"
    && input.options.maxAttemptsPerRun > 0
    && input.runAttemptCount >= input.options.maxAttemptsPerRun
  ) {
    return `max-attempts-per-run:${input.options.maxAttemptsPerRun}`;
  }
  if (
    typeof input.options.maxCreatedPerRun === "number"
    && input.options.maxCreatedPerRun > 0
    && input.runCreatedCount >= input.options.maxCreatedPerRun
  ) {
    return `max-created-per-run:${input.options.maxCreatedPerRun}`;
  }
  if (
    typeof input.options.maxAuthFailuresPerRun === "number"
    && input.options.maxAuthFailuresPerRun > 0
    && input.runAuthFailureCount >= input.options.maxAuthFailuresPerRun
  ) {
    return `max-auth-failures-per-run:${input.options.maxAuthFailuresPerRun}`;
  }
  return null;
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
  const baselineTotalMatchesBefore = await countImportedMatches(options.dryRun);
  const baselineCompetitiveMatchesBefore = await countCompetitiveMatches(options.dryRun);
  const existingCompetitiveMatchIds = await loadExistingCompetitiveMatchIds(options.dryRun);
  const remainingTargetMatches = Math.max(0, options.targetMatches - baselineCompetitiveMatchesBefore);
  const classificationBudget = options.maxClassifiedPerRun
    ?? Math.max(300, (options.trancheSize ?? 25) * 12);
  const checkpoint = (!options.resetCheckpoint ? await loadCompetitiveIngestionCheckpoint(checkpointPath) : null)
    ?? buildInitialCheckpoint({ manifest, remainingTargetMatches, classificationBudget, policy, startTime, endTime });

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
        await persistResolutionSnapshot({ snapshot, persistResolutionProgress });
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
          await persistDiscoverySnapshot({ snapshot, persistDiscoveryProgress });
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
        await persistResolutionSnapshot({ snapshot, persistResolutionProgress });
      },
    });
    await refreshDiscoveryState();
    initialDiscoveryProgressStage = "discovery-elite-refresh";
  }

  const attemptedMatchIds = new Set(checkpoint.attemptedMatchIds);
  const importedMatchIds = new Set(checkpoint.importedMatchIds);
  const failedMatches = [...checkpoint.failedMatches];
  const seedIndex = buildSeedIndex(resolvedSeeds);
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

  const getRunAttemptCount = () => attemptedMatchIds.size - initialAttemptedCount;
  const getRunAuthFailureCount = () => failedMatches.filter(
    (failure) => failure.failureReason === "Riot API authentication failed.",
  ).length - initialFailedAuthCount;
  const updateStopReason = () => {
    if (stopReason) {
      return stopReason;
    }
    stopReason = getCompetitiveRunStopReason({
      options,
      runAttemptCount: getRunAttemptCount(),
      runCreatedCount: createdCandidates.length,
      runAuthFailureCount: getRunAuthFailureCount(),
    });
    return stopReason;
  };

  const persistIntermediateProgress = async (progressStage: string) => {
    const seedSummaries = buildSeedSummaries({
      resolvedSeeds,
      discoveries,
      discoveredMatches,
    });
    const rejectedMatches = buildRejectedMatches(discoveredMatches);
    const createdCounts = buildCreatedCounts(createdCandidates);
    const policyDecisionByMatchId = buildPolicyDecisionByMatchId(discoveredMatches);

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
      importCountsByTier: createdCounts.byTier,
      importCountsByPatchBucket: createdCounts.byPatchBucket,
      importCountsByQueueBucket: createdCounts.byQueueBucket,
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
      importCountsByTier: createdCounts.byTier,
      importCountsByPatchBucket: createdCounts.byPatchBucket,
      importCountsByQueueBucket: createdCounts.byQueueBucket,
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

  await runCompetitiveImportPasses({
    options,
    policy,
    ownerUserId,
    remainingTargetMatches,
    existingCompetitiveMatchIds,
    attemptedMatchIds,
    importedMatchIds,
    failedMatches,
    createdCandidates,
    seedIndex,
    duplicateLikeReasons,
    authFailureCountsBySeedKey,
    authFailureCountsByRegion,
    getDiscoveredMatches: () => discoveredMatches,
    getCurrentTargetIdsPerSeed: () => currentTargetIdsPerSeed,
    setCurrentTargetIdsPerSeed: (value) => {
      currentTargetIdsPerSeed = value;
    },
    incrementDiscoveryPass: () => {
      discoveryPass += 1;
      return discoveryPass;
    },
    setLastFallbackPlan: (plan) => {
      lastFallbackPlan = plan;
    },
    getStopReason: updateStopReason,
    persistIntermediateProgress,
    refreshDiscoveryState,
  });

  const seedSummaries = buildSeedSummaries({
    resolvedSeeds,
    discoveries,
    discoveredMatches,
  });

  const rejectedMatches = buildRejectedMatches(discoveredMatches);
  const createdCounts = buildCreatedCounts(createdCandidates);
  const policyDecisionByMatchId = buildPolicyDecisionByMatchId(discoveredMatches);

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
    importCountsByTier: createdCounts.byTier,
    importCountsByPatchBucket: createdCounts.byPatchBucket,
    importCountsByQueueBucket: createdCounts.byQueueBucket,
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
        ...getCompetitiveSourceWhere(),
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
    importCountsByTier: createdCounts.byTier,
    importCountsByPatchBucket: createdCounts.byPatchBucket,
    importCountsByQueueBucket: createdCounts.byQueueBucket,
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
