import { prisma } from "../server/src/lib/prisma.js";
import { buildDailyIngestionReport } from "../server/src/lib/riot/riotBatch.js";

function parseDays(argv: string[]) {
  const index = argv.findIndex((arg) => arg === "--days");
  if (index === -1) {
    return 1;
  }

  const value = Number(argv[index + 1] ?? "1");
  return Number.isFinite(value) && value > 0 ? value : 1;
}

async function main() {
  const days = parseDays(process.argv.slice(2));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);

  const matches = await prisma.importedMatch.findMany({
    where: {
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
      mongoMatchImportRef: true,
      mongoTimelineRef: true,
    },
  });

  const report = buildDailyIngestionReport(matches);
  const mongoBackedCount = matches.filter((match) => Boolean(match.mongoMatchImportRef)).length;
  const mongoTimelineCount = matches.filter((match) => Boolean(match.mongoTimelineRef)).length;
  console.info(
    JSON.stringify(
      {
        windowDays: days,
        generatedAt: new Date().toISOString(),
        ...report,
        timelineCoveragePercent: Number(report.timelineCoveragePercent.toFixed(2)),
        mongoBackedMatchCoverage: Number((matches.length > 0 ? (mongoBackedCount / matches.length) * 100 : 0).toFixed(2)),
        mongoBackedTimelineCoverage: Number((matches.length > 0 ? (mongoTimelineCount / matches.length) * 100 : 0).toFixed(2)),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[riot-ingestion-report] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
