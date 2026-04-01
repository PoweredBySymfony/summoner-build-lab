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
  DEFAULT_PRO_SEED_SOURCES,
  DEFAULT_SEEDS_CACHE_PATH,
  fetchRecentProPlayerSeeds,
  loadProPlayerSeedFile,
  type ProPlayerSeed,
  type ProSeedSourceDefinition,
} from "../server/src/lib/riot/proSeeds.js";
import { type RiotPlatform } from "../server/src/lib/riot/routing.js";

type CliOptions = {
  outputPath: string;
  season: string;
  seedSetVersion: string;
  includeElite: boolean;
  elitePlatforms: RiotPlatform[];
  eliteMaxEntriesPerTier: number;
  curatedProPath: string;
  enableLeaguepedia: boolean;
  seedsCachePath: string;
  leaguepediaUserAgent: string;
  leaguepediaSince?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputPath: path.join("data", "seeds", "competitive-seeds-2026.json"),
    season: DEFAULT_COMPETITIVE_SEASON,
    seedSetVersion: DEFAULT_COMPETITIVE_SEED_SET_VERSION,
    includeElite: true,
    elitePlatforms: DEFAULT_ELITE_SEED_OPTIONS.platforms,
    eliteMaxEntriesPerTier: DEFAULT_ELITE_SEED_OPTIONS.maxEntriesPerTier,
    curatedProPath: path.join("data", "seeds", "pro-curated-2026.json"),
    enableLeaguepedia: false,
    seedsCachePath: DEFAULT_SEEDS_CACHE_PATH,
    leaguepediaUserAgent: DEFAULT_LEAGUEPEDIA_USER_AGENT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--output":
        if (next) {
          options.outputPath = next;
        }
        index += 1;
        break;
      case "--season":
        if (next) {
          options.season = next;
        }
        index += 1;
        break;
      case "--seed-set-version":
        if (next) {
          options.seedSetVersion = next;
        }
        index += 1;
        break;
      case "--pro-only":
        options.includeElite = false;
        break;
      case "--elite-platforms":
        if (next) {
          options.elitePlatforms = next.split(",").map((value) => value.trim() as RiotPlatform).filter(Boolean);
        }
        index += 1;
        break;
      case "--elite-max-entries-per-tier":
        options.eliteMaxEntriesPerTier = Number(next ?? String(DEFAULT_ELITE_SEED_OPTIONS.maxEntriesPerTier));
        index += 1;
        break;
      case "--curated-pro-path":
        if (next) {
          options.curatedProPath = next;
        }
        index += 1;
        break;
      case "--enable-leaguepedia":
        options.enableLeaguepedia = true;
        break;
      case "--seeds-cache-path":
        if (next) {
          options.seedsCachePath = next;
        }
        index += 1;
        break;
      case "--leaguepedia-user-agent":
        if (next) {
          options.leaguepediaUserAgent = next;
        }
        index += 1;
        break;
      case "--leaguepedia-since":
        if (next) {
          options.leaguepediaSince = next;
        }
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

function resolveLeaguepediaSources(options: CliOptions): ProSeedSourceDefinition[] {
  if (!options.leaguepediaSince) {
    return DEFAULT_PRO_SEED_SOURCES.map((source) => ({
      ...source,
      since: `${options.season}-01-01`,
    }));
  }

  return DEFAULT_PRO_SEED_SOURCES.map((source) => ({
    ...source,
    since: options.leaguepediaSince!,
  }));
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
    `[competitive-seeds] quality leagues=${report.leagueDistribution.slice(0, 8).map((entry) => `${entry.league}:${entry.count}`).join(", ")}`,
  );
  console.info(
    `[competitive-seeds] quality regions=${report.regionDistribution.slice(0, 8).map((entry) => `${entry.region}:${entry.count}`).join(", ")}`,
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

main().catch((error) => {
  console.error("[competitive-seeds] failed", error);
  process.exitCode = 1;
});
