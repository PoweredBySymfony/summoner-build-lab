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
