import { startOfDay } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { puzzleRepository } from "../repositories/puzzleRepository.js";
import { HttpError } from "../utils/http.js";

export const dailyChallengeService = {
  async getOrCreateToday() {
    const today = startOfDay(new Date());
    const existing = await puzzleRepository.getDailyChallenge(today);
    if (existing) {
      return existing;
    }

    const candidates = await prisma.puzzle.findMany({
      where: {
        isPublished: true,
        isDailyEligible: true,
      },
      include: {
        champion: true,
        choices: {
          include: {
            item: true,
          },
          orderBy: {
            displayOrder: "asc",
          },
        },
        scenario: {
          include: {
            playerChampion: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: [{ attempts: { _count: "asc" } }, { createdAt: "desc" }],
      take: 20,
    });

    if (!candidates.length) {
      throw new HttpError(404, "No daily challenge candidates are available.");
    }

    const puzzle = candidates[Math.floor(Math.random() * candidates.length)];
    return puzzleRepository.upsertDailyChallenge(today, puzzle.id);
  },
};
