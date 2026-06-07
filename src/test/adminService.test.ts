import { PuzzleDifficulty, PuzzleMode, PuzzleSourceType, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  countStandardItems: vi.fn(),
  listChampions: vi.fn(),
  listItems: vi.fn(),
  listStandardItems: vi.fn(),
  findChampionById: vi.fn(),
  updateChampion: vi.fn(),
  deleteChampion: vi.fn(),
  findItemById: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  listAll: vi.fn(),
  findById: vi.fn(),
  updatePuzzle: vi.fn(),
  deletePuzzle: vi.fn(),
  latestVersion: vi.fn(),
  championCount: vi.fn(),
  championGroupBy: vi.fn(),
  puzzleCount: vi.fn(),
  itemGroupBy: vi.fn(),
  transaction: vi.fn(),
  puzzleChoiceCount: vi.fn(),
  syncAll: vi.fn(),
  mapChampionView: vi.fn((champion: { slug?: string; id?: string }) => ({ id: champion.slug ?? champion.id })),
  mapItemView: vi.fn((item: { slug?: string; id?: string }) => ({ id: item.slug ?? item.id })),
  mapPuzzleListView: vi.fn((puzzle: { slug?: string; id?: string }) => ({ id: puzzle.slug ?? puzzle.id })),
  mapPuzzleDetailView: vi.fn((puzzle: { slug?: string; id?: string }) => ({ id: puzzle.slug ?? puzzle.id, detail: true })),
}));

vi.mock("../../server/src/repositories/catalogRepository.js", () => ({
  standardSummonersRiftItemWhere: { isActive: true },
  catalogRepository: {
    countStandardItems: mocks.countStandardItems,
    listChampions: mocks.listChampions,
    listItems: mocks.listItems,
    listStandardItems: mocks.listStandardItems,
    findChampionById: mocks.findChampionById,
    updateChampion: mocks.updateChampion,
    deleteChampion: mocks.deleteChampion,
    findItemById: mocks.findItemById,
    updateItem: mocks.updateItem,
    deleteItem: mocks.deleteItem,
  },
}));

vi.mock("../../server/src/repositories/puzzleRepository.js", () => ({
  puzzleRepository: {
    listAll: mocks.listAll,
    findById: mocks.findById,
    updatePuzzle: mocks.updatePuzzle,
    deletePuzzle: mocks.deletePuzzle,
  },
}));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    $transaction: mocks.transaction,
    champion: {
      count: mocks.championCount,
      groupBy: mocks.championGroupBy,
    },
    puzzle: {
      count: mocks.puzzleCount,
    },
    item: {
      groupBy: mocks.itemGroupBy,
    },
    puzzleScenario: {
      count: vi.fn(),
    },
    userChampionProgress: {
      count: vi.fn(),
    },
    generatedPuzzleRequest: {
      count: vi.fn(),
    },
    puzzleChoice: {
      count: mocks.puzzleChoiceCount,
    },
  },
}));

vi.mock("../../server/src/lib/gameData/dataDragonClient.js", () => ({
  dataDragonClient: {
    getLatestVersion: mocks.latestVersion,
    getItemIconUrl: vi.fn((patch: string, itemId: string) => `https://ddragon/${patch}/${itemId}.png`),
  },
}));

vi.mock("../../server/src/lib/championIndex.js", () => ({
  buildChampionViewIndex: vi.fn(() => new Map()),
}));

vi.mock("../../server/src/lib/itemIndex.js", () => ({
  buildItemViewIndex: vi.fn(() => new Map()),
}));

vi.mock("../../server/src/services/riotSyncService.js", () => ({
  riotSyncService: {
    syncAll: mocks.syncAll,
  },
}));

vi.mock("../../server/src/services/viewMappers.js", () => ({
  mapChampionView: mocks.mapChampionView,
  mapItemView: mocks.mapItemView,
  mapPuzzleListView: mocks.mapPuzzleListView,
  mapPuzzleDetailView: mocks.mapPuzzleDetailView,
}));

import { adminService } from "../../server/src/services/adminService";

