import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCompetitiveSeedManifest,
  DEFAULT_COMPETITIVE_SEASON,
  DEFAULT_COMPETITIVE_SEED_SET_VERSION,
  DEFAULT_ELITE_SEED_OPTIONS,
  type CompetitiveSeed,
} from "../server/src/lib/riot/competitiveSeeds.js";
import {
  DEFAULT_LEAGUEPEDIA_USER_AGENT,
  DEFAULT_SEEDS_CACHE_PATH,
  fetchRecentProPlayerSeeds,
  loadProPlayerSeedFile,
  resolveProSeedSources,
  type ProPlayerSeed,
  type ProSeedSourceDefinition,
  type ProSeedSourceProfile,
} from "../server/src/lib/riot/proSeeds.js";
import { type RiotPlatform } from "../server/src/lib/riot/routing.js";

type CliOptions = {
  outputPath: string;
  season: string;
  seedSetVersion: string;
  includeElite: boolean;
  elitePlatforms: RiotPlatform[];
  eliteMaxEntriesPerTier: number;
  eliteMaxConsecutiveFailures: number;
  curatedProPath: string;
  enableLeaguepedia: boolean;
  seedsCachePath: string;
  leaguepediaUserAgent: string;
  leaguepediaSince?: string;
  sourceProfile: ProSeedSourceProfile;
};

type ValueOptionHandler = (options: CliOptions, next: string | undefined) => void;

const parsePlatformList = (value: string) =>
  value.split(",").map((entry) => entry.trim() as RiotPlatform).filter(Boolean);

const valueOptionHandlers: Record<string, ValueOptionHandler> = {
  "--output": (options, next) => {
    if (next) options.outputPath = next;
  },
  "--season": (options, next) => {
    if (next) options.season = next;
  },
  "--seed-set-version": (options, next) => {
    if (next) options.seedSetVersion = next;
  },
  "--elite-platforms": (options, next) => {
    if (next) options.elitePlatforms = parsePlatformList(next);
  },
  "--elite-max-entries-per-tier": (options, next) => {
    options.eliteMaxEntriesPerTier = Number(next ?? String(DEFAULT_ELITE_SEED_OPTIONS.maxEntriesPerTier));
  },
  "--elite-max-consecutive-failures": (options, next) => {
    options.eliteMaxConsecutiveFailures = Number(
      next ?? String(DEFAULT_ELITE_SEED_OPTIONS.maxConsecutiveFailures),
    );
  },
  "--curated-pro-path": (options, next) => {
    if (next) options.curatedProPath = next;
  },
  "--seeds-cache-path": (options, next) => {
    if (next) options.seedsCachePath = next;
  },
  "--leaguepedia-user-agent": (options, next) => {
    if (next) options.leaguepediaUserAgent = next;
  },
  "--leaguepedia-since": (options, next) => {
    if (next) options.leaguepediaSince = next;
  },
  "--source-profile": (options, next) => {
    if (next !== "canon" && next !== "wide") {
      return;
    }

    options.sourceProfile = next;
    if (next === "wide") {
      options.includeElite = false;
    }
  },
};

const flagOptionHandlers: Record<string, (options: CliOptions) => void> = {
  "--pro-only": (options) => {
    options.includeElite = false;
  },
  "--enable-leaguepedia": (options) => {
    options.enableLeaguepedia = true;
  },
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputPath: path.join("data", "seeds", "competitive-seeds-2026.json"),
    season: DEFAULT_COMPETITIVE_SEASON,
    seedSetVersion: DEFAULT_COMPETITIVE_SEED_SET_VERSION,
    includeElite: true,
    elitePlatforms: DEFAULT_ELITE_SEED_OPTIONS.platforms,
    eliteMaxEntriesPerTier: DEFAULT_ELITE_SEED_OPTIONS.maxEntriesPerTier,
    eliteMaxConsecutiveFailures: DEFAULT_ELITE_SEED_OPTIONS.maxConsecutiveFailures,
    curatedProPath: path.join("data", "seeds", "pro-curated-2026.json"),
    enableLeaguepedia: true,
    seedsCachePath: DEFAULT_SEEDS_CACHE_PATH,
    leaguepediaUserAgent: DEFAULT_LEAGUEPEDIA_USER_AGENT,
    sourceProfile: "canon",
  };

  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    index += 1;
    const next = argv[index];

    const valueHandler = valueOptionHandlers[arg];
    if (valueHandler) {
      valueHandler(options, next);
      index += 1;
      continue;
    }

    const flagHandler = flagOptionHandlers[arg];
    if (flagHandler) {
      flagHandler(options);
    }
  }

  return options;
}

