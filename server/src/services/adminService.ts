import { Prisma, PuzzleDifficulty, PuzzleMode, Role } from "@prisma/client";
import { catalogRepository, standardSummonersRiftItemWhere } from "../repositories/catalogRepository.js";
import { buildChampionViewIndex } from "../lib/championIndex.js";
import { buildItemViewIndex } from "../lib/itemIndex.js";
import { puzzleRepository } from "../repositories/puzzleRepository.js";
import { dataDragonClient } from "../lib/gameData/dataDragonClient.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http.js";
import { riotSyncService } from "./riotSyncService.js";
import { mapChampionView, mapItemView, mapPuzzleDetailView, mapPuzzleListView } from "./viewMappers.js";

const comparePatch = (left: string, right: string) =>
  right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });

const normalizeStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }

  return [];
};

const normalizeRecord = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const coerceNullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

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
    payload: {
      name: string;
      title?: string | null;
      rolePrimary?: Role | null;
      roleSecondary?: Role | null;
      patch: string;
      isActive: boolean;
      image: string;
      iconImage?: string | null;
      splashImage?: string | null;
      tags?: unknown;
      stats?: unknown;
    },
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
    payload: {
      name: string;
      shortDescription?: string | null;
      fullDescription?: string | null;
      image: string;
      patch: string;
      category?: string | null;
      goldTotal: number;
      goldBase?: number | null;
      goldSell?: number | null;
      isBoots: boolean;
      isLegendary: boolean;
      isConsumable: boolean;
      isTrinket: boolean;
      isStarter: boolean;
      isActive: boolean;
      activeEffect?: string | null;
      passiveEffect?: string | null;
      tags?: unknown;
      stats?: unknown;
      buildsFrom?: unknown;
      buildsInto?: unknown;
    },
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
    payload: {
      title: string;
      slug: string;
      mode: PuzzleMode;
      difficulty: PuzzleDifficulty;
      role?: Role | null;
      championId?: string | null;
      patch: string;
      description: string;
      shortPrompt: string;
      situation: string;
      question: string;
      explanation: string;
      isPublished: boolean;
      isDailyEligible: boolean;
    },
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
    const [champions, items] = await Promise.all([
      prisma.champion.findMany({
        where: { patch: { not: latestRemotePatch } },
        orderBy: [{ patch: "asc" }, { name: "asc" }],
      }),
      catalogRepository.listStandardItems({
        where: { patch: { not: latestRemotePatch } },
        orderBy: [{ patch: "asc" }, { name: "asc" }],
      }),
    ]);

    return {
      remoteLatestPatch: latestRemotePatch,
      hasUpdate: champions.length > 0 || items.length > 0,
      summary: {
        championCount: champions.length,
        itemCount: items.length,
      },
      champions: champions.map(mapChampionView),
      items: items.map(mapItemView),
    };
  },

  async syncPatch(version?: string) {
    const result = await riotSyncService.syncAll(version);
    const status = await this.getPatchStatus();
    return { result, status };
  },
};
