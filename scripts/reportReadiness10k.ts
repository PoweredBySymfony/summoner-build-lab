import { prisma } from "../server/src/lib/prisma.js";
import { closeMongoClient, getMongoDb } from "../server/src/lib/mongo.js";

type RequestParameters = {
  generationStatus?: string;
  attemptsSummary?: {
    snapshotsEvaluated?: number;
    attempts?: Array<{ rejectionReasons?: string[] }>;
  };
  viableSnapshots?: number;
  publishableSnapshots?: number;
  nonPublishableButViableSnapshots?: number;
  dominantRejectionReasons?: string[];
};

type ReadinessCounters = {
  snapshotsEvaluated: number;
  viableSnapshots: number;
  publishableSnapshots: number;
  nonPublishableButViableSnapshots: number;
  noViableSnapshotRequests: number;
  rejectionReasonCounts: Record<string, number>;
};

function getRequestParameters(parameters: unknown): RequestParameters {
  return typeof parameters === "object" && parameters !== null && !Array.isArray(parameters)
    ? parameters as RequestParameters
    : {};
}

function isNoViableSnapshotStatus(status: string | undefined) {
  return status === "no_viable_snapshot_found" || status === "no_publishable_snapshot_found";
}

function incrementRejectionReasonCounts(counts: Record<string, number>, reasons: string[] | undefined) {
  for (const reason of reasons ?? []) {
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
}

function createReadinessCounters(): ReadinessCounters {
  return {
    snapshotsEvaluated: 0,
    viableSnapshots: 0,
    publishableSnapshots: 0,
    nonPublishableButViableSnapshots: 0,
    noViableSnapshotRequests: 0,
    rejectionReasonCounts: {},
  };
}

function addRequestToReadinessCounters(counters: ReadinessCounters, parameters: RequestParameters) {
  if (isNoViableSnapshotStatus(parameters.generationStatus)) {
    counters.noViableSnapshotRequests += 1;
  }

  counters.snapshotsEvaluated += Number(parameters.attemptsSummary?.snapshotsEvaluated ?? 0);
  counters.viableSnapshots += Number(parameters.viableSnapshots ?? 0);
  counters.publishableSnapshots += Number(parameters.publishableSnapshots ?? 0);
  counters.nonPublishableButViableSnapshots += Number(parameters.nonPublishableButViableSnapshots ?? 0);

  incrementRejectionReasonCounts(counters.rejectionReasonCounts, parameters.dominantRejectionReasons);
  for (const attempt of parameters.attemptsSummary?.attempts ?? []) {
    incrementRejectionReasonCounts(counters.rejectionReasonCounts, attempt.rejectionReasons);
  }
}

function calculatePercent(numerator: number, denominator: number) {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;
}

async function main() {
  const targetMatches = 10_000;
  const db = await getMongoDb();
  const mongoMatchCount = db ? await db.collection("match_imports_raw").countDocuments() : 0;
  const mongoTimelineCount = db ? await db.collection("timeline_frames_raw").countDocuments() : 0;

  const totalImportedMatches = await prisma.importedMatch.count();
  const mongoBackedMatches = await prisma.importedMatch.count({
    where: {
      mongoMatchImportRef: { not: null },
    },
  });

  const recentRequests = await prisma.generatedPuzzleRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 250,
    select: {
      status: true,
      parameters: true,
    },
  });

  const counters = createReadinessCounters();

  for (const request of recentRequests) {
    addRequestToReadinessCounters(counters, getRequestParameters(request.parameters));
  }

  const dominantRejectionReasons = Object.entries(counters.rejectionReasonCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  console.info(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        targetMatches,
        totalImportedMatches,
        mongoMatchCount,
        mongoTimelineCount,
        targetCompletionPercent: calculatePercent(mongoMatchCount, targetMatches),
        mongoBackedMatchCoverage: calculatePercent(mongoBackedMatches, totalImportedMatches),
        recentGeneratedMatchRequests: recentRequests.length,
        noViableSnapshotRequests: counters.noViableSnapshotRequests,
        noViableSnapshotRate: calculatePercent(counters.noViableSnapshotRequests, recentRequests.length),
        snapshotsEvaluated: counters.snapshotsEvaluated,
        viableSnapshots: counters.viableSnapshots,
        viableSnapshotRate: calculatePercent(counters.viableSnapshots, counters.snapshotsEvaluated),
        publishableSnapshots: counters.publishableSnapshots,
        publishableSnapshotRate: calculatePercent(counters.publishableSnapshots, counters.snapshotsEvaluated),
        nonPublishableButViableSnapshots: counters.nonPublishableButViableSnapshots,
        dominantRejectionReasons,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  console.error("[readiness-10k] failed", error);
  process.exitCode = 1;
} finally {
  try { await closeMongoClient(); } catch { /* ignore */ }
  try { await prisma.$disconnect(); } catch { /* ignore */ }
}
