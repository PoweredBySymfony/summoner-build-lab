import { GeneratedPuzzleRequestStatus, GeneratedPuzzleRequestType, PuzzleMode, PuzzleSourceType, Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  championFindUnique: vi.fn(),
  championFindMany: vi.fn(),
  itemFindMany: vi.fn(),
  puzzleCreate: vi.fn(),
  generatedPuzzleRequestCreate: vi.fn(),
  importedMatchFindUnique: vi.fn(),
  mlIsConfigured: vi.fn(),
  mlGenerateFromImportedMatch: vi.fn(),
}));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    champion: {
      findUnique: mocks.championFindUnique,
      findMany: mocks.championFindMany,
    },
    item: {
      findMany: mocks.itemFindMany,
    },
    puzzle: {
      create: mocks.puzzleCreate,
    },
    generatedPuzzleRequest: {
      create: mocks.generatedPuzzleRequestCreate,
    },
    importedMatch: {
      findUnique: mocks.importedMatchFindUnique,
    },
  },
}));

vi.mock("../../server/src/services/mlPuzzleGenerationService.js", () => ({
  mlPuzzleGenerationService: {
    isConfigured: mocks.mlIsConfigured,
    generateFromImportedMatch: mocks.mlGenerateFromImportedMatch,
  },
}));

import { puzzleGenerationService } from "../../server/src/services/puzzleGenerationService";

const champion = {
  id: "champion-id",
  slug: "jinx",
  name: "Jinx",
  tags: ["Marksman"],
  patch: "16.7",
};

