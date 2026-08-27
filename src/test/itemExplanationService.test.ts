import { PuzzleSourceType, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  findBySlug: vi.fn(),
  itemFindMany: vi.fn(),
  itemFindUnique: vi.fn(),
  getCachedItemExplanation: vi.fn(),
  cacheItemExplanation: vi.fn(),
}));

vi.mock("../../server/src/repositories/puzzleRepository.js", () => ({
  puzzleRepository: {
    findBySlug: mocks.findBySlug,
  },
}));

vi.mock("../../server/src/repositories/importedMatchArchiveRepository.js", () => ({
  importedMatchArchiveRepository: {
    getCachedItemExplanation: mocks.getCachedItemExplanation,
    cacheItemExplanation: mocks.cacheItemExplanation,
  },
}));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    item: {
      findMany: mocks.itemFindMany,
      findUnique: mocks.itemFindUnique,
    },
  },
}));

import { itemExplanationService } from "../../server/src/services/itemExplanationService";

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-id",
    slug: "infinity-edge",
    name: "Infinity Edge",
    goldTotal: 3400,
    isActive: true,
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    tags: ["Damage", "CriticalStrike"],
    stats: {
      FlatPhysicalDamageMod: 75,
      FlatCritChanceMod: 0.25,
    },
    itemGroups: [],
    ...overrides,
  };
}

function puzzle(overrides: Record<string, unknown> = {}) {
  const recommended = item();
  const compared = item({
    id: "compared-id",
    slug: "bloodthirster",
    name: "Bloodthirster",
    goldTotal: 3300,
    stats: {
      FlatPhysicalDamageMod: 55,
      FlatHPPoolMod: 200,
    },
  });

  return {
    id: "puzzle-id",
    slug: "jinx-next-item",
    patch: "16.6",
    role: Role.ADC,
    sourceType: PuzzleSourceType.AI_GENERATED,
    isPublished: true,
    scenario: {
      playerChampion: { slug: "jinx" },
      playerLevel: 12,
      playerGold: 3400,
      currentBuild: [
        { id: "kraken-slayer" },
        "berserker-greaves",
        { itemSlug: "phantom-dancer" },
      ],
    },
    choices: [
      {
        id: "choice-good",
        isCorrect: true,
        item: recommended,
      },
      {
        id: "choice-bad",
        isCorrect: false,
        item: compared,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findBySlug.mockResolvedValue(puzzle());
  mocks.itemFindMany
    .mockResolvedValueOnce([
      item({ slug: "kraken-slayer", itemGroups: ["marksman-core"] }),
      item({ slug: "berserker-greaves", isBoots: true, itemGroups: ["boots"] }),
      item({ slug: "phantom-dancer", itemGroups: ["zeal"] }),
    ])
    .mockResolvedValueOnce([
      item(),
      item({ slug: "lord-dominiks-regards", name: "Lord Dominik's Regards", goldTotal: 3000 }),
      item({ slug: "control-ward", name: "Control Ward", goldTotal: 75, isConsumable: true }),
    ]);
  mocks.itemFindUnique.mockResolvedValue(item({
    id: "compared-id",
    slug: "bloodthirster",
    name: "Bloodthirster",
    goldTotal: 3300,
    stats: {
      FlatPhysicalDamageMod: 55,
      FlatHPPoolMod: 200,
    },
  }));
  mocks.getCachedItemExplanation.mockResolvedValue(null);
  mocks.cacheItemExplanation.mockResolvedValue(undefined);
});

describe("itemExplanationService", () => {
  it("returns cached explanations without recomputing item pools", async () => {
    mocks.getCachedItemExplanation.mockResolvedValueOnce({
      payload: {
        recommendedItem: { slug: "infinity-edge" },
      },
    });

    await expect(
      itemExplanationService.buildExplanation({
        puzzleSlug: "jinx-next-item",
      }),
    ).resolves.toEqual({
      recommendedItem: { slug: "infinity-edge" },
      cacheHit: true,
    });
    expect(mocks.cacheItemExplanation).not.toHaveBeenCalled();
    expect(mocks.itemFindMany).toHaveBeenCalledTimes(1);
  });

  it("rejects unavailable puzzle explanation contexts with typed HTTP errors", async () => {
    mocks.findBySlug.mockResolvedValueOnce(null);

    await expect(itemExplanationService.buildExplanation({ puzzleSlug: "missing" })).rejects.toMatchObject({
      status: 404,
      message: "Puzzle introuvable.",
    } satisfies Partial<HttpError>);

    mocks.findBySlug.mockResolvedValueOnce(puzzle({ isPublished: false }));
    await expect(itemExplanationService.buildExplanation({ puzzleSlug: "draft" })).rejects.toMatchObject({
      status: 403,
    });

    mocks.findBySlug.mockResolvedValueOnce(puzzle({ scenario: null }));
    await expect(itemExplanationService.buildExplanation({ puzzleSlug: "no-scenario", currentUserId: "admin" })).rejects.toMatchObject({
      status: 400,
      message: "Ce puzzle ne contient pas de scenario exploitable.",
    });
  });

  it("builds and caches an item comparison explanation", async () => {
    const explanation = await itemExplanationService.buildExplanation({
      puzzleSlug: "jinx-next-item",
      selectedChoiceId: "choice-bad",
    });

    expect(explanation).toMatchObject({
      recommendedItem: {
        slug: "infinity-edge",
        name: "Infinity Edge",
        goldTotal: 3400,
      },
      comparedItem: {
        slug: "bloodthirster",
        name: "Bloodthirster",
      },
      cacheHit: false,
      puzzleContext: {
        slug: "jinx-next-item",
        sourceType: "ai_generated",
        role: Role.ADC,
        patch: "16.6",
        level: 12,
        goldAvailable: 3400,
        currentBuildSlugs: ["kraken-slayer", "berserker-greaves", "phantom-dancer"],
      },
    });
    expect(explanation.statRows.some((row) => row.key === "attackDamage" && row.delta > 0)).toBe(true);
    expect(explanation.profileDeltaRows).toHaveLength(5);
    expect(explanation.damageRows.length).toBeGreaterThan(0);
    expect(explanation.efficiencyRows.length).toBeGreaterThan(0);
    expect(explanation.strategicVerdict.reasons.length).toBeGreaterThan(0);
    expect(explanation.exportPayload.filename).toBe("item-proof-jinx-next-item-infinity-edge-vs-bloodthirster.csv");
    expect(mocks.cacheItemExplanation).toHaveBeenCalledWith(
      expect.stringContaining("puzzle-id::infinity-edge::bloodthirster"),
      expect.objectContaining({
        recommendedItem: expect.objectContaining({ slug: "infinity-edge" }),
      }),
    );
  });
});
