import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_LEAGUEPEDIA_USER_AGENT,
  DEFAULT_SEEDS_CACHE_PATH,
  fetchRecentProPlayerSeeds,
  resolveProSeedSources,
  type ProSeedSourceProfile,
  type ProSeedSourceDefinition,
} from "../server/src/lib/riot/proSeeds.js";

type CliOptions = {
  outputPath: string;
  since?: string;
  enableLeaguepedia: boolean;
  seedsCachePath: string;
  leaguepediaUserAgent: string;
  sourceProfile: ProSeedSourceProfile;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputPath: path.join("data", "pro-seeds", "major-pros-recent.json"),
    enableLeaguepedia: false,
    seedsCachePath: DEFAULT_SEEDS_CACHE_PATH,
    leaguepediaUserAgent: DEFAULT_LEAGUEPEDIA_USER_AGENT,
    sourceProfile: "canon",
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
      case "--since":
        if (next) {
          options.since = next;
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
      case "--source-profile":
        if (next === "canon" || next === "wide") {
          options.sourceProfile = next;
        }
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

function resolveSources(options: CliOptions): ProSeedSourceDefinition[] {
  return resolveProSeedSources(options.sourceProfile, options.since);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.enableLeaguepedia) {
    throw new Error("Leaguepedia is opt-in. Re-run with --enable-leaguepedia.");
  }
  const sources = resolveSources(options);
  const players = await fetchRecentProPlayerSeeds(sources, {
    cachePath: options.seedsCachePath,
    userAgent: options.leaguepediaUserAgent,
  });

  if (players.length === 0) {
    throw new Error("No recent professional seeds were discovered from Leaguepedia.");
  }

  const outputPath = path.resolve(options.outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });

  await writeFile(
    outputPath,
    JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: "leaguepedia-cargo",
        sources,
        playerCount: players.length,
        players,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.info(
    `[pro-seeds] wrote ${players.length} recent professional seeds to ${outputPath}`,
  );
}

main().catch((error) => {
  console.error("[pro-seeds] failed", error);
  process.exitCode = 1;
});
