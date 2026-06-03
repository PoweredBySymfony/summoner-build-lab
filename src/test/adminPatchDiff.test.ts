import { describe, expect, it } from "vitest";
import { diffChampionPatch, diffItemPatch } from "../../server/src/lib/admin/patchDiff";

const baseChampion = {
  id: "champion-id",
  riotChampionId: 103,
  championKey: "Ahri",
  name: "Ahri",
  slug: "ahri",
  title: "old title",
  rolePrimary: "MID",
  roleSecondary: null,
  image: "old.png",
  splashImage: null,
  iconImage: "old.png",
  tags: ["Mage"],
  stats: { attackdamage: 53 },
  isActive: true,
  patch: "16.8.1",
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

const baseItem = {
  id: "item-id",
  riotItemId: 3089,
  name: "Rabadon's Deathcap",
  slug: "rabadons-deathcap",
  shortDescription: "Old AP spike.",
  fullDescription: "Old description",
  image: "old.png",
  goldTotal: 3600,
  goldBase: 1100,
  goldSell: 2520,
  category: "mage",
  tags: ["SpellDamage"],
  stats: { FlatMagicDamageMod: 130 },
  activeEffect: null,
  passiveEffect: null,
  buildsFrom: ["1058"],
  buildsInto: [],
  mapAvailability: { "11": true },
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  patch: "16.8.1",
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

describe("admin patch diffs", () => {
  it("explains champion changes against the target patch data", () => {
    const result = diffChampionPatch(baseChampion, {
      version: "16.11.1",
      id: "Ahri",
      key: "103",
      name: "Ahri",
      title: "the Nine-Tailed Fox",
      image: { full: "Ahri.png" },
      tags: ["Mage", "Assassin"],
      stats: { attackdamage: 53, movespeed: 330 },
    });

    expect(result.changeSummary).toContain("Titre");
    expect(result.changes.map((change) => change.field)).toEqual(["title", "tags", "stats"]);
  });

  it("explains item economy and build path changes", () => {
    const result = diffItemPatch(baseItem, {
      name: "Rabadon's Deathcap",
      description: "New description",
      plaintext: "New AP spike.",
      image: { full: "3089.png" },
      gold: { base: 1200, total: 3700, sell: 2590, purchasable: true },
      tags: ["SpellDamage"],
      stats: { FlatMagicDamageMod: 130 },
      from: ["1058", "1026"],
      into: ["9999"],
      maps: { "11": true },
    });

    expect(result.changes.map((change) => change.field)).toEqual([
      "description",
      "goldTotal",
      "goldBase",
      "goldSell",
      "buildsFrom",
      "buildsInto",
    ]);
  });

  it("reports entities missing from the target patch", () => {
    expect(diffChampionPatch(baseChampion, undefined).changeSummary).toEqual(["Champion absent du patch cible"]);
    expect(diffItemPatch(baseItem, undefined).changeSummary).toEqual(["Item absent du patch cible"]);
  });
});