function resolveLeaguepediaSources(options: CliOptions): ProSeedSourceDefinition[] {
  return resolveProSeedSources(options.sourceProfile, options.leaguepediaSince ?? `${options.season}-01-01`);
}

function countBy(values: string[]) {
  return Object.entries(
    values.reduce<Record<string, number>>((accumulator, value) => {
      accumulator[value] = (accumulator[value] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function buildSeedQualityReport(players: CompetitiveSeed[]) {
  const resolvedSeeds = players.filter((seed) => Boolean(seed.puuid) || Boolean(seed.riotId)).length;
  const seedsWithRiotIdCandidates = players.filter((seed) => seed.riotIdCandidates.length > 0).length;

  return {
    resolvedSeeds,
    resolvedSeedsPercent: players.length > 0 ? (resolvedSeeds / players.length) * 100 : 0,
    seedsWithRiotIdCandidates,
    seedsWithRiotIdCandidatesPercent: players.length > 0 ? (seedsWithRiotIdCandidates / players.length) * 100 : 0,
    leagueDistribution: countBy(players.map((seed) => seed.league)).map(({ key, count }) => ({ league: key, count })),
    regionDistribution: countBy(players.map((seed) => seed.region)).map(({ key, count }) => ({ region: key, count })),
  };
}

function logSeedQualityReport(report: ReturnType<typeof buildSeedQualityReport>) {
  console.info(
    `[competitive-seeds] quality resolved=${report.resolvedSeedsPercent.toFixed(2)}% riotIdCandidates=${report.seedsWithRiotIdCandidatesPercent.toFixed(2)}%`,
  );
  console.info(
    `[competitive-seeds] quality leagues=${report.leagueDistribution.slice(0, 8).map((entry) => entry.league + ":" + entry.count).join(", ")}`,
  );
  console.info(
    `[competitive-seeds] quality regions=${report.regionDistribution.slice(0, 8).map((entry) => entry.region + ":" + entry.count).join(", ")}`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const curatedSeeds = await loadProPlayerSeedFile(path.resolve(options.curatedProPath));
  const leaguepediaSources = resolveLeaguepediaSources(options);
  const leaguepediaSeeds: ProPlayerSeed[] = options.enableLeaguepedia
    ? await fetchRecentProPlayerSeeds(leaguepediaSources, {
        cachePath: options.seedsCachePath,
        userAgent: options.leaguepediaUserAgent,
      })
    : [];

  const manifest = await buildCompetitiveSeedManifest({
    season: options.season,
    seedSetVersion: options.seedSetVersion,
    includeElite: options.includeElite,
    proSeeds: [...curatedSeeds, ...leaguepediaSeeds],
    proSourcesMetadata: [
      {
        kind: "curated-file",
        enabled: true,
        path: path.resolve(options.curatedProPath),
        label: "manual curated pro seeds",
        sourceCount: curatedSeeds.length,
      },
      {
        kind: "leaguepedia-cargo",
        enabled: options.enableLeaguepedia,
        cachePath: path.resolve(options.seedsCachePath),
        label: "Leaguepedia CargoExport opt-in",
        sourceCount: leaguepediaSeeds.length,
      },
    ],
    eliteOptions: {
      platforms: options.elitePlatforms,
      maxEntriesPerTier: options.eliteMaxEntriesPerTier,
      maxConsecutiveFailures: options.eliteMaxConsecutiveFailures,
    },
  });
  const quality = buildSeedQualityReport(manifest.players);
  manifest.quality = quality;

  const outputPath = path.resolve(options.outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(manifest, null, 2), "utf-8");
  logSeedQualityReport(quality);

  console.info(
    `[competitive-seeds] wrote ${manifest.playerCount} seeds to ${outputPath} curated=${curatedSeeds.length} leaguepedia=${leaguepediaSeeds.length} elite=${options.includeElite ? "enabled" : "disabled"}`,
  );
}

try {
  await main();
} catch (error) {
  console.error("[competitive-seeds] failed", error);
  process.exitCode = 1;
}
