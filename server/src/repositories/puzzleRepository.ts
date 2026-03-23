import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const puzzleInclude = {
  champion: true,
  choices: {
    include: {
      item: true,
    },
    orderBy: {
      displayOrder: "asc" as const,
    },
  },
  tags: {
    include: {
      puzzleTag: true,
    },
  },
} satisfies Prisma.PuzzleInclude;

export const puzzleRepository = {
  listPublished: () =>
    prisma.puzzle.findMany({
      where: { isPublished: true },
      include: puzzleInclude,
      orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
    }),
  findBySlug: (slug: string) =>
    prisma.puzzle.findUnique({
      where: { slug },
      include: puzzleInclude,
    }),
  createAttempt: (data: { userId: string; puzzleId: string; selectedChoiceId: string; isCorrect: boolean }) =>
    prisma.puzzleAttempt.create({ data }),
  listAttemptsByUser: (userId: string) =>
    prisma.puzzleAttempt.findMany({
      where: { userId },
      include: {
        puzzle: true,
      },
      orderBy: {
        answeredAt: "desc",
      },
    }),
};
