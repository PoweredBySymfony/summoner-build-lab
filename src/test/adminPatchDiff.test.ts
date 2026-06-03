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
    expect(result.changes.find((change) => change.field === "stats")?.beforeLines).toEqual([
      { key: "movespeed", label: "Vitesse de deplacement", value: "Non renseigne" },
    ]);
    expect(result.changes.find((change) => change.field === "stats")?.afterLines).toEqual([
      { key: "movespeed", label: "Vitesse de deplacement", value: "330" },
    ]);
  });

  it("explains item economy and build path changes", () => {
    const result = diffItemPatch(
      baseItem,
      {
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
      },
      { itemNameById: new Map([["1058", "Baguette trop grosse"], ["1026", "Tome explosif"], ["9999", "Objet test"]]) },
    );

    expect(result.changes.map((change) => change.field)).toEqual([
      "description",
      "goldTotal",
      "goldBase",
      "goldSell",
      "buildsFrom",
      "buildsInto",
    ]);
    expect(result.changes.find((change) => change.field === "buildsFrom")?.afterLines).toEqual([
      { key: "1058", label: "Baguette trop grosse", value: "ID Riot 1058" },
      { key: "1026", label: "Tome explosif", value: "ID Riot 1026" },
    ]);
    expect(result.changes.find((change) => change.field === "buildsInto")?.after).toBe("Objet test (ID Riot 9999)");
  });

  it("formats item stat changes with site-facing labels", () => {
    const result = diffItemPatch(baseItem, {
      name: "Rabadon's Deathcap",
      description: "New description",
      plaintext: "Old AP spike.",
      image: { full: "3089.png" },
      gold: { base: 1100, total: 3600, sell: 2520, purchasable: true },
      tags: ["SpellDamage"],
      stats: { FlatMagicDamageMod: 145 },
      from: ["1058"],
      into: [],
      maps: { "11": true },
    });

    const statsChange = result.changes.find((change) => change.field === "stats");
    expect(statsChange?.beforeLines).toEqual([{ key: "FlatMagicDamageMod", label: "Puissance", value: "130", delta: undefined }]);
    expect(statsChange?.afterLines).toEqual([{ key: "FlatMagicDamageMod", label: "Puissance", value: "145", delta: "+15" }]);
  });

  it("reports only changed champion abilities", () => {
    const result = diffChampionPatch(
      baseChampion,
      {
        version: "16.11.1",
        id: "Ahri",
        key: "103",
        name: "Ahri",
        title: "old title",
        image: { full: "Ahri.png" },
        tags: ["Mage"],
        stats: { attackdamage: 53 },
      },
      {
        localChampionDetail: {
          id: "Ahri",
          key: "103",
          name: "Ahri",
          title: "old title",
          image: { full: "Ahri.png" },
          tags: ["Mage"],
          stats: { attackdamage: 53 },
          passive: { name: "Vastaya Grace", description: "Old passive", image: { full: "Ahri_Passive.png" } },
          spells: [
            { id: "AhriOrbofDeception", name: "Orb of Deception", description: "Old Q", image: { full: "AhriQ.png" } },
          ],
        },
        remoteChampionDetail: {
          id: "Ahri",
          key: "103",
          name: "Ahri",
          title: "old title",
          image: { full: "Ahri.png" },
          tags: ["Mage"],
          stats: { attackdamage: 53 },
          passive: { name: "Vastaya Grace", description: "Old passive", image: { full: "Ahri_Passive.png" } },
          spells: [
            { id: "AhriOrbofDeception", name: "Orb of Deception", description: "New Q damage", image: { full: "AhriQ.png" } },
          ],
        },
      },
    );

    const abilityChange = result.changes.find((change) => change.field === "abilities");
    expect(abilityChange?.beforeLines).toEqual([{ key: "AhriOrbofDeception", label: "A - Orb of Deception", value: "Old Q" }]);
    expect(abilityChange?.afterLines).toEqual([{ key: "AhriOrbofDeception", label: "A - Orb of Deception", value: "New Q damage" }]);
  });

  it("explains boolean item availability changes", () => {
    const result = diffItemPatch(baseItem, {
      name: "Rabadon's Deathcap",
      description: "New description",
      plaintext: "Old AP spike.",
      image: { full: "3089.png" },
      gold: { base: 1100, total: 3600, sell: 2520, purchasable: false },
      tags: ["SpellDamage"],
      stats: { FlatMagicDamageMod: 130 },
      from: ["1058"],
      into: [],
      maps: { "11": false },
    });

    const purchasableChange = result.changes.find((change) => change.field === "purchasable");
    const mapChange = result.changes.find((change) => change.field === "maps");
    expect(purchasableChange?.before).toBe("Oui, disponible a l'achat en boutique");
    expect(purchasableChange?.after).toBe("Non, retire de l'achat direct en boutique");
    expect(mapChange?.afterLines).toEqual([{ key: "11", label: "Faille de l'invocateur", value: "Non" }]);
  });

  it("reports entities missing from the target patch", () => {
    expect(diffChampionPatch(baseChampion, undefined).changeSummary).toEqual(["Champion absent du patch cible"]);
    expect(diffItemPatch(baseItem, undefined).changeSummary).toEqual(["Item absent du patch cible"]);
  });
});
