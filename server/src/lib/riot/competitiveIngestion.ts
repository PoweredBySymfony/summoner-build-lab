import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Role } from "@prisma/client";

import { classifyPatchBucket as classifyCanonicalPatchBucket } from "./patchCanonical.js";
import type { CompetitiveSeed, CompetitiveSeedPriorityTier } from "./competitiveSeeds.js";
import type { RiotPlatform, RiotRegion } from "./routing.js";

export type CompetitivePolicyMode = "strict_recent_competitive" | "recent_preferred_with_controlled_fallback";
export type CompetitivePatchBucket = "exact_target_patch" | "adjacent_recent_patch" | "out_of_target_patch";
export type CompetitiveQueueBucket = "preferred_queue" | "fallback_queue" | "out_of_policy_queue";
export type CompetitiveSourceBucket = CompetitiveSeedPriorityTier;
export type CompetitivePriorityBand = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

export type CompetitivePolicyTierConfig = {
  id: CompetitivePriorityBand;
  enabled: boolean;
  sourceBuckets: CompetitiveSourceBucket[];
  patchBuckets: CompetitivePatchBucket[];
  queueBuckets: CompetitiveQueueBucket[];
  acceptedReason: string;
  fallbackReason: string | null;
};

export type CompetitiveIngestionPolicyConfig = {
  version: 1;
  policyName: string;
  mode: CompetitivePolicyMode;
  preferredPatchPrefixes: string[];
  acceptedAdjacentPatchPrefixes: string[];
  preferredQueues: number[];
  acceptedFallbackQueues: number[];
  seasonWindowStart: string;
  seasonWindowEnd: string | null;
  autoEnrichEliteIfNeeded: boolean;
  allowFallbackTier5: boolean;
  fallbackCaps: {
    maxAdjacentPatchShare: number;
    maxNonProShare: number;
    maxImportsByTier: Partial<Record<CompetitivePriorityBand, number>>;
  };
  priorityTiers: CompetitivePolicyTierConfig[];
  whyZeroBefore: string;
  whatWasRelaxed: string;
};

export type CompetitiveIngestionPolicyRuntime = CompetitiveIngestionPolicyConfig & {
  seasonWindowStartMs: number;
  seasonWindowEndMs: number | null;
};

export type CompetitivePolicyDecision = {
  policyMode: CompetitivePolicyMode;
  sourceBucket: CompetitiveSourceBucket;
  patchBucket: CompetitivePatchBucket;
  queueBucket: CompetitiveQueueBucket;
  accepted: boolean;
  acceptedReason: string | null;
  rejectionReason: string | null;
  fallbackReason: string | null;
  priorityBand: CompetitivePriorityBand | null;
};

export type CompetitiveResolvedSeed = CompetitiveSeed & {
  resolutionStatus: "resolved" | "unresolved";
  resolutionError: string | null;
  resolutionSource: "seed-puuid" | "seed-riot-id" | "candidate-riot-id" | null;
  resolvedRiotId: string | null;
  puuid: string | null;
  platformHint: RiotPlatform | null;
  cluster: RiotRegion | null;
};

export type CompetitiveDiscoveryQueueState = {
  nextStart: number;
  requests: number;
  exhausted: boolean;
};

export type CompetitiveSeedMatchDiscovery = {
  seedKey: string;
  playerName: string;
  team: string;
  league: string;
  competition: string;
  role: string;
  priorityTier: CompetitiveSeedPriorityTier;
  priorityScore: number;
  puuid: string;
  region: RiotRegion;
  matchIds: string[];
  querySignature?: string;
  appliedFilters?: {
    queues: number[];
    startTime: number | null;
    endTime: number | null;
    pageSize: number;
    maxIdsPerSeed: number;
  };
  scanStateByQueue?: Record<string, CompetitiveDiscoveryQueueState>;
};

export type CompetitiveCachedMatchMetadata = {
  patch: string | null;
  queueId: number | null;
  gameCreationAt: string | null;
  targetParticipantPresent?: boolean;
};

export type CompetitiveDiscoveredMatch = {
  matchId: string;
  seedKey: string;
  playerName: string;
  team: string;
  league: string;
  competition: string;
  role: string;
  priorityTier: CompetitiveSeedPriorityTier;
  priorityScore: number;
  platform: RiotPlatform | null;
  cluster: RiotRegion;
  queueId: number | null;
  patch: string | null;
  gameCreationAt: string | null;
  acceptedByPolicy: boolean;
  acceptedReason: string | null;
  rejectionReason: string | null;
  fallbackReason: string | null;
  policyMode: CompetitivePolicyMode;
  policyBucket: CompetitivePatchBucket;
  queueBucket: CompetitiveQueueBucket;
  sourceBucket: CompetitiveSourceBucket;
  priorityBand: CompetitivePriorityBand | null;
  matchPriorityScore: number;
};

