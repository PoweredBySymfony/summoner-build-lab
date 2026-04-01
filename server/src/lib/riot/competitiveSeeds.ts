import { PLATFORM_TO_REGION, type RiotPlatform, type RiotRegion } from "./routing.js";
import {
  DEFAULT_PRO_SEED_SOURCES,
  fetchRecentProPlayerSeeds,
  type ProPlayerSeed,
  type ProSeedSourceDefinition,
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
    pro: ProSeedSourceDefinition[];
    elite: Array<{
      platform: RiotPlatform;
      tiers: string[];
      queue: string;
      maxEntriesPerTier: number;
    }>;
  };
  playerCount: number;
  players: CompetitiveSeed[];
};

export type EliteSeedDiscoveryOptions = {
  platforms: RiotPlatform[];
  queue: "RANKED_SOLO_5x5";
  tiers: Array<"challenger" | "grandmaster" | "master">;
  maxEntriesPerTier: number;
  season: string;
  seedSetVersion: string;
};

type RiotLeagueEntry = {
  summonerId: string;
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

export const DEFAULT_ELITE_SEED_PLATFORMS: RiotPlatform[] = ["kr", "euw1", "na1", "eun1", "br1", "tw2", "vn2"];

export const DEFAULT_ELITE_SEED_OPTIONS: EliteSeedDiscoveryOptions = {
  platforms: DEFAULT_ELITE_SEED_PLATFORMS,
  queue: "RANKED_SOLO_5x5",
  tiers: ["challenger", "grandmaster", "master"],
  maxEntriesPerTier: 20,
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

async function fetchEliteSeedsForPlatform(
  platform: RiotPlatform,
  options: EliteSeedDiscoveryOptions,
): Promise<CompetitiveSeed[]> {
  const cluster = PLATFORM_TO_REGION[platform];
  const seeds: CompetitiveSeed[] = [];

  for (const tier of options.tiers) {
    const response = await riotApiClient.getLeagueEntriesByQueueOnPlatform(platform, options.queue, tier);
    const entries = response.entries
      .slice()
      .sort((left, right) => right.leaguePoints - left.leaguePoints || right.wins - left.wins)
      .slice(0, options.maxEntriesPerTier);

    for (const [index, entry] of entries.entries()) {
      try {
        const summoner = await riotApiClient.getSummonerBySummonerIdOnPlatform(entry.summonerId, platform);
        const account = await riotApiClient.getAccountByPuuidOnRegion(summoner.puuid, cluster);
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
          puuid: summoner.puuid,
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
        console.warn(
          "[competitive-seeds] elite-seed-resolution-failed",
          JSON.stringify({
            platform,
            tier,
            summonerId: entry.summonerId,
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
    seeds.push(...(await fetchEliteSeedsForPlatform(platform, resolvedOptions)));
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
  proSources?: ProSeedSourceDefinition[];
  eliteOptions?: Partial<EliteSeedDiscoveryOptions>;
  includeElite?: boolean;
  season?: string;
  seedSetVersion?: string;
}): Promise<CompetitiveSeedManifest> {
  const season = input?.season ?? DEFAULT_COMPETITIVE_SEASON;
  const seedSetVersion = input?.seedSetVersion ?? DEFAULT_COMPETITIVE_SEED_SET_VERSION;
  const proSources = input?.proSources ?? DEFAULT_PRO_SEED_SOURCES.map((source) => ({
    ...source,
    since: "2026-01-01",
  }));
  const proSeeds = (await fetchRecentProPlayerSeeds(proSources)).map((seed) =>
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
      pro: proSources,
      elite: (input?.eliteOptions?.platforms ?? DEFAULT_ELITE_SEED_OPTIONS.platforms).map((platform) => ({
        platform,
        tiers: input?.eliteOptions?.tiers ?? DEFAULT_ELITE_SEED_OPTIONS.tiers,
        queue: input?.eliteOptions?.queue ?? DEFAULT_ELITE_SEED_OPTIONS.queue,
        maxEntriesPerTier: input?.eliteOptions?.maxEntriesPerTier ?? DEFAULT_ELITE_SEED_OPTIONS.maxEntriesPerTier,
      })),
    },
    playerCount: players.length,
    players,
  };
}
