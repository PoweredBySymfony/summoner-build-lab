import { startOfDay, differenceInCalendarDays } from "date-fns";
import { prisma } from "../lib/prisma.js";

export const progressService = {
  async recordAttempt(input: {
    userId: string;
    puzzleId: string;
    selectedChoiceId: string;
    isCorrect: boolean;
    responseTimeMs?: number;
  }) {
    const puzzle = await prisma.puzzle.findUnique({
      where: { id: input.puzzleId },
      include: {
        champion: true,
      },
    });

    if (!puzzle) {
      throw new Error("Puzzle not found while recording attempt.");
    }

    const attempt = await prisma.puzzleAttempt.create({
      data: input,
    });

    const globalProgress = await prisma.userGlobalProgress.upsert({
      where: { userId: input.userId },
      update: {
        totalAttempts: { increment: 1 },
        totalCorrect: input.isCorrect ? { increment: 1 } : undefined,
      },
      create: {
        userId: input.userId,
        totalAttempts: 1,
        totalCorrect: input.isCorrect ? 1 : 0,
      },
    });

    if (puzzle.championId) {
      await prisma.userChampionProgress.upsert({
        where: {
          userId_championId: {
            userId: input.userId,
            championId: puzzle.championId,
          },
        },
        update: {
          totalAttempts: { increment: 1 },
          correctAttempts: input.isCorrect ? { increment: 1 } : undefined,
          masteryScore: Math.max(
            0,
            Math.round(
              (((globalProgress.totalCorrect + (input.isCorrect ? 1 : 0)) / Math.max(globalProgress.totalAttempts + 1, 1)) * 100),
            ),
          ),
        },
        create: {
          userId: input.userId,
          championId: puzzle.championId,
          totalAttempts: 1,
          correctAttempts: input.isCorrect ? 1 : 0,
          masteryScore: input.isCorrect ? 100 : 0,
        },
      });
    }

    return attempt;
  },

  async completeDailyChallenge(input: { userId: string; dailyChallengeId: string; isCorrect: boolean }) {
    const existing = await prisma.dailyChallengeCompletion.findFirst({
      where: {
        dailyChallengeId: input.dailyChallengeId,
        userId: input.userId,
      },
    });

    if (existing) {
      return existing;
    }

    const completion = await prisma.dailyChallengeCompletion.create({
      data: input,
    });

    const progress = await prisma.userGlobalProgress.upsert({
      where: { userId: input.userId },
      update: {},
      create: { userId: input.userId },
    });

    const today = startOfDay(new Date());
    const lastCompletion = progress.lastDailyCompletedAt ? startOfDay(progress.lastDailyCompletedAt) : null;
    const gap = lastCompletion ? differenceInCalendarDays(today, lastCompletion) : null;
    const nextStreak = gap === null ? 1 : gap <= 1 ? progress.dailyStreak + 1 : 1;

    await prisma.userGlobalProgress.update({
      where: { userId: input.userId },
      data: {
        dailyStreak: nextStreak,
        bestStreak: Math.max(progress.bestStreak, nextStreak),
        lastDailyCompletedAt: new Date(),
      },
    });

    return completion;
  },

  async getOverview(userId: string) {
    const [globalProgress, championProgress, recentAttempts, dailyCompletions] = await Promise.all([
      prisma.userGlobalProgress.findUnique({ where: { userId } }),
      prisma.userChampionProgress.findMany({
        where: { userId },
        include: {
          champion: true,
        },
        orderBy: [{ masteryScore: "desc" }, { updatedAt: "desc" }],
        take: 12,
      }),
      prisma.puzzleAttempt.findMany({
        where: { userId },
        include: {
          puzzle: {
            include: {
              champion: true,
            },
          },
        },
        orderBy: { answeredAt: "desc" },
        take: 8,
      }),
      prisma.dailyChallengeCompletion.count({
        where: { userId, isCorrect: true },
      }),
    ]);

    return {
      global: globalProgress ?? {
        totalAttempts: 0,
        totalCorrect: 0,
        dailyStreak: 0,
        bestStreak: 0,
        lastDailyCompletedAt: null,
      },
      championProgress: championProgress.map((entry) => ({
        champion: entry.champion,
        totalAttempts: entry.totalAttempts,
        correctAttempts: entry.correctAttempts,
        masteryScore: entry.masteryScore ?? 0,
      })),
      recentAttempts,
      dailyCompletedCount: dailyCompletions,
    };
  },
};
