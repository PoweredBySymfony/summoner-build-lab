import { type Prisma } from "@prisma/client";
import { canonicalizePatch } from "../../server/src/lib/riot/patchCanonical.js";
import { riotApiClient } from "../../server/src/lib/riot/riotApiClient.js";
import {
  evaluateCompetitiveMatchPolicy,
  resolveCompetitiveIngestionPolicy,
  scoreCompetitiveMatch,
  type CompetitiveCachedMatchMetadata,
  type CompetitiveDiscoveredMatch,
  type CompetitiveResolvedSeed,
  type CompetitiveSeedMatchDiscovery,
} from "../../server/src/lib/riot/competitiveIngestion.js";

export function normalizePatch(match: Record<string, unknown>) {
  const info = match.info as { gameVersion?: string; gameCreation?: number } | undefined;
  const gameCreationAt = typeof info?.gameCreation === "number" ? new Date(info.gameCreation) : null;
  return canonicalizePatch(info?.gameVersion, gameCreationAt).patchCanonical;
}

export function normalizeQueueId(match: Record<string, unknown>) {
  const info = match.info as { queueId?: number } | undefined;
  const queueId = Number(info?.queueId ?? Number.NaN);
  return Number.isFinite(queueId) ? queueId : null;
}

export function normalizeGameCreationAt(match: Record<string, unknown>) {
  const info = match.info as { gameCreation?: number } | undefined;
  const gameCreation = Number(info?.gameCreation ?? Number.NaN);
  if (!Number.isFinite(gameCreation)) {
    return null;
  }
  return new Date(gameCreation);
}

export async function classifyDiscoveredMatches(
  discoveries: CompetitiveSeedMatchDiscovery[],
  policy: ReturnType<typeof resolveCompetitiveIngestionPolicy>,
  matchMetadataCache: Map<string, CompetitiveCachedMatchMetadata>,
  options?: {
    maxUniqueMatchesToClassify?: number;
    concurrency?: number;
    onProgress?: (snapshot: {
      classifiedUniqueMatches: number;
      maxUniqueMatchesToClassify: number;
      discoveredMatches: CompetitiveDiscoveredMatch[];
      currentMatchId: string;
    }) => Promise<void> | void;
  },
) {
  const discoveredMatches: CompetitiveDiscoveredMatch[] = [];
  const maxUniqueMatchesToClassify = options?.maxUniqueMatchesToClassify ?? Number.POSITIVE_INFINITY;
  const concurrency = Math.max(1, Math.floor(options?.concurrency ?? 6));

  const prioritizedCandidates = new Map<string, {
    discovery: CompetitiveSeedMatchDiscovery;
    matchPriorityScore: number;
  }>();

  for (const discovery of discoveries) {
    for (const matchId of discovery.matchIds) {
      const current = prioritizedCandidates.get(matchId);
      if (!current || discovery.priorityScore > current.matchPriorityScore) {
        prioritizedCandidates.set(matchId, {
          discovery,
          matchPriorityScore: discovery.priorityScore,
        });
      }
    }
  }

  const orderedCandidates = [...prioritizedCandidates.entries()]
    .map(([matchId, entry]) => ({ matchId, ...entry }))
    .sort((left, right) => right.matchPriorityScore - left.matchPriorityScore || left.matchId.localeCompare(right.matchId))
    .slice(0, maxUniqueMatchesToClassify);

  let classifiedCount = 0;
  let nextProgressLogAt = Math.min(100, orderedCandidates.length);
  let nextIndex = 0;

  const classifyCandidate = async (candidate: { matchId: string; discovery: CompetitiveSeedMatchDiscovery; matchPriorityScore: number }) => {
    const { matchId, discovery } = candidate;
    const cachedMetadata = matchMetadataCache.get(matchId);
    const cachedGameCreationAt = cachedMetadata?.gameCreationAt ? new Date(cachedMetadata.gameCreationAt) : null;
    let gameCreationAt = cachedGameCreationAt;
    let effectivePatch = cachedMetadata?.patch ?? null;
    let effectiveQueueId = cachedMetadata?.queueId ?? null;
    let hasTargetParticipant = cachedMetadata?.targetParticipantPresent ?? false;

    if (!cachedMetadata || cachedMetadata.targetParticipantPresent !== true) {
      try {
        const match = await riotApiClient.getMatchByIdOnRegion(matchId, discovery.region);
        const info = match as {
          info?: {
            participants?: Array<{ puuid?: string }>;
          };
        };
        hasTargetParticipant = Boolean(info.info?.participants?.some((participant) => participant.puuid === discovery.puuid));
        effectivePatch = normalizePatch(match);
        effectiveQueueId = normalizeQueueId(match);
        gameCreationAt = normalizeGameCreationAt(match);
        matchMetadataCache.set(matchId, {
          patch: effectivePatch,
          queueId: effectiveQueueId,
          gameCreationAt: gameCreationAt?.toISOString() ?? null,
          targetParticipantPresent: hasTargetParticipant,
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
        return;
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
      acceptedByPolicy: hasTargetParticipant && policyResult.accepted,
      acceptedReason: hasTargetParticipant ? policyResult.acceptedReason : null,
      rejectionReason: hasTargetParticipant ? policyResult.rejectionReason : "target-participant-missing",
      fallbackReason: policyResult.fallbackReason,
      policyMode: policyResult.policyMode,
      policyBucket: policyResult.patchBucket,
      queueBucket: policyResult.queueBucket,
      sourceBucket: policyResult.sourceBucket,
      priorityBand: policyResult.priorityBand,
      matchPriorityScore,
    });
  };

  const workers = Array.from({ length: Math.min(concurrency, orderedCandidates.length) }, async () => {
    for (;;) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= orderedCandidates.length) {
        break;
      }
      const candidate = orderedCandidates[currentIndex]!;
      classifiedCount += 1;
      if (classifiedCount >= nextProgressLogAt || classifiedCount === orderedCandidates.length) {
        console.info(
          `[competitive-ingestion] classify-progress classified=${classifiedCount}/${orderedCandidates.length} matchId=${candidate.matchId}`,
        );
        await options?.onProgress?.({
          classifiedUniqueMatches: classifiedCount,
          maxUniqueMatchesToClassify,
          discoveredMatches,
          currentMatchId: candidate.matchId,
        });
        nextProgressLogAt = Math.min(orderedCandidates.length, nextProgressLogAt + 100);
      }
      await classifyCandidate(candidate);
    }
  });

  await Promise.all(workers);

  discoveredMatches.sort((left, right) => right.matchPriorityScore - left.matchPriorityScore || left.matchId.localeCompare(right.matchId));

  return discoveredMatches;
}

export function buildRejectedMatches(discoveredMatches: CompetitiveDiscoveredMatch[]) {
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

export function buildSourceMetadata(
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