function champion(overrides: Record<string, unknown> = {}) {
  return {
    id: "champion-id",
    slug: "jinx",
    name: "Jinx",
    patch: "16.6",
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-id",
    slug: "infinity-edge",
    name: "Infinity Edge",
    patch: "16.6",
    ...overrides,
  };
}

function puzzle(overrides: Record<string, unknown> = {}) {
  return {
    id: "puzzle-id",
    slug: "jinx-next-item",
    sourceType: PuzzleSourceType.MANUAL,
    isPublished: false,
    ...overrides,
  };
}

const championPayload = {
  name: "  Jinx  ",
  title: "  Loose Cannon  ",
  rolePrimary: Role.ADC,
  roleSecondary: null,
  patch: " 16.7 ",
  isActive: true,
  image: " icon.png ",
  iconImage: " ",
  splashImage: "",
  tags: ["Marksman"],
  stats: { attack: 9 },
};

const itemPayload = {
  name: " Infinity Edge ",
  shortDescription: "",
  fullDescription: " Crit item ",
  image: " item.png ",
  patch: " 16.7 ",
  category: "",
  goldTotal: 3400,
  goldBase: undefined,
  goldSell: 2380,
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  activeEffect: null,
  passiveEffect: " crit ",
  tags: ["Damage"],
  stats: { ad: 75 },
  buildsFrom: ["bf-sword"],
  buildsInto: undefined,
};

const puzzlePayload = {
  title: " Better next item ",
  slug: " better-next-item ",
  mode: PuzzleMode.GENERAL,
  difficulty: PuzzleDifficulty.BEGINNER,
  role: Role.ADC,
  championId: "champion-id",
  patch: " 16.7 ",
  description: " desc ",
  shortPrompt: " prompt ",
  situation: " situation ",
  question: " question ",
  explanation: " explanation ",
  isPublished: true,
  isDailyEligible: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.countStandardItems.mockResolvedValue(20);
  mocks.latestVersion.mockResolvedValue("16.7");
  mocks.championCount.mockResolvedValue(12);
  mocks.puzzleCount.mockResolvedValueOnce(30).mockResolvedValueOnce(18);
  mocks.championGroupBy.mockResolvedValue([{ patch: "16.6" }]);
  mocks.itemGroupBy.mockResolvedValue([{ patch: "16.5" }]);
  mocks.listChampions.mockResolvedValue([champion()]);
  mocks.listItems.mockResolvedValue([item()]);
  mocks.listStandardItems.mockResolvedValue([item()]);
  mocks.listAll.mockResolvedValue([puzzle()]);
  mocks.findById.mockResolvedValue(puzzle());
  mocks.findChampionById.mockResolvedValue(champion());
  mocks.updateChampion.mockResolvedValue(champion({ slug: "jinx-updated" }));
  mocks.findItemById.mockResolvedValue(item());
  mocks.updateItem.mockResolvedValue(item({ slug: "infinity-edge-updated" }));
  mocks.updatePuzzle.mockResolvedValue(puzzle());
  mocks.transaction.mockResolvedValue([0, 0, 0, 0]);
  mocks.puzzleChoiceCount.mockResolvedValue(0);
  mocks.syncAll.mockResolvedValue({ synced: true });
});

