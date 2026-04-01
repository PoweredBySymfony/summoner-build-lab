import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCompetitiveSeedManifest,
  DEFAULT_COMPETITIVE_SEASON,
  DEFAULT_COMPETITIVE_SEED_SET_VERSION,
  DEFAULT_ELITE_SEED_OPTIONS,
} from "../server/src/lib/riot/competitiveSeeds.js";
import { type RiotPlatform } from "../server/src/lib/riot/routing.js";

type CliOptions = {
  outputPath: string;
  season: string;
  seedSetVersion: string;
  includeElite: boolean;
  elitePlatforms: RiotPlatform[];
  eliteMaxEntriesPerTier: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputPath: path.join("data", "seeds", "competitive-seeds-2026.json"),
    season: DEFAULT_COMPETITIVE_SEASON,
    seedSetVersion: DEFAULT_COMPETITIVE_SEED_SET_VERSION,
    includeElite: true,
    elitePlatforms: DEFAULT_ELITE_SEED_OPTIONS.platforms,
    eliteMaxEntriesPerTier: DEFAULT_ELITE_SEED_OPTIONS.maxEntriesPerTier,
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
      default:
        break;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await buildCompetitiveSeedManifest({
    season: options.season,
    seedSetVersion: options.seedSetVersion,
    includeElite: options.includeElite,
    eliteOptions: {
      platforms: options.elitePlatforms,
      maxEntriesPerTier: options.eliteMaxEntriesPerTier,
    },
  });

  const outputPath = path.resolve(options.outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.info(
    `[competitive-seeds] wrote ${manifest.playerCount} seeds to ${outputPath}`,
  );
}

main().catch((error) => {
  console.error("[competitive-seeds] failed", error);
  process.exitCode = 1;
});
