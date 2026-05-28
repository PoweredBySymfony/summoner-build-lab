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
    buildsFrom: [],
    itemGroups: [],
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
    buildsFrom: [],
    itemGroups: [],
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
    buildsFrom: [],
    itemGroups: [],
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
    buildsFrom: [],
    itemGroups: [],
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
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "item-6",
    slug: "lucidite-pourpre",
    name: "Lucidite pourpre",
    riotItemId: 3171,
    goldTotal: 1600,
    patch: "16.6.1",
    category: "boots",
    tags: ["Boots", "CooldownReduction"],
    isBoots: true,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    buildsFrom: ["3158"],
    itemGroups: ["Boots"],
  },
] as const;

describe("resolveMlPuzzleChoices", () => {
  it("resolves a valid ML seed into one answer and three distractors", () => {
    const result = resolveMlPuzzleChoices({
      patch: "16.6",
      role: "MID",
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
      role: "MID",
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
        role: "MID",
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
      role: "MID",
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

  it("skips restricted distractors for ADC and traces the rejection reason", () => {
    const result = resolveMlPuzzleChoices({
      patch: "16.6",
      role: "ADC",
      currentItemSlugs: [],
      goodAnswer: "coiffe-de-rabadon",
      distractors: ["lucidite-pourpre", "baton-du-vide", "morellonomicon"],
      rankedItemSlugs: ["lucidite-pourpre", "baton-du-vide", "morellonomicon", "zhonyas-hourglass"],
      availableItems: [...baseItems],
      fallbackItems: [...baseItems],
    });

    expect(result.distractors.some((item) => item.slug === "lucidite-pourpre")).toBe(false);
    expect(result.restrictedItems).toEqual([
      { input: "lucidite-pourpre", reasons: ["role-restricted"] },
    ]);
  });

  it("rejects derived tier 3 boots for ADC even when the slug is not in config", () => {
    expect(() =>
      resolveMlPuzzleChoices({
        patch: "16.6",
        role: "ADC",
        currentItemSlugs: [],
        goodAnswer: "jambieres-de-metal",
        distractors: ["baton-du-vide", "morellonomicon", "sablier-de-zhonya"],
        rankedItemSlugs: [],
        availableItems: [
          ...baseItems,
          {
            ...baseItems[5],
            id: "item-7",
            slug: "bottes-de-metal",
            name: "Bottes de metal",
            riotItemId: 3047,
            isLegendary: false,
            buildsFrom: ["1001"],
          },
          {
            ...baseItems[5],
            id: "item-8",
            slug: "jambieres-de-metal",
            name: "Jambieres de metal",
            riotItemId: 3999,
            isBoots: false,
            buildsFrom: ["3047"],
          },
        ],
        fallbackItems: [...baseItems],
      }),
    ).toThrow("good-answer-role-restricted");
  });

  it("does not keep two last whisper family items in the final choices", () => {
    const result = resolveMlPuzzleChoices({
      patch: "16.6",
      role: "ADC",
      currentItemSlugs: [],
      goodAnswer: "salutations-de-dominik",
      distractors: ["rappel-mortel", "baton-du-vide", "morellonomicon"],
      rankedItemSlugs: ["rappel-mortel", "baton-du-vide", "morellonomicon", "zhonyas-hourglass"],
      availableItems: [
        ...baseItems,
        {
          id: "item-7",
          slug: "salutations-de-dominik",
          name: "Salutations de Dominik",
          riotItemId: 3036,
          goldTotal: 3000,
          patch: "16.6.1",
          category: "crit",
          tags: ["CriticalStrike", "Damage"],
          isBoots: false,
          isLegendary: true,
          isConsumable: false,
          isStarter: false,
          isTrinket: false,
          isActive: true,
          buildsFrom: ["3035"],
          itemGroups: ["LastWhisper"],
        },
        {
          id: "item-8",
          slug: "rappel-mortel",
          name: "Rappel mortel",
          riotItemId: 3033,
          goldTotal: 3200,
          patch: "16.6.1",
          category: "crit",
          tags: ["CriticalStrike", "Damage"],
          isBoots: false,
          isLegendary: true,
          isConsumable: false,
          isStarter: false,
          isTrinket: false,
          isActive: true,
          buildsFrom: ["3035"],
          itemGroups: ["LastWhisper"],
        },
      ],
      fallbackItems: [...baseItems],
    });

    expect(result.distractors.some((item) => item.slug === "rappel-mortel")).toBe(false);
  });
});
