import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  puzzleFindUnique: vi.fn(),
  puzzleAttemptCreate: vi.fn(),
  puzzleAttemptFindMany: vi.fn(),
  userGlobalProgressUpsert: vi.fn(),
  userGlobalProgressFindUnique: vi.fn(),
  userChampionProgressUpsert: vi.fn(),
  userChampionProgressFindMany: vi.fn(),
  dailyChallengeFindFirst: vi.fn(),
  dailyChallengeCompletionFindFirst: vi.fn(),
  dailyChallengeCompletionCreate: vi.fn(),
  dailyChallengeCompletionFindMany: vi.fn(),
  dailyChallengeCompletionCount: vi.fn(),
  mapChampionView: vi.fn((champion: { slug: string; name?: string }) => ({
    id: champion.slug,
    name: champion.name ?? champion.slug,
  })),
}));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    puzzle: {
      findUnique: mocks.puzzleFindUnique,
    },
    puzzleAttempt: {
      create: mocks.puzzleAttemptCreate,
      findMany: mocks.puzzleAttemptFindMany,
    },
    userGlobalProgress: {
      upsert: mocks.userGlobalProgressUpsert,
      findUnique: mocks.userGlobalProgressFindUnique,
    },
    userChampionProgress: {
      upsert: mocks.userChampionProgressUpsert,
      findMany: mocks.userChampionProgressFindMany,
    },
    dailyChallenge: {
      findFirst: mocks.dailyChallengeFindFirst,
    },
    dailyChallengeCompletion: {
      findFirst: mocks.dailyChallengeCompletionFindFirst,
      create: mocks.dailyChallengeCompletionCreate,
      findMany: mocks.dailyChallengeCompletionFindMany,
      count: mocks.dailyChallengeCompletionCount,
    },
  },
}));

vi.mock("../../server/src/services/viewMappers.js", () => ({
  mapChampionView: mocks.mapChampionView,
}));

import { progressService } from "../../server/src/services/progressService";

const now = new Date("2026-06-07T10:00:00.000Z");
const yesterday = new Date("2026-06-06T11:00:00.000Z");
const twoDaysAgo = new Date("2026-06-05T12:00:00.000Z");

function champion(overrides: Record<string, unknown> = {}) {
  return {
    id: "champion-id",
    slug: "jinx",
    name: "Jinx",
    ...overrides,
  };
}

