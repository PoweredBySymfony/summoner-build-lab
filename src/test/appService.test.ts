import { PuzzleSourceType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  listStandardItems: vi.fn(),
  countStandardItems: vi.fn(),
  listChampions: vi.fn(),
  listItems: vi.fn(),
  findChampionBySlug: vi.fn(),
  listPublished: vi.fn(),
  findBySlug: vi.fn(),
  getOrCreateToday: vi.fn(),
  getOverview: vi.fn(),
  generatedRequestFindFirst: vi.fn(),
  generatedRequestFindUnique: vi.fn(),
  mapChampionView: vi.fn((champion: { slug?: string; id?: string }) => ({
    id: champion.slug ?? champion.id,
    mapped: "champion",
  })),
  mapItemView: vi.fn((item: { slug?: string; id?: string }) => ({
    id: item.slug ?? item.id,
    patch: "16.6",
    mapped: "item",
  })),
  mapPuzzleListView: vi.fn((puzzle: { slug?: string; id?: string }) => ({
    id: puzzle.slug ?? puzzle.id,
    mapped: "puzzle-list",
  })),
  mapPuzzleDetailView: vi.fn((puzzle: { slug?: string; id?: string }) => ({
    id: puzzle.slug ?? puzzle.id,
    mapped: "puzzle-detail",
  })),
}));

vi.mock("../../server/src/repositories/catalogRepository.js", () => ({
  catalogRepository: {
    listStandardItems: mocks.listStandardItems,
    countStandardItems: mocks.countStandardItems,
    listChampions: mocks.listChampions,
    listItems: mocks.listItems,
    findChampionBySlug: mocks.findChampionBySlug,
  },
}));

vi.mock("../../server/src/repositories/puzzleRepository.js", () => ({
  puzzleRepository: {
    listPublished: mocks.listPublished,
    findBySlug: mocks.findBySlug,
  },
}));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    generatedPuzzleRequest: {
      findFirst: mocks.generatedRequestFindFirst,
      findUnique: mocks.generatedRequestFindUnique,
    },
  },
}));

vi.mock("../../server/src/lib/championIndex.js", () => ({
  buildChampionViewIndex: vi.fn((champions: Array<{ slug: string }>) =>
    new Map(champions.map((champion) => [champion.slug, { id: champion.slug }])),
  ),
}));

vi.mock("../../server/src/lib/itemIndex.js", () => ({
  buildItemViewIndex: vi.fn((items: Array<{ slug: string }>) =>
    new Map(items.map((item) => [item.slug, { id: item.slug }])),
  ),
}));

vi.mock("../../server/src/services/dailyChallengeService.js", () => ({
  dailyChallengeService: {
    getOrCreateToday: mocks.getOrCreateToday,
  },
}));

vi.mock("../../server/src/services/progressService.js", () => ({
  progressService: {
    getOverview: mocks.getOverview,
  },
}));

vi.mock("../../server/src/services/viewMappers.js", () => ({
  mapChampionView: mocks.mapChampionView,
  mapItemView: mocks.mapItemView,
  mapPuzzleListView: mocks.mapPuzzleListView,
  mapPuzzleDetailView: mocks.mapPuzzleDetailView,
}));

import { appService } from "../../server/src/services/appService";

const now = new Date("2026-06-07T08:00:00.000Z");

function item(slug = "infinity-edge", patch = "16.6") {
  return { id: `${slug}-id`, slug, patch };
}

function champion(slug = "jinx", patch = "16.5") {
  return { id: `${slug}-id`, slug, patch };
}

function puzzle(overrides: Record<string, unknown> = {}) {
  return {
    id: "puzzle-id",
    slug: "jinx-next-item",
    sourceType: PuzzleSourceType.MANUAL,
    isPublished: true,
    ...overrides,
  };
}

function generatedRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-id",
    userId: "owner-id",
    status: "COMPLETED",
    createdAt: now,
    updatedAt: now,
    parameters: { championSlug: "jinx" },
    resultPuzzleId: "puzzle-id",
    resultPuzzle: puzzle({
      slug: "draft-puzzle",
      sourceType: PuzzleSourceType.AI_GENERATED,
      isPublished: false,
    }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listStandardItems.mockResolvedValue([item("infinity-edge", "16.6")]);
  mocks.countStandardItems.mockResolvedValue(42);
  mocks.listChampions.mockResolvedValue([champion("jinx", "16.5")]);
  mocks.listItems.mockResolvedValue([item("bloodthirster", "16.4")]);
  mocks.findChampionBySlug.mockResolvedValue(champion("jinx"));
  mocks.listPublished.mockResolvedValue([puzzle()]);
  mocks.findBySlug.mockResolvedValue(puzzle());
  mocks.getOrCreateToday.mockResolvedValue({
    id: "challenge-id",
    challengeDate: now,
    completions: 7,
    puzzle: puzzle({ slug: "daily-puzzle" }),
  });
  mocks.getOverview.mockResolvedValue({
    completedCount: 3,
    championProgress: [
      {
        champion: { slug: "jinx" },
        mastery: 0.75,
      },
    ],
  });
  mocks.generatedRequestFindFirst.mockResolvedValue({ userId: "owner-id" });
  mocks.generatedRequestFindUnique.mockResolvedValue(generatedRequest());
});

