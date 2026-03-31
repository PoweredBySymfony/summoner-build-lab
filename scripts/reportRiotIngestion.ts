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
    },
  });

  const report = buildDailyIngestionReport(matches);
  console.info(
    JSON.stringify(
      {
        windowDays: days,
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
    console.error("[riot-ingestion-report] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
