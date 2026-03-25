import { Prisma } from "@prisma/client";
import { resolveItemSlug } from "../lib/itemSlugAliases.js";
import { prisma } from "../lib/prisma.js";

export const standardSummonersRiftItemWhere = {
  mapAvailability: {
    path: ["11"],
    equals: true,
  },
  riotItemId: {
    lt: 100000,
  },
  isActive: true,
  goldTotal: {
    gt: 0,
  },
} satisfies Prisma.ItemWhereInput;

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
  listStandardItems: (args?: Prisma.ItemFindManyArgs) =>
    prisma.item.findMany({
      ...args,
      where: args?.where
        ? {
            AND: [standardSummonersRiftItemWhere, args.where],
          }
        : standardSummonersRiftItemWhere,
      orderBy: args?.orderBy ?? [{ category: "asc" }, { name: "asc" }],
    }),
  countStandardItems: (where?: Prisma.ItemWhereInput) =>
    prisma.item.count({
      where: where
        ? {
            AND: [standardSummonersRiftItemWhere, where],
          }
        : standardSummonersRiftItemWhere,
    }),
  findChampionBySlug: (slug: string) =>
    prisma.champion.findUnique({
      where: { slug },
    }),
  findItemBySlug: (slug: string) =>
    prisma.item.findUnique({
      where: { slug: resolveItemSlug(slug) },
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
  deleteChampion: (id: string) =>
    prisma.champion.delete({
      where: { id },
    }),
  updateItem: (id: string, data: Prisma.ItemUpdateInput) =>
    prisma.item.update({
      where: { id },
      data,
    }),
  deleteItem: (id: string) =>
    prisma.item.delete({
      where: { id },
    }),
};
