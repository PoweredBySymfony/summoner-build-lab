import { prisma } from "../server/src/lib/prisma.js";
import { importedMatchArchiveRepository } from "../server/src/repositories/importedMatchArchiveRepository.js";

async function main() {
  const matches = await prisma.importedMatch.findMany({
    orderBy: { createdAt: "asc" },
  });

  let backed = 0;
  for (const match of matches) {
    const matchData = match.matchData as Record<string, unknown>;
    const timelineData = match.timelineData as Record<string, unknown> | null;
    const matchRaw = matchData?.raw;
    const timelineRaw = timelineData?.raw;
    if (!matchRaw || typeof matchRaw !== "object") {
      continue;
    }

    const refs = await importedMatchArchiveRepository.persistImportedMatchArtifacts({
      riotMatchId: match.riotMatchId,
      patch: match.patch ?? null,
      sourceRegion: match.sourceRegion ?? null,
      sourceKind: match.sourceKind ?? null,
      sourceMetadata: (match.sourceMetadata as Record<string, unknown> | null) ?? null,
      targetPuuid: match.targetPuuid ?? null,
      targetGameName: match.targetGameName ?? null,
      targetTagLine: match.targetTagLine ?? null,
      userId: match.userId,
      matchRaw: matchRaw as Record<string, unknown>,
      timelineRaw: timelineRaw && typeof timelineRaw === "object" ? (timelineRaw as Record<string, unknown>) : null,
      gameCreationAt: match.gameCreationAt ?? null,
    });

    await prisma.importedMatch.update({
      where: { id: match.id },
      data: {
        mongoMatchImportRef: refs.mongoMatchImportRef,
        mongoTimelineRef: refs.mongoTimelineRef,
        mongoBackfilledAt: refs.mongoMatchImportRef ? new Date() : null,
      },
    });
    backed += 1;
  }

  console.info(
    JSON.stringify(
      {
        processed: matches.length,
        mongoBackfilled: backed,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[backfill-matches-to-mongo] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