export type CompetitiveRejectedMatch = {
  matchId: string;
  seedKey: string;
  reason: string;
  patch: string | null;
  queueId: number | null;
  priorityTier: CompetitiveSeedPriorityTier;
  gameCreationAt: string | null;
  policyBucket: CompetitivePatchBucket;
  queueBucket: CompetitiveQueueBucket;
  sourceBucket: CompetitiveSourceBucket;
  priorityBand: CompetitivePriorityBand | null;
};

export type CompetitiveIngestionAttemptSummary = {
  matchId: string;
  seedKey: string;
  playerName: string;
  team: string;
  league: string;
  competition: string;
  role: string;
  region: string;
  priorityTier: CompetitiveSeedPriorityTier;
  patch: string | null;
  queueId: number | null;
  policyBucket: CompetitivePatchBucket;
  queueBucket: CompetitiveQueueBucket;
  sourceBucket: CompetitiveSourceBucket;
  priorityBand: CompetitivePriorityBand | null;
  timelineAvailable: boolean;
  timelineMissingReason: string | null;
  targetChampionSlug: string | null;
  targetRole: Role | null;
  gameCreationAt: string | null;
  created: boolean;
  failureReason: string | null;
};

export type CompetitivePolicyDecisionCheckpoint = Record<
  string,
  Pick<
    CompetitiveDiscoveredMatch,
    | "acceptedByPolicy"
    | "acceptedReason"
    | "rejectionReason"
    | "fallbackReason"
    | "policyMode"
    | "policyBucket"
    | "queueBucket"
    | "sourceBucket"
    | "priorityBand"
  >
>;

export type CompetitiveSeedResolutionSummary = {
  totalSeeds: number;
  resolved: number;
  unresolved: number;
};

export type CompetitiveSeedDiscoverySummary = {
  resolvedButNoMatches: number;
  resolvedButRejectedByPolicy: number;
  resolvedWithAcceptedMatches: number;
};

export type CompetitiveIngestionCheckpoint = {
  version: 2 | 3;
  generatedAt: string;
  seedSetVersion: string;
  targetUniqueMatches: number;
  classificationBudget?: number;
  queueWhitelist: number[];
  patchAllowPrefixes: string[];
  seasonWindow: {
    startTime: number;
    endTime: number | null;
  };
  policyMode?: CompetitivePolicyMode;
  openedFallbackTiers?: string[];
  discoveryStopReason?: string | null;
  seedResolutionSummary?: CompetitiveSeedResolutionSummary;
  seedDiscoverySummary?: CompetitiveSeedDiscoverySummary;
  policyDecisionByMatchId?: CompetitivePolicyDecisionCheckpoint;
  importCountsByTier?: Record<string, number>;
  importCountsByPatchBucket?: Record<string, number>;
  importCountsByQueueBucket?: Record<string, number>;
  matchMetadataById?: Record<string, CompetitiveCachedMatchMetadata>;
  resolvedSeeds: CompetitiveResolvedSeed[];
  discoveredMatches: CompetitiveSeedMatchDiscovery[];
  attemptedMatchIds: string[];
  importedMatchIds: string[];
  rejectedMatchIds: CompetitiveRejectedMatch[];
  failedMatches: CompetitiveIngestionAttemptSummary[];
};

export type CompetitiveIngestionReportRow = {
  patch: string | null;
  queueId: number | null;
  timelineMissingReason: string | null;
  gameCreationAt: Date | null;
  timelineFetchedAt: Date | null;
  targetRole: Role | null;
  sourceKind: string | null;
  sourceLeague: string | null;
  sourceCompetition: string | null;
  sourceRegion: string | null;
  priorityTier: string | null;
  patchBucket?: CompetitivePatchBucket | null;
  queueBucket?: CompetitiveQueueBucket | null;
  priorityBand?: CompetitivePriorityBand | null;
};

export type CompetitiveIngestionReportInput = {
  persistedRows: CompetitiveIngestionReportRow[];
  discoveredMatches?: CompetitiveDiscoveredMatch[];
  discoveries?: CompetitiveSeedMatchDiscovery[];
  resolvedSeeds?: CompetitiveResolvedSeed[];
  failedMatches?: CompetitiveIngestionAttemptSummary[];
  openedFallbackTiers?: string[];
  whyZeroBefore?: string;
  whatWasRelaxed?: string;
};