describe("appService", () => {
  it("builds bootstrap payloads with catalog stats and optional user progress", async () => {
    const bootstrap = await appService.getBootstrap("user-id");

    expect(bootstrap).toMatchObject({
      stats: {
        itemCount: 42,
        championCount: 1,
        puzzleCount: 1,
        latestPatch: "16.6",
      },
      featuredItems: [{ id: "infinity-edge" }],
      featuredChampions: [{ id: "jinx" }],
      featuredPuzzles: [{ id: "jinx-next-item" }],
      dailyChallenge: { id: "daily-puzzle" },
      progress: { completedCount: 3 },
    });
    expect(mocks.listStandardItems).toHaveBeenCalledWith({ take: 18 });
    expect(mocks.getOverview).toHaveBeenCalledWith("user-id");
  });

  it("returns catalog entries with newest patches first", async () => {
    mocks.listChampions.mockResolvedValueOnce([
      champion("jinx", "16.5"),
      champion("ahri", "16.7"),
    ]);
    mocks.listStandardItems.mockResolvedValueOnce([
      item("infinity-edge", "16.6"),
      item("bloodthirster", "16.4"),
    ]);

    await expect(appService.getCatalog()).resolves.toMatchObject({
      champions: [{ id: "jinx" }, { id: "ahri" }],
      items: [{ id: "infinity-edge" }, { id: "bloodthirster" }],
      patches: ["16.7", "16.6", "16.5", "16.4"],
    });
  });

  it("maps puzzle filters to repository query criteria", async () => {
    await appService.getPuzzles({
      championSlug: "jinx",
      mode: "champion_specific",
      limit: 5,
    });

    expect(mocks.listPublished).toHaveBeenCalledWith({
      where: {
        champion: { slug: "jinx" },
        mode: "CHAMPION_SPECIFIC",
      },
      take: 5,
      orderBy: [{ createdAt: "desc" }],
    });
  });

  it("returns null for missing or inaccessible puzzle details", async () => {
    mocks.findBySlug.mockResolvedValueOnce(null);
    await expect(appService.getPuzzleDetail("missing")).resolves.toBeNull();

    mocks.findBySlug.mockResolvedValueOnce(puzzle({
      sourceType: PuzzleSourceType.AI_GENERATED,
      isPublished: false,
    }));
    await expect(appService.getPuzzleDetail("draft")).resolves.toBeNull();

    mocks.findBySlug.mockResolvedValueOnce(puzzle({
      sourceType: PuzzleSourceType.AI_GENERATED,
      isPublished: false,
    }));
    mocks.generatedRequestFindFirst.mockResolvedValueOnce({ userId: "owner-id" });
    await expect(appService.getPuzzleDetail("draft", { id: "other-user", isAdmin: false })).resolves.toBeNull();
  });

  it("maps published and authorized draft puzzle details", async () => {
    await expect(appService.getPuzzleDetail("published")).resolves.toMatchObject({
      id: "jinx-next-item",
      mapped: "puzzle-detail",
    });

    mocks.findBySlug.mockResolvedValueOnce(puzzle({
      slug: "draft-puzzle",
      sourceType: PuzzleSourceType.AI_GENERATED,
      isPublished: false,
    }));
    mocks.generatedRequestFindFirst.mockResolvedValueOnce({ userId: "owner-id" });

    await expect(appService.getPuzzleDetail("draft", { id: "owner-id", isAdmin: false })).resolves.toMatchObject({
      id: "draft-puzzle",
      mapped: "puzzle-detail",
    });
  });

  it("returns generated puzzle request payloads and draft details", async () => {
    const getPuzzleDetailSpy = vi.spyOn(appService, "getPuzzleDetail").mockResolvedValueOnce({
      id: "draft-puzzle",
      mapped: "puzzle-detail",
    });

    await expect(
      appService.getGeneratedPuzzleRequestById("request-id", { id: "owner-id", isAdmin: false }),
    ).resolves.toMatchObject({
      requestId: "request-id",
      status: "completed",
      puzzle: {
        id: "draft-puzzle",
      },
    });

    getPuzzleDetailSpy.mockResolvedValueOnce({
      id: "draft-puzzle",
      mapped: "puzzle-detail",
    });
    await expect(
      appService.getGeneratedPuzzleDraftByRequestId("request-id", { id: "owner-id", isAdmin: false }),
    ).resolves.toMatchObject({
      requestId: "request-id",
      status: "completed",
      puzzle: {
        id: "draft-puzzle",
      },
    });

    getPuzzleDetailSpy.mockRestore();
  });

  it.each([
    ["missing request", null, 404, "Requete de generation introuvable."],
    ["forbidden request", generatedRequest({ userId: "owner-id" }), 403, "Acces refuse a cette requete de generation."],
  ])("rejects generated puzzle request access: %s", async (_label, requestRecord, status, message) => {
    mocks.generatedRequestFindUnique.mockResolvedValueOnce(requestRecord);

    await expect(
      appService.getGeneratedPuzzleRequestById("request-id", { id: "other-user", isAdmin: false }),
    ).rejects.toMatchObject({
      status,
      message,
    } satisfies Partial<HttpError>);
  });

  it.each([
    ["missing request", null, 404, "Requete de generation introuvable."],
    [
      "missing draft",
      generatedRequest({ resultPuzzleId: null, resultPuzzle: null }),
      404,
      "Aucun brouillon ML n'est disponible pour cette requete.",
    ],
  ])("rejects generated draft access: %s", async (_label, requestRecord, status, message) => {
    mocks.generatedRequestFindUnique.mockResolvedValueOnce(requestRecord);

    await expect(
      appService.getGeneratedPuzzleDraftByRequestId("request-id", { id: "owner-id", isAdmin: false }),
    ).rejects.toMatchObject({
      status,
      message,
    } satisfies Partial<HttpError>);
  });

  it("builds dashboard, champion learning, and daily challenge detail payloads", async () => {
    await expect(appService.getDashboard("user-id")).resolves.toMatchObject({
      progress: { completedCount: 3 },
      dailyChallenge: { id: "daily-puzzle" },
    });

    await expect(appService.getChampionLearning("jinx", "user-id")).resolves.toMatchObject({
      champion: { id: "jinx" },
      puzzles: [{ id: "jinx-next-item" }],
      progress: {
        champion: { slug: "jinx" },
      },
    });

    await expect(appService.getDailyChallengeDetail()).resolves.toMatchObject({
      id: "challenge-id",
      completions: 7,
      puzzle: { id: "daily-puzzle" },
    });
  });

  it("returns null for unknown champion learning pages", async () => {
    mocks.findChampionBySlug.mockResolvedValueOnce(null);

    await expect(appService.getChampionLearning("unknown")).resolves.toBeNull();
  });
});
