import path from "node:path";

import { prisma } from "../server/src/lib/prisma.js";
import {
  buildCompetitiveIngestionReport,
  loadCompetitiveIngestionCheckpoint,
  type CompetitiveDiscoveredMatch,
  type CompetitiveResolvedSeed,
} from "../server/src/lib/riot/competitiveIngestion.js";

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
  const checkpoint = await loadCompetitiveIngestionCheckpoint(path.resolve(options.checkpointPath));

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
    },
  });

  const report = buildCompetitiveIngestionReport({
    persistedRows: matches.map((row) => {
      const metadata = (row.sourceMetadata ?? {}) as {
        seed?: {
          league?: string | null;
          competition?: string | null;
          region?: string | null;
          priorityTier?: string | null;
        };
        ingestion?: {
          queueId?: number | null;
          patchBucket?: "exact_target_patch" | "adjacent_recent_patch" | "out_of_target_patch" | null;
          queueBucket?: "preferred_queue" | "fallback_queue" | "out_of_policy_queue" | null;
          priorityBand?: "tier1" | "tier2" | "tier3" | "tier4" | "tier5" | null;
        };
      };

      return {
        patch: row.patch,
        queueId: metadata.ingestion?.queueId ?? null,
        timelineMissingReason: row.timelineMissingReason,
        gameCreationAt: row.gameCreationAt,
        timelineFetchedAt: row.timelineFetchedAt,
        targetRole: row.targetRole,
        sourceKind: row.sourceKind,
        sourceLeague: metadata.seed?.league ?? null,
        sourceCompetition: metadata.seed?.competition ?? null,
        sourceRegion: metadata.seed?.region ?? null,
        priorityTier: metadata.seed?.priorityTier ?? null,
        patchBucket: metadata.ingestion?.patchBucket ?? null,
        queueBucket: metadata.ingestion?.queueBucket ?? null,
        priorityBand: metadata.ingestion?.priorityBand ?? null,
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
