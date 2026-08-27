import {
  buildCompetitiveSeedKey,
  resolveCompetitiveIngestionPolicy,
  scoreCompetitiveMatch,
  type CompetitiveCachedMatchMetadata,
  type CompetitiveDiscoveredMatch,
  type CompetitiveIngestionCheckpoint,
  type CompetitiveResolvedSeed,
  type CompetitiveSeedMatchDiscovery,
} from "../../server/src/lib/riot/competitiveIngestion.js";

function arraysEqualIgnoringOrder<T extends string | number>(left: T[], right: T[]) {
  if (left.length !== right.length) {
    return false;
  }

  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export function canReuseResolvedSeedCheckpointState(input: {
  checkpoint: CompetitiveIngestionCheckpoint;
  manifestSeedSetVersion: string;
  policy: ReturnType<typeof resolveCompetitiveIngestionPolicy>;
  startTime: number | null;
  endTime: number | null;
}) {
  const { checkpoint, manifestSeedSetVersion, policy, startTime, endTime } = input;
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

  return checkpoint.resolvedSeeds.length > 0;
}

export function canReuseDiscoveryCheckpointState(input: {
  checkpoint: CompetitiveIngestionCheckpoint;
  manifestSeedSetVersion: string;
  policy: ReturnType<typeof resolveCompetitiveIngestionPolicy>;
  startTime: number | null;
  endTime: number | null;
  classificationBudget: number;
  refreshDiscovery: boolean;
  hasActiveQuarantine: boolean;
}) {
  const { checkpoint, manifestSeedSetVersion, policy, startTime, endTime, classificationBudget, refreshDiscovery, hasActiveQuarantine } = input;
  return canReuseResolvedSeedCheckpointState({
    checkpoint,
    manifestSeedSetVersion,
    policy,
    startTime,
    endTime,
  }) && (checkpoint.classificationBudget ?? 0) === classificationBudget && !refreshDiscovery && !hasActiveQuarantine && !checkpoint.discoveryStopReason && checkpoint.discoveredMatches.length > 0;
}

type CompetitivePolicyDecision = NonNullable<CompetitiveIngestionCheckpoint["policyDecisionByMatchId"]>[string];

function indexDiscoveriesByClassifiedMatchId(input: {
  discoveredMatches: CompetitiveSeedMatchDiscovery[];
  classifiedMatchIds: Set<string>;
}) {
  const discoveryByMatchId = new Map<string, CompetitiveSeedMatchDiscovery>();

  for (const discovery of input.discoveredMatches) {
    for (const matchId of discovery.matchIds) {
      if (!input.classifiedMatchIds.has(matchId) || discoveryByMatchId.has(matchId)) {
        continue;
      }

      discoveryByMatchId.set(matchId, discovery);
      if (discoveryByMatchId.size >= input.classifiedMatchIds.size) {
        break;
      }
    }

    if (discoveryByMatchId.size >= input.classifiedMatchIds.size) {
      break;
    }
  }

  return discoveryByMatchId;
}

function rebuildDiscoveredMatch(input: {
  matchId: string;
  decision: CompetitivePolicyDecision;
  discovery: CompetitiveSeedMatchDiscovery;
  seed: CompetitiveResolvedSeed | undefined;
  metadata: CompetitiveCachedMatchMetadata | undefined;
}): CompetitiveDiscoveredMatch {
  const gameCreationAt = input.metadata?.gameCreationAt ?? null;
  const gameCreationDate = gameCreationAt ? new Date(gameCreationAt) : null;

  return {
    matchId: input.matchId,
    seedKey: input.discovery.seedKey,
    playerName: input.discovery.playerName,
    team: input.discovery.team,
    league: input.discovery.league,
    competition: input.discovery.competition,
    role: input.discovery.role,
    priorityTier: input.discovery.priorityTier,
    priorityScore: input.discovery.priorityScore,
    platform: input.seed?.platformHint ?? null,
    cluster: input.discovery.region,
    queueId: input.metadata?.queueId ?? null,
    patch: input.metadata?.patch ?? null,
    gameCreationAt,
    acceptedByPolicy: input.decision.acceptedByPolicy,
    acceptedReason: input.decision.acceptedReason,
    rejectionReason: input.decision.rejectionReason,
    fallbackReason: input.decision.fallbackReason,
    policyMode: input.decision.policyMode,
    policyBucket: input.decision.policyBucket,
    queueBucket: input.decision.queueBucket,
    sourceBucket: input.decision.sourceBucket,
    priorityBand: input.decision.priorityBand,
    matchPriorityScore: scoreCompetitiveMatch({
      priorityTier: input.discovery.priorityTier,
      priorityScore: input.discovery.priorityScore,
      patch: input.metadata?.patch ?? null,
      gameCreationAt: gameCreationDate,
      patchBucket: input.decision.policyBucket,
      queueBucket: input.decision.queueBucket,
      priorityBand: input.decision.priorityBand,
    }),
  };
}

export function rebuildDiscoveredMatchesFromCheckpoint(input: {
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
  const discoveryByMatchId = indexDiscoveriesByClassifiedMatchId({
    discoveredMatches: input.checkpoint.discoveredMatches,
    classifiedMatchIds,
  });

  const rebuilt: CompetitiveDiscoveredMatch[] = [];
  for (const [matchId, decision] of Object.entries(policyDecisionByMatchId)) {
    const discovery = discoveryByMatchId.get(matchId);
    if (!discovery) {
      continue;
    }

    const seed = seedIndex.get(discovery.seedKey);
    const metadata = input.matchMetadataCache.get(matchId);
    rebuilt.push(rebuildDiscoveredMatch({
      matchId,
      decision,
      discovery,
      seed,
      metadata,
    }));
  }

  return rebuilt;
}
