import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PLATFORM_TO_REGION, type RiotPlatform, type RiotRegion } from "./routing.js";

const LEAGUEPEDIA_CARGO_EXPORT_URL = "https://lol.fandom.com/wiki/Special:CargoExport";
export const DEFAULT_SEEDS_CACHE_PATH = path.join("data", "runtime", "seeds-cache.json");
export const DEFAULT_LEAGUEPEDIA_USER_AGENT = "summoner-build-lab/seed-prep (leaguepedia opt-in; local operator)";

export type ProSeedSourceDefinition = {
  key: string;
  leagueNames?: string[];
  tournamentNamePatterns?: string[];
  since: string;
};

export type ProPlayerSeed = {
  playerName: string;
  playerPage: string;
  team: string;
  league: string;
  competition: string;
  role: "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
  region: string;
  platformHint: RiotPlatform | null;
  cluster: RiotRegion | null;
  riotId: string | null;
  riotIdCandidates: string[];
  puuid: string | null;
  source: string;
  sourceUrl: string;
  sourceTournamentDate: string | null;
};

export type ProSeedFile = {
  version: 1;
  generatedAt: string;
  source: string;
  sources?: unknown;
  playerCount: number;
  players: ProPlayerSeed[];
};

type SeedsCacheFile = {
  version: 1;
  updatedAt: string;
  leaguepedia: Record<
    string,
    {
      fetchedAt: string;
      sourceUrl: string;
      sources: ProSeedSourceDefinition[];
      players: ProPlayerSeed[];
    }
  >;
};

type LeaguepediaTournamentPlayerRow = {
  Player?: string | number | null;
  Team?: string | null;
  Role?: string | null;
  ID?: string | number | null;
  SoloqueueIds?: string | null;
  Name?: string | null;
  League?: string | null;
  Region?: string | null;
  DateStart?: string | null;
};

const ROLE_MAP = new Map<string, ProPlayerSeed["role"]>([
  ["TOP", "TOP"],
  ["JUNGLE", "JUNGLE"],
  ["MID", "MID"],
  ["MIDDLE", "MID"],
  ["BOT", "ADC"],
  ["BOTTOM", "ADC"],
  ["ADC", "ADC"],
  ["SUPPORT", "SUPPORT"],
  ["UTILITY", "SUPPORT"],
]);

const PLATFORM_HINTS = new Map<string, RiotPlatform>([
  ["BR", "br1"],
  ["BR1", "br1"],
  ["EUNE", "eun1"],
  ["EUN1", "eun1"],
  ["EUW", "euw1"],
  ["EUW1", "euw1"],
  ["JP", "jp1"],
  ["JP1", "jp1"],
  ["KR", "kr"],
  ["KR1", "kr"],
  ["LAN", "la1"],
  ["LA1", "la1"],
  ["LAS", "la2"],
  ["LA2", "la2"],
  ["NA", "na1"],
  ["NA1", "na1"],
  ["OCE", "oc1"],
  ["OC1", "oc1"],
  ["RU", "ru"],
  ["TR", "tr1"],
  ["TR1", "tr1"],
  ["PH", "ph2"],
  ["PH2", "ph2"],
  ["SG", "sg2"],
  ["SG2", "sg2"],
  ["TH", "th2"],
  ["TH2", "th2"],
  ["TW", "tw2"],
  ["TW2", "tw2"],
  ["VN", "vn2"],
  ["VN2", "vn2"],
]);

export const DEFAULT_PRO_SEED_SOURCES: ProSeedSourceDefinition[] = [
  {
    key: "lck",
    leagueNames: ["LoL Champions Korea"],
    since: "2025-01-01",
  },
  {
    key: "lpl",
    leagueNames: ["League of Legends Pro League"],
    since: "2025-01-01",
  },
  {
    key: "lec",
    leagueNames: ["League of Legends EMEA Championship"],
    since: "2025-01-01",
  },
  {
    key: "lta",
    leagueNames: ["League of Legends Championship of The Americas"],
    since: "2025-01-01",
  },
  {
    key: "msi",
    leagueNames: ["Mid-Season Invitational"],
    tournamentNamePatterns: ["MSI %"],
    since: "2025-01-01",
  },
  {
    key: "worlds",
    leagueNames: ["World Championship"],
    tournamentNamePatterns: ["Worlds %"],
    since: "2025-01-01",
  },
  {
    key: "first-stand",
    leagueNames: ["First Stand"],
    since: "2025-01-01",
  },
];