const REPORT_PREFERRED_PATCH_PREFIXES = ["26."];
const REPORT_ADJACENT_PATCH_PREFIXES = ["26.6", "26.5", "26.4", "26.3", "26.2"];

const SOURCE_WEIGHTS: Record<CompetitiveSeedPriorityTier, number> = {
  pro: 4_000_000_000,
  elite: 3_000_000_000,
  fallback: 2_000_000_000,
};
const PATCH_WEIGHTS: Record<CompetitivePatchBucket, number> = {
  exact_target_patch: 500_000_000,
  adjacent_recent_patch: 250_000_000,
  out_of_target_patch: 0,
};
const QUEUE_WEIGHTS: Record<CompetitiveQueueBucket, number> = {
  preferred_queue: 50_000_000,
  fallback_queue: 10_000_000,
  out_of_policy_queue: 0,
};
const BAND_WEIGHTS: Record<CompetitivePriorityBand, number> = {
  tier1: 5_000_000,
  tier2: 4_000_000,
  tier3: 3_000_000,
  tier4: 2_000_000,
  tier5: 1_000_000,
};

export function buildCompetitiveSeedKey(
  seed: Pick<CompetitiveSeed, "playerName" | "team" | "league" | "role" | "priorityTier">,
) {
  return `${seed.playerName}::${seed.team}::${seed.league}::${seed.role}::${seed.priorityTier}`;
}

export async function loadCompetitiveIngestionPolicy(policyPath: string) {
  const raw = await readFile(policyPath, "utf-8");
  return JSON.parse(raw) as CompetitiveIngestionPolicyConfig;
}

export function resolveCompetitiveIngestionPolicy(
  policy: CompetitiveIngestionPolicyConfig,
): CompetitiveIngestionPolicyRuntime {
  return {
    ...policy,
    seasonWindowStartMs: Date.parse(policy.seasonWindowStart),
    seasonWindowEndMs: policy.seasonWindowEnd ? Date.parse(policy.seasonWindowEnd) : null,
  };
}

function classifyPatchBucket(
  patch: string | null,
  policy: CompetitiveIngestionPolicyRuntime,
): CompetitivePatchBucket {
  return classifyCanonicalPatchBucket(
    patch,
    policy.preferredPatchPrefixes,
    policy.acceptedAdjacentPatchPrefixes,
  );
}

function classifyQueueBucket(
  queueId: number | null,
  policy: CompetitiveIngestionPolicyRuntime,
): CompetitiveQueueBucket {
  if (queueId !== null && policy.preferredQueues.includes(queueId)) {
    return "preferred_queue";
  }
  if (queueId !== null && policy.acceptedFallbackQueues.includes(queueId)) {
    return "fallback_queue";
  }
  return "out_of_policy_queue";
}

function resolvePriorityBand(
  sourceBucket: CompetitiveSourceBucket,
  patchBucket: CompetitivePatchBucket,
  queueBucket: CompetitiveQueueBucket,
  policy: CompetitiveIngestionPolicyRuntime,
): CompetitivePriorityBand | null {
  for (const tier of policy.priorityTiers) {
    if (!tier.enabled) {
      continue;
    }
    if (!policy.allowFallbackTier5 && tier.id === "tier5") {
      continue;
    }
    if (
      tier.sourceBuckets.includes(sourceBucket)
      && tier.patchBuckets.includes(patchBucket)
      && tier.queueBuckets.includes(queueBucket)
    ) {
      return tier.id;
    }
  }
  return null;
}

function resolveTierConfig(
  priorityBand: CompetitivePriorityBand | null,
  policy: CompetitiveIngestionPolicyRuntime,
) {
  if (!priorityBand) {
    return null;
  }
  return policy.priorityTiers.find((tier) => tier.id === priorityBand) ?? null;
}

function makeRejectedDecision(
  policyMode: CompetitivePolicyMode,
  sourceBucket: CompetitiveSourceBucket,
  patchBucket: CompetitivePatchBucket,
  queueBucket: CompetitiveQueueBucket,
  rejectionReason: string,
): CompetitivePolicyDecision {
  return { policyMode, sourceBucket, patchBucket, queueBucket, accepted: false, acceptedReason: null, rejectionReason, fallbackReason: null, priorityBand: null };
}

function buildStrictDecision(
  policyMode: CompetitivePolicyMode,
  sourceBucket: CompetitiveSourceBucket,
  patchBucket: CompetitivePatchBucket,
  queueBucket: CompetitiveQueueBucket,
  priorityBand: CompetitivePriorityBand,
): CompetitivePolicyDecision {
  const strictAccepted = patchBucket === "exact_target_patch" && queueBucket === "preferred_queue";
  return {
    policyMode,
    sourceBucket,
    patchBucket,
    queueBucket,
    accepted: strictAccepted,
    acceptedReason: strictAccepted ? "strict-target-match" : null,
    rejectionReason: strictAccepted ? null : "strict-mode-reject",
    fallbackReason: null,
    priorityBand: strictAccepted ? priorityBand : null,
  };
}

