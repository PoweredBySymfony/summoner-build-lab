import { describe, expect, it } from "vitest";
import { getItemEffectBlocks, getItemStatLines } from "@/lib/itemPresentation";
import type { GameItem } from "@/types/domain";

function createItem(overrides: Partial<GameItem>): GameItem {
  return {
    id: "test-item",
    databaseId: "db-test-item",
    riotItemId: 9999,
    name: "Test Item",
    slug: "test-item",
    icon: "https://example.com/item.png",
    image: "https://example.com/item.png",
    cost: 3000,
    tags: [],
    itemGroups: [],
    stats: {},
    shortDescription: null,
    fullDescription: null,
    activeEffect: null,
    passiveEffect: null,
    buildsFrom: [],
    buildsInto: [],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isTrinket: false,
    isStarter: false,
    isActive: true,
    patch: "16.6",
    ...overrides,
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function auditItems(items: GameItem[]) {
  return items.flatMap((item) => {
    const statLines = getItemStatLines(item);
    const effectBlocks = getItemEffectBlocks(item);
    const anomalies: string[] = [];
    const seen = new Set<string>();

    for (const statLine of statLines) {
      const signature = `${normalizeText(statLine.label)}::${statLine.value}`;
      if (seen.has(signature)) {
        anomalies.push(`${item.name}: duplicated base stat ${statLine.label} ${statLine.value}`);
      }
      seen.add(signature);
    }

    const effectText = normalizeText(
      effectBlocks
        .map((block) => [block.title, block.body].filter(Boolean).join(" "))
        .join(" "),
    );

    for (const statLine of statLines) {
      const label = normalizeText(statLine.label);
      if (effectText.includes(label) && effectText.includes(statLine.value.replace(/\s+/g, ""))) {
        anomalies.push(`${item.name}: effect text repeats base stat ${statLine.label} ${statLine.value}`);
      }
    }

    return anomalies;
  });
}

describe("itemPresentation", () => {
  it("uses item.stats as the source of truth for Infinity Edge base stats and keeps crit damage in effects", () => {
    const item = createItem({
      id: "infinity-edge",
      name: "Lame d'infini",
      slug: "lame-d-infini",
      stats: {
        FlatPhysicalDamageMod: 65,
        FlatCritChanceMod: 0.25,
      },
      fullDescription: ["+65 Degats d'attaque", "+25% chances de coup critique", "Perfection", "+30% degats de coup critique"].join("\n"),
    });

    expect(getItemStatLines(item)).toEqual([
      { key: "FlatPhysicalDamageMod", label: "Degats d'attaque", value: "+65", icon: "attackDamage" },
      { key: "FlatCritChanceMod", label: "Chances de coup critique", value: "+25%", icon: "crit" },
    ]);

    expect(getItemEffectBlocks(item)).toEqual([{ title: "Perfection", body: "+30% degats de coup critique", icon: "crit" }]);
  });

  it("renders AP item base stats from raw stats and keeps the passive text separate", () => {
    const item = createItem({
      id: "ludens-companion",
      name: "Compagnon de Luden",
      slug: "compagnon-de-luden",
      stats: {
        FlatMagicDamageMod: 100,
        FlatMPPoolMod: 600,
      },
      fullDescription: [
        "+100 Puissance",
        "+600 Mana",
        "Feu",
        "Les sorts charges infligent des degats magiques supplementaires.",
      ].join("\n"),
    });

    expect(getItemStatLines(item)).toEqual([
      { key: "FlatMagicDamageMod", label: "Puissance", value: "+100", icon: "abilityPower" },
      { key: "FlatMPPoolMod", label: "Mana", value: "+600", icon: "mana" },
    ]);

    expect(getItemEffectBlocks(item)).toEqual([
      {
        title: "Feu",
        body: "Les sorts charges infligent des degats magiques supplementaires.",
      },
    ]);
  });

  it("renders tank item defensive base stats without leaking passive text into stat cards", () => {
    const item = createItem({
      id: "thornmail",
      name: "Cotte epineuse",
      slug: "cotte-epineuse",
      stats: {
        FlatArmorMod: 70,
        FlatHPPoolMod: 350,
      },
      fullDescription: [
        "+70 Armure",
        "+350 PV",
        "Epines",
        "Quand vous subissez une attaque, renvoie des degats magiques et applique Blessures graves.",
      ].join("\n"),
    });

    expect(getItemStatLines(item)).toEqual([
      { key: "FlatArmorMod", label: "Armure", value: "+70", icon: "armor" },
      { key: "FlatHPPoolMod", label: "PV", value: "+350", icon: "health" },
    ]);

    expect(getItemEffectBlocks(item)).toEqual([
      {
        title: "Epines",
        body: "Quand vous subissez une attaque, renvoie des degats magiques et applique Blessures graves.",
      },
    ]);
  });

  it("renders support item base stats from raw data and keeps active text in effects", () => {
    const item = createItem({
      id: "locket-of-the-iron-solari",
      name: "Medaillon de l'Iron Solari",
      slug: "medaillon-de-l-iron-solari",
      stats: {
        FlatHPPoolMod: 200,
        FlatArmorMod: 30,
      },
      fullDescription: [
        "+200 PV",
        "+30 Armure",
        "Intervention",
        "Apres 2,5 s, soigne les allies dans une zone.",
      ].join("\n"),
    });

    expect(getItemStatLines(item)).toEqual([
      { key: "FlatHPPoolMod", label: "PV", value: "+200", icon: "health" },
      { key: "FlatArmorMod", label: "Armure", value: "+30", icon: "armor" },
    ]);

    expect(getItemEffectBlocks(item)).toEqual([
      {
        title: "Intervention",
        body: "Apres 2,5 s, soigne les allies dans une zone.",
      },
    ]);
  });

  it("falls back to description parsing when raw stats are unavailable", () => {
    const item = createItem({
      id: "legacy-item",
      name: "Ancien item",
      slug: "ancien-item",
      stats: {},
      fullDescription: ["+40 Degats d'attaque", "+10 letalite", "Passif", "Texte de passif."].join("\n"),
    });

    expect(getItemStatLines(item)).toEqual([
      { key: "degats d'attaque", label: "Degats d'attaque", value: "+40", icon: "attackDamage" },
      { key: "letalite", label: "Letalite", value: "+10", icon: "lethality" },
    ]);

    expect(getItemEffectBlocks(item)).toEqual([{ title: "Passif", body: "Texte de passif." }]);
  });

  it("audits a representative sample for duplicated or misleading stat/effect rendering", () => {
    const infinityEdge = createItem({
      id: "infinity-edge",
      name: "Lame d'infini",
      slug: "lame-d-infini",
      stats: {
        FlatPhysicalDamageMod: 65,
        FlatCritChanceMod: 0.25,
      },
      fullDescription: ["+65 Degats d'attaque", "+25% chances de coup critique", "Perfection", "+30% degats de coup critique"].join("\n"),
    });
    const apItem = createItem({
      id: "ludens-companion",
      name: "Compagnon de Luden",
      slug: "compagnon-de-luden",
      stats: {
        FlatMagicDamageMod: 100,
        FlatMPPoolMod: 600,
      },
      fullDescription: ["+100 Puissance", "+600 Mana", "Feu", "Les sorts charges infligent des degats magiques supplementaires."].join("\n"),
    });
    const tankItem = createItem({
      id: "thornmail",
      name: "Cotte epineuse",
      slug: "cotte-epineuse",
      stats: {
        FlatArmorMod: 70,
        FlatHPPoolMod: 350,
      },
      fullDescription: ["+70 Armure", "+350 PV", "Epines", "Quand vous subissez une attaque, renvoie des degats magiques et applique Blessures graves."].join("\n"),
    });
    const supportItem = createItem({
      id: "locket-of-the-iron-solari",
      name: "Medaillon de l'Iron Solari",
      slug: "medaillon-de-l-iron-solari",
      stats: {
        FlatHPPoolMod: 200,
        FlatArmorMod: 30,
      },
      fullDescription: ["+200 PV", "+30 Armure", "Intervention", "Apres 2,5 s, soigne les allies dans une zone."].join("\n"),
    });

    expect(auditItems([infinityEdge, apItem, tankItem, supportItem])).toEqual([]);
  });
});
