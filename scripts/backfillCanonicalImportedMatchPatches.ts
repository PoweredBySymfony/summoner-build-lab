import { Prisma } from "@prisma/client";

import { prisma } from "../server/src/lib/prisma.js";
import { canonicalizePatch } from "../server/src/lib/riot/patchCanonical.js";

type ImportedMatchPatchCandidate = Awaited<
  ReturnType<typeof prisma.importedMatch.findMany>
>[number];

function asJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Prisma.JsonObject
    : null;
}

function readRawMatchInfo(importedMatch: ImportedMatchPatchCandidate) {
  const matchData = asJsonObject(importedMatch.matchData);
  const raw = asJsonObject(matchData?.raw);
  return {
    matchData,
    info: asJsonObject(raw?.info),
  };
}

function getCanonicalPatchInput(importedMatch: ImportedMatchPatchCandidate) {
  const { matchData, info } = readRawMatchInfo(importedMatch);
  const rawGameVersion = typeof info?.gameVersion === "string" ? info.gameVersion : null;
  const gameCreationAt =
    importedMatch.gameCreationAt ??
    (typeof info?.gameCreation === "number" ? new Date(info.gameCreation) : null);

  return {
    matchData,
    rawGameVersion,
    gameCreationAt,
    canonicalPatch: canonicalizePatch(rawGameVersion ?? importedMatch.patch, gameCreationAt).patchCanonical,
  };
}

function withCanonicalPatchMetadata(matchData: Prisma.JsonObject | null, canonicalPatch: string) {
  if (!matchData) {
    return null;
  }

  const metadata = asJsonObject(matchData.metadata);
  return {
    ...matchData,
    metadata: {
      ...(metadata ?? {}),
      patch: canonicalPatch,
    },
  } satisfies Prisma.InputJsonObject;
}

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
    const { matchData, rawGameVersion, canonicalPatch } = getCanonicalPatchInput(importedMatch);
    if (!rawGameVersion) {
      missingVersion += 1;
    }
    if (!canonicalPatch || canonicalPatch === importedMatch.patch) {
      skipped += 1;
      continue;
    }

    const nextMatchData = withCanonicalPatchMetadata(matchData, canonicalPatch) ?? importedMatch.matchData;

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

try {
  await main();
} catch (error) {
  console.error("[patch-backfill] failed", error);
  process.exitCode = 1;
} finally {
  try { await prisma.$disconnect(); } catch { /* ignore */ }
}