export function evaluateCompetitiveMatchPolicy(
  input: {
    patch: string | null;
    queueId: number | null;
    gameCreationAt: Date | null;
    priorityTier: CompetitiveSeedPriorityTier;
  },
  policy: CompetitiveIngestionPolicyRuntime,
): CompetitivePolicyDecision {
  const sourceBucket: CompetitiveSourceBucket = input.priorityTier;
  const patchBucket = classifyPatchBucket(input.patch, policy);
  const queueBucket = classifyQueueBucket(input.queueId, policy);

  if (!input.gameCreationAt) {
    return makeRejectedDecision(policy.mode, sourceBucket, patchBucket, queueBucket, "game-creation-missing");
  }
  const gameCreationAtMs = input.gameCreationAt.getTime();
  if (gameCreationAtMs < policy.seasonWindowStartMs) {
    return makeRejectedDecision(policy.mode, sourceBucket, patchBucket, queueBucket, "before-season-window");
  }
  if (policy.seasonWindowEndMs && gameCreationAtMs > policy.seasonWindowEndMs) {
    return makeRejectedDecision(policy.mode, sourceBucket, patchBucket, queueBucket, "after-season-window");
  }
  if (queueBucket === "out_of_policy_queue") {
    return makeRejectedDecision(policy.mode, sourceBucket, patchBucket, queueBucket, "queue-not-allowed");
  }
  if (patchBucket === "out_of_target_patch") {
    return makeRejectedDecision(policy.mode, sourceBucket, patchBucket, queueBucket, "patch-not-allowed");
  }
  const priorityBand = resolvePriorityBand(sourceBucket, patchBucket, queueBucket, policy);
  if (!priorityBand) {
    return makeRejectedDecision(policy.mode, sourceBucket, patchBucket, queueBucket, "source-tier-disabled");
  }
  if (policy.mode === "strict_recent_competitive") {
    return buildStrictDecision(policy.mode, sourceBucket, patchBucket, queueBucket, priorityBand);
  }
  const tierConfig = resolveTierConfig(priorityBand, policy);
  return {
    policyMode: policy.mode,
    sourceBucket,
    patchBucket,
    queueBucket,
    accepted: Boolean(tierConfig),
    acceptedReason: tierConfig?.acceptedReason ?? null,
    rejectionReason: tierConfig ? null : "policy-tier-missing",
    fallbackReason: tierConfig?.fallbackReason ?? null,
    priorityBand: tierConfig ? priorityBand : null,
  };
}

export function scoreCompetitiveMatch(input: {
  priorityTier: CompetitiveSeedPriorityTier;
  priorityScore: number;
  patch: string | null;
  gameCreationAt: Date | null;
  patchBucket: CompetitivePatchBucket;
  queueBucket: CompetitiveQueueBucket;
  priorityBand: CompetitivePriorityBand | null;
}) {
  const sourceWeight = SOURCE_WEIGHTS[input.priorityTier];
  const patchWeight = PATCH_WEIGHTS[input.patchBucket];
  const queueWeight = QUEUE_WEIGHTS[input.queueBucket];
  const bandWeight = input.priorityBand ? (BAND_WEIGHTS[input.priorityBand] ?? 0) : 0;
  const recencyWeight = input.gameCreationAt ? Math.floor(input.gameCreationAt.getTime() / 60_000) : 0;
  return sourceWeight + patchWeight + queueWeight + bandWeight + input.priorityScore * 1_000 + recencyWeight;
}

