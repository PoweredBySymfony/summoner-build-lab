import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const catalogRepository = {
  listChampions: (args?: Prisma.ChampionFindManyArgs) =>
    prisma.champion.findMany({
      orderBy: [{ rolePrimary: "asc" }, { name: "asc" }],
      ...args,
    }),
  listItems: (args?: Prisma.ItemFindManyArgs) =>
    prisma.item.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      ...args,
    }),
  findChampionBySlug: (slug: string) =>
    prisma.champion.findUnique({
      where: { slug },
    }),
  findItemBySlug: (slug: string) =>
    prisma.item.findUnique({
      where: { slug },
    }),
  findChampionById: (id: string) =>
    prisma.champion.findUnique({
      where: { id },
    }),
  findItemById: (id: string) =>
    prisma.item.findUnique({
      where: { id },
    }),
  updateChampion: (id: string, data: Prisma.ChampionUpdateInput) =>
    prisma.champion.update({
      where: { id },
      data,
    }),
  updateItem: (id: string, data: Prisma.ItemUpdateInput) =>
    prisma.item.update({
      where: { id },
      data,
    }),
};
