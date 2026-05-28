import { describe, expect, it } from "vitest";
import { InventoryValidationService } from "@/lib/item-lab/InventoryValidationService";
import type { ChampionView, GameItem } from "@/types/domain";

const champion: ChampionView = {
  id: "smolder",
  databaseId: "db-smolder",
  riotChampionId: 901,
  championKey: "Smolder",
  name: "Smolder",
  title: "the Fiery Fledgling",
  slug: "smolder",
  icon: "https://example.com/smolder.png",
  image: "https://example.com/smolder.png",
  roles: ["ADC", "Mid", "Top"],
  tags: ["Marksman"],
  stats: {},
  patch: "16.6.1",
  isActive: true,
};

const makeItem = (overrides: Partial<GameItem> & Pick<GameItem, "id" | "name" | "riotItemId">): GameItem => ({
  databaseId: `db-${overrides.id}`,
  slug: overrides.id,
  icon: "https://example.com/item.png",
  image: "https://example.com/item.png",
  cost: 1000,
  category: "fighter",
  tags: [],
  itemGroups: [],
  stats: {},
  buildsFrom: [],
  buildsInto: [],
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  patch: "16.6.1",
  ...overrides,
});

const basicBoots = makeItem({
  id: "bottes",
  name: "Bottes",
  riotItemId: 1001,
  isBoots: true,
  isLegendary: false,
  category: "boots",
  tags: ["Boots"],
});

const ionianBoots = makeItem({
  id: "bottes-de-lucidite",
  name: "Bottes de lucidite",
  riotItemId: 3158,
  isBoots: true,
  isLegendary: false,
  category: "boots",
  tags: ["Boots", "CooldownReduction"],
  buildsFrom: ["1001"],
});

const tier3Boots = makeItem({
  id: "lucidite-pourpre",
  name: "Lucidite pourpre",
  riotItemId: 3171,
  isBoots: true,
  category: "boots",
  tags: ["Boots", "CooldownReduction"],
  buildsFrom: ["3158"],
});

const bloodthirster = makeItem({
  id: "soif-de-sang",
  name: "Soif-de-sang",
  riotItemId: 3072,
  tags: ["Damage", "CriticalStrike"],
  category: "crit",
});

const dawnAndDusk = makeItem({
  id: "aube-et-crepuscule",
  name: "Aube et crepuscule",
  riotItemId: 2510,
  tags: ["Health", "AttackSpeed", "SpellDamage", "OnHit", "AbilityHaste"],
  category: "mage",
  itemGroups: ["Spellblade"],
});

const essenceReaver = makeItem({
  id: "faux-spectrale",
  name: "Faux spectrale",
  riotItemId: 3508,
  tags: ["Damage", "CriticalStrike", "AbilityHaste"],
  category: "crit",
  itemGroups: ["Spellblade"],
});

const mortalReminder = makeItem({
  id: "rappel-mortel",
  name: "Rappel mortel",
  riotItemId: 3033,
  tags: ["Damage", "ArmorPenetration", "CriticalStrike"],
  category: "crit",
  buildsFrom: ["3035"],
  itemGroups: ["LastWhisper"],
});

const dominik = makeItem({
  id: "salutations-de-dominik",
  name: "Salutations de Dominik",
  riotItemId: 3036,
  tags: ["Damage", "ArmorPenetration", "CriticalStrike"],
  category: "crit",
  buildsFrom: ["3035"],
  itemGroups: ["LastWhisper"],
});

const catalog = [basicBoots, ionianBoots, tier3Boots, bloodthirster, mortalReminder, dominik, dawnAndDusk, essenceReaver];

describe("InventoryValidationService", () => {
  it("limits ADC slot 7 to boots", () => {
    const validation = InventoryValidationService.getSlotItemValidation({
      champion,
      setup: {
        championId: champion.id,
        role: "ADC",
        level: 11,
        itemIds: [null, null, null, null, null, null, null],
      },
      catalog,
      targetSlotIndex: 6,
    });

    expect(validation.allowedItems.some((item) => item.id === basicBoots.id)).toBe(true);
    expect(validation.allowedItems.some((item) => item.id === bloodthirster.id)).toBe(false);
  });

  it("reserves tier 3 boots to MID", () => {
    const topValidation = InventoryValidationService.canSelectItem({
      champion,
      setup: {
        championId: champion.id,
        role: "TOP",
        level: 11,
        itemIds: [null, null, null, null, null, null],
      },
      catalog,
      targetSlotIndex: 0,
      itemId: tier3Boots.id,
    });

    const midValidation = InventoryValidationService.canSelectItem({
      champion,
      setup: {
        championId: champion.id,
        role: "MID",
        level: 11,
        itemIds: [null, null, null, null, null, null],
      },
      catalog,
      targetSlotIndex: 0,
      itemId: tier3Boots.id,
    });

    expect(topValidation.allowed).toBe(false);
    expect(topValidation.reasons.some((reason) => reason.code === "role-locked")).toBe(true);
    expect(midValidation.allowed).toBe(true);
  });

  it("locks direct upgrades to the slot holding the base item", () => {
    const blocked = InventoryValidationService.canSelectItem({
      champion,
      setup: {
        championId: champion.id,
        role: "MID",
        level: 11,
        itemIds: [ionianBoots.id, null, null, null, null, null],
      },
      catalog,
      targetSlotIndex: 5,
      itemId: tier3Boots.id,
    });

    const allowed = InventoryValidationService.canSelectItem({
      champion,
      setup: {
        championId: champion.id,
        role: "MID",
        level: 11,
        itemIds: [ionianBoots.id, null, null, null, null, null],
      },
      catalog,
      targetSlotIndex: 0,
      itemId: tier3Boots.id,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons.some((reason) => reason.code === "upgrade-slot-locked")).toBe(true);
    expect(allowed.allowed).toBe(true);
  });

  it("blocks mutually exclusive last whisper upgrades", () => {
    const validation = InventoryValidationService.canSelectItem({
      champion,
      setup: {
        championId: champion.id,
        role: "ADC",
        level: 11,
        itemIds: [mortalReminder.id, null, null, null, null, null, null],
      },
      catalog,
      targetSlotIndex: 1,
      itemId: dominik.id,
    });

    expect(validation.allowed).toBe(false);
    expect(validation.reasons.some((reason) => reason.code === "exclusive-group")).toBe(true);
  });

  it("blocks other items from an already owned item group", () => {
    const validation = InventoryValidationService.canSelectItem({
      champion,
      setup: {
        championId: champion.id,
        role: "ADC",
        level: 11,
        itemIds: [essenceReaver.id, null, null, null, null, null, null],
      },
      catalog,
      targetSlotIndex: 1,
      itemId: dawnAndDusk.id,
    });

    expect(validation.allowed).toBe(false);
    expect(validation.reasons.some((reason) => reason.code === "exclusive-group")).toBe(true);
  });

  it("detects an invalid ADC 7th slot build", () => {
    const validation = InventoryValidationService.validateSetupInventory({
      champion,
      setup: {
        championId: champion.id,
        role: "ADC",
        level: 11,
        itemIds: [null, null, null, null, null, null, bloodthirster.id],
      },
      catalog,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.issues[0]?.reasons.some((reason) => reason.code === "slot-boots-only")).toBe(true);
  });
});
