import { catalogRepository } from "../repositories/catalogRepository.js";
import { buildChampionViewIndex } from "../lib/championIndex.js";
import { buildItemViewIndex } from "../lib/itemIndex.js";
import { puzzleRepository } from "../repositories/puzzleRepository.js";
import { dailyChallengeService } from "./dailyChallengeService.js";
import { progressService } from "./progressService.js";
import { mapChampionView, mapItemView, mapPuzzleDetailView, mapPuzzleListView } from "./viewMappers.js";

export const appService = {
  async getBootstrap(userId?: string) {
    const [items, champions, puzzles, dailyChallenge, progress] = await Promise.all([
      catalogRepository.listStandardItems({ take: 18 }),
      catalogRepository.listChampions({ take: 24 }),
      puzzleRepository.listPublished({ take: 12, orderBy: [{ createdAt: "desc" }] }),
      dailyChallengeService.getOrCreateToday(),
      userId ? progressService.getOverview(userId) : Promise.resolve(null),
    ]);

    const [itemCount, championCount, puzzleCount] = await Promise.all([
      catalogRepository.countStandardItems(),
      catalogRepository.listChampions({}).then((list) => list.length),
      puzzleRepository.listPublished({}).then((list) => list.length),
    ]);

    return {
      stats: {
        itemCount,
        championCount,
        puzzleCount,
        latestPatch: items[0]?.patch ?? champions[0]?.patch ?? "unknown",
      },
      featuredItems: items.map(mapItemView),
      featuredChampions: champions.map(mapChampionView),
      featuredPuzzles: puzzles.map(mapPuzzleListView),
      dailyChallenge: mapPuzzleListView(dailyChallenge.puzzle),
      progress,
    };
  },

  async getCatalog() {
    const [champions, items] = await Promise.all([catalogRepository.listChampions(), catalogRepository.listStandardItems()]);
    return {
      champions: champions.map(mapChampionView),
      items: items.map(mapItemView),
      patches: Array.from(new Set([...champions.map((entry) => entry.patch), ...items.map((entry) => entry.patch)])).sort().reverse(),
    };
  },

  async getPuzzles(filters: { championSlug?: string; mode?: string; limit?: number }) {
    const puzzles = await puzzleRepository.listPublished({
      where: {
        champion: filters.championSlug ? { slug: filters.championSlug } : undefined,
        mode: filters.mode ? (filters.mode.toUpperCase() as never) : undefined,
      },
      take: filters.limit,
      orderBy: [{ createdAt: "desc" }],
    });

    return puzzles.map(mapPuzzleListView);
  },

  async getPuzzleDetail(slug: string) {
    const [puzzle, champions, items] = await Promise.all([
      puzzleRepository.findBySlug(slug),
      catalogRepository.listChampions(),
      catalogRepository.listItems(),
    ]);

    if (!puzzle || !puzzle.isPublished) {
      return null;
    }

    const championIndex = buildChampionViewIndex(champions);
    const itemIndex = buildItemViewIndex(items);
    return mapPuzzleDetailView(puzzle, championIndex, itemIndex);
  },

  async getDashboard(userId: string) {
    const [progress, dailyChallenge] = await Promise.all([progressService.getOverview(userId), dailyChallengeService.getOrCreateToday()]);

    return {
      progress,
      dailyChallenge: mapPuzzleListView(dailyChallenge.puzzle),
    };
  },

  async getChampionLearning(championSlug: string, userId?: string) {
    const [champion, puzzles, progress] = await Promise.all([
      catalogRepository.findChampionBySlug(championSlug),
      puzzleRepository.listPublished({
        where: {
          champion: {
            slug: championSlug,
          },
        },
        take: 20,
        orderBy: [{ createdAt: "desc" }],
      }),
      userId ? progressService.getOverview(userId) : Promise.resolve(null),
    ]);

    if (!champion) {
      return null;
    }

    const championProgress = progress?.championProgress.find((entry) => entry.champion.slug === championSlug) ?? null;

    return {
      champion: mapChampionView(champion),
      puzzles: puzzles.map(mapPuzzleListView),
      progress: championProgress,
    };
  },

  async getDailyChallengeDetail() {
    const [challenge, champions, items] = await Promise.all([
      dailyChallengeService.getOrCreateToday(),
      catalogRepository.listChampions(),
      catalogRepository.listItems(),
    ]);

    const championIndex = buildChampionViewIndex(champions);
    const itemIndex = buildItemViewIndex(items);

    return {
      id: challenge.id,
      challengeDate: challenge.challengeDate,
      completions: challenge.completions,
      puzzle: mapPuzzleDetailView(challenge.puzzle, championIndex, itemIndex),
    };
  },
};
