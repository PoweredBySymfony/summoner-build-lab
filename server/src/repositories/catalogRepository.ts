import { prisma } from "../lib/prisma.js";

export const catalogRepository = {
  listItems: () =>
    prisma.item.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  listChampions: () =>
    prisma.champion.findMany({
      orderBy: [{ primaryRole: "asc" }, { name: "asc" }],
    }),
  findDemoUser: (username: string) =>
    prisma.user.findUnique({
      where: { username },
    }),
};
