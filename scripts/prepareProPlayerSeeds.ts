import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchRecentProPlayerSeeds, DEFAULT_PRO_SEED_SOURCES, type ProSeedSourceDefinition } from "../server/src/lib/riot/proSeeds.js";

type CliOptions = {
  outputPath: string;
  since?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputPath: path.join("data", "pro-seeds", "major-pros-recent.json"),
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
      default:
        break;
    }
  }

  return options;
}

function resolveSources(options: CliOptions): ProSeedSourceDefinition[] {
  if (!options.since) {
    return DEFAULT_PRO_SEED_SOURCES;
  }

  return DEFAULT_PRO_SEED_SOURCES.map((source) => ({
    ...source,
    since: options.since!,
  }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sources = resolveSources(options);
  const players = await fetchRecentProPlayerSeeds(sources);

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
