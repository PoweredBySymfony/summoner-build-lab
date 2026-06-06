import { PLATFORM_TO_REGION, type RiotPlatform, type RiotRegion } from "./routing.js";
import {
  type ProPlayerSeed,
} from "./proSeeds.js";
import { riotApiClient } from "./riotApiClient.js";

export type CompetitiveSeedPriorityTier = "pro" | "elite" | "fallback";

export type CompetitiveSeed = {
  playerName: string;
  team: string;
  league: string;
  competition: string;
  role: "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
  region: string;
  riotId: string | null;
  riotIdCandidates: string[];
  puuid: string | null;
  priorityTier: CompetitiveSeedPriorityTier;
  priorityScore: number;
  discoverySource: string;
  seedSetVersion: string;
  platformHint: RiotPlatform | null;
  cluster: RiotRegion | null;
  season: string;
  sourceTournamentDate: string | null;
  playerPage?: string | null;
  sourceUrl?: string | null;
};

export type CompetitiveSeedManifest = {
  version: 1;
  generatedAt: string;
  seedSetVersion: string;
  season: string;
  source: "competitive-seed-merge";
  sources: {
    pro: Array<{
      kind: "curated-file" | "leaguepedia-cargo";
      enabled: boolean;
      path?: string;
      cachePath?: string;
      label?: string;
      sourceCount?: number;
    }>;
    elite: Array<{
      platform: RiotPlatform;
      tiers: string[];
      queue: string;
      maxEntriesPerTier: number;
    }>;
  };
  quality?: {
    resolvedSeeds: number;
    resolvedSeedsPercent: number;
    seedsWithRiotIdCandidates: number;
    seedsWithRiotIdCandidatesPercent: number;
    leagueDistribution: Array<{ league: string; count: number }>;
    regionDistribution: Array<{ region: string; count: number }>;
  };
  playerCount: number;
  players: CompetitiveSeed[];
};

export type EliteSeedDiscoveryOptions = {
  platforms: RiotPlatform[];
  queue: "RANKED_SOLO_5x5";
  tiers: Array<"challenger" | "grandmaster" | "master">;
  maxEntriesPerTier: number;
  maxConsecutiveFailures: number;
  season: string;
  seedSetVersion: string;
};