function puzzle(overrides: Record<string, unknown> = {}) {
  return {
    id: "puzzle-id",
    title: "Jinx OTP ITEMIZATION PUZZLE",
    championId: "champion-id",
    champion: champion(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();

  mocks.puzzleFindUnique.mockResolvedValue(puzzle());
  mocks.puzzleAttemptCreate.mockImplementation(async ({ data }) => ({
    id: "attempt-id",
    answeredAt: now,
    ...data,
  }));
  mocks.userGlobalProgressUpsert.mockResolvedValue({
    userId: "user-id",
    totalAttempts: 4,
    totalCorrect: 2,
    dailyStreak: 0,
    bestStreak: 0,
    lastDailyCompletedAt: null,
  });
  mocks.userChampionProgressUpsert.mockResolvedValue({});
  mocks.dailyChallengeFindFirst.mockResolvedValue(null);
  mocks.dailyChallengeCompletionFindFirst.mockResolvedValue(null);
  mocks.dailyChallengeCompletionCreate.mockImplementation(async ({ data }) => ({
    id: "completion-id",
    completedAt: now,
    ...data,
  }));
  mocks.dailyChallengeCompletionFindMany.mockResolvedValue([]);
  mocks.dailyChallengeCompletionCount.mockResolvedValue(0);
  mocks.puzzleAttemptFindMany.mockResolvedValue([]);
  mocks.userGlobalProgressFindUnique.mockResolvedValue(null);
  mocks.userChampionProgressFindMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("progressService", () => {
  it("records attempts, completes active daily challenges, and updates champion progress", async () => {
    mocks.dailyChallengeFindFirst.mockResolvedValueOnce({
      id: "daily-id",
      puzzleId: "puzzle-id",
      completions: [],
    });

    await expect(
      progressService.recordAttempt({
        userId: "user-id",
        puzzleId: "puzzle-id",
        selectedChoiceId: "choice-id",
        isCorrect: true,
        responseTimeMs: 12_000,
      }),
    ).resolves.toMatchObject({
      id: "attempt-id",
      userId: "user-id",
      puzzleId: "puzzle-id",
      isCorrect: true,
    });

    expect(mocks.dailyChallengeCompletionCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-id",
        dailyChallengeId: "daily-id",
        isCorrect: true,
      },
    });
    expect(mocks.userGlobalProgressUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-id" },
      update: {
        totalAttempts: { increment: 1 },
        totalCorrect: { increment: 1 },
      },
    }));
    expect(mocks.userChampionProgressUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_championId: {
          userId: "user-id",
          championId: "champion-id",
        },
      },
      update: expect.objectContaining({
        totalAttempts: { increment: 1 },
        correctAttempts: { increment: 1 },
        masteryScore: 60,
      }),
    }));
  });

  it("records incorrect championless attempts without daily completion", async () => {
    mocks.puzzleFindUnique.mockResolvedValueOnce(puzzle({ championId: null }));

    await progressService.recordAttempt({
      userId: "user-id",
      puzzleId: "puzzle-id",
      selectedChoiceId: "choice-id",
      isCorrect: false,
    });

    expect(mocks.dailyChallengeFindFirst).not.toHaveBeenCalled();
    expect(mocks.dailyChallengeCompletionCreate).not.toHaveBeenCalled();
    expect(mocks.userChampionProgressUpsert).not.toHaveBeenCalled();
    expect(mocks.userGlobalProgressUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        totalAttempts: { increment: 1 },
        totalCorrect: undefined,
      },
    }));
  });

  it("throws when recording an attempt for an unknown puzzle", async () => {
    mocks.puzzleFindUnique.mockResolvedValueOnce(null);

    await expect(
      progressService.recordAttempt({
        userId: "user-id",
        puzzleId: "missing-puzzle",
        selectedChoiceId: "choice-id",
        isCorrect: true,
      }),
    ).rejects.toThrow("Puzzle introuvable pendant l'enregistrement de la tentative.");
    expect(mocks.puzzleAttemptCreate).not.toHaveBeenCalled();
  });

  it("returns existing daily completions and still refreshes global streak progress", async () => {
    const existingCompletion = {
      id: "existing-completion",
      completedAt: yesterday,
      dailyChallengeId: "daily-id",
      userId: "user-id",
      isCorrect: true,
    };
    mocks.dailyChallengeCompletionFindFirst.mockResolvedValueOnce(existingCompletion);
    mocks.dailyChallengeCompletionFindMany.mockResolvedValueOnce([
      { completedAt: twoDaysAgo },
      { completedAt: yesterday },
    ]);

    await expect(
      progressService.completeDailyChallenge({
        userId: "user-id",
        dailyChallengeId: "daily-id",
        isCorrect: true,
      }),
    ).resolves.toBe(existingCompletion);

    expect(mocks.dailyChallengeCompletionCreate).not.toHaveBeenCalled();
    expect(mocks.userGlobalProgressUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        dailyStreak: 2,
        bestStreak: 2,
        lastDailyCompletedAt: yesterday,
      }),
    }));
  });

  it("syncs missing daily completions from historical correct attempts", async () => {
    mocks.puzzleAttemptFindMany.mockResolvedValueOnce([
      {
        answeredAt: twoDaysAgo,
        puzzle: {
          dailyChallenges: [{ id: "daily-from-attempt" }],
        },
      },
      {
        answeredAt: yesterday,
        puzzle: {
          dailyChallenges: [],
        },
      },
    ]);
    mocks.dailyChallengeCompletionFindMany.mockResolvedValueOnce([
      { completedAt: twoDaysAgo },
      { completedAt: yesterday },
    ]);
    mocks.userGlobalProgressFindUnique.mockResolvedValueOnce({
      userId: "user-id",
      totalAttempts: 8,
      totalCorrect: 6,
      dailyStreak: 1,
      bestStreak: 1,
      lastDailyCompletedAt: twoDaysAgo,
    });
    mocks.userChampionProgressFindMany.mockResolvedValueOnce([
      {
        champion: champion(),
        totalAttempts: 4,
        correctAttempts: 3,
        masteryScore: 75,
      },
    ]);
    mocks.dailyChallengeCompletionCount.mockResolvedValueOnce(2);
    mocks.puzzleAttemptFindMany.mockResolvedValueOnce([
      {
        id: "recent-attempt",
        puzzle: puzzle(),
      },
    ]);

    const overview = await progressService.getOverview("user-id");

    expect(mocks.dailyChallengeCompletionCreate).toHaveBeenCalledWith({
      data: {
        dailyChallengeId: "daily-from-attempt",
        userId: "user-id",
        isCorrect: true,
        completedAt: twoDaysAgo,
      },
    });
    expect(overview).toMatchObject({
      global: {
        totalAttempts: 8,
        totalCorrect: 6,
        dailyStreak: 2,
        bestStreak: 2,
        lastDailyCompletedAt: yesterday.toISOString(),
      },
      championProgress: [
        {
          champion: { id: "jinx" },
          totalAttempts: 4,
          correctAttempts: 3,
          masteryScore: 75,
        },
      ],
      dailyCompletedCount: 2,
      recentAttempts: [
        {
          id: "recent-attempt",
          puzzle: {
            title: "Jinx : puzzle d'itemisation OTP",
            champion: { id: "jinx" },
          },
        },
      ],
    });
  });
});
