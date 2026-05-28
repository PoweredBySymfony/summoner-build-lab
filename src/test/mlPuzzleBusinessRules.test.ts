import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildMlPuzzleBusinessRules,
  shuffleResolvedChoices,
} from "../../server/src/lib/ml/puzzleBusinessRules";

const baseSnapshot = {
  patch: "16.6",
  championSlug: "jinx",
  role: Role.ADC,
  goldAvailable: 2200,
  level: 12,
  kills: 5,
  deaths: 2,
  assists: 4,
  cs: 145,
  timestampMinutes: 21,
  currentItems: ["ouragan-de-runaan", "tueur-de-krakens"],
  allyFrontlineCount: 2,
  allyMagicDamageCount: 2,
  allyPhysicalDamageCount: 2,
  allySupportCount: 1,
  enemyFrontlineCount: 2,
  enemyMagicDamageCount: 2,
  enemyPhysicalDamageCount: 3,
  enemySupportCount: 1,
} as const;

const availableItems = [
  {
    id: "1",
    slug: "danse-de-la-mort",
    name: "Danse de la mort",
    riotItemId: 6333,
    patch: "16.6.1",
    category: "fighter",
    tags: ["Damage", "Armor"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 3300,
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "2",
    slug: "lame-dinfini",
    name: "Lame d'infini",
    riotItemId: 3031,
    patch: "16.6.1",
    category: "crit",
    tags: ["CriticalStrike", "Damage"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 3500,
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "3",
    slug: "salutations-de-dominik",
    name: "Salutations de Dominik",
    riotItemId: 3036,
    patch: "16.6.1",
    category: "crit",
    tags: ["CriticalStrike", "Damage"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 3000,
    buildsFrom: ["3035"],
    itemGroups: ["LastWhisper"],
  },
  {
    id: "4",
    slug: "soif-de-sang",
    name: "Soif-de-sang",
    riotItemId: 3072,
    patch: "16.6.1",
    category: "crit",
    tags: ["CriticalStrike", "Damage"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 3400,
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "5",
    slug: "fin-de-lesprit",
    name: "Fin de l'esprit",
    riotItemId: 3091,
    patch: "16.6.1",
    category: "onhit",
    tags: ["AttackSpeed", "Damage", "SpellBlock"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 2800,
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "6",
    slug: "ange-gardien",
    name: "Ange gardien",
    riotItemId: 3026,
    patch: "16.6.1",
    category: "fighter",
    tags: ["Damage", "Armor"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 3200,
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "7",
    slug: "coiffe-de-rabadon",
    name: "Coiffe de Rabadon",
    riotItemId: 3089,
    patch: "16.6.1",
    category: "mage",
    tags: ["SpellDamage"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 3500,
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "8",
    slug: "chapitre-perdu",
    name: "Chapitre perdu",
    riotItemId: 3802,
    patch: "16.6.1",
    category: "mage",
    tags: ["SpellDamage", "Mana", "ManaRegen"],
    isBoots: false,
    isLegendary: false,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 1200,
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "9",
    slug: "arc-aquebuse",
    name: "Arc aquebuse",
    riotItemId: 1043,
    patch: "16.6.1",
    category: "onhit",
    tags: ["AttackSpeed"],
    isBoots: false,
    isLegendary: false,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 700,
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "10",
    slug: "voile-de-la-banshee",
    name: "Voile de la banshee",
    riotItemId: 3102,
    patch: "16.6.1",
    category: "mage",
    tags: ["SpellDamage", "SpellBlock"],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 3000,
    buildsFrom: [],
    itemGroups: [],
  },
  {
    id: "11",
    slug: "lucidite-pourpre",
    name: "Lucidite pourpre",
    riotItemId: 3171,
    patch: "16.6.1",
    category: "boots",
    tags: ["Boots", "CooldownReduction"],
    isBoots: true,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    goldTotal: 1600,
    buildsFrom: ["3158"],
    itemGroups: ["Boots"],
  },
] as const;

describe("buildMlPuzzleBusinessRules", () => {
  it("filters incoherent AP items for a physical ADC profile", () => {
    const result = buildMlPuzzleBusinessRules({
      snapshot: { ...baseSnapshot },
      championTags: ["Marksman"],
      goodAnswer: availableItems[2],
      rankedCandidates: [...availableItems],
      availableItems: [...availableItems],
      previousChoiceSignatures: [],
      variationSeed: "seed-adc",
    });

    expect(result.distractorCandidates.some((item) => item.slug === "coiffe-de-rabadon")).toBe(false);
    expect(result.distractorCandidates.some((item) => item.slug === "voile-de-la-banshee")).toBe(false);
    expect(result.debug.filterReasonCounts["incoherent-with-champion"]).toBeGreaterThan(0);
  });

  it("rejects trivially cheap good answers and filters cheap distractors", () => {
    const result = buildMlPuzzleBusinessRules({
      snapshot: { ...baseSnapshot },
      championTags: ["Marksman"],
      goodAnswer: availableItems[8],
      rankedCandidates: [...availableItems],
      availableItems: [...availableItems],
      previousChoiceSignatures: [],
      variationSeed: "seed-gold",
    });

    expect(result.debug.goodAnswerViolations).toContain("too-cheap");
    expect(result.distractorCandidates.some((item) => item.slug === "arc-aquebuse")).toBe(false);
    expect(result.debug.goldFilter.applied).toBe(true);
    expect(result.debug.goodAnswerGoldAssessment).toBe("too-cheap");
  });

  it("keeps a coherent mid-cost component when it is a legitimate bridge purchase", () => {
    const midCostAdcComponent = {
      id: "12",
      slug: "carquois-midi",
      name: "Carquois de midi",
      riotItemId: 6670,
      patch: "16.6.1",
      category: "crit",
      tags: ["AttackSpeed", "Damage"],
      isBoots: false,
      isLegendary: false,
      isConsumable: false,
      isStarter: false,
      isTrinket: false,
      isActive: true,
      goldTotal: 1200,
      buildsFrom: ["1042"],
      itemGroups: [],
    } as const;
    const result = buildMlPuzzleBusinessRules({
      snapshot: { ...baseSnapshot },
      championTags: ["Marksman"],
      goodAnswer: midCostAdcComponent,
      rankedCandidates: [midCostAdcComponent, ...availableItems],
      availableItems: [midCostAdcComponent, ...availableItems],
      previousChoiceSignatures: [],
      variationSeed: "seed-legit-component",
    });

    expect(result.debug.goodAnswerViolations).not.toContain("too-cheap");
    expect(result.debug.goodAnswerGoldAssessment).toBe("legitimate-component");
    expect(result.distractorCandidates.some((item) => item.slug === "chapitre-perdu")).toBe(false);
  });

  it("builds a candidate pool of at least six items when enough coherent fallbacks exist", () => {
    const result = buildMlPuzzleBusinessRules({
      snapshot: { ...baseSnapshot },
      championTags: ["Marksman"],
      goodAnswer: availableItems[2],
      rankedCandidates: [availableItems[2], availableItems[6], availableItems[7]],
      availableItems: [...availableItems],
      previousChoiceSignatures: [],
      variationSeed: "seed-pool",
    });

    expect(result.debug.candidatePoolSizeAfterFallback).toBeGreaterThanOrEqual(6);
    expect(result.distractorCandidates.length).toBeGreaterThanOrEqual(5);
  });

  it("uses variation to avoid repeating a previous choice signature when alternatives exist", () => {
    const result = buildMlPuzzleBusinessRules({
      snapshot: { ...baseSnapshot },
      championTags: ["Marksman"],
      goodAnswer: availableItems[2],
      rankedCandidates: [...availableItems],
      availableItems: [...availableItems],
      previousChoiceSignatures: [
        ["salutations-de-dominik", "soif-de-sang", "fin-de-lesprit", "ange-gardien"].sort().join("|"),
      ],
      variationSeed: "seed-history",
    });

    expect(result.debug.historyAvoided).toBe(true);
    expect(result.debug.preferredSignature).not.toBe(
      ["salutations-de-dominik", "soif-de-sang", "fin-de-lesprit", "ange-gardien"].sort().join("|"),
    );
  });

  it("applies patch and role restrictions from config", () => {
    const result = buildMlPuzzleBusinessRules({
      snapshot: { ...baseSnapshot },
      championTags: ["Marksman"],
      goodAnswer: availableItems[2],
      rankedCandidates: [...availableItems],
      availableItems: [...availableItems, { ...availableItems[0], id: "12", slug: "jarvan-i", name: "Jarvan I", riotItemId: 3001 }],
      previousChoiceSignatures: [],
      variationSeed: "seed-restrictions",
    });

    expect(result.distractorCandidates.some((item) => item.slug === "lucidite-pourpre")).toBe(false);
    expect(result.distractorCandidates.some((item) => item.slug === "jarvan-i")).toBe(false);
    expect(result.debug.filterReasonCounts["role-restricted"]).toBeGreaterThan(0);
    expect(result.debug.filterReasonCounts["patch-restricted"]).toBeGreaterThan(0);
    expect(result.debug.restrictedCandidateSamples.some((entry) => entry.slug === "lucidite-pourpre")).toBe(true);
  });

  it("blocks tier 3 boots for ADC even when the slug is not hardcoded in config", () => {
    const result = buildMlPuzzleBusinessRules({
      snapshot: { ...baseSnapshot },
      championTags: ["Marksman"],
      goodAnswer: availableItems[2],
      rankedCandidates: [...availableItems],
      availableItems: [
        ...availableItems,
        {
          ...availableItems[10],
          id: "12",
          slug: "capsules-de-metal",
          name: "Capsules de metal",
          riotItemId: 3047,
          isLegendary: false,
          buildsFrom: ["1001"],
        },
        {
          ...availableItems[10],
          id: "13",
          slug: "jambieres-de-metal",
          name: "Jambieres de metal",
          riotItemId: 3999,
          isBoots: false,
          buildsFrom: ["3047"],
        },
      ],
      previousChoiceSignatures: [],
      variationSeed: "seed-tier3-derived",
    });

    expect(result.distractorCandidates.some((item) => item.slug === "jambieres-de-metal")).toBe(false);
    expect(result.debug.filterReasonCounts["role-restricted"]).toBeGreaterThan(0);
  });

  it("filters mutually exclusive family items already present in the current build", () => {
    const result = buildMlPuzzleBusinessRules({
      snapshot: { ...baseSnapshot, currentItems: ["ouragan-de-runaan", "salutations-de-dominik"] },
      championTags: ["Marksman"],
      goodAnswer: availableItems[3],
      rankedCandidates: [...availableItems],
      availableItems: [
        ...availableItems,
        {
          ...availableItems[3],
          id: "12",
          slug: "rappel-mortel",
          name: "Rappel mortel",
          riotItemId: 3033,
          buildsFrom: ["3035"],
          itemGroups: ["LastWhisper"],
        },
      ],
      previousChoiceSignatures: [],
      variationSeed: "seed-exclusive-groups",
    });

    expect(result.distractorCandidates.some((item) => item.slug === "rappel-mortel")).toBe(false);
    expect(result.debug.filterReasonCounts["exclusive-group"]).toBeGreaterThan(0);
  });
});

describe("shuffleResolvedChoices", () => {
  it("does not keep the correct answer locked in first position", () => {
    const ordered = shuffleResolvedChoices(
      availableItems[2],
      [availableItems[3], availableItems[4], availableItems[5]],
      "seed-order",
    );

    expect(ordered).toHaveLength(4);
    expect(ordered.findIndex((entry) => entry.isCorrect)).not.toBe(0);
  });
});