function encodeCargoQuery(params: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    query.set(key, value);
  }
  return `${LEAGUEPEDIA_CARGO_EXPORT_URL}?${query.toString()}`;
}

function normalizeRole(rawRole: string | null | undefined): ProPlayerSeed["role"] | null {
  if (!rawRole) {
    return null;
  }
  return ROLE_MAP.get(rawRole.trim().toUpperCase()) ?? null;
}

function decodeLeaguepediaText(rawValue: string) {
  return rawValue
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&#160;|&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/'''/g, "")
    .replace(/''/g, "")
    .trim();
}

function splitSoloqueueEntries(rawValue: string | null | undefined) {
  const decoded = decodeLeaguepediaText(rawValue ?? "");
  if (!decoded) {
    return [];
  }

  return decoded
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function extractRiotIdCandidates(rawValue: string | null | undefined) {
  const candidates: Array<{ riotId: string; platformHint: RiotPlatform | null; cluster: RiotRegion | null }> = [];

  for (const line of splitSoloqueueEntries(rawValue)) {
    const regionMatch = line.match(/^([A-Z0-9]+)\s*:\s*(.+)$/i);
    const regionKey = regionMatch?.[1]?.trim().toUpperCase() ?? null;
    const rest = regionMatch?.[2]?.trim() ?? line;
    const platformHint = regionKey ? (PLATFORM_HINTS.get(regionKey) ?? null) : null;
    const cluster = platformHint ? PLATFORM_TO_REGION[platformHint] : null;
    const normalizedFragments = rest
      .split(/[;,]/)
      .map((fragment) => fragment.trim())
      .filter(Boolean);

    for (const fragment of normalizedFragments) {
      const riotIdMatch = fragment.match(/([^#\n]+#[A-Za-z0-9]+)\b/);
      if (!riotIdMatch) {
        continue;
      }

      candidates.push({
        riotId: riotIdMatch[1].trim(),
        platformHint,
        cluster,
      });
    }
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.riotId.toLowerCase()}::${candidate.platformHint ?? "unknown"}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizePlayerPage(rawPlayer: string | number | null | undefined) {
  return String(rawPlayer ?? "").trim();
}

function normalizePlayerDisplayName(rawPlayer: string | number | null | undefined) {
  const normalized = normalizePlayerPage(rawPlayer);
  if (!normalized) {
    return normalized;
  }
  return normalized.replace(/\s*\(.*\)\s*$/, "").trim();
}

function buildWhereClause(sources: ProSeedSourceDefinition[]) {
  const tournamentClauses = sources.map((source) => {
    const leagueClauses = (source.leagueNames ?? []).map((leagueName) => `Tournaments.League="${leagueName}"`);
    const nameClauses = (source.tournamentNamePatterns ?? []).map((pattern) => `Tournaments.Name LIKE "${pattern}"`);
    const leagueOrName = [...leagueClauses, ...nameClauses];

    if (leagueOrName.length === 0) {
      throw new Error(`Seed source ${source.key} must define leagueNames or tournamentNamePatterns.`);
    }

    return `(((${leagueOrName.join(" OR ")})) AND Tournaments.DateStart >= "${source.since}")`;
  });

  return `(${tournamentClauses.join(" OR ")}) AND TournamentPlayers.Role IN ("Top","Jungle","Mid","Bot","Support")`;
}

function buildLeaguepediaCacheKey(sources: ProSeedSourceDefinition[]) {
  return Buffer.from(JSON.stringify(sources)).toString("base64url");
}

async function loadSeedsCache(cachePath: string) {
  try {
    const raw = await readFile(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<SeedsCacheFile>;
    return {
      version: 1,
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      leaguepedia: parsed.leaguepedia ?? {},
    } satisfies SeedsCacheFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        version: 1,
        updatedAt: new Date(0).toISOString(),
        leaguepedia: {},
      } satisfies SeedsCacheFile;
    }
    throw error;
  }
}

async function saveSeedsCache(cachePath: string, cache: SeedsCacheFile) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");
}

export async function loadProPlayerSeedFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ProSeedFile | ProPlayerSeed[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return Array.isArray(parsed.players) ? parsed.players : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function fetchRecentProPlayerSeeds(
  sources: ProSeedSourceDefinition[] = DEFAULT_PRO_SEED_SOURCES,
  options?: {
    cachePath?: string;
    forceRefresh?: boolean;
    userAgent?: string;
  },
): Promise<ProPlayerSeed[]> {
  const url = encodeCargoQuery({
    tables: "TournamentPlayers,Players,Tournaments",
    join_on:
      "TournamentPlayers.Player=Players.OverviewPage,TournamentPlayers.OverviewPage=Tournaments.OverviewPage",
    fields: [
      "TournamentPlayers.Player",
      "TournamentPlayers.Team",
      "TournamentPlayers.Role",
      "Players.ID",
      "Players.SoloqueueIds",
      "Tournaments.Name",
      "Tournaments.League",
      "Tournaments.Region",
      "Tournaments.DateStart",
    ].join(","),
    where: buildWhereClause(sources),
    order_by: "Tournaments.DateStart DESC",
    limit: "1000",
    format: "json",
  });

  const cachePath = options?.cachePath ? path.resolve(options.cachePath) : null;
  const cacheKey = buildLeaguepediaCacheKey(sources);

  if (cachePath && !options?.forceRefresh) {
    const cache = await loadSeedsCache(cachePath);
    const cached = cache.leaguepedia[cacheKey];
    if (cached) {
      console.info(`[pro-seeds] leaguepedia-cache-hit path=${cachePath}`);
      return cached.players;
    }
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": options?.userAgent ?? DEFAULT_LEAGUEPEDIA_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Leaguepedia CargoExport request failed (${response.status}).`);
  }

  const rows = (await response.json()) as LeaguepediaTournamentPlayerRow[];
  const deduped = new Map<string, ProPlayerSeed>();

  for (const row of rows) {
    const role = normalizeRole(row.Role ?? null);
    const playerPage = normalizePlayerPage(row.Player);
    if (!role || !playerPage || !row.Team || !row.Name || !row.League) {
      continue;
    }

    const riotIdCandidates = extractRiotIdCandidates(row.SoloqueueIds).map((candidate) => candidate.riotId);
    const primaryCandidate = extractRiotIdCandidates(row.SoloqueueIds)[0] ?? null;
    const seed: ProPlayerSeed = {
      playerName: normalizePlayerDisplayName(row.ID ?? row.Player),
      playerPage,
      team: String(row.Team),
      league: String(row.League),
      competition: String(row.Name),
      role,
      region: String(row.Region ?? "unknown"),
      platformHint: primaryCandidate?.platformHint ?? null,
      cluster: primaryCandidate?.cluster ?? null,
      riotId: primaryCandidate?.riotId ?? null,
      riotIdCandidates,
      puuid: null,
      source: "leaguepedia-cargo",
      sourceUrl: url,
      sourceTournamentDate: row.DateStart ?? null,
    };

    const dedupeKey = `${seed.playerPage}::${seed.team}::${seed.role}`;
    const existing = deduped.get(dedupeKey);
    if (!existing) {
      deduped.set(dedupeKey, seed);
      continue;
    }

    const existingDate = existing.sourceTournamentDate ?? "";
    const nextDate = seed.sourceTournamentDate ?? "";
    if (nextDate > existingDate) {
      deduped.set(dedupeKey, seed);
    }
  }

  const players = [...deduped.values()].sort((left, right) => {
    return (
      left.league.localeCompare(right.league) ||
      left.team.localeCompare(right.team) ||
      left.role.localeCompare(right.role) ||
      left.playerName.localeCompare(right.playerName)
    );
  });

  if (cachePath) {
    const cache = await loadSeedsCache(cachePath);
    cache.leaguepedia[cacheKey] = {
      fetchedAt: new Date().toISOString(),
      sourceUrl: url,
      sources,
      players,
    };
    cache.updatedAt = new Date().toISOString();
    await saveSeedsCache(cachePath, cache);
    console.info(`[pro-seeds] leaguepedia-cache-write path=${cachePath}`);
  }

  return players;
}