describe("adminService", () => {
  it("builds overview stats and patch freshness", async () => {
    await expect(adminService.getOverview()).resolves.toEqual({
      stats: {
        championCount: 12,
        itemCount: 20,
        puzzleCount: 30,
        publishedPuzzleCount: 18,
      },
      patch: {
        localLatestPatch: "16.6",
        remoteLatestPatch: "16.7",
        hasUpdate: true,
      },
    });
  });

  it("lists champions, items, all puzzles, and unpublished AI puzzles through view mappers", async () => {
    await expect(adminService.listChampions()).resolves.toEqual([{ id: "jinx" }]);
    await expect(adminService.listItems()).resolves.toEqual([{ id: "infinity-edge" }]);
    await expect(adminService.listPuzzles()).resolves.toEqual([{ id: "jinx-next-item" }]);
    await expect(adminService.listAiGeneratedPuzzles()).resolves.toEqual([{ id: "jinx-next-item" }]);

    expect(mocks.listAll).toHaveBeenLastCalledWith({
      where: {
        sourceType: PuzzleSourceType.AI_GENERATED,
        isPublished: false,
      },
    });
  });

  it("maps puzzle details and rejects missing puzzles", async () => {
    await expect(adminService.getPuzzleDetail("puzzle-id")).resolves.toEqual({
      id: "jinx-next-item",
      detail: true,
    });

    mocks.findById.mockResolvedValueOnce(null);
    await expect(adminService.getPuzzleDetail("missing")).rejects.toMatchObject({
      status: 404,
      message: "Puzzle introuvable.",
    } satisfies Partial<HttpError>);
  });

  it("updates champions and normalizes nullable strings", async () => {
    await expect(adminService.updateChampion("champion-id", championPayload)).resolves.toEqual({
      id: "jinx-updated",
    });

    expect(mocks.updateChampion).toHaveBeenCalledWith("champion-id", expect.objectContaining({
      name: "Jinx",
      title: "Loose Cannon",
      patch: "16.7",
      image: "icon.png",
      iconImage: "icon.png",
      splashImage: null,
      tags: ["Marksman"],
      stats: { attack: 9 },
    }));
  });

  it("deletes champions only when no dependencies remain", async () => {
    await expect(adminService.deleteChampion("champion-id")).resolves.toEqual({ deleted: true });
    expect(mocks.deleteChampion).toHaveBeenCalledWith("champion-id");

    mocks.transaction.mockResolvedValueOnce([1, 0, 0, 0]);
    await expect(adminService.deleteChampion("champion-id")).rejects.toMatchObject({
      status: 409,
    });
  });

  it("updates items and prevents deleting referenced items", async () => {
    await expect(adminService.updateItem("item-id", itemPayload)).resolves.toEqual({
      id: "infinity-edge-updated",
    });
    expect(mocks.updateItem).toHaveBeenCalledWith("item-id", expect.objectContaining({
      name: "Infinity Edge",
      shortDescription: null,
      fullDescription: "Crit item",
      category: null,
      goldBase: null,
      buildsInto: [],
    }));

    mocks.puzzleChoiceCount.mockResolvedValueOnce(2);
    await expect(adminService.deleteItem("item-id")).rejects.toMatchObject({
      status: 409,
      message: "Cet item est encore utilise dans des choix de puzzles. Corrige d'abord les puzzles concernes.",
    } satisfies Partial<HttpError>);
  });

  it("updates, publishes, and deletes puzzles", async () => {
    await expect(adminService.updatePuzzle("puzzle-id", puzzlePayload)).resolves.toEqual({
      id: "jinx-next-item",
      detail: true,
    });
    expect(mocks.updatePuzzle).toHaveBeenCalledWith("puzzle-id", expect.objectContaining({
      title: "Better next item",
      slug: "better-next-item",
      champion: { connect: { id: "champion-id" } },
      isPublished: true,
    }));

    await expect(adminService.publishPuzzle("puzzle-id")).resolves.toEqual({
      id: "jinx-next-item",
      detail: true,
    });
    expect(mocks.updatePuzzle).toHaveBeenCalledWith("puzzle-id", { isPublished: true });

    await expect(adminService.deletePuzzle("puzzle-id")).resolves.toEqual({ deleted: true });
    expect(mocks.deletePuzzle).toHaveBeenCalledWith("puzzle-id");
  });

  it.each([
    ["champion", () => adminService.updateChampion("missing", championPayload), mocks.findChampionById, "Champion introuvable."],
    ["item", () => adminService.updateItem("missing", itemPayload), mocks.findItemById, "Objet introuvable."],
    ["puzzle", () => adminService.deletePuzzle("missing"), mocks.findById, "Puzzle introuvable."],
  ])("rejects missing %s records", async (_label, action, finder, message) => {
    finder.mockResolvedValueOnce(null);

    await expect(action()).rejects.toMatchObject({
      status: 404,
      message,
    } satisfies Partial<HttpError>);
  });
});