function countBy<T>(values: T[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    const key = String(value);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function buildOrderedBandList(policy: CompetitiveIngestionPolicyRuntime) {
  if (policy.mode === "strict_recent_competitive") {
    return policy.priorityTiers
      .filter((tier) => tier.enabled && tier.patchBuckets.every((bucket) => bucket === "exact_target_patch"))
      .map((tier) => tier.id);
  }

  return policy.priorityTiers
    .filter((tier) => tier.enabled && (policy.allowFallbackTier5 || tier.id !== "tier5"))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((tier) => tier.id);
}

function getBandActivationLabel(band: string): string {
  const labels: Record<string, string> = {
    tier2: "fallback-opened: pro_adjacent_patch",
    tier3: "fallback-opened: elite_exact_patch",
    tier4: "fallback-opened: elite_adjacent_patch",
  };
  return labels[band] ?? "fallback-opened: fallback_exact_patch";
}

export function determineOpenedFallbackTiers(input: {
  matches: CompetitiveDiscoveredMatch[];
  targetUniqueMatches: number;
  alreadyCountedMatchIds?: Set<string>;
  policy: CompetitiveIngestionPolicyRuntime;
}) {
  const orderedBands = buildOrderedBandList(input.policy);
  const seenMatchIds = input.alreadyCountedMatchIds ?? new Set<string>();
  const opened: string[] = [];
  const activeBands: CompetitivePriorityBand[] = [];
  let available = 0;

  for (const band of orderedBands) {
    activeBands.push(band);
    const bandAvailable = new Set(
      input.matches
        .filter((match) => match.acceptedByPolicy && match.priorityBand === band && !seenMatchIds.has(match.matchId))
        .map((match) => match.matchId),
    ).size;
    available += bandAvailable;

    if (band !== "tier1") {
      opened.push(getBandActivationLabel(band));
    }

    if (input.policy.mode === "strict_recent_competitive" || available >= input.targetUniqueMatches) {
      break;
    }
  }

  return {
    activeBands,
    openedFallbackTiers: opened,
  };
}

function canSelectWithCaps(input: {
  candidate: CompetitiveDiscoveredMatch;
  selected: CompetitiveDiscoveredMatch[];
  targetUniqueMatches: number;
  policy: CompetitiveIngestionPolicyRuntime;
}) {
  const { candidate, selected, targetUniqueMatches, policy } = input;
  const adjacentSelected = selected.filter((entry) => entry.policyBucket === "adjacent_recent_patch").length;
  const nonProSelected = selected.filter((entry) => entry.sourceBucket !== "pro").length;
  const tierSelected = selected.filter((entry) => entry.priorityBand === candidate.priorityBand).length;

  if (
    candidate.policyBucket === "adjacent_recent_patch"
    && adjacentSelected + 1 > Math.ceil(targetUniqueMatches * policy.fallbackCaps.maxAdjacentPatchShare)
  ) {
    return false;
  }

  if (
    candidate.sourceBucket !== "pro"
    && nonProSelected + 1 > Math.ceil(targetUniqueMatches * policy.fallbackCaps.maxNonProShare)
  ) {
    return false;
  }

  const maxForTier = candidate.priorityBand
    ? policy.fallbackCaps.maxImportsByTier[candidate.priorityBand]
    : undefined;
  if (typeof maxForTier === "number" && tierSelected + 1 > maxForTier) {
    return false;
  }

  return true;
}

function runQueueSelectionRound(
  groupKeys: string[],
  grouped: Map<string, CompetitiveDiscoveredMatch[]>,
  queue: CompetitiveDiscoveredMatch[],
  seen: Set<string>,
  targetUniqueMatches: number,
  policy: CompetitiveIngestionPolicyRuntime,
): boolean {
  let progressed = false;
  for (const groupKey of groupKeys) {
    const bucket = grouped.get(groupKey);
    if (!bucket?.length) continue;
    const next = bucket.shift()!;
    if (seen.has(next.matchId)) continue;
    if (!canSelectWithCaps({ candidate: next, selected: queue, targetUniqueMatches, policy })) continue;
    seen.add(next.matchId);
    queue.push(next);
    progressed = true;
    if (queue.length >= targetUniqueMatches) break;
  }
  return progressed;
}

export function buildCompetitiveMatchQueue(input: {
  matches: CompetitiveDiscoveredMatch[];
  targetUniqueMatches: number;
  policy: CompetitiveIngestionPolicyRuntime;
  activeBands: CompetitivePriorityBand[];
  excludedMatchIds?: Set<string>;
}) {
  const grouped = new Map<string, CompetitiveDiscoveredMatch[]>();
  const excludedMatchIds = input.excludedMatchIds ?? new Set<string>();
  for (const match of input.matches) {
    if (
      !match.acceptedByPolicy
      || !match.priorityBand
      || !input.activeBands.includes(match.priorityBand)
      || excludedMatchIds.has(match.matchId)
    ) {
      continue;
    }
    const key = `${match.priorityBand}::${match.league || "unknown"}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(match);
    grouped.set(key, bucket);
  }

  for (const [key, bucket] of grouped.entries()) {
    grouped.set(key, [...bucket].sort((left, right) => right.matchPriorityScore - left.matchPriorityScore || left.matchId.localeCompare(right.matchId)));
  }

  const groupKeys = [...grouped.keys()].sort((left, right) => {
    const [leftBand, leftLeague] = left.split("::");
    const [rightBand, rightLeague] = right.split("::");
    return input.activeBands.indexOf(leftBand as CompetitivePriorityBand) - input.activeBands.indexOf(rightBand as CompetitivePriorityBand)
      || leftLeague.localeCompare(rightLeague);
  });

  const queue: CompetitiveDiscoveredMatch[] = [];
  const seen = new Set<string>();

  while (queue.length < input.targetUniqueMatches) {
    if (!runQueueSelectionRound(groupKeys, grouped, queue, seen, input.targetUniqueMatches, input.policy)) break;
  }

  return queue;
}

export function buildSeedSummaries(input: {
  resolvedSeeds: CompetitiveResolvedSeed[];
  discoveries: CompetitiveSeedMatchDiscovery[];
  discoveredMatches: CompetitiveDiscoveredMatch[];
}) {
  const discoveryIndex = new Map(input.discoveries.map((entry) => [entry.seedKey, entry]));
  const matchIndex = new Map<string, CompetitiveDiscoveredMatch[]>();
  for (const match of input.discoveredMatches) {
    const bucket = matchIndex.get(match.seedKey) ?? [];
    bucket.push(match);
    matchIndex.set(match.seedKey, bucket);
  }

  let resolvedButNoMatches = 0;
  let resolvedButRejectedByPolicy = 0;
  let resolvedWithAcceptedMatches = 0;

  for (const seed of input.resolvedSeeds.filter((entry) => entry.resolutionStatus === "resolved")) {
    const seedKey = buildCompetitiveSeedKey(seed);
    const discovery = discoveryIndex.get(seedKey);
    const matches = matchIndex.get(seedKey) ?? [];
    if (!discovery || discovery.matchIds.length === 0) {
      resolvedButNoMatches += 1;
      continue;
    }
    if (matches.every((match) => !match.acceptedByPolicy)) {
      resolvedButRejectedByPolicy += 1;
      continue;
    }
    resolvedWithAcceptedMatches += 1;
  }

  return {
    seedResolutionSummary: {
      totalSeeds: input.resolvedSeeds.length,
      resolved: input.resolvedSeeds.filter((entry) => entry.resolutionStatus === "resolved").length,
      unresolved: input.resolvedSeeds.filter((entry) => entry.resolutionStatus !== "resolved").length,
    } satisfies CompetitiveSeedResolutionSummary,
    seedDiscoverySummary: {
      resolvedButNoMatches,
      resolvedButRejectedByPolicy,
      resolvedWithAcceptedMatches,
    } satisfies CompetitiveSeedDiscoverySummary,
  };
}

export async function saveCompetitiveIngestionCheckpoint(
  checkpointPath: string,
  checkpoint: CompetitiveIngestionCheckpoint,
) {
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), "utf-8");
}

export async function loadCompetitiveIngestionCheckpoint(checkpointPath: string) {
  try {
    const raw = await readFile(checkpointPath, "utf-8");
    return JSON.parse(raw) as CompetitiveIngestionCheckpoint;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

type IngestionReportAccumulator = {
  patchCounts: Map<string, number>;
  queueCounts: Map<string, number>;
  leagueCounts: Map<string, number>;
  regionCounts: Map<string, number>;
  tierCounts: Map<string, number>;
  roleCounts: Map<string, number>;
  patchBucketCounts: Map<string, number>;
  queueBucketCounts: Map<string, number>;
  priorityBandCounts: Map<string, number>;
  missingCounts: Map<string, number>;
  timelineCount: number;
  exactTargetCount: number;
  adjacentPatchCount: number;
  outOfTargetCount: number;
  proCount: number;
  eliteCount: number;
  fallbackCount: number;
  minGameDate: Date | null;
  maxGameDate: Date | null;
};

function classifyRowQueueBucket(row: CompetitiveIngestionReportRow): string {
  if (row.queueBucket) return row.queueBucket;
  if (row.queueId === 420) return "preferred_queue";
  if (row.queueId === 440) return "fallback_queue";
  return "out_of_policy_queue";
}

function incrementMap(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function accumulateReportRow(row: CompetitiveIngestionReportRow, acc: IngestionReportAccumulator): void {
  const effectivePatchBucket = classifyCanonicalPatchBucket(row.patch, REPORT_PREFERRED_PATCH_PREFIXES, REPORT_ADJACENT_PATCH_PREFIXES);
  const effectiveQueueBucket = classifyRowQueueBucket(row);
  incrementMap(acc.patchCounts, row.patch ?? "unknown");
  incrementMap(acc.queueCounts, String(row.queueId ?? "unknown"));
  incrementMap(acc.leagueCounts, row.sourceLeague ?? "unknown");
  incrementMap(acc.regionCounts, row.sourceRegion ?? "unknown");
  incrementMap(acc.tierCounts, row.priorityTier ?? "unknown");
  incrementMap(acc.roleCounts, row.targetRole ?? "UNKNOWN");
  incrementMap(acc.patchBucketCounts, effectivePatchBucket);
  incrementMap(acc.queueBucketCounts, effectiveQueueBucket);
  incrementMap(acc.priorityBandCounts, row.priorityBand ?? "unknown");
  if (effectivePatchBucket === "exact_target_patch") {
    acc.exactTargetCount += 1;
  } else if (effectivePatchBucket === "adjacent_recent_patch") {
    acc.adjacentPatchCount += 1;
  } else {
    acc.outOfTargetCount += 1;
  }
  if (row.priorityTier === "pro") {
    acc.proCount += 1;
  } else if (row.priorityTier === "elite") {
    acc.eliteCount += 1;
  } else if (row.priorityTier === "fallback") {
    acc.fallbackCount += 1;
  }
  if (row.timelineFetchedAt) {
    acc.timelineCount += 1;
  } else {
    incrementMap(acc.missingCounts, row.timelineMissingReason ?? "unknown");
  }
  if (row.gameCreationAt && (!acc.minGameDate || row.gameCreationAt < acc.minGameDate)) {
    acc.minGameDate = row.gameCreationAt;
  }
  if (row.gameCreationAt && (!acc.maxGameDate || row.gameCreationAt > acc.maxGameDate)) {
    acc.maxGameDate = row.gameCreationAt;
  }
}

export function buildCompetitiveIngestionReport(input: CompetitiveIngestionReportInput) {
  const { persistedRows, discoveredMatches = [], discoveries = [], resolvedSeeds = [], failedMatches = [] } = input;
  const acc: IngestionReportAccumulator = {
    patchCounts: new Map(),
    queueCounts: new Map(),
    leagueCounts: new Map(),
    regionCounts: new Map(),
    tierCounts: new Map(),
    roleCounts: new Map(),
    patchBucketCounts: new Map(),
    queueBucketCounts: new Map(),
    priorityBandCounts: new Map(),
    missingCounts: new Map(),
    timelineCount: 0,
    exactTargetCount: 0,
    adjacentPatchCount: 0,
    outOfTargetCount: 0,
    proCount: 0,
    eliteCount: 0,
    fallbackCount: 0,
    minGameDate: null,
    maxGameDate: null,
  };

  for (const row of persistedRows) {
    accumulateReportRow(row, acc);
  }

  const {
    patchCounts, queueCounts, leagueCounts, regionCounts, tierCounts, roleCounts,
    patchBucketCounts, queueBucketCounts, priorityBandCounts, missingCounts,
    timelineCount, exactTargetCount, adjacentPatchCount, outOfTargetCount,
    proCount, eliteCount, fallbackCount, minGameDate, maxGameDate,
  } = acc;

  const discovered = new Set(discoveredMatches.map((entry) => entry.matchId)).size;
  const discoveredAfterTimeFilter = new Set(
    discoveredMatches
      .filter((entry) => entry.rejectionReason !== "before-season-window" && entry.rejectionReason !== "after-season-window")
      .map((entry) => entry.matchId),
  ).size;
  const policyAccepted = new Set(
    discoveredMatches.filter((entry) => entry.acceptedByPolicy).map((entry) => entry.matchId),
  ).size;
  const rejectedByPolicy = new Set(
    discoveredMatches.filter((entry) => !entry.acceptedByPolicy).map((entry) => entry.matchId),
  ).size;
  const rejectedUniqueReasonCounts = new Map<string, number>();
  for (const match of discoveredMatches.filter((entry) => !entry.acceptedByPolicy)) {
    const reason = match.rejectionReason ?? "policy-rejected";
    const key = `${reason}::${match.matchId}`;
    if (rejectedUniqueReasonCounts.has(key)) {
      continue;
    }
    rejectedUniqueReasonCounts.set(key, 1);
  }
  const rejectedCountsByReason = [...rejectedUniqueReasonCounts.keys()].reduce<Record<string, number>>((accumulator, key) => {
    const [reason] = key.split("::");
    accumulator[reason] = (accumulator[reason] ?? 0) + 1;
    return accumulator;
  }, {});
  const rejectedUniqueTotal = Object.values(rejectedCountsByReason).reduce((sum, value) => sum + value, 0);

  const discoveredByTier = countBy(discoveredMatches.map((entry) => entry.sourceBucket));
  const discoveredByPatchBucket = countBy(discoveredMatches.map((entry) => entry.policyBucket));
  const discoveredByQueueBucket = countBy(discoveredMatches.map((entry) => entry.queueBucket));

  const seedSummaries = buildSeedSummaries({
    resolvedSeeds,
    discoveries,
    discoveredMatches,
  });

  return {
    totalMatches: persistedRows.length,
    totalTimelineMatches: timelineCount,
    timelineCoveragePercent: persistedRows.length > 0 ? (timelineCount / persistedRows.length) * 100 : 0,
    matchesImportedExactTargetPatch: exactTargetCount,
    matchesImportedAdjacentRecentPatch: adjacentPatchCount,
    matchesImportedOutOfTargetPatch: outOfTargetCount,
    matchesImportedPro: proCount,
    matchesImportedElite: eliteCount,
    matchesImportedFallback: fallbackCount,
    patchDistribution: [...patchCounts.entries()].map(([patch, count]) => ({ patch, count }))
      .sort((left, right) => right.count - left.count || left.patch.localeCompare(right.patch)),
    queueDistribution: [...queueCounts.entries()].map(([queueId, count]) => ({ queueId, count }))
      .sort((left, right) => right.count - left.count || left.queueId.localeCompare(right.queueId)),
    leagueDistribution: [...leagueCounts.entries()].map(([league, count]) => ({ league, count }))
      .sort((left, right) => right.count - left.count || left.league.localeCompare(right.league)),
    regionDistribution: [...regionCounts.entries()].map(([region, count]) => ({ region, count }))
      .sort((left, right) => right.count - left.count || left.region.localeCompare(right.region)),
    tierDistribution: [...tierCounts.entries()].map(([tier, count]) => ({ tier, count }))
      .sort((left, right) => right.count - left.count || left.tier.localeCompare(right.tier)),
    roleDistribution: [...roleCounts.entries()].map(([role, count]) => ({ role, count }))
      .sort((left, right) => right.count - left.count || left.role.localeCompare(right.role)),
    patchBucketDistribution: [...patchBucketCounts.entries()].map(([bucket, count]) => ({ bucket, count }))
      .sort((left, right) => right.count - left.count || left.bucket.localeCompare(right.bucket)),
    queueBucketDistribution: [...queueBucketCounts.entries()].map(([bucket, count]) => ({ bucket, count }))
      .sort((left, right) => right.count - left.count || left.bucket.localeCompare(right.bucket)),
    priorityBandDistribution: [...priorityBandCounts.entries()].map(([band, count]) => ({ band, count }))
      .sort((left, right) => right.count - left.count || left.band.localeCompare(right.band)),
    timelineMissingReasons: [...missingCounts.entries()].map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
    gameDateRange: {
      min: minGameDate?.toISOString() ?? null,
      max: maxGameDate?.toISOString() ?? null,
    },
    discovered,
    discoveredUniqueMatchesAfterTimeFilter: discoveredAfterTimeFilter,
    policyAccepted,
    rejectedByPolicy,
    rejectedByReason: rejectedCountsByReason,
    rejectedReasonFractions: {
      beforeSeasonWindow:
        rejectedUniqueTotal > 0 ? (rejectedCountsByReason["before-season-window"] ?? 0) / rejectedUniqueTotal : 0,
      patchNotAllowed:
        rejectedUniqueTotal > 0 ? (rejectedCountsByReason["patch-not-allowed"] ?? 0) / rejectedUniqueTotal : 0,
      queueNotAllowed:
        rejectedUniqueTotal > 0 ? (rejectedCountsByReason["queue-not-allowed"] ?? 0) / rejectedUniqueTotal : 0,
    },
    attempted: failedMatches.length + persistedRows.length,
    imported: persistedRows.length,
    failedFetch: failedMatches.length,
    discoveredByTier,
    discoveredByPatchBucket,
    discoveredByQueueBucket,
    resolvedSeeds: seedSummaries.seedResolutionSummary.resolved,
    unresolvedSeeds: seedSummaries.seedResolutionSummary.unresolved,
    resolvedButNoMatches: seedSummaries.seedDiscoverySummary.resolvedButNoMatches,
    resolvedButRejectedByPolicy: seedSummaries.seedDiscoverySummary.resolvedButRejectedByPolicy,
    resolvedWithAcceptedMatches: seedSummaries.seedDiscoverySummary.resolvedWithAcceptedMatches,
    fallbackActivations: input.openedFallbackTiers ?? [],
    whyZeroBefore: input.whyZeroBefore ?? null,
    whatWasRelaxed: input.whatWasRelaxed ?? null,
    whyStillBlocked:
      persistedRows.length === 0
        ? "No imported matches passed the active policy tiers for this run."
        : null,
  };
}
