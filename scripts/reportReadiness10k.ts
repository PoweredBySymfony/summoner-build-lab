import { prisma } from "../server/src/lib/prisma.js";
import { closeMongoClient, getMongoDb } from "../server/src/lib/mongo.js";

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

  let snapshotsEvaluated = 0;
  let viableSnapshots = 0;
  let publishableSnapshots = 0;
  let nonPublishableButViableSnapshots = 0;
  let noViableSnapshotRequests = 0;
  const rejectionReasonCounts: Record<string, number> = {};

  for (const request of recentRequests) {
    const parameters =
      typeof request.parameters === "object" && request.parameters !== null && !Array.isArray(request.parameters)
        ? (request.parameters as {
            generationStatus?: string;
            attemptsSummary?: {
              snapshotsEvaluated?: number;
              attempts?: Array<{ rejectionReasons?: string[] }>;
            };
            viableSnapshots?: number;
            publishableSnapshots?: number;
            nonPublishableButViableSnapshots?: number;
            dominantRejectionReasons?: string[];
          })
        : {};

    if (
      parameters.generationStatus === "no_viable_snapshot_found"
      || parameters.generationStatus === "no_publishable_snapshot_found"
    ) {
      noViableSnapshotRequests += 1;
    }

    snapshotsEvaluated += Number(parameters.attemptsSummary?.snapshotsEvaluated ?? 0);
    viableSnapshots += Number(parameters.viableSnapshots ?? 0);
    publishableSnapshots += Number(parameters.publishableSnapshots ?? 0);
    nonPublishableButViableSnapshots += Number(parameters.nonPublishableButViableSnapshots ?? 0);

    for (const reason of parameters.dominantRejectionReasons ?? []) {
      rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] ?? 0) + 1;
    }

    for (const attempt of parameters.attemptsSummary?.attempts ?? []) {
      for (const reason of attempt.rejectionReasons ?? []) {
        rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] ?? 0) + 1;
      }
    }
  }

  const dominantRejectionReasons = Object.entries(rejectionReasonCounts)
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
        targetCompletionPercent: Number(((mongoMatchCount / targetMatches) * 100).toFixed(2)),
        mongoBackedMatchCoverage: totalImportedMatches > 0 ? Number(((mongoBackedMatches / totalImportedMatches) * 100).toFixed(2)) : 0,
        recentGeneratedMatchRequests: recentRequests.length,
        noViableSnapshotRequests,
        noViableSnapshotRate: recentRequests.length > 0 ? Number(((noViableSnapshotRequests / recentRequests.length) * 100).toFixed(2)) : 0,
        snapshotsEvaluated,
        viableSnapshots,
        viableSnapshotRate: snapshotsEvaluated > 0 ? Number(((viableSnapshots / snapshotsEvaluated) * 100).toFixed(2)) : 0,
        publishableSnapshots,
        publishableSnapshotRate: snapshotsEvaluated > 0 ? Number(((publishableSnapshots / snapshotsEvaluated) * 100).toFixed(2)) : 0,
        nonPublishableButViableSnapshots,
        dominantRejectionReasons,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[readiness-10k] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
    await prisma.$disconnect();
  });
