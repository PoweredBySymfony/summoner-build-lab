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
