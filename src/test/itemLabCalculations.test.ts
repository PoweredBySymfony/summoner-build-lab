import { describe, expect, it } from "vitest";
import { analyzeSetup, buildComparisonSummary } from "@/lib/item-lab/calculations";
import type { ChampionView, GameItem } from "@/types/domain";

const champion: ChampionView = {
  id: "jinx",
  databaseId: "db-jinx",
  riotChampionId: 222,
  championKey: "Jinx",
  name: "Jinx",
  title: "the Loose Cannon",
  slug: "jinx",
  icon: "https://example.com/jinx.png",
  image: "https://example.com/jinx.png",
  roles: ["ADC"],
  tags: ["Marksman"],
  stats: {
    hp: 630,
    hpperlevel: 105,
    mp: 260,
    mpperlevel: 50,
    movespeed: 325,
    armor: 26,
    armorperlevel: 4.7,
    spellblock: 30,
    spellblockperlevel: 1.3,
    hpregen: 3.75,
    hpregenperlevel: 0.55,
    mpregen: 6.7,
    mpregenperlevel: 1,
    crit: 0,
    critperlevel: 0,
    attackdamage: 59,
    attackdamageperlevel: 3.4,
    attackspeed: 0.625,
    attackspeedperlevel: 1,
  },
  patch: "14.10",
  isActive: true,
};

const adItem: GameItem = {
  id: "bf-sword",
  databaseId: "db-bf-sword",
  riotItemId: 1038,
  name: "B. F. Sword",
  slug: "bf-sword",
  icon: "https://example.com/bf.png",
  image: "https://example.com/bf.png",
  cost: 1300,
  tags: ["Damage"],
  stats: { FlatPhysicalDamageMod: 40 },
  buildsFrom: [],
  buildsInto: [],
  isBoots: false,
  isLegendary: false,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  patch: "14.10",
};

const asCritItem: GameItem = {
  id: "kraken",
  databaseId: "db-kraken",
  riotItemId: 6672,
  name: "Kraken Slayer",
  slug: "kraken-slayer",
  icon: "https://example.com/kraken.png",
  image: "https://example.com/kraken.png",
  cost: 3100,
  tags: ["AttackSpeed", "CriticalStrike"],
  stats: { FlatPhysicalDamageMod: 40, PercentAttackSpeedMod: 0.35, FlatCritChanceMod: 0.25 },
  buildsFrom: [],
  buildsInto: [],
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  patch: "14.10",
};

describe("item lab calculations", () => {
  it("adds champion base stats and item bonuses", () => {
    const analysis = analyzeSetup({
      setup: { championId: "jinx", level: 11, itemIds: [adItem.id, null, null, null, null, null] },
      champion,
      items: [adItem],
    });

    expect(analysis.stats.attackDamage).toBeGreaterThan(99);
    expect(analysis.bonusStats.attackDamage).toBe(40);
    expect(analysis.totalGold).toBe(1300);
  });

  it("captures comparison narrative when one setup has more dps", () => {
    const base = analyzeSetup({
      setup: { championId: "jinx", level: 11, itemIds: [null, null, null, null, null, null] },
      champion,
      items: [],
    });
    const spiked = analyzeSetup({
      setup: { championId: "jinx", level: 11, itemIds: [asCritItem.id, null, null, null, null, null] },
      champion,
      items: [asCritItem],
    });

    const comparison = buildComparisonSummary(spiked, base);
    expect(comparison.narrative.some((line) => line.includes("DPS soutenu"))).toBe(true);
  });
});
