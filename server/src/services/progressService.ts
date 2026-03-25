import { addHours, differenceInHours, isAfter } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { mapChampionView } from "./viewMappers.js";

const STREAK_WINDOW_HOURS = 24;

type StreakMetrics = {
  activeStreak: number;
  bestStreak: number;
  lastCompletionAt: Date | null;
  deadlineAt: Date | null;
};

const getStreakDeadline = (completedAt: Date | null) => (completedAt ? addHours(completedAt, STREAK_WINDOW_HOURS) : null);

const translatePuzzleTitle = (title: string) =>
  title.replace(/^(.+?) OTP ITEMIZATION PUZZLE$/i, (_match, name: string) => `${name} : puzzle d'itemisation OTP`);

const computeStreakMetrics = (completionDates: Date[], now: Date): StreakMetrics => {
  if (!completionDates.length) {
    return {
      activeStreak: 0,
      bestStreak: 0,
      lastCompletionAt: null,
      deadlineAt: null,
    };
  }

  const sortedAsc = [...completionDates].sort((left, right) => left.getTime() - right.getTime());
  let bestStreak = 1;
  let runningBest = 1;

  for (let index = 1; index < sortedAsc.length; index += 1) {
    const gapHours = differenceInHours(sortedAsc[index], sortedAsc[index - 1]);
    runningBest = gapHours <= STREAK_WINDOW_HOURS ? runningBest + 1 : 1;
    bestStreak = Math.max(bestStreak, runningBest);
  }

  const lastCompletionAt = sortedAsc.at(-1) ?? null;
  const deadlineAt = getStreakDeadline(lastCompletionAt);

  if (!lastCompletionAt || !deadlineAt || isAfter(now, deadlineAt)) {
    return {
      activeStreak: 0,
      bestStreak,
      lastCompletionAt,
      deadlineAt,
    };
  }

  let activeStreak = 1;
  for (let index = sortedAsc.length - 1; index > 0; index -= 1) {
    const gapHours = differenceInHours(sortedAsc[index], sortedAsc[index - 1]);
    if (gapHours <= STREAK_WINDOW_HOURS) {
      activeStreak += 1;
      continue;
    }

    break;
  }

  return {
    activeStreak,
    bestStreak,
    lastCompletionAt,
    deadlineAt,
  };
};

const syncDailyCompletionsFromAttempts = async (userId: string) => {
  const attempts = await prisma.puzzleAttempt.findMany({
    where: {
      userId,
      isCorrect: true,
      puzzle: {
        dailyChallenges: {
          some: {},
        },
      },
    },
    include: {
      puzzle: {
        include: {
          dailyChallenges: true,
        },
      },
    },
    orderBy: {
      answeredAt: "asc",
    },
  });

  for (const attempt of attempts) {
    const dailyChallenge = attempt.puzzle.dailyChallenges[0];
    if (!dailyChallenge) {
      continue;
    }

    const existing = await prisma.dailyChallengeCompletion.findFirst({
      where: {
        dailyChallengeId: dailyChallenge.id,
        userId,
      },
    });

    if (existing) {
      continue;
    }

    await prisma.dailyChallengeCompletion.create({
      data: {
        dailyChallengeId: dailyChallenge.id,
        userId,
        isCorrect: true,
        completedAt: attempt.answeredAt,
      },
    });
  }
};

const syncGlobalDailyProgress = async (userId: string) => {
  await syncDailyCompletionsFromAttempts(userId);

  const completions = await prisma.dailyChallengeCompletion.findMany({
    where: {
      userId,
      isCorrect: true,
    },
    orderBy: {
      completedAt: "asc",
    },
  });

  const metrics = computeStreakMetrics(
    completions.map((entry) => entry.completedAt),
    new Date(),
  );

  await prisma.userGlobalProgress.upsert({
    where: { userId },
    update: {
      dailyStreak: metrics.activeStreak,
      bestStreak: metrics.bestStreak,
      lastDailyCompletedAt: metrics.lastCompletionAt,
    },
    create: {
      userId,
      dailyStreak: metrics.activeStreak,
      bestStreak: metrics.bestStreak,
      lastDailyCompletedAt: metrics.lastCompletionAt,
    },
  });

  return metrics;
};

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
      throw new Error("Puzzle introuvable pendant l'enregistrement de la tentative.");
    }

    const attempt = await prisma.puzzleAttempt.create({
      data: input,
    });

    if (input.isCorrect) {
      const activeDailyChallenge = await prisma.dailyChallenge.findFirst({
        orderBy: { challengeDate: "desc" },
        include: {
          completions: {
            where: {
              userId: input.userId,
            },
          },
        },
      });

      if (activeDailyChallenge?.puzzleId === input.puzzleId && activeDailyChallenge.completions.length === 0) {
        await this.completeDailyChallenge({
          userId: input.userId,
          dailyChallengeId: activeDailyChallenge.id,
          isCorrect: true,
        });
      }
    }

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
      await syncGlobalDailyProgress(input.userId);
      return existing;
    }

    const completion = await prisma.dailyChallengeCompletion.create({
      data: input,
    });

    await syncGlobalDailyProgress(input.userId);
    return completion;
  },

  async getOverview(userId: string) {
    const streakMetrics = await syncGlobalDailyProgress(userId);

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

    const fallbackProgress = globalProgress ?? {
      totalAttempts: 0,
      totalCorrect: 0,
      dailyStreak: 0,
      bestStreak: 0,
      lastDailyCompletedAt: null,
    };

    return {
      global: {
        ...fallbackProgress,
        dailyStreak: streakMetrics.activeStreak,
        bestStreak: Math.max(fallbackProgress.bestStreak, streakMetrics.bestStreak),
        lastDailyCompletedAt: streakMetrics.lastCompletionAt?.toISOString() ?? fallbackProgress.lastDailyCompletedAt,
        streakDeadlineAt: streakMetrics.deadlineAt?.toISOString() ?? null,
      },
      championProgress: championProgress.map((entry) => ({
        champion: mapChampionView(entry.champion),
        totalAttempts: entry.totalAttempts,
        correctAttempts: entry.correctAttempts,
        masteryScore: entry.masteryScore ?? 0,
      })),
      dailyCompletedCount: dailyCompletions,
      recentAttempts: recentAttempts.map((attempt) => ({
        ...attempt,
        puzzle: {
          ...attempt.puzzle,
          title: translatePuzzleTitle(attempt.puzzle.title),
          champion: attempt.puzzle.champion ? mapChampionView(attempt.puzzle.champion) : null,
        },
      })),
    };
  },
};
