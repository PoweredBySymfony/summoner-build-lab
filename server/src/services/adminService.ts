import { Prisma, PuzzleSourceType, type Champion } from "@prisma/client";
import type {
  AdminChampionUpdatePayload,
  AdminItemUpdatePayload,
  AdminPuzzleUpdatePayload,
} from "../lib/admin/adminPayloadSchemas.js";
import {
  buildNewChampionPatchEntry,
  buildNewItemPatchEntries,
  countPatchStatus,
  diffChampionPatch,
  diffItemPatch,
  type PatchLineItem,
  type RemoteChampionDetail,
} from "../lib/admin/patchDiff.js";
import { catalogRepository, standardSummonersRiftItemWhere } from "../repositories/catalogRepository.js";
import { buildChampionViewIndex } from "../lib/championIndex.js";
import { buildItemViewIndex } from "../lib/itemIndex.js";
import { puzzleRepository } from "../repositories/puzzleRepository.js";
import { dataDragonClient } from "../lib/gameData/dataDragonClient.js";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/slug.js";
import { HttpError } from "../utils/http.js";
import { riotSyncService } from "./riotSyncService.js";
import { mapChampionView, mapItemView, mapPuzzleDetailView, mapPuzzleListView } from "./viewMappers.js";

const comparePatch = (left: string, right: string) =>
  right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });

const normalizeStringArray = (value: readonly string[] | undefined) => value ? [...value] : [];

const normalizeRecord = (value: Record<string, unknown> | undefined) => value ?? {};

const coerceNullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com";

const buildRemoteItemReference = (itemId: string, item: { name?: string; plaintext?: string; description?: string; gold: { base: number; total: number; sell: number; purchasable: boolean }; tags?: string[]; stats?: Record<string, number>; from?: string[]; into?: string[]; maps?: Record<string, boolean>; consumed?: boolean; inStore?: boolean }, patch: string): PatchLineItem => {
  const riotItemId = Number(itemId);
  const name = item.name || `Item ${itemId}`;
  return {
    id: slugify(name || itemId),
    databaseId: `remote:${itemId}`,
    riotItemId,
    name,
    slug: slugify(name || itemId),
    icon: dataDragonClient.getItemIconUrl(patch, itemId),
    image: dataDragonClient.getItemIconUrl(patch, itemId),
    cost: item.gold.total,
    baseCost: item.gold.base,
    sellPrice: item.gold.sell,
    category: item.tags?.[0]?.toLowerCase() ?? "utility",
    tags: item.tags ?? [],
    itemGroups: [],
    stats: item.stats ?? {},
    shortDescription: item.plaintext || null,
    fullDescription: item.description || null,
    activeEffect: null,
    passiveEffect: null,
    buildsFrom: item.from ?? [],
    buildsInto: item.into ?? [],
    buildsFromIcons: (item.from ?? []).map((entry) => ({
      riotItemId: Number(entry),
      icon: dataDragonClient.getItemIconUrl(patch, entry),
    })),
    mapAvailability: item.maps ?? null,
    isBoots: item.tags?.includes("Boots") ?? false,
    isLegendary: item.gold.total >= 2200,
    isConsumable: item.consumed ?? false,
    isTrinket: item.tags?.includes("Trinket") ?? false,
    isStarter: item.tags?.includes("Lane") ?? false,
    isActive: item.gold.purchasable && item.inStore !== false,
    patch,
  };
};

const createChampionPreview = (detail: RemoteChampionDetail | undefined, patch: string) => detail ? {
  blurb: detail.blurb ?? null,
  passive: {
    id: `${detail.id}-passive`,
    key: "Passive",
    name: detail.passive.name,
    description: detail.passive.description,
    icon: `${DDRAGON_BASE_URL}/cdn/${patch}/img/passive/${detail.passive.image.full}`,
  },
  spells: detail.spells.map((spell, index) => ({
    id: spell.id,
    key: ["A", "Z", "E", "R"][index] ?? `Sort ${index + 1}`,
    name: spell.name,
    description: spell.description,
    icon: `${DDRAGON_BASE_URL}/cdn/${patch}/img/spell/${spell.image.full}`,
  })),
} : undefined;

