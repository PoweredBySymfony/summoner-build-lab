import { groupBy } from "./groupBy.js";
import { catalogRepository } from "../repositories/catalogRepository.js";
import { puzzleRepository } from "../repositories/puzzleRepository.js";
import { mapChampionView, mapItemView, mapPuzzleDetailView, mapPuzzleListView } from "./viewMappers.js";

export const appService = {
  async getBootstrap() {
    const [items, champions, puzzles] = await Promise.all([
      catalogRepository.listItems(),
      catalogRepository.listChampions(),
      puzzleRepository.listPublished(),
    ]);

    const championViews = champions.map(mapChampionView);

    return {
      stats: {
        itemCount: items.length,
        championCount: champions.length,
        puzzleCount: puzzles.length,
        moduleCount: new Set(puzzles.map((puzzle) => puzzle.moduleKey)).size,
        latestPatch: puzzles[0]?.patch ?? "14.10",
      },
      featuredItems: items.slice(0, 16).map(mapItemView),
      featuredChampions: championViews.slice(0, 8),
      featuredPuzzles: puzzles.slice(0, 3).map(mapPuzzleListView),
    };
  },
  async getModules() {
    const puzzles = await puzzleRepository.listPublished();
    const grouped = groupBy(puzzles, (puzzle) => puzzle.moduleKey);

    return Object.entries(grouped).map(([moduleKey, modulePuzzles]) => ({
      id: moduleKey,
      title: moduleKey,
      difficulty: mapPuzzleListView(modulePuzzles[0]).difficulty,
      patch: modulePuzzles[0].patch,
      scenarios: modulePuzzles.length,
      roles: Array.from(new Set(modulePuzzles.map((puzzle) => puzzle.role))),
      progress: 0,
      puzzles: modulePuzzles.map(mapPuzzleListView),
    }));
  },
  async getPuzzleList() {
    const puzzles = await puzzleRepository.listPublished();
    return puzzles.map(mapPuzzleListView);
  },
  async getPuzzleDetail(slug: string) {
    const [puzzle, champions] = await Promise.all([
      puzzleRepository.findBySlug(slug),
      catalogRepository.listChampions(),
    ]);

    if (!puzzle || !puzzle.isPublished) {
      return null;
    }

    const championIndex = new Map(champions.map((champion) => [champion.slug, mapChampionView(champion)]));

    return mapPuzzleDetailView(puzzle, championIndex);
  },
  async getDashboard(username: string) {
    const [user, items, puzzles] = await Promise.all([
      catalogRepository.findDemoUser(username),
      catalogRepository.listItems(),
      puzzleRepository.listPublished(),
    ]);
    const attempts = user ? await puzzleRepository.listAttemptsByUser(user.id) : [];

    const sessions = attempts.length;
    const correct = attempts.filter((attempt) => attempt.isCorrect).length;
    const accuracy = sessions ? Math.round((correct / sessions) * 100) : 0;

    return {
      user: {
        username: user?.username ?? username,
        level: 12,
        xp: 1240,
        xpToNextLevel: 2000,
        streak: 7,
      },
      stats: {
        accuracy,
        sessions,
        totalPuzzles: puzzles.length,
      },
      featuredItems: items.slice(0, 6).map(mapItemView),
      recentAttempts: attempts.slice(0, 5).map((attempt) => ({
        id: attempt.id,
        puzzleSlug: attempt.puzzle.slug,
        puzzleTitle: mapPuzzleListView({ ...attempt.puzzle, champion: null, choices: [], tags: [] }).title,
        isCorrect: attempt.isCorrect,
        answeredAt: attempt.answeredAt,
      })),
    };
  },
};
