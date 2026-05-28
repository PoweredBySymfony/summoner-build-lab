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

function fromProSeed(
  seed: ProPlayerSeed,
  options: {
    seedSetVersion: string;
    season: string;
  },
): CompetitiveSeed {
  const leaguePriority =
    seed.league.includes("LoL Champions Korea") ? 100 :
      seed.league.includes("League of Legends Pro League") ? 95 :
        seed.league.includes("League of Legends EMEA Championship") ? 90 :
          seed.league.includes("First Stand") ? 88 :
            seed.league.includes("Mid-Season Invitational") ? 87 :
              seed.league.includes("World Championship") ? 86 :
                75;

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
    priorityScore: leaguePriority,
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

async function fetchEliteSeedsForPlatform(
  platform: RiotPlatform,
  options: EliteSeedDiscoveryOptions,
): Promise<CompetitiveSeed[]> {
  const cluster = PLATFORM_TO_REGION[platform];
  const seeds: CompetitiveSeed[] = [];
  const isAuthFailure = (message: string) => /forbidden|authentication failed/i.test(message);
  let consecutiveFailures = 0;

  const recordFailure = (context: string, error: unknown) => {
    consecutiveFailures += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      "[competitive-seeds] elite-request-failed",
      JSON.stringify({
        platform,
        context,
        consecutiveFailures,
        message,
      }),
    );
    if (consecutiveFailures >= options.maxConsecutiveFailures) {
      throw new Error(
        `Elite seed discovery stopped after ${consecutiveFailures} consecutive failures on ${platform}.`,
      );
    }
  };

  for (const tier of options.tiers) {
    let response: RiotLeagueListResponse;
    try {
      response = await riotApiClient.getLeagueEntriesByQueueOnPlatform(platform, options.queue, tier);
      consecutiveFailures = 0;
    } catch (error) {
      recordFailure(`tier:${tier}`, error);
      const message = error instanceof Error ? error.message : String(error);
      if (isAuthFailure(message)) {
        throw error;
      }
      continue;
    }
    const entries = response.entries
      .slice()
      .sort((left, right) => right.leaguePoints - left.leaguePoints || right.wins - left.wins)
      .slice(0, options.maxEntriesPerTier);

    for (const [index, entry] of entries.entries()) {
      try {
        const entryIdentity = getEliteEntryIdentity(entry);
        let resolvedPuuid = entryIdentity.puuid;

        if (!resolvedPuuid && entryIdentity.summonerId) {
          const summoner = await riotApiClient.getSummonerBySummonerIdOnPlatform(entryIdentity.summonerId, platform);
          resolvedPuuid = summoner.puuid;
        }

        if (!resolvedPuuid) {
          console.warn(
            "[competitive-seeds] elite-entry-missing-identity",
            JSON.stringify({
              platform,
              tier,
              index,
            }),
          );
          continue;
        }

        const account = await riotApiClient.getAccountByPuuidOnRegion(resolvedPuuid, cluster);
        consecutiveFailures = 0;
        const riotId = account.gameName && account.tagLine
          ? `${account.gameName}#${account.tagLine}`
          : null;

        seeds.push(normalizeSeed({
          playerName: account.gameName ?? entry.summonerName ?? `Elite ${platform.toUpperCase()} ${index + 1}`,
          team: "soloq-elite",
          league: "Riot Ranked Ladder",
          competition: `${platform.toUpperCase()} ${tier.toUpperCase()} ${options.season}`,
          role: inferRoleFromIndex(index),
          region: platform.toUpperCase(),
          riotId,
          riotIdCandidates: riotId ? [riotId] : [],
          puuid: resolvedPuuid,
          priorityTier: "elite",
          priorityScore:
            tier === "challenger" ? 80 :
              tier === "grandmaster" ? 72 :
                64,
          discoverySource: `riot-league-v4:${tier}`,
          seedSetVersion: options.seedSetVersion,
          platformHint: platform,
          cluster,
          season: options.season,
          sourceTournamentDate: null,
          sourceUrl: null,
        }));
        } catch (error) {
        recordFailure(
          `tier:${tier}:entry:${index}`,
          error,
        );
        console.warn(
          "[competitive-seeds] elite-seed-resolution-failed",
          JSON.stringify({
            platform,
            tier,
            summonerId: entry.summonerId ?? null,
            puuid: entry.puuid ?? null,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
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
