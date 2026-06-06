import type { ChampionView, GameItem } from "@/types/domain";

type SearchablePuzzle = {
  title: string;
  mode: string;
  difficulty: string;
  patch: string;
  champion?: {
    name?: string | null;
  } | null;
};

function matchesQuery(values: string[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function filterAdminChampions(champions: ChampionView[] | undefined, query: string) {
  return (champions ?? []).filter((entry) =>
    matchesQuery([entry.name, entry.title ?? "", entry.patch, ...entry.roles], query),
  );
}

export function filterAdminItems(items: GameItem[] | undefined, query: string) {
  return (items ?? []).filter((entry) =>
    matchesQuery([entry.name, entry.category ?? "", entry.patch, ...entry.tags], query),
  );
}

export function filterAdminPuzzles<TPuzzle extends SearchablePuzzle>(
  puzzles: TPuzzle[] | undefined,
  query: string,
) {
  return (puzzles ?? []).filter((entry) =>
    matchesQuery(
      [entry.title, entry.mode, entry.difficulty, entry.patch, entry.champion?.name ?? ""],
      query,
    ),
  );
}
