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

type ValueOptionHandler = (options: CliOptions, next: string | undefined) => void;

const valueOptionHandlers: Record<string, ValueOptionHandler> = {
  "--output": (options, next) => {
    if (next) options.outputPath = next;
  },
  "--since": (options, next) => {
    if (next) options.since = next;
  },
  "--seeds-cache-path": (options, next) => {
    if (next) options.seedsCachePath = next;
  },
  "--leaguepedia-user-agent": (options, next) => {
    if (next) options.leaguepediaUserAgent = next;
  },
  "--source-profile": (options, next) => {
    if (next === "canon" || next === "wide") {
      options.sourceProfile = next;
    }
  },
};

const flagOptionHandlers: Record<string, (options: CliOptions) => void> = {
  "--enable-leaguepedia": (options) => {
    options.enableLeaguepedia = true;
  },
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
