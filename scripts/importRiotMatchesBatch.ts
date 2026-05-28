import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "../server/src/lib/prisma.js";
import { parseBatchTargets, runRiotImportBatch, type RiotImportInput } from "../server/src/lib/riot/riotBatch.js";
import { riotApiClient } from "../server/src/lib/riot/riotApiClient.js";
import { riotSyncService } from "../server/src/services/riotSyncService.js";

type CliOptions = {
  userId?: string;
  count: number;
  inputPath?: string;
  riotIds: string[];
  puuids: string[];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    count: 10,
    riotIds: [],
    puuids: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--user-id":
        options.userId = next;
        index += 1;
        break;
      case "--count":
        options.count = Number(next ?? "10");
        index += 1;
        break;
      case "--input":
        options.inputPath = next;
        index += 1;
        break;
      case "--riot-id":
        if (next) {
          options.riotIds.push(next);
        }
        index += 1;
        break;
      case "--puuid":
        if (next) {
          options.puuids.push(next);
        }
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

async function loadTargets(options: CliOptions) {
  const rawTargets = [...options.riotIds, ...options.puuids.map((value) => `puuid:${value}`)];

  if (options.inputPath) {
    const absolutePath = path.resolve(options.inputPath);
    const fileContents = await fs.readFile(absolutePath, "utf8");
    rawTargets.push(
      ...fileContents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")),
    );
  }

  return parseBatchTargets(rawTargets);
}

async function resolveUserId(explicitUserId: string | undefined, target: RiotImportInput, puuid: string) {
  if (explicitUserId) {
    return explicitUserId;
  }

  if (target.type === "riot-id") {
    const byRiotId = await prisma.playerProfile.findFirst({
      where: {
        riotGameName: target.gameName,
        riotTagLine: target.tagLine,
      },
      select: { userId: true },
    });
    if (byRiotId) {
      return byRiotId.userId;
    }
  }

  const byPuuid = await prisma.playerProfile.findFirst({
    where: { riotPuuid: puuid },
    select: { userId: true },
  });
  if (byPuuid) {
    return byPuuid.userId;
  }

  throw new Error(`No owning user found for ${puuid}. Provide --user-id explicitly.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!Number.isFinite(options.count) || options.count <= 0) {
    throw new Error("--count must be a positive integer.");
  }

  const targets = await loadTargets(options);
  if (targets.length === 0) {
    throw new Error("No Riot IDs or PUUIDs provided. Use --input, --riot-id, or --puuid.");
  }

  console.info(
    `[riot-import-batch] starting targets=${targets.length} countPerTarget=${options.count} concurrency=${process.env.RIOT_API_CONCURRENCY ?? "1"}`,
  );

  const result = await runRiotImportBatch(targets, {
    getMetricsSnapshot: () => riotApiClient.getMetricsSnapshot(),
    resolveTarget: async (input) => {
      const resolved = await riotSyncService.resolveImportIdentity(input);
      return {
        label:
          resolved.gameName && resolved.tagLine
            ? `${resolved.gameName}#${resolved.tagLine}`
            : resolved.puuid,
        puuid: resolved.puuid,
      };
    },
    importMatches: async (resolved) => {
      const userId = await resolveUserId(
        options.userId,
        { type: "puuid", puuid: resolved.puuid },
        resolved.puuid,
      );
      return riotSyncService.importRecentMatchesDetailed(userId, resolved.puuid, options.count);
    },
  });

  console.info("[riot-import-batch] summary");
  console.info(
    JSON.stringify(
      {
        ...result.summary,
        averageMsPerMatch: Number(result.summary.averageMsPerMatch.toFixed(2)),
      },
      null,
      2,
    ),
  );

  if (result.summary.failedTargets > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[riot-import-batch] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
