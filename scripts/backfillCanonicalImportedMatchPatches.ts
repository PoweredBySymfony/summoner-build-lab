import { Prisma } from "@prisma/client";

import { prisma } from "../server/src/lib/prisma.js";
import { canonicalizePatch } from "../server/src/lib/riot/patchCanonical.js";

async function main() {
  const matches = await prisma.importedMatch.findMany({
    where: {
      patch: {
        startsWith: "16.",
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      riotMatchId: true,
      patch: true,
      gameCreationAt: true,
      matchData: true,
    },
  });

  let updated = 0;
  let skipped = 0;
  let missingVersion = 0;

  for (const importedMatch of matches) {
    const matchData =
      importedMatch.matchData && typeof importedMatch.matchData === "object" && !Array.isArray(importedMatch.matchData)
        ? (importedMatch.matchData as Prisma.JsonObject)
        : null;
    const raw =
      matchData?.raw && typeof matchData.raw === "object" && !Array.isArray(matchData.raw)
        ? (matchData.raw as Prisma.JsonObject)
        : null;
    const info =
      raw?.info && typeof raw.info === "object" && !Array.isArray(raw.info)
        ? (raw.info as Prisma.JsonObject)
        : null;
    const rawGameVersion = typeof info?.gameVersion === "string" ? info.gameVersion : null;
    const gameCreationAt =
      importedMatch.gameCreationAt ??
      (typeof info?.gameCreation === "number" ? new Date(info.gameCreation) : null);

    const canonicalPatch = canonicalizePatch(rawGameVersion ?? importedMatch.patch, gameCreationAt).patchCanonical;
    if (!rawGameVersion) {
      missingVersion += 1;
    }
    if (!canonicalPatch || canonicalPatch === importedMatch.patch) {
      skipped += 1;
      continue;
    }

    let nextMatchData = importedMatch.matchData;
    if (matchData) {
      const metadata =
        matchData.metadata && typeof matchData.metadata === "object" && !Array.isArray(matchData.metadata)
          ? ({ ...(matchData.metadata as Prisma.JsonObject), patch: canonicalPatch } as Prisma.JsonObject)
          : ({ patch: canonicalPatch } as Prisma.JsonObject);
      nextMatchData = {
        ...matchData,
        metadata,
      } satisfies Prisma.InputJsonObject;
    }

    await prisma.importedMatch.update({
      where: { id: importedMatch.id },
      data: {
        patch: canonicalPatch,
        matchData: nextMatchData as Prisma.InputJsonObject,
      },
    });

    updated += 1;
    console.info(
      `[patch-backfill] updated ${importedMatch.riotMatchId}: ${importedMatch.patch ?? "null"} -> ${canonicalPatch}`,
    );
  }

  console.info(
    `[patch-backfill] completed scanned=${matches.length} updated=${updated} skipped=${skipped} missingVersion=${missingVersion}`,
  );
}

main()
  .catch((error) => {
    console.error("[patch-backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
