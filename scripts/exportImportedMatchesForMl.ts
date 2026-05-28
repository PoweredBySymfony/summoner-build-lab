import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { dataDragonClient } from "../server/src/lib/gameData/dataDragonClient.js";
import { prisma } from "../server/src/lib/prisma.js";
import {
  buildPatchLookupCandidates,
  canonicalizePatch,
} from "../server/src/lib/riot/patchCanonical.js";
import { slugify } from "../server/src/lib/slug.js";

const rootDir = process.cwd();
const rawDir = path.join(rootDir, "ml", "data", "raw");
const catalogsDir = path.join(rawDir, "catalogs");

type DataDragonChampionSummary = Awaited<ReturnType<typeof dataDragonClient.getChampionSummary>>;
type DataDragonItemSummary = Awaited<ReturnType<typeof dataDragonClient.getItemSummary>>;

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function detectCategory(tags: string[] = []) {
  if (tags.includes("Boots")) return "boots";
  if (tags.includes("CriticalStrike")) return "crit";
  if (tags.includes("Armor") || tags.includes("SpellBlock")) return "defensive";
  if (tags.includes("SpellDamage")) return "mage";
  if (tags.includes("Lane")) return "starter";
  if (tags.includes("Trinket")) return "trinket";
  if (tags.includes("Health") || tags.includes("HealthRegen")) return "tank";
  if (tags.includes("Damage") || tags.includes("AttackSpeed")) return "fighter";
  return tags[0]?.toLowerCase() ?? "utility";
}

function deriveItemGroups(item: { tags?: string[]; from?: string[] | number[] }) {
  const groups = new Set<string>();
  const tags = new Set(item.tags ?? []);
  const buildsFrom = (item.from ?? []).map((entry) => Number(entry));

  if (tags.has("Boots")) {
    groups.add("Boots");
  }
  if (buildsFrom.includes(3035)) {
    groups.add("LastWhisper");
  }

  return [...groups];
}

function deriveBootItemIds(summary: DataDragonItemSummary) {
  const entries = Object.entries(summary.data);
  const bootItemIds = new Set<number>();

  for (const [itemId, item] of entries) {
    if (item.tags?.includes("Boots")) {
      bootItemIds.add(Number(itemId));
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [itemId, item] of entries) {
      const numericItemId = Number(itemId);
      if (bootItemIds.has(numericItemId)) {
        continue;
      }
      const buildsFrom = (item.from ?? []).map((entry) => Number(entry));
      if (buildsFrom.some((entry) => bootItemIds.has(entry))) {
        bootItemIds.add(numericItemId);
        changed = true;
      }
    }
  }

  return bootItemIds;
}

function resolveDataDragonVersionForPatch(
  patchCanonical: string,
  patchFormat: "year_patch" | "legacy_patch" | "unknown",
  versions: string[],
) {
  const candidates = buildPatchLookupCandidates(patchCanonical, patchFormat);
  const matched = candidates
    .map((candidate) => versions.find((version) => version.startsWith(`${candidate}.`)))
    .find(Boolean);
  if (!matched) {
    throw new Error(`Unable to resolve a Data Dragon version for patch ${patchCanonical}.`);
  }
  return matched;
}

