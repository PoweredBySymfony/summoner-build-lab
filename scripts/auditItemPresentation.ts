import "dotenv/config";
import { Client } from "pg";
import { auditItems } from "../src/lib/itemPresentationAudit";
import type { GameItem } from "../src/types/domain";

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
    itemGroups: [],
    stats: row.stats && typeof row.stats === "object" && !Array.isArray(row.stats) ? (row.stats as Record<string, unknown>) : {},
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    activeEffect: row.activeEffect,
    passiveEffect: row.passiveEffect,
    buildsFrom: Array.isArray(row.buildsFrom) ? (row.buildsFrom as string[]) : [],
    buildsInto: Array.isArray(row.buildsInto) ? (row.buildsInto as string[]) : [],
    isBoots: row.isBoots,
    isLegendary: row.isLegendary,
    isConsumable: row.isConsumable,
    isTrinket: row.isTrinket,
    isStarter: row.isStarter,
    isActive: row.isActive,
    patch: row.patch,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing.");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query<ItemRow>(
    `SELECT id, "riotItemId", name, slug, image, "goldTotal", category, tags, stats, "shortDescription", "fullDescription", "activeEffect", "passiveEffect", "buildsFrom", "buildsInto", "isBoots", "isLegendary", "isConsumable", "isTrinket", "isStarter", "isActive", patch
     FROM "Item"
     ORDER BY "riotItemId"`,
  );
  await client.end();

  const items = result.rows.map(mapItem);
  const issues = auditItems(items);

  console.log(JSON.stringify({
    auditedItems: items.length,
    issuesCount: issues.length,
    issues: issues.slice(0, 200),
  }, null, 2));

  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.includes("auditItemPresentation.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
