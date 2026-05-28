import path from "node:path";

import { prisma } from "../server/src/lib/prisma.js";
import {
  buildCompetitiveSeedKey,
  loadCompetitiveIngestionCheckpoint,
  type CompetitiveResolvedSeed,
  type CompetitiveSeedMatchDiscovery,
} from "../server/src/lib/riot/competitiveIngestion.js";
import {
  COMPETITIVE_SOURCE_KINDS,
  mergeCompetitiveSourceMetadata,
  resolveFirstExistingPath,
  sourceTierFromSourceKind,
} from "./lib/competitiveImportedMatchProvenance.js";

type CliOptions = {
  checkpointPath: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    checkpointPath: path.join("data", "runtime", "competitive-ingestion", "checkpoint.json"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--checkpoint-path" && next) {
      options.checkpointPath = next;
      index += 1;
    }
  }

  return options;
}

function buildMatchDiscoveryIndex(discoveries: CompetitiveSeedMatchDiscovery[]) {
  const index = new Map<string, CompetitiveSeedMatchDiscovery>();
  for (const discovery of discoveries) {
    for (const matchId of discovery.matchIds) {
      if (!index.has(matchId)) {
        index.set(matchId, discovery);
      }
    }
  }
  return index;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const resolvedCheckpointPath = await resolveFirstExistingPath([
    options.checkpointPath,
    path.join("data", "runtime", "competitive-ingestion", "real-checkpoint.json"),
  ]);
  const checkpoint = await loadCompetitiveIngestionCheckpoint(resolvedCheckpointPath);
  if (!checkpoint) {
    throw new Error(`Checkpoint not found at ${resolvedCheckpointPath}`);
  }

  const discoveryByMatchId = buildMatchDiscoveryIndex(checkpoint.discoveredMatches ?? []);
  const resolvedSeedByKey = new Map<string, CompetitiveResolvedSeed>(
    (checkpoint.resolvedSeeds ?? []).map((seed) => [buildCompetitiveSeedKey(seed), seed]),
  );

  const rows = await prisma.importedMatch.findMany({
    where: {
      sourceKind: {
        in: [...COMPETITIVE_SOURCE_KINDS],
      },
    },
    select: {
      id: true,
      riotMatchId: true,
      sourceKind: true,
      sourceMetadata: true,
      sourceRegion: true,
    },
  });

  let updatedCount = 0;
  let checkpointBackfilledCount = 0;
  let sourceKindOnlyBackfilledCount = 0;
  let alreadyCompleteCount = 0;

  for (const row of rows) {
    const discovery = discoveryByMatchId.get(row.riotMatchId);
    const resolvedSeed = discovery ? resolvedSeedByKey.get(discovery.seedKey) : null;
    const seedMetadata =
      resolvedSeed
        ? {
          playerName: resolvedSeed.playerName,
          playerPage: resolvedSeed.playerPage ?? null,
          team: resolvedSeed.team,
          league: resolvedSeed.league,
          competition: resolvedSeed.competition,
          role: resolvedSeed.role,
          region: resolvedSeed.region,
          riotId: resolvedSeed.resolvedRiotId ?? resolvedSeed.riotId ?? null,
          puuid: resolvedSeed.puuid,
          platform: resolvedSeed.platformHint,
          cluster: resolvedSeed.cluster,
          priorityTier: resolvedSeed.priorityTier,
          priorityScore: resolvedSeed.priorityScore,
          discoverySource: resolvedSeed.discoverySource,
          seedSetVersion: resolvedSeed.seedSetVersion,
          season: resolvedSeed.season,
          sourceTournamentDate: resolvedSeed.sourceTournamentDate,
          sourceUrl: resolvedSeed.sourceUrl ?? null,
        }
        : discovery
          ? {
            playerName: discovery.playerName,
            team: discovery.team,
            league: discovery.league,
            competition: discovery.competition,
            role: discovery.role,
            region: discovery.region,
            puuid: discovery.puuid,
            priorityTier: discovery.priorityTier,
            priorityScore: discovery.priorityScore,
          }
          : {
            priorityTier: sourceTierFromSourceKind(row.sourceKind),
          };
    const decision = checkpoint.policyDecisionByMatchId?.[row.riotMatchId];
    const mergedMetadata = mergeCompetitiveSourceMetadata({
      sourceKind: row.sourceKind,
      sourceRegion: row.sourceRegion,
      existingMetadata: row.sourceMetadata,
      seed: seedMetadata,
      ingestion: decision
        ? {
          acceptedByPolicy: decision.acceptedByPolicy,
          acceptedReason: decision.acceptedReason,
          rejectionReason: decision.rejectionReason,
          fallbackReason: decision.fallbackReason,
          policyMode: decision.policyMode,
          patchBucket: decision.policyBucket,
          queueBucket: decision.queueBucket,
          sourceBucket: decision.sourceBucket,
          priorityBand: decision.priorityBand,
        }
        : undefined,
      backfill: {
        provenanceBackfilledAt: new Date().toISOString(),
        strategy: resolvedSeed || discovery ? "checkpoint-match-join" : "source-kind-fallback",
        checkpointPath: resolvedCheckpointPath,
      },
    });
    const serializedBefore = JSON.stringify(row.sourceMetadata ?? null);
    const serializedAfter = JSON.stringify(mergedMetadata);

    if (serializedBefore === serializedAfter) {
      alreadyCompleteCount += 1;
      continue;
    }

    await prisma.importedMatch.update({
      where: {
        id: row.id,
      },
      data: {
        sourceKind: row.sourceKind,
        sourceRegion:
          (typeof seedMetadata.region === "string" && seedMetadata.region.length > 0
            ? seedMetadata.region
            : row.sourceRegion) ?? null,
        sourceMetadata: mergedMetadata,
      },
    });

    updatedCount += 1;
    if (resolvedSeed || discovery) {
      checkpointBackfilledCount += 1;
    } else {
      sourceKindOnlyBackfilledCount += 1;
    }
  }

  const competitiveRowsAfter = await prisma.importedMatch.findMany({
    where: {
      sourceKind: {
        in: [...COMPETITIVE_SOURCE_KINDS],
      },
    },
    select: {
      sourceKind: true,
      sourceMetadata: true,
    },
  });
  const remainingUnknownTierCount = competitiveRowsAfter.filter((row) => {
    const seed =
      typeof row.sourceMetadata === "object" && row.sourceMetadata !== null && !Array.isArray(row.sourceMetadata)
      && typeof (row.sourceMetadata as Record<string, unknown>).seed === "object"
      && (row.sourceMetadata as Record<string, unknown>).seed !== null
        ? ((row.sourceMetadata as Record<string, unknown>).seed as Record<string, unknown>)
        : {};
    const tier = typeof seed.priorityTier === "string" && seed.priorityTier.length > 0
      ? seed.priorityTier
      : sourceTierFromSourceKind(row.sourceKind);
    return tier === "unknown";
  }).length;

  console.info(JSON.stringify({
    checkpointPath: resolvedCheckpointPath,
    competitiveMatchesScanned: rows.length,
    updatedCount,
    checkpointBackfilledCount,
    sourceKindOnlyBackfilledCount,
    alreadyCompleteCount,
    remainingUnknownTierCount,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[backfill-competitive-provenance] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