async function resolveChampionDetails(champions: Champion[], targetPatch: string) {
  const requests = champions.flatMap((champion) => {
    if (!champion.championKey) {
      return [];
    }

    return [
      { key: `${champion.patch}:${champion.championKey}`, patch: champion.patch, championKey: champion.championKey },
      { key: `${targetPatch}:${champion.championKey}`, patch: targetPatch, championKey: champion.championKey },
    ];
  });
  const uniqueRequests = [...new Map(requests.map((request) => [request.key, request])).values()];
  const details = await Promise.all(uniqueRequests.map(async (request) => {
    try {
      return [request.key, await dataDragonClient.getChampionDetail(request.patch, request.championKey)] as const;
    } catch {
      return [request.key, undefined] as const;
    }
  }));

  return new Map<string, RemoteChampionDetail | undefined>(details);
}


export type {
  AdminChampionUpdatePayload,
  AdminItemUpdatePayload,
  AdminPuzzleUpdatePayload,
} from "../lib/admin/adminPayloadSchemas.js";

export const adminService = {
  async getOverview() {
    const [championCount, itemCount, puzzleCount, publishedPuzzleCount, latestRemotePatch, championPatches, itemPatches] = await Promise.all([
      prisma.champion.count(),
      catalogRepository.countStandardItems(),
      prisma.puzzle.count(),
      prisma.puzzle.count({ where: { isPublished: true } }),
      dataDragonClient.getLatestVersion(),
      prisma.champion.groupBy({ by: ["patch"], _count: { _all: true } }),
      prisma.item.groupBy({ by: ["patch"], where: standardSummonersRiftItemWhere, _count: { _all: true } }),
    ]);

    const patchCandidates = [...championPatches.map((entry) => entry.patch), ...itemPatches.map((entry) => entry.patch)]
      .filter(Boolean)
      .sort(comparePatch);

    return {
      stats: {
        championCount,
        itemCount,
        puzzleCount,
        publishedPuzzleCount,
      },
      patch: {
        localLatestPatch: patchCandidates[0] ?? null,
        remoteLatestPatch: latestRemotePatch,
        hasUpdate: patchCandidates[0] !== latestRemotePatch,
      },
    };
  },

  async listChampions() {
    const champions = await catalogRepository.listChampions();
    return champions.map(mapChampionView);
  },

  async listItems() {
    const items = await catalogRepository.listStandardItems();
    return items.map(mapItemView);
  },

  async listPuzzles() {
    const puzzles = await puzzleRepository.listAll();
    return puzzles.map(mapPuzzleListView);
  },

  async listAiGeneratedPuzzles() {
    const puzzles = await puzzleRepository.listAll({
      where: {
        sourceType: PuzzleSourceType.AI_GENERATED,
        isPublished: false,
      },
    });
    return puzzles.map(mapPuzzleListView);
  },

  async getPuzzleDetail(id: string) {
    const [puzzle, champions, items] = await Promise.all([
      puzzleRepository.findById(id),
      catalogRepository.listChampions(),
      catalogRepository.listItems(),
    ]);

    if (!puzzle) {
      throw new HttpError(404, "Puzzle introuvable.");
    }

    const championIndex = buildChampionViewIndex(champions);
    const itemIndex = buildItemViewIndex(items);
    return mapPuzzleDetailView(puzzle, championIndex, itemIndex);
  },

  async updateChampion(
    id: string,
    payload: AdminChampionUpdatePayload,
  ) {
    const champion = await catalogRepository.findChampionById(id);
    if (!champion) {
      throw new HttpError(404, "Champion introuvable.");
    }

    const updated = await catalogRepository.updateChampion(id, {
      name: payload.name.trim(),
      title: coerceNullableString(payload.title),
      rolePrimary: payload.rolePrimary ?? null,
      roleSecondary: payload.roleSecondary ?? null,
      patch: payload.patch.trim(),
      isActive: payload.isActive,
      image: payload.image.trim(),
      iconImage: coerceNullableString(payload.iconImage) ?? payload.image.trim(),
      splashImage: coerceNullableString(payload.splashImage),
      tags: normalizeStringArray(payload.tags) as Prisma.InputJsonValue,
      stats: normalizeRecord(payload.stats) as Prisma.InputJsonValue,
    });

    return mapChampionView(updated);
  },

  async deleteChampion(id: string) {
    const champion = await catalogRepository.findChampionById(id);
    if (!champion) {
      throw new HttpError(404, "Champion introuvable.");
    }

    const dependencies = await prisma.$transaction([
      prisma.puzzle.count({ where: { championId: id } }),
      prisma.puzzleScenario.count({ where: { playerChampionId: id } }),
      prisma.userChampionProgress.count({ where: { championId: id } }),
      prisma.generatedPuzzleRequest.count({ where: { championId: id } }),
    ]);

    const totalDependencies = dependencies.reduce((sum, value) => sum + value, 0);
    if (totalDependencies > 0) {
      throw new HttpError(409, "Ce champion est encore reference dans des puzzles, des scenarios ou de la progression. Archive-le ou nettoie ses dependances avant suppression.");
    }

    await catalogRepository.deleteChampion(id);
    return { deleted: true };
  },

  async updateItem(
    id: string,
    payload: AdminItemUpdatePayload,
  ) {
    const item = await catalogRepository.findItemById(id);
    if (!item) {
      throw new HttpError(404, "Objet introuvable.");
    }

    const updated = await catalogRepository.updateItem(id, {
      name: payload.name.trim(),
      shortDescription: coerceNullableString(payload.shortDescription),
      fullDescription: coerceNullableString(payload.fullDescription),
      image: payload.image.trim(),
      patch: payload.patch.trim(),
      category: coerceNullableString(payload.category),
      goldTotal: payload.goldTotal,
      goldBase: payload.goldBase ?? null,
      goldSell: payload.goldSell ?? null,
      isBoots: payload.isBoots,
      isLegendary: payload.isLegendary,
      isConsumable: payload.isConsumable,
      isTrinket: payload.isTrinket,
      isStarter: payload.isStarter,
      isActive: payload.isActive,
      activeEffect: coerceNullableString(payload.activeEffect),
      passiveEffect: coerceNullableString(payload.passiveEffect),
      tags: normalizeStringArray(payload.tags) as Prisma.InputJsonValue,
      stats: normalizeRecord(payload.stats) as Prisma.InputJsonValue,
      buildsFrom: normalizeStringArray(payload.buildsFrom) as Prisma.InputJsonValue,
      buildsInto: normalizeStringArray(payload.buildsInto) as Prisma.InputJsonValue,
    });

    return mapItemView(updated);
  },

  async deleteItem(id: string) {
    const item = await catalogRepository.findItemById(id);
    if (!item) {
      throw new HttpError(404, "Objet introuvable.");
    }

    const dependencyCount = await prisma.puzzleChoice.count({ where: { itemId: id } });
    if (dependencyCount > 0) {
      throw new HttpError(409, "Cet item est encore utilise dans des choix de puzzles. Corrige d'abord les puzzles concernes.");
    }

    await catalogRepository.deleteItem(id);
    return { deleted: true };
  },

  async updatePuzzle(
    id: string,
    payload: AdminPuzzleUpdatePayload,
  ) {
    const puzzle = await puzzleRepository.findById(id);
    if (!puzzle) {
      throw new HttpError(404, "Puzzle introuvable.");
    }

    await puzzleRepository.updatePuzzle(id, {
      title: payload.title.trim(),
      slug: payload.slug.trim(),
      mode: payload.mode,
      difficulty: payload.difficulty,
      role: payload.role ?? null,
      champion: payload.championId ? { connect: { id: payload.championId } } : { disconnect: true },
      patch: payload.patch.trim(),
      description: payload.description.trim(),
      shortPrompt: payload.shortPrompt.trim(),
      situation: payload.situation.trim(),
      question: payload.question.trim(),
      explanation: payload.explanation.trim(),
      isPublished: payload.isPublished,
      isDailyEligible: payload.isDailyEligible,
    });

    return this.getPuzzleDetail(id);
  },

  async publishPuzzle(id: string) {
    const puzzle = await puzzleRepository.findById(id);
    if (!puzzle) {
      throw new HttpError(404, "Puzzle introuvable.");
    }

    await puzzleRepository.updatePuzzle(id, {
      isPublished: true,
    });

    return this.getPuzzleDetail(id);
  },

  async deletePuzzle(id: string) {
    const puzzle = await puzzleRepository.findById(id);
    if (!puzzle) {
      throw new HttpError(404, "Puzzle introuvable.");
    }

    await puzzleRepository.deletePuzzle(id);
    return { deleted: true };
  },

  async getPatchStatus() {
    const latestRemotePatch = await dataDragonClient.getLatestVersion();
    const [champions, allChampions, items, allItems, remoteChampions, remoteItems] = await Promise.all([
      prisma.champion.findMany({
        where: { patch: { not: latestRemotePatch } },
        orderBy: [{ patch: "asc" }, { name: "asc" }],
      }),
      prisma.champion.findMany({
        orderBy: [{ patch: "asc" }, { name: "asc" }],
      }),
      catalogRepository.listStandardItems({
        where: { patch: { not: latestRemotePatch } },
        orderBy: [{ patch: "asc" }, { name: "asc" }],
      }),
      catalogRepository.listStandardItems(),
      dataDragonClient.getChampionSummary(latestRemotePatch),
      dataDragonClient.getItemSummary(latestRemotePatch),
    ]);
    const localChampionKeys = new Set(allChampions.map((champion) => champion.championKey).filter(Boolean));
    const localItemIds = new Set(allItems.map((item) => item.riotItemId));
    const itemNameById = new Map<string, string>([
      ...allItems.map((item) => [String(item.riotItemId), item.name] as const),
      ...Object.entries(remoteItems.data).map(([itemId, item]) => [itemId, item.name || `Item Riot ${itemId}`] as const),
    ]);
    const itemReferenceById = new Map<string, PatchLineItem>([
      ...allItems.map((item) => [String(item.riotItemId), mapItemView(item) as PatchLineItem] as const),
      ...Object.entries(remoteItems.data).map(([itemId, item]) => [itemId, buildRemoteItemReference(itemId, item, latestRemotePatch)] as const),
    ]);
    const championDetailByPatch = await resolveChampionDetails(champions, latestRemotePatch);
    const championEntries = [
      ...champions.map((champion) => {
        const remoteChampion = champion.championKey ? remoteChampions.data[champion.championKey] : undefined;
        const localChampionDetail = champion.championKey ? championDetailByPatch.get(`${champion.patch}:${champion.championKey}`) : undefined;
        const remoteChampionDetail = champion.championKey ? championDetailByPatch.get(`${latestRemotePatch}:${champion.championKey}`) : undefined;
        return {
          ...mapChampionView(champion),
          patchPreview: createChampionPreview(remoteChampionDetail, latestRemotePatch),
          ...diffChampionPatch(champion, remoteChampion, { localChampionDetail, remoteChampionDetail }),
        };
      }),
      ...Object.values(remoteChampions.data)
        .filter((champion) => !localChampionKeys.has(champion.id))
        .map((champion) => buildNewChampionPatchEntry(champion, latestRemotePatch)),
    ];
    const itemEntries = [
      ...items.map((item) => ({
        ...mapItemView(item),
        ...diffItemPatch(item, remoteItems.data[String(item.riotItemId)], { itemNameById, itemReferenceById }),
      })),
      ...buildNewItemPatchEntries(remoteItems.data, localItemIds, latestRemotePatch),
    ];

    return {
      remoteLatestPatch: latestRemotePatch,
      hasUpdate: championEntries.length > 0 || itemEntries.length > 0,
      summary: {
        championCount: championEntries.length,
        itemCount: itemEntries.length,
        changedChampionCount: countPatchStatus(championEntries, "changed"),
        changedItemCount: countPatchStatus(itemEntries, "changed"),
        newChampionCount: countPatchStatus(championEntries, "new"),
        newItemCount: countPatchStatus(itemEntries, "new"),
        unchangedChampionCount: countPatchStatus(championEntries, "unchanged"),
        unchangedItemCount: countPatchStatus(itemEntries, "unchanged"),
        removedChampionCount: countPatchStatus(championEntries, "removed"),
        removedItemCount: countPatchStatus(itemEntries, "removed"),
      },
      champions: championEntries,
      items: itemEntries,
    };
  },

  async syncPatch(version?: string) {
    const result = await riotSyncService.syncAll(version);
    const status = await this.getPatchStatus();
    return { result, status };
  },
};
