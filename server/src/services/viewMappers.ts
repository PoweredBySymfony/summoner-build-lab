import { Item, PuzzleChoice, PuzzleDifficulty, Puzzle, Champion, Role } from "@prisma/client";
import { toLocalized } from "../utils/localized.js";

const difficultyLabel: Record<PuzzleDifficulty, string> = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
};

const roleLabel: Record<Role, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MID: "Mid",
  ADC: "ADC",
  SUPPORT: "Support",
  FLEX: "Flex",
};

export const mapItemView = (item: Item) => ({
  id: item.slug,
  databaseId: item.id,
  riotItemId: item.riotItemId,
  name: item.name,
  cost: item.goldTotal,
  combineCost: item.combineCost ?? undefined,
  icon: item.image,
  stats: Array.isArray(item.statsJson) ? item.statsJson : [],
  passive: item.passiveEffect ? toLocalized(item.passiveEffect) : undefined,
  passiveName: item.passiveName ?? undefined,
  active: item.activeEffect ? toLocalized(item.activeEffect) : undefined,
  activeName: item.activeName ?? undefined,
  components: Array.isArray(item.componentsJson) ? item.componentsJson : [],
  tags: item.tags,
  category: item.category.toLowerCase(),
  patch: item.patch,
  description: item.shortDescription ? toLocalized(item.shortDescription) : undefined,
});

export const mapChampionView = (champion: Champion) => ({
  id: champion.slug,
  databaseId: champion.id,
  name: champion.name,
  icon: champion.image,
  roles: champion.roles.map((role) => roleLabel[role]),
  damageType: champion.damageType ?? "Mixed",
  threat: champion.threatJson ? toLocalized(champion.threatJson) : { fr: "", en: "" },
  tags: champion.tags,
});

export const mapPuzzleChoiceView = (choice: PuzzleChoice & { item: Item | null }) => ({
  id: choice.id,
  label: toLocalized(choice.label),
  choiceType: choice.choiceType.toLowerCase(),
  item: choice.item ? mapItemView(choice.item) : null,
  textFallback: choice.textFallback ? toLocalized(choice.textFallback) : undefined,
  explanation: toLocalized(choice.explanation),
  isCorrect: choice.isCorrect,
  displayOrder: choice.displayOrder,
});

export const mapPuzzleListView = (
  puzzle: Puzzle & {
    champion: Champion | null;
    choices: Array<PuzzleChoice & { item: Item | null }>;
    tags: Array<{ puzzleTag: { slug: string; name: string } }>;
  },
) => ({
  id: puzzle.id,
  slug: puzzle.slug,
  title: toLocalized(puzzle.title),
  description: toLocalized(puzzle.description),
  difficulty: difficultyLabel[puzzle.difficulty],
  patch: puzzle.patch,
  role: roleLabel[puzzle.role],
  moduleKey: puzzle.moduleKey,
  champion: puzzle.champion ? mapChampionView(puzzle.champion) : null,
  tags: puzzle.tags.map((tag) => tag.puzzleTag.slug),
  choiceCount: puzzle.choices.length,
});

export const mapPuzzleDetailView = (
  puzzle: Puzzle & {
    champion: Champion | null;
    choices: Array<PuzzleChoice & { item: Item | null }>;
    tags: Array<{ puzzleTag: { slug: string; name: string } }>;
  },
  championIndex: Map<string, ReturnType<typeof mapChampionView>>,
) => ({
  ...mapPuzzleListView(puzzle),
  situation: toLocalized(puzzle.situation),
  question: toLocalized(puzzle.question),
  explanation: toLocalized(puzzle.explanation),
  gameContext: puzzle.gameContextJson,
  allyTeam: Array.isArray(puzzle.allyTeamJson)
    ? puzzle.allyTeamJson.map((slug) => championIndex.get(String(slug))).filter(Boolean)
    : [],
  enemyTeam: Array.isArray(puzzle.enemyTeamJson)
    ? puzzle.enemyTeamJson.map((slug) => championIndex.get(String(slug))).filter(Boolean)
    : [],
  choices: puzzle.choices.map(mapPuzzleChoiceView),
});
