import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { getItemEffectBlocks, getItemStatLines } from "@/lib/itemPresentation";
import { auditItems } from "@/lib/itemPresentationAudit";
import type { GameItem } from "@/types/domain";

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

describe("item presentation catalog audit", () => {
  let client: Client;
  let items: GameItem[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing.");
    }

    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const result = await client.query<ItemRow>(
      `SELECT id, "riotItemId", name, slug, image, "goldTotal", category, tags, stats, "shortDescription", "fullDescription", "activeEffect", "passiveEffect", "buildsFrom", "buildsInto", "isBoots", "isLegendary", "isConsumable", "isTrinket", "isStarter", "isActive", patch
       FROM "Item"
       ORDER BY "riotItemId"`,
    );
    items = result.rows.map(mapItem);
  });

  afterAll(async () => {
    await client.end();
  });

  it("covers the full local item catalog", () => {
    expect(items.length).toBeGreaterThan(200);
  });

  it("has no presentation anomalies across the local item catalog", () => {
    expect(auditItems(items)).toEqual([]);
  });

  it("keeps Infinity Edge crit damage as an effect with a crit icon", () => {
    const infinityEdge = items.find((item) => item.riotItemId === 3031);
    expect(infinityEdge).toBeTruthy();

    expect(getItemStatLines(infinityEdge!)).toEqual([
      { key: "FlatCritChanceMod", label: "Chances de coup critique", value: "+25%", icon: "crit" },
      { key: "FlatPhysicalDamageMod", label: "Degats d'attaque", value: "+75", icon: "attackDamage" },
    ]);

    expect(getItemEffectBlocks(infinityEdge!)).toEqual([
      { body: "+30% de dégâts de coup critique", icon: "crit" },
    ]);
  });
});
