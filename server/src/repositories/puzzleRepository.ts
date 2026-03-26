import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const puzzleInclude = {
  champion: true,
  choices: {
    include: {
      item: true,
    },
    orderBy: {
      displayOrder: "asc" as const,
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
} satisfies Prisma.PuzzleInclude;

export const puzzleRepository = {
  listAll: (args?: Omit<Prisma.PuzzleFindManyArgs, "include">) =>
    prisma.puzzle.findMany({
      include: puzzleInclude,
      orderBy: args?.orderBy ?? [{ updatedAt: "desc" }],
      take: args?.take,
      skip: args?.skip,
      where: args?.where,
    }),
  listPublished: (args?: Omit<Prisma.PuzzleFindManyArgs, "include">) =>
    prisma.puzzle.findMany({
      where: { isPublished: true, ...(args?.where ?? {}) },
      include: puzzleInclude,
      orderBy: args?.orderBy ?? [{ createdAt: "desc" }],
      take: args?.take,
      skip: args?.skip,
    }),
  findBySlug: (slug: string) =>
    prisma.puzzle.findUnique({
      where: { slug },
      include: puzzleInclude,
    }),
  findById: (id: string) =>
    prisma.puzzle.findUnique({
      where: { id },
      include: puzzleInclude,
    }),
  updatePuzzle: (id: string, data: Prisma.PuzzleUpdateInput) =>
    prisma.puzzle.update({
      where: { id },
      data,
      include: puzzleInclude,
    }),
  deletePuzzle: (id: string) =>
    prisma.puzzle.delete({
      where: { id },
    }),
  createAttempt: (data: Prisma.PuzzleAttemptUncheckedCreateInput) =>
    prisma.puzzleAttempt.create({
      data,
      include: {
        puzzle: {
          include: {
            champion: true,
          },
        },
      },
    }),
  listAttemptsByUser: (userId: string, take = 10) =>
    prisma.puzzleAttempt.findMany({
      where: { userId },
      include: {
        puzzle: {
          include: {
            champion: true,
          },
        },
        selectedChoice: {
          include: {
            item: true,
          },
        },
      },
      orderBy: {
        answeredAt: "desc",
      },
      take,
    }),
  upsertDailyChallenge: (challengeDate: Date, puzzleId: string) =>
    prisma.dailyChallenge.upsert({
      where: { challengeDate },
      update: { puzzleId },
      create: { challengeDate, puzzleId },
      include: {
        puzzle: {
          include: puzzleInclude,
        },
        completions: true,
      },
    }),
  getDailyChallenge: (challengeDate: Date) =>
    prisma.dailyChallenge.findUnique({
      where: { challengeDate },
      include: {
        puzzle: {
          include: puzzleInclude,
        },
        completions: true,
      },
    }),
};