type RiotLeagueEntry = {
  puuid?: string | null;
  summonerId?: string | null;
  summonerName?: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

type RiotLeagueListResponse = {
  tier: string;
  queue: string;
  entries: RiotLeagueEntry[];
};

const ROLE_ROTATION: CompetitiveSeed["role"][] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

export const DEFAULT_COMPETITIVE_SEED_SET_VERSION = "2026-premium-v1";
export const DEFAULT_COMPETITIVE_SEASON = "2026";

export const DEFAULT_ELITE_SEED_PLATFORMS: RiotPlatform[] = ["kr", "euw1", "na1", "br1", "eun1", "jp1", "la1", "la2"];

export const DEFAULT_ELITE_SEED_OPTIONS: EliteSeedDiscoveryOptions = {
  platforms: DEFAULT_ELITE_SEED_PLATFORMS,
  queue: "RANKED_SOLO_5x5",
  tiers: ["challenger", "grandmaster", "master"],
  maxEntriesPerTier: 150,
  maxConsecutiveFailures: 3,
  season: DEFAULT_COMPETITIVE_SEASON,
  seedSetVersion: DEFAULT_COMPETITIVE_SEED_SET_VERSION,
};

function normalizeSeed(seed: CompetitiveSeed) {
  return {
    ...seed,
    team: seed.team.trim(),
    league: seed.league.trim(),
    competition: seed.competition.trim(),
    region: seed.region.trim(),
    riotIdCandidates: [...new Set(seed.riotIdCandidates.filter(Boolean))],
  };
}

function buildCompetitiveSeedKey(seed: Pick<CompetitiveSeed, "puuid" | "riotId" | "playerName" | "team" | "priorityTier">) {
  if (seed.puuid) {
    return `puuid:${seed.puuid}`;
  }
  if (seed.riotId) {
    return `riot:${seed.riotId.toLowerCase()}`;
  }
  return `fallback:${seed.playerName.toLowerCase()}::${seed.team.toLowerCase()}::${seed.priorityTier}`;
}

const PRO_LEAGUE_PRIORITY_RULES: Array<{ includes: string; priority: number }> = [
  { includes: "LoL Champions Korea", priority: 100 },
  { includes: "League of Legends Pro League", priority: 95 },
  { includes: "League of Legends EMEA Championship", priority: 90 },
  { includes: "First Stand", priority: 88 },
  { includes: "Mid-Season Invitational", priority: 87 },
  { includes: "World Championship", priority: 86 },
];

function getProLeaguePriority(league: string) {
  return PRO_LEAGUE_PRIORITY_RULES.find((rule) => league.includes(rule.includes))?.priority ?? 75;
}

function fromProSeed(
  seed: ProPlayerSeed,
  options: {
    seedSetVersion: string;
    season: string;
  },
): CompetitiveSeed {
  return normalizeSeed({
    playerName: seed.playerName,
    playerPage: seed.playerPage,
    team: seed.team,
    league: seed.league,
    competition: seed.competition,
    role: seed.role,
    region: seed.region,
    riotId: seed.riotId,
    riotIdCandidates: seed.riotIdCandidates,
    puuid: seed.puuid,
    priorityTier: "pro",
    priorityScore: getProLeaguePriority(seed.league),
    discoverySource: seed.source,
    seedSetVersion: options.seedSetVersion,
    platformHint: seed.platformHint,
    cluster: seed.cluster,
    season: options.season,
    sourceTournamentDate: seed.sourceTournamentDate,
    sourceUrl: seed.sourceUrl,
  });
}

function inferRoleFromIndex(index: number): CompetitiveSeed["role"] {
  return ROLE_ROTATION[index % ROLE_ROTATION.length];
}

export function getEliteEntryIdentity(entry: Pick<RiotLeagueEntry, "puuid" | "summonerId">) {
  const puuid = typeof entry.puuid === "string" && entry.puuid.trim() ? entry.puuid.trim() : null;
  const summonerId = typeof entry.summonerId === "string" && entry.summonerId.trim() ? entry.summonerId.trim() : null;

  return {
    puuid,
    summonerId,
  };
}

function isEliteAuthFailure(message: string) {
  return /forbidden|authentication failed/i.test(message);
}

function getEliteTierPriorityScore(tier: EliteSeedDiscoveryOptions["tiers"][number]) {
  if (tier === "challenger") {
    return 80;
  }

  return tier === "grandmaster" ? 72 : 64;
}

function sortEliteEntries(entries: RiotLeagueEntry[]) {
  return entries
    .slice()
    .sort((left, right) => right.leaguePoints - left.leaguePoints || right.wins - left.wins);
}

async function resolveEliteEntryPuuid(entry: RiotLeagueEntry, platform: RiotPlatform) {
  const entryIdentity = getEliteEntryIdentity(entry);
  if (entryIdentity.puuid) {
    return entryIdentity.puuid;
  }

  if (!entryIdentity.summonerId) {
    return null;
  }

  const summoner = await riotApiClient.getSummonerBySummonerIdOnPlatform(entryIdentity.summonerId, platform);
  return summoner.puuid;
}

async function buildEliteSeedFromEntry(input: {
  entry: RiotLeagueEntry;
  index: number;
  tier: EliteSeedDiscoveryOptions["tiers"][number];
  platform: RiotPlatform;
  cluster: RiotRegion;
  options: EliteSeedDiscoveryOptions;
}) {
  const resolvedPuuid = await resolveEliteEntryPuuid(input.entry, input.platform);
  if (!resolvedPuuid) {
    console.warn(
      "[competitive-seeds] elite-entry-missing-identity",
      JSON.stringify({
        platform: input.platform,
        tier: input.tier,
        index: input.index,
      }),
    );
    return null;
  }

  const account = await riotApiClient.getAccountByPuuidOnRegion(resolvedPuuid, input.cluster);
  const riotId = account.gameName && account.tagLine
    ? `${account.gameName}#${account.tagLine}`
    : null;

  return normalizeSeed({
    playerName: account.gameName ?? input.entry.summonerName ?? `Elite ${input.platform.toUpperCase()} ${input.index + 1}`,
    team: "soloq-elite",
    league: "Riot Ranked Ladder",
    competition: `${input.platform.toUpperCase()} ${input.tier.toUpperCase()} ${input.options.season}`,
    role: inferRoleFromIndex(input.index),
    region: input.platform.toUpperCase(),
    riotId,
    riotIdCandidates: riotId ? [riotId] : [],
    puuid: resolvedPuuid,
    priorityTier: "elite",
    priorityScore: getEliteTierPriorityScore(input.tier),
    discoverySource: `riot-league-v4:${input.tier}`,
    seedSetVersion: input.options.seedSetVersion,
    platformHint: input.platform,
    cluster: input.cluster,
    season: input.options.season,
    sourceTournamentDate: null,
    sourceUrl: null,
  });
}

function createEliteFailureRecorder(input: {
  platform: RiotPlatform;
  maxConsecutiveFailures: number;
}) {
  let consecutiveFailures = 0;

  return {
    reset() {
      consecutiveFailures = 0;
    },
    record(context: string, error: unknown) {
      consecutiveFailures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        "[competitive-seeds] elite-request-failed",
        JSON.stringify({
          platform: input.platform,
          context,
          consecutiveFailures,
          message,
        }),
      );
      if (consecutiveFailures >= input.maxConsecutiveFailures) {
        throw new Error(
          `Elite seed discovery stopped after ${consecutiveFailures} consecutive failures on ${input.platform}.`,
        );
      }
    },
  };
}

