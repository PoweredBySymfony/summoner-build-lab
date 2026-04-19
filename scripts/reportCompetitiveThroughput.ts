import path from "node:path";

import { prisma } from "../server/src/lib/prisma.js";
import { loadCompetitiveIngestionCheckpoint } from "../server/src/lib/riot/competitiveIngestion.js";
import { resolveNewestExistingPath } from "./lib/competitiveImportedMatchProvenance.js";

type CliOptions = {
  checkpointPath: string;
};

function parseArgs(argv: string[]): CliOptions {
  const checkpointIndex = argv.findIndex((arg) => arg === "--checkpoint-path");
  return {
    checkpointPath:
      checkpointIndex === -1
        ? path.join("data", "runtime", "competitive-ingestion", "checkpoint.json")
        : argv[checkpointIndex + 1],
  };
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checkpointPath = await resolveNewestExistingPath([
    options.checkpointPath,
    path.join("data", "runtime", "competitive-ingestion", "real-checkpoint.json"),
  ]);
  const checkpoint = checkpointPath ? await loadCompetitiveIngestionCheckpoint(checkpointPath) : null;
  if (!checkpoint) {
    throw new Error("Competitive ingestion checkpoint not found.");
  }

  const [importsLastHour, importsLast6Hours, importsLast24Hours, totalCompetitiveImports] = await Promise.all([
    prisma.importedMatch.count({
      where: {
        sourceKind: { in: ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"] },
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    }),
    prisma.importedMatch.count({
      where: {
        sourceKind: { in: ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"] },
        createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      },
    }),
    prisma.importedMatch.count({
      where: {
        sourceKind: { in: ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.importedMatch.count({
      where: {
        sourceKind: { in: ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"] },
      },
    }),
  ]);

  console.info(JSON.stringify({
    generatedAt: new Date().toISOString(),
    checkpointPath,
    checkpointGeneratedAt: checkpoint.generatedAt,
    targetUniqueMatches: checkpoint.targetUniqueMatches,
    totalCompetitiveImports,
    importedMatchIdsTracked: checkpoint.importedMatchIds.length,
    attemptedMatchIdsTracked: checkpoint.attemptedMatchIds.length,
    failedMatchesTracked: checkpoint.failedMatches.length,
    rejectedMatchesTracked: checkpoint.rejectedMatchIds.length,
    discoveredSeedsTracked: checkpoint.discoveredMatches.length,
    resolvedSeedsTracked: checkpoint.resolvedSeeds.length,
    openedFallbackTiers: checkpoint.openedFallbackTiers ?? [],
    importsLastHour,
    importsLast6Hours,
    importsLast24Hours,
    resolvedSeedsByTier: countBy(checkpoint.resolvedSeeds.map((seed) => seed.priorityTier)),
    resolvedSeedsByPlatform: countBy(
      checkpoint.resolvedSeeds
        .map((seed) => seed.platformHint ?? "unknown")
        .filter(Boolean),
    ),
    importedByTier: countBy(
      checkpoint.importedMatchIds
        .map((matchId) => checkpoint.policyDecisionByMatchId?.[matchId]?.sourceBucket ?? "unknown"),
    ),
    importedByPriorityBand: countBy(
      checkpoint.importedMatchIds
        .map((matchId) => checkpoint.policyDecisionByMatchId?.[matchId]?.priorityBand ?? "unknown"),
    ),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[competitive-throughput-report] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
