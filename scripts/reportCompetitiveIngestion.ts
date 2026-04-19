import path from "node:path";

import { prisma } from "../server/src/lib/prisma.js";
import {
  buildCompetitiveIngestionReport,
  loadCompetitiveIngestionCheckpoint,
  type CompetitiveDiscoveredMatch,
  type CompetitiveResolvedSeed,
} from "../server/src/lib/riot/competitiveIngestion.js";
import {
  extractCompetitiveProvenance,
  getIngestionMetadata,
  resolveNewestExistingPath,
} from "./lib/competitiveImportedMatchProvenance.js";

function parseOptions(argv: string[]) {
  const daysIndex = argv.findIndex((arg) => arg === "--days");
  const checkpointIndex = argv.findIndex((arg) => arg === "--checkpoint-path");

  return {
    days: daysIndex === -1 ? 365 : Number(argv[daysIndex + 1] ?? "365"),
    checkpointPath:
      checkpointIndex === -1
        ? path.join("data", "runtime", "competitive-ingestion", "checkpoint.json")
        : argv[checkpointIndex + 1],
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1_000);
  const checkpointPath = await resolveNewestExistingPath([
    options.checkpointPath,
    path.join("data", "runtime", "competitive-ingestion", "real-checkpoint.json"),
  ]);
  const checkpoint = await loadCompetitiveIngestionCheckpoint(checkpointPath);

  const matches = await prisma.importedMatch.findMany({
    where: {
      sourceKind: {
        in: ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"],
      },
      createdAt: {
        gte: since,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      patch: true,
      timelineMissingReason: true,
      gameCreationAt: true,
      timelineFetchedAt: true,
      targetRole: true,
      sourceKind: true,
      sourceMetadata: true,
      sourceRegion: true,
    },
  });

  const report = buildCompetitiveIngestionReport({
    persistedRows: matches.map((row) => {
      const provenance = extractCompetitiveProvenance(row);
      const ingestion = getIngestionMetadata(row.sourceMetadata);
      const metadata =
        typeof row.sourceMetadata === "object" && row.sourceMetadata !== null && !Array.isArray(row.sourceMetadata)
          ? (row.sourceMetadata as { seed?: { competition?: string | null } })
          : {};

      return {
        patch: row.patch,
        queueId: typeof ingestion.queueId === "number" ? ingestion.queueId : null,
        timelineMissingReason: row.timelineMissingReason,
        gameCreationAt: row.gameCreationAt,
        timelineFetchedAt: row.timelineFetchedAt,
        targetRole: row.targetRole,
        sourceKind: row.sourceKind,
        sourceLeague: provenance.sourceLeague,
        sourceCompetition: metadata.seed?.competition ?? null,
        sourceRegion: provenance.sourceRegionHint,
        priorityTier: provenance.priorityTier,
        patchBucket:
          ingestion.patchBucket === "exact_target_patch"
          || ingestion.patchBucket === "adjacent_recent_patch"
          || ingestion.patchBucket === "out_of_target_patch"
            ? ingestion.patchBucket
            : null,
        queueBucket:
          ingestion.queueBucket === "preferred_queue"
          || ingestion.queueBucket === "fallback_queue"
          || ingestion.queueBucket === "out_of_policy_queue"
            ? ingestion.queueBucket
            : null,
        priorityBand:
          ingestion.priorityBand === "tier1"
          || ingestion.priorityBand === "tier2"
          || ingestion.priorityBand === "tier3"
          || ingestion.priorityBand === "tier4"
          || ingestion.priorityBand === "tier5"
            ? ingestion.priorityBand
            : null,
      };
    }),
    discoveredMatches: (
      checkpoint?.discoveredMatches.flatMap((seedDiscovery) =>
        seedDiscovery.matchIds.map((matchId) => {
          const decision = checkpoint.policyDecisionByMatchId?.[matchId];
          if (!decision) {
            return null;
          }
          return {
            matchId,
            seedKey: seedDiscovery.seedKey,
            playerName: seedDiscovery.playerName,
            team: seedDiscovery.team,
            league: seedDiscovery.league,
            competition: seedDiscovery.competition,
            role: seedDiscovery.role,
            priorityTier: seedDiscovery.priorityTier,
            priorityScore: seedDiscovery.priorityScore,
            platform: null,
            cluster: seedDiscovery.region,
            queueId: null,
            patch: null,
            gameCreationAt: null,
            acceptedByPolicy: decision.acceptedByPolicy,
            acceptedReason: decision.acceptedReason,
            rejectionReason: decision.rejectionReason,
            fallbackReason: decision.fallbackReason,
            policyMode: decision.policyMode,
            policyBucket: decision.policyBucket,
            queueBucket: decision.queueBucket,
            sourceBucket: decision.sourceBucket,
            priorityBand: decision.priorityBand,
            matchPriorityScore: 0,
          };
        }).filter(Boolean),
      ) ?? []
    ) as CompetitiveDiscoveredMatch[],
    discoveries: checkpoint?.discoveredMatches ?? [],
    resolvedSeeds: (checkpoint?.resolvedSeeds ?? []) as CompetitiveResolvedSeed[],
    failedMatches: checkpoint?.failedMatches ?? [],
    openedFallbackTiers: checkpoint?.openedFallbackTiers ?? [],
  });

  console.info(
    JSON.stringify(
      {
        windowDays: options.days,
        generatedAt: new Date().toISOString(),
        ...report,
        timelineCoveragePercent: Number(report.timelineCoveragePercent.toFixed(2)),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[competitive-ingestion-report] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