async function fetchEliteTierEntries(input: {
  platform: RiotPlatform;
  options: EliteSeedDiscoveryOptions;
  tier: EliteSeedDiscoveryOptions["tiers"][number];
  failureRecorder: ReturnType<typeof createEliteFailureRecorder>;
}) {
  try {
    const response = await riotApiClient.getLeagueEntriesByQueueOnPlatform(
      input.platform,
      input.options.queue,
      input.tier,
    );
    input.failureRecorder.reset();
    return sortEliteEntries(response.entries).slice(0, input.options.maxEntriesPerTier);
  } catch (error) {
    input.failureRecorder.record(`tier:${input.tier}`, error);
    const message = error instanceof Error ? error.message : String(error);
    if (isEliteAuthFailure(message)) {
      throw error;
    }
    return [];
  }
}

async function buildEliteSeedsForTier(input: {
  platform: RiotPlatform;
  cluster: RiotRegion;
  options: EliteSeedDiscoveryOptions;
  tier: EliteSeedDiscoveryOptions["tiers"][number];
  entries: RiotLeagueEntry[];
  failureRecorder: ReturnType<typeof createEliteFailureRecorder>;
}) {
  const seeds: CompetitiveSeed[] = [];

  for (const [index, entry] of input.entries.entries()) {
    try {
      const seed = await buildEliteSeedFromEntry({
        entry,
        index,
        tier: input.tier,
        platform: input.platform,
        cluster: input.cluster,
        options: input.options,
      });
      if (!seed) {
        continue;
      }

      input.failureRecorder.reset();
      seeds.push(seed);
    } catch (error) {
      input.failureRecorder.record(
        `tier:${input.tier}:entry:${index}`,
        error,
      );
      console.warn(
        "[competitive-seeds] elite-seed-resolution-failed",
        JSON.stringify({
          platform: input.platform,
          tier: input.tier,
          summonerId: entry.summonerId ?? null,
          puuid: entry.puuid ?? null,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return seeds;
}

async function fetchEliteSeedsForPlatform(
  platform: RiotPlatform,
  options: EliteSeedDiscoveryOptions,
): Promise<CompetitiveSeed[]> {
  const cluster = PLATFORM_TO_REGION[platform];
  const seeds: CompetitiveSeed[] = [];
  const failureRecorder = createEliteFailureRecorder({
    platform,
    maxConsecutiveFailures: options.maxConsecutiveFailures,
  });

  for (const tier of options.tiers) {
    const entries = await fetchEliteTierEntries({
      platform,
      options,
      tier,
      failureRecorder,
    });
    if (entries.length === 0) {
      continue;
    }

    seeds.push(...await buildEliteSeedsForTier({
      platform,
      cluster,
      options,
      tier,
      entries,
      failureRecorder,
    }));
  }

  return seeds;
}

export async function fetchEliteLadderSeeds(
  options: Partial<EliteSeedDiscoveryOptions> = {},
): Promise<CompetitiveSeed[]> {
  const resolvedOptions: EliteSeedDiscoveryOptions = {
    ...DEFAULT_ELITE_SEED_OPTIONS,
    ...options,
  };
  const seeds: CompetitiveSeed[] = [];
  for (const platform of resolvedOptions.platforms) {
    try {
      seeds.push(...(await fetchEliteSeedsForPlatform(platform, resolvedOptions)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        "[competitive-seeds] elite-platform-fetch-failed",
        JSON.stringify({
          platform,
          message,
        }),
      );
      // Seed preparation is a batch job, not a recovery loop.
      // Any Riot failure here stops the run immediately so we do not burn
      // minutes retrying the same broken path across platforms/tiers.
      throw error;
    }
  }
  return dedupeCompetitiveSeeds(seeds);
}

export function dedupeCompetitiveSeeds(seeds: CompetitiveSeed[]) {
  const deduped = new Map<string, CompetitiveSeed>();
  for (const seed of seeds) {
    const normalized = normalizeSeed(seed);
    const key = buildCompetitiveSeedKey(normalized);
    const existing = deduped.get(key);
    if (!existing || normalized.priorityScore > existing.priorityScore) {
      deduped.set(key, normalized);
    }
  }

  return [...deduped.values()].sort((left, right) =>
    right.priorityScore - left.priorityScore
    || left.priorityTier.localeCompare(right.priorityTier)
    || left.league.localeCompare(right.league)
    || left.team.localeCompare(right.team)
    || left.playerName.localeCompare(right.playerName));
}

export async function buildCompetitiveSeedManifest(input?: {
  proSeeds?: ProPlayerSeed[];
  proSourcesMetadata?: CompetitiveSeedManifest["sources"]["pro"];
  eliteOptions?: Partial<EliteSeedDiscoveryOptions>;
  includeElite?: boolean;
  season?: string;
  seedSetVersion?: string;
  quality?: CompetitiveSeedManifest["quality"];
}): Promise<CompetitiveSeedManifest> {
  const season = input?.season ?? DEFAULT_COMPETITIVE_SEASON;
  const seedSetVersion = input?.seedSetVersion ?? DEFAULT_COMPETITIVE_SEED_SET_VERSION;
  const proSeeds = (input?.proSeeds ?? []).map((seed) =>
    fromProSeed(seed, {
      seedSetVersion,
      season,
    }),
  );
  const eliteSeeds = input?.includeElite === false
    ? []
    : await fetchEliteLadderSeeds({
        ...input?.eliteOptions,
        season,
        seedSetVersion,
      });
  const players = dedupeCompetitiveSeeds([...proSeeds, ...eliteSeeds]);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    seedSetVersion,
    season,
    source: "competitive-seed-merge",
    sources: {
      pro: input?.proSourcesMetadata ?? [],
      elite: (input?.eliteOptions?.platforms ?? DEFAULT_ELITE_SEED_OPTIONS.platforms).map((platform) => ({
        platform,
        tiers: input?.eliteOptions?.tiers ?? DEFAULT_ELITE_SEED_OPTIONS.tiers,
        queue: input?.eliteOptions?.queue ?? DEFAULT_ELITE_SEED_OPTIONS.queue,
        maxEntriesPerTier: input?.eliteOptions?.maxEntriesPerTier ?? DEFAULT_ELITE_SEED_OPTIONS.maxEntriesPerTier,
      })),
    },
    quality: input?.quality,
    playerCount: players.length,
    players,
  };
}
