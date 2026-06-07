import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  getDailyChallenge: vi.fn(),
  upsertDailyChallenge: vi.fn(),
  puzzleFindMany: vi.fn(),
}));

vi.mock("../../server/src/repositories/puzzleRepository.js", () => ({
  puzzleRepository: {
    getDailyChallenge: mocks.getDailyChallenge,
    upsertDailyChallenge: mocks.upsertDailyChallenge,
  },
}));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    puzzle: {
      findMany: mocks.puzzleFindMany,
    },
  },
}));

import { dailyChallengeService } from "../../server/src/services/dailyChallengeService";

const now = new Date("2026-06-07T15:30:00.000Z");
const todayLocalStart = new Date(2026, 5, 7);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  mocks.getDailyChallenge.mockResolvedValue(null);
  mocks.upsertDailyChallenge.mockResolvedValue({ id: "daily-id", puzzleId: "puzzle-id" });
  mocks.puzzleFindMany.mockResolvedValue([{ id: "puzzle-id" }]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("dailyChallengeService", () => {
  it("returns the existing daily challenge for the current day", async () => {
    mocks.getDailyChallenge.mockResolvedValueOnce({ id: "existing-daily" });

    await expect(dailyChallengeService.getOrCreateToday()).resolves.toEqual({ id: "existing-daily" });
    expect(mocks.getDailyChallenge).toHaveBeenCalledWith(todayLocalStart);
    expect(mocks.puzzleFindMany).not.toHaveBeenCalled();
    expect(mocks.upsertDailyChallenge).not.toHaveBeenCalled();
  });

  it("selects an eligible published puzzle when no daily challenge exists", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.75);
    mocks.puzzleFindMany.mockResolvedValueOnce([
      { id: "first-puzzle" },
      { id: "second-puzzle" },
    ]);

    await expect(dailyChallengeService.getOrCreateToday()).resolves.toEqual({
      id: "daily-id",
      puzzleId: "puzzle-id",
    });

    expect(mocks.puzzleFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        isPublished: true,
        isDailyEligible: true,
      },
      take: 20,
    }));
    expect(mocks.upsertDailyChallenge).toHaveBeenCalledWith(
      todayLocalStart,
      "second-puzzle",
    );
    randomSpy.mockRestore();
  });

  it("throws a typed error when no daily candidate is available", async () => {
    mocks.puzzleFindMany.mockResolvedValueOnce([]);

    await expect(dailyChallengeService.getOrCreateToday()).rejects.toMatchObject({
      status: 404,
      message: "No daily challenge candidates are available.",
    } satisfies Partial<HttpError>);
  });
});
