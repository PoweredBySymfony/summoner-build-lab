import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { getItemGroups } from "../server/src/lib/itemGroups.js";
import { buildStaticDataAuditMarkdown, runStaticDataAudit } from "../src/lib/staticDataAudit";
import type { ChampionView, GameItem } from "../src/types/domain";

type ItemRow = {
  id: string;
  riotItemId: number;
  name: string;
  slug: string;
  image: string;
  goldTotal: number;
  category: string | null;
  tags: unknown;
  stats: unknown;
  shortDescription: string | null;
  fullDescription: string | null;
  activeEffect: string | null;
  passiveEffect: string | null;
  buildsFrom: unknown;
  buildsInto: unknown;
  isBoots: boolean;
  isLegendary: boolean;
  isConsumable: boolean;
  isTrinket: boolean;
  isStarter: boolean;
  isActive: boolean;
  patch: string;
};

type ChampionRow = {
  id: string;
  riotChampionId: number | null;
  championKey: string | null;
  name: string;
  title: string | null;
  slug: string;
  image: string;
  iconImage: string | null;
  splashImage: string | null;
  rolePrimary: string | null;
  roleSecondary: string | null;
  tags: unknown;
  stats: unknown;
  patch: string;
  isActive: boolean;
};

function mapItem(row: ItemRow): GameItem {
  return {
    id: row.id,
    databaseId: row.id,
    riotItemId: row.riotItemId,
    name: row.name,
    slug: row.slug,
    icon: row.image,
    image: row.image,
    cost: row.goldTotal,
    category: row.category,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    itemGroups: getItemGroups({
      ...row,
      goldBase: null,
      goldSell: null,
      mapAvailability: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).map((entry) => String(entry)),
    stats: row.stats && typeof row.stats === "object" && !Array.isArray(row.stats) ? (row.stats as Record<string, unknown>) : {},
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    activeEffect: row.activeEffect,
    passiveEffect: row.passiveEffect,
    buildsFrom: Array.isArray(row.buildsFrom) ? (row.buildsFrom as string[]).map((entry) => String(entry)) : [],
    buildsInto: Array.isArray(row.buildsInto) ? (row.buildsInto as string[]).map((entry) => String(entry)) : [],
    isBoots: row.isBoots,
    isLegendary: row.isLegendary,
    isConsumable: row.isConsumable,
    isTrinket: row.isTrinket,
    isStarter: row.isStarter,
    isActive: row.isActive,
    patch: row.patch,
  };
}

function mapChampion(row: ChampionRow): ChampionView {
  return {
    id: row.slug,
    databaseId: row.id,
    riotChampionId: row.riotChampionId,
    championKey: row.championKey,
    name: row.name,
    title: row.title,
    slug: row.slug,
    icon: row.iconImage || row.image,
    splashImage: row.splashImage,
    image: row.image,
    roles: [row.rolePrimary, row.roleSecondary].filter((value): value is string => Boolean(value)),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    stats: row.stats && typeof row.stats === "object" && !Array.isArray(row.stats) ? (row.stats as Record<string, unknown>) : {},
    patch: row.patch,
    isActive: row.isActive,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing.");
  }

  const reportDir = path.resolve(process.cwd(), "reports", "static-data-audit");
  await mkdir(reportDir, { recursive: true });

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const [itemResult, championResult] = await Promise.all([
    client.query<ItemRow>(
      `SELECT id, "riotItemId", name, slug, image, "goldTotal", category, tags, stats, "shortDescription", "fullDescription", "activeEffect", "passiveEffect", "buildsFrom", "buildsInto", "isBoots", "isLegendary", "isConsumable", "isTrinket", "isStarter", "isActive", patch
       FROM "Item"
       WHERE "isActive" = true
       ORDER BY "riotItemId"`,
    ),
    client.query<ChampionRow>(
      `SELECT id, "riotChampionId", "championKey", name, title, slug, image, "iconImage", "splashImage", "rolePrimary", "roleSecondary", tags, stats, patch, "isActive"
       FROM "Champion"
       WHERE "isActive" = true
       ORDER BY "riotChampionId"`,
    ),
  ]);

  await client.end();

  const report = runStaticDataAudit({
    items: itemResult.rows.map(mapItem),
    champions: championResult.rows.map(mapChampion),
  });
  const markdown = buildStaticDataAuditMarkdown(report);

  const jsonPath = path.join(reportDir, "latest.json");
  const markdownPath = path.join(reportDir, "latest.md");
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8"),
    writeFile(markdownPath, `${markdown}\n`, "utf-8"),
  ]);

  console.log(JSON.stringify({
    jsonPath,
    markdownPath,
    itemIssueCount: report.itemSummary.issueCount,
    championIssueCount: report.championSummary.issueCount,
    totalIssueCount: report.issues.length,
  }, null, 2));

  if (report.issues.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.includes("auditStaticData.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
