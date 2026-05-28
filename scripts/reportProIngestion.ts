import { prisma } from "../server/src/lib/prisma.js";
import { buildProIngestionReport } from "../server/src/lib/riot/proIngestion.js";

function parseDays(argv: string[]) {
  const index = argv.findIndex((arg) => arg === "--days");
  if (index === -1) {
    return 365;
  }

  const value = Number(argv[index + 1] ?? "365");
  return Number.isFinite(value) && value > 0 ? value : 365;
}

async function main() {
  const days = parseDays(process.argv.slice(2));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);

  const matches = await prisma.importedMatch.findMany({
    where: {
      sourceKind: "PRO_SEED",
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

  const report = buildProIngestionReport(
    matches.map((row) => {
      const metadata = (row.sourceMetadata ?? {}) as {
        seed?: { league?: string | null; competition?: string | null };
      };

      return {
        patch: row.patch,
        timelineMissingReason: row.timelineMissingReason,
        gameCreationAt: row.gameCreationAt,
        timelineFetchedAt: row.timelineFetchedAt,
        targetRole: row.targetRole,
        sourceKind: row.sourceKind,
        sourceLeague: metadata.seed?.league ?? null,
        sourceCompetition: metadata.seed?.competition ?? null,
      };
    }),
  );

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
    console.error("[pro-ingestion-report] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