function buildChampionCatalog(summary: DataDragonChampionSummary) {
  return Object.values(summary.data)
    .map((champion) => ({
      riotChampionId: Number(champion.key),
      championKey: champion.id,
      slug: slugify(champion.name),
      name: champion.name,
      patch: champion.version,
      tags: champion.tags,
      stats: champion.stats,
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

function buildItemCatalog(summary: DataDragonItemSummary, patchVersion: string) {
  const seenSlugs = new Map<string, number>();
  const derivedBootItemIds = deriveBootItemIds(summary);

  return Object.entries(summary.data)
    .map(([itemId, item]) => {
      const baseSlug = slugify(item.name);
      const nextCount = (seenSlugs.get(baseSlug) ?? 0) + 1;
      seenSlugs.set(baseSlug, nextCount);
      const slug = nextCount === 1 ? baseSlug : `${baseSlug}-${itemId}`;

      return {
        riotItemId: Number(itemId),
        slug,
        name: item.name,
        patch: patchVersion,
        goldTotal: item.gold.total,
        goldBase: item.gold.base,
        goldSell: item.gold.sell,
        category: detectCategory(item.tags ?? []),
        isBoots: derivedBootItemIds.has(Number(itemId)),
        isLegendary: item.gold.total >= 2200,
        isConsumable: item.consumed ?? false,
        isStarter: item.tags?.includes("Lane") ?? false,
        isActive: item.gold.purchasable && item.inStore !== false,
        tags: item.tags ?? [],
        buildsFrom: item.from ?? [],
        buildsInto: item.into ?? [],
        itemGroups: deriveItemGroups(item),
        mapAvailability: item.maps ?? null,
      };
    })
    .sort((left, right) => left.riotItemId - right.riotItemId);
}

async function writeCatalogPair(
  patch: string,
  ddVersion: string,
  itemSummary: DataDragonItemSummary,
  championSummary: DataDragonChampionSummary,
) {
  const patchDir = path.join(catalogsDir, patch);
  await mkdir(patchDir, { recursive: true });

  const itemCatalogPath = path.join(patchDir, "item_catalog.json");
  const championCatalogPath = path.join(patchDir, "champion_catalog.json");

  await Promise.all([
    writeFile(
      itemCatalogPath,
      JSON.stringify(buildItemCatalog(itemSummary, ddVersion), null, 2),
      "utf-8",
    ),
    writeFile(
      championCatalogPath,
      JSON.stringify(buildChampionCatalog(championSummary), null, 2),
      "utf-8",
    ),
  ]);

  return {
    itemCatalogPath: path.relative(rawDir, itemCatalogPath).replace(/\\/g, "/"),
    championCatalogPath: path.relative(rawDir, championCatalogPath).replace(/\\/g, "/"),
    ddVersion,
  };
}

async function main() {
  await mkdir(rawDir, { recursive: true });

  const matches = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      "id",
      "riotMatchId",
      "patch",
      "sourceRegion",
      "sourceKind",
      "sourceMetadata",
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
  `;

  const canonicalizedMatches = matches.map((entry) => {
    const matchData =
      typeof entry.matchData === "object" && entry.matchData !== null && !Array.isArray(entry.matchData)
        ? (entry.matchData as Record<string, unknown>)
        : {};
    const rawMatch =
      typeof matchData.raw === "object" && matchData.raw !== null && !Array.isArray(matchData.raw)
        ? (matchData.raw as Record<string, unknown>)
        : {};
    const info =
      typeof rawMatch.info === "object" && rawMatch.info !== null && !Array.isArray(rawMatch.info)
        ? (rawMatch.info as Record<string, unknown>)
        : {};
    const gameCreationAt = entry.gameCreationAt instanceof Date ? entry.gameCreationAt : toIsoString(entry.gameCreationAt);
    const patchInfo = canonicalizePatch(
      typeof info.gameVersion === "string" ? info.gameVersion : String(entry.patch ?? ""),
      gameCreationAt,
    );
    return {
      ...entry,
      patch: patchInfo.patchCanonical,
      patchCanonical: patchInfo.patchCanonical,
      patchFormat: patchInfo.patchFormat,
    };
  });

  const patches = [...new Set(canonicalizedMatches.map((entry) => String(entry.patch ?? "").trim()).filter(Boolean))].sort();
  const versions = await dataDragonClient.getVersions();
  const latestVersion = versions[0];

  const patchCatalogs: Record<
    string,
    { itemCatalogPath: string; championCatalogPath: string; ddVersion: string }
  > = {};

  for (const patch of patches) {
    const patchFormat =
      canonicalizedMatches.find((entry) => entry.patch === patch)?.patchFormat ?? "unknown";
    const ddVersion = resolveDataDragonVersionForPatch(patch, patchFormat, versions);
    const [itemSummary, championSummary] = await Promise.all([
      dataDragonClient.getItemSummary(ddVersion),
      dataDragonClient.getChampionSummary(ddVersion),
    ]);
    patchCatalogs[patch] = await writeCatalogPair(
      patch,
      ddVersion,
      itemSummary,
      championSummary,
    );
  }

  const [latestItemSummary, latestChampionSummary] = await Promise.all([
    dataDragonClient.getItemSummary(latestVersion),
    dataDragonClient.getChampionSummary(latestVersion),
  ]);
  const latestCatalog = await writeCatalogPair(
    "latest",
    latestVersion,
    latestItemSummary,
    latestChampionSummary,
  );

  const rawMatchesPath = path.join(rawDir, "imported_matches.jsonl");
  const manifestPath = path.join(rawDir, "manifest.json");
  const jsonl = canonicalizedMatches
    .map((entry) =>
      JSON.stringify({
        ...entry,
        sourceTier:
          typeof entry.sourceMetadata === "object"
          && entry.sourceMetadata !== null
          && !Array.isArray(entry.sourceMetadata)
          && typeof (entry.sourceMetadata as Record<string, unknown>).seed === "object"
          && (entry.sourceMetadata as Record<string, unknown>).seed !== null
            ? (((entry.sourceMetadata as Record<string, unknown>).seed as Record<string, unknown>).priorityTier ?? null)
            : null,
        sourceLeague:
          typeof entry.sourceMetadata === "object"
          && entry.sourceMetadata !== null
          && !Array.isArray(entry.sourceMetadata)
          && typeof (entry.sourceMetadata as Record<string, unknown>).seed === "object"
          && (entry.sourceMetadata as Record<string, unknown>).seed !== null
            ? (((entry.sourceMetadata as Record<string, unknown>).seed as Record<string, unknown>).league ?? null)
            : null,
        sourceRegionHint:
          typeof entry.sourceMetadata === "object"
          && entry.sourceMetadata !== null
          && !Array.isArray(entry.sourceMetadata)
          && typeof (entry.sourceMetadata as Record<string, unknown>).seed === "object"
          && (entry.sourceMetadata as Record<string, unknown>).seed !== null
            ? (((entry.sourceMetadata as Record<string, unknown>).seed as Record<string, unknown>).region ?? null)
            : null,
        patchCanonical: entry.patchCanonical ?? entry.patch ?? null,
        patchFormat: entry.patchFormat ?? "unknown",
        gameCreationAt: toIsoString(entry.gameCreationAt),
        timelineFetchedAt: toIsoString(entry.timelineFetchedAt),
        createdAt: toIsoString(entry.createdAt),
      }),
    )
    .join("\n");

  await Promise.all([
    writeFile(rawMatchesPath, jsonl ? `${jsonl}\n` : "", "utf-8"),
    writeFile(
      path.join(rawDir, "item_catalog.json"),
      JSON.stringify(buildItemCatalog(latestItemSummary, latestVersion), null, 2),
      "utf-8",
    ),
    writeFile(
      path.join(rawDir, "champion_catalog.json"),
      JSON.stringify(buildChampionCatalog(latestChampionSummary), null, 2),
      "utf-8",
    ),
    writeFile(
      manifestPath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          matchCount: canonicalizedMatches.length,
          matchesWithTimeline: canonicalizedMatches.filter((entry) => Boolean(entry.timelineData)).length,
          sourceKindDistribution: canonicalizedMatches.reduce<Record<string, number>>((accumulator, entry) => {
            const key = String(entry.sourceKind ?? "unknown");
            accumulator[key] = (accumulator[key] ?? 0) + 1;
            return accumulator;
          }, {}),
          patchFormatDistribution: canonicalizedMatches.reduce<Record<string, number>>((accumulator, entry) => {
            const key = String(entry.patchFormat ?? "unknown");
            accumulator[key] = (accumulator[key] ?? 0) + 1;
            return accumulator;
          }, {}),
          rawMatchesPath: "imported_matches.jsonl",
          itemCatalogPath: latestCatalog.itemCatalogPath,
          championCatalogPath: latestCatalog.championCatalogPath,
          itemRestrictionsPath: "../configs/item_restrictions.json",
          latestDataDragonVersion: latestVersion,
          patchCatalogs,
        },
        null,
        2,
      ),
      "utf-8",
    ),
  ]);

  console.info(
    `[ml-export] wrote ${canonicalizedMatches.length} imported matches (${canonicalizedMatches.filter((entry) => entry.timelineData).length} with timeline) and ${patches.length} patch-aware catalogs to ${rawDir}`,
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