function itemFromSlug(slug: string) {
  return {
    id: `${slug}-id`,
    riotItemId: Math.abs([...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0)),
    slug,
    name: slug.replace(/-/g, " "),
    shortDescription: `${slug} short`,
    goldTotal: slug === "lord-dominiks-regards" ? 3000 : 2500,
    isBoots: slug.includes("boots") || slug.includes("steelcaps"),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.1234);
  vi.clearAllMocks();

  mocks.mlIsConfigured.mockReturnValue(false);
  mocks.mlGenerateFromImportedMatch.mockResolvedValue({ slug: "ml-generated", slugs: ["ml-generated"] });
  mocks.championFindUnique.mockImplementation(async ({ where }) => {
    if (where.id === "missing" || where.slug === "missing-champion") {
      return null;
    }
    return champion;
  });
  mocks.championFindMany.mockImplementation(async ({ where }) =>
    where.slug.in.map((slug: string) => ({
      id: `${slug}-champion-id`,
      riotChampionId: 100,
      championKey: slug.toUpperCase(),
      slug,
    })),
  );
  mocks.itemFindMany.mockImplementation(async ({ where }) =>
    where.slug.in.map((slug: string) => itemFromSlug(slug)),
  );
  mocks.puzzleCreate.mockImplementation(async ({ data }) => ({
    id: "generated-puzzle-id",
    slug: data.slug,
    mode: data.mode,
    sourceType: data.sourceType,
    champion: champion,
    choices: data.choices.create,
    scenario: data.scenario.create,
    tags: data.tags.create,
  }));
  mocks.generatedPuzzleRequestCreate.mockResolvedValue({ id: "request-id" });
  mocks.importedMatchFindUnique.mockResolvedValue({
    id: "imported-match-id",
    targetChampionSlug: "jinx",
    matchData: {
      metadata: {
        targetChampionSlug: "jinx",
      },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("puzzleGenerationService", () => {
  it("generates a champion puzzle with serialized choices, scenario teams, and request tracking", async () => {
    const puzzle = await puzzleGenerationService.generateChampionPuzzle("champion-id", "user-id");

    expect(puzzle).toMatchObject({
      id: "generated-puzzle-id",
      mode: PuzzleMode.CHAMPION_SPECIFIC,
      sourceType: PuzzleSourceType.GENERATED,
    });
    expect(mocks.puzzleCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        slug: "jinx-frontline-armor-1780833600000-1234",
        role: Role.ADC,
        championId: "champion-id",
        isDailyEligible: true,
        choices: {
          create: expect.arrayContaining([
            expect.objectContaining({
              itemId: "lord-dominiks-regards-id",
              isCorrect: true,
            }),
          ]),
        },
        scenario: {
          create: expect.objectContaining({
            playerChampionId: "champion-id",
            playerRole: Role.ADC,
            currentBuild: expect.any(Array),
            allyTeam: expect.any(Array),
            enemyTeam: expect.any(Array),
          }),
        },
      }),
    }));
    expect(mocks.generatedPuzzleRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-id",
        type: GeneratedPuzzleRequestType.CHAMPION,
        status: GeneratedPuzzleRequestStatus.COMPLETED,
        resultPuzzleId: "generated-puzzle-id",
      }),
    });
  });

  it("generates a five-puzzle champion series", async () => {
    let index = 0;
    mocks.puzzleCreate.mockImplementation(async ({ data }) => ({
      id: `generated-${index}`,
      slug: `${data.slug}-${index++}`,
    }));

    await expect(puzzleGenerationService.generateChampionPuzzleSeries("champion-id", "user-id")).resolves.toEqual({
      slug: "jinx-frontline-armor-1780833600000-1234-0",
      slugs: [
        "jinx-frontline-armor-1780833600000-1234-0",
        "jinx-anti-heal-1780833600000-1234-1",
        "jinx-anti-burst-1780833600000-1234-2",
        "jinx-mixed-damage-1780833600000-1234-3",
        "jinx-closing-damage-1780833600000-1234-4",
      ],
    });
    expect(mocks.puzzleCreate).toHaveBeenCalledTimes(5);
  });

  it("delegates match-based generation to ML when configured", async () => {
    mocks.mlIsConfigured.mockReturnValueOnce(true);

    await expect(
      puzzleGenerationService.generateMatchBasedPuzzle("imported-match-id", "user-id", {
        forceDraftOnLowConfidence: true,
        actorIsAdmin: true,
      }),
    ).resolves.toEqual({
      slug: "ml-generated",
      slugs: ["ml-generated"],
    });
    expect(mocks.mlGenerateFromImportedMatch).toHaveBeenCalledWith("imported-match-id", "user-id", {
      forceDraftOnLowConfidence: true,
      actorIsAdmin: true,
    });
  });

  it("falls back to template series for imported matches when ML is disabled", async () => {
    await expect(puzzleGenerationService.generateMatchBasedPuzzle("imported-match-id", "user-id")).resolves.toMatchObject({
      slugs: expect.arrayContaining([
        expect.stringContaining("jinx-frontline-armor"),
      ]),
    });
    expect(mocks.importedMatchFindUnique).toHaveBeenCalledWith({ where: { id: "imported-match-id" } });
    expect(mocks.generatedPuzzleRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        importedMatchId: "imported-match-id",
        type: GeneratedPuzzleRequestType.MATCH_BASED,
      }),
    });
  });

  it("rejects missing champions, missing imported matches, and unresolved required items", async () => {
    await expect(puzzleGenerationService.generateChampionPuzzle("missing")).rejects.toMatchObject({
      status: 404,
      message: "Champion introuvable.",
    } satisfies Partial<HttpError>);

    mocks.importedMatchFindUnique.mockResolvedValueOnce(null);
    await expect(puzzleGenerationService.generateMatchBasedPuzzle("missing-match", "user-id")).rejects.toMatchObject({
      status: 404,
    } satisfies Partial<HttpError>);

    mocks.itemFindMany.mockResolvedValueOnce([]);
    await expect(puzzleGenerationService.generateChampionPuzzle("champion-id")).rejects.toMatchObject({
      status: 500,
    } satisfies Partial<HttpError>);
  });
});
