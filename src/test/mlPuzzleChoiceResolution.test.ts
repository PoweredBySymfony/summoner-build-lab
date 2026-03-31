import { describe, expect, it } from "vitest";

import { resolveMlPuzzleChoices } from "../../server/src/lib/ml/puzzleChoiceResolution";

const baseItems = [
  {
    id: "item-1",
    slug: "coiffe-de-rabadon",
    name: "Coiffe de Rabadon",
    riotItemId: 3089,
    goldTotal: 3500,
    patch: "16.6.1",
    category: "mage",
    tags: ["SpellDamage"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
  },
  {
    id: "item-2",
    slug: "baton-du-vide",
    name: "Bâton du vide",
    riotItemId: 3135,
    goldTotal: 3000,
    patch: "16.6.1",
    category: "mage",
    tags: ["SpellDamage"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
  },
  {
    id: "item-3",
    slug: "morellonomicon",
    name: "Morellonomicon",
    riotItemId: 3165,
    goldTotal: 2950,
    patch: "16.6.1",
    category: "mage",
    tags: ["SpellDamage"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
  },
  {
    id: "item-4",
    slug: "sablier-de-zhonya",
    name: "Sablier de Zhonya",
    riotItemId: 3157,
    goldTotal: 3250,
    patch: "16.6.1",
    category: "mage",
    tags: ["SpellDamage"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
  },
  {
    id: "item-5",
    slug: "cape-de-neant",
    name: "Cape de néant",
    riotItemId: 1033,
    goldTotal: 900,
    patch: "16.6.1",
    category: "defensive",
    tags: ["SpellBlock"],
    isBoots: false,
    isLegendary: false,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
  },
] as const;

describe("resolveMlPuzzleChoices", () => {
  it("resolves a valid ML seed into one answer and three distractors", () => {
    const result = resolveMlPuzzleChoices({
      patch: "16.6",
      currentItemSlugs: [],
      goodAnswer: "rabadons-deathcap",
      distractors: ["void-staff", "morellonomicon", "zhonyas-hourglass"],
      rankedItemSlugs: ["rabadons-deathcap", "void-staff", "morellonomicon", "zhonyas-hourglass"],
      availableItems: [...baseItems],
      fallbackItems: [...baseItems],
    });

    expect(result.goodAnswer.slug).toBe("coiffe-de-rabadon");
    expect(result.distractors.map((item) => item.slug)).toEqual([
      "baton-du-vide",
      "morellonomicon",
      "sablier-de-zhonya",
    ]);
  });

  it("fills a missing distractor with a fallback candidate", () => {
    const result = resolveMlPuzzleChoices({
      patch: "16.6",
      currentItemSlugs: [],
      goodAnswer: "coiffe-de-rabadon",
      distractors: ["baton-du-vide", "missing-item", "baton-du-vide"],
      rankedItemSlugs: ["coiffe-de-rabadon", "baton-du-vide"],
      availableItems: [...baseItems],
      fallbackItems: [...baseItems],
    });

    expect(result.distractors).toHaveLength(3);
    expect(result.unresolvedItems).toContain("missing-item");
    expect(result.fallbackItemsUsed.length).toBeGreaterThan(0);
  });

  it("fails explicitly when the good answer cannot be resolved", () => {
    expect(() =>
      resolveMlPuzzleChoices({
        patch: "16.6",
        currentItemSlugs: [],
        goodAnswer: "missing-answer",
        distractors: ["baton-du-vide", "morellonomicon", "sablier-de-zhonya"],
        rankedItemSlugs: [],
        availableItems: [...baseItems],
        fallbackItems: [...baseItems],
      }),
    ).toThrow("good-answer-unresolved");
  });

  it("handles collisions and duplicate distractors without duplicating final choices", () => {
    const result = resolveMlPuzzleChoices({
      patch: "16.6",
      currentItemSlugs: [],
      goodAnswer: "coiffe-de-rabadon",
      distractors: ["coiffe-de-rabadon", "baton-du-vide", "baton-du-vide"],
      rankedItemSlugs: ["coiffe-de-rabadon", "baton-du-vide", "morellonomicon"],
      availableItems: [...baseItems],
      fallbackItems: [...baseItems],
    });

    expect(new Set(result.resolvedItems.map((item) => item.id)).size).toBe(4);
    expect(result.duplicateInputs.length).toBeGreaterThan(0);
  });
});
