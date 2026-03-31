import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../server/src/lib/prisma.js";

const rootDir = process.cwd();
const rawDir = path.join(rootDir, "ml", "data", "raw");

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
}

async function main() {
  await mkdir(rawDir, { recursive: true });

  const [matches, items, champions] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        "id",
        "riotMatchId",
        "patch",
        "sourceRegion",
        "targetPuuid",
        "targetGameName",
        "targetTagLine",
        "targetChampionId",
        "targetChampionSlug",
        "targetRole",
        "gameCreationAt",
        "gameDurationSeconds",
        "timelineFetchedAt",
        "timelineMissingReason",
        "matchData",
        "timelineData",
        "createdAt"
      FROM "ImportedMatch"
      ORDER BY COALESCE("gameCreationAt", "createdAt") ASC, "createdAt" ASC
    `,
    prisma.item.findMany({
      orderBy: { riotItemId: "asc" },
      select: {
        riotItemId: true,
        slug: true,
        name: true,
        goldTotal: true,
        category: true,
        patch: true,
        isBoots: true,
        isLegendary: true,
        isConsumable: true,
        isStarter: true,
        isActive: true,
        tags: true,
        buildsFrom: true,
        buildsInto: true,
      },
    }),
    prisma.champion.findMany({
      orderBy: { slug: "asc" },
      select: {
        riotChampionId: true,
        championKey: true,
        slug: true,
        name: true,
        rolePrimary: true,
        roleSecondary: true,
        patch: true,
        tags: true,
      },
    }),
  ]);

  const rawMatchesPath = path.join(rawDir, "imported_matches.jsonl");
  const itemsPath = path.join(rawDir, "item_catalog.json");
  const championsPath = path.join(rawDir, "champion_catalog.json");
  const manifestPath = path.join(rawDir, "manifest.json");

  const jsonl = matches
    .map((entry) =>
      JSON.stringify({
        ...entry,
        gameCreationAt: toIsoString(entry.gameCreationAt),
        timelineFetchedAt: toIsoString(entry.timelineFetchedAt),
        createdAt: toIsoString(entry.createdAt),
      }),
    )
    .join("\n");

  await Promise.all([
    writeFile(rawMatchesPath, jsonl ? `${jsonl}\n` : "", "utf-8"),
    writeFile(itemsPath, JSON.stringify(items, null, 2), "utf-8"),
    writeFile(championsPath, JSON.stringify(champions, null, 2), "utf-8"),
    writeFile(
      manifestPath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          matchCount: matches.length,
          matchesWithTimeline: matches.filter((entry) => Boolean(entry.timelineData)).length,
          rawMatchesPath: "imported_matches.jsonl",
          itemCatalogPath: "item_catalog.json",
          championCatalogPath: "champion_catalog.json",
        },
        null,
        2,
      ),
      "utf-8",
    ),
  ]);

  console.info(
    `[ml-export] wrote ${matches.length} imported matches (${matches.filter((entry) => entry.timelineData).length} with timeline) to ${rawDir}`,
  );
}

main()
  .catch((error) => {
    console.error("[ml-export] failed to export imported matches for ML", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
