import { Champion, Item, Puzzle, PuzzleChoice, PuzzleDifficulty, PuzzleMode, Role } from "@prisma/client";

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

const modeLabel: Record<PuzzleMode, string> = {
  GENERAL: "general",
  CHAMPION_SPECIFIC: "champion_specific",
  PERSONALIZED: "personalized",
  DAILY: "daily",
};

export const mapChampionView = (champion: Champion) => ({
  id: champion.slug,
  databaseId: champion.id,
  riotChampionId: champion.riotChampionId,
  championKey: champion.championKey,
  name: champion.name,
  title: champion.title,
  slug: champion.slug,
  icon: champion.iconImage || champion.image,
  splashImage: champion.splashImage,
  image: champion.image,
  roles: [champion.rolePrimary, champion.roleSecondary].filter(Boolean).map((role) => roleLabel[role as Role]),
  tags: Array.isArray(champion.tags) ? champion.tags : [],
  stats: champion.stats,
  patch: champion.patch,
});

export const mapItemView = (item: Item) => ({
  id: item.slug,
  databaseId: item.id,
  riotItemId: item.riotItemId,
  name: item.name,
  slug: item.slug,
  icon: item.image,
  image: item.image,
  cost: item.goldTotal,
  baseCost: item.goldBase,
  sellPrice: item.goldSell,
  category: item.category,
  tags: Array.isArray(item.tags) ? item.tags : [],
  stats: item.stats,
  shortDescription: item.shortDescription,
  fullDescription: item.fullDescription,
  activeEffect: item.activeEffect,
  passiveEffect: item.passiveEffect,
  buildsFrom: Array.isArray(item.buildsFrom) ? item.buildsFrom : [],
  buildsInto: Array.isArray(item.buildsInto) ? item.buildsInto : [],
  mapAvailability: item.mapAvailability,
  isBoots: item.isBoots,
  isLegendary: item.isLegendary,
  isConsumable: item.isConsumable,
  isTrinket: item.isTrinket,
  isStarter: item.isStarter,
  patch: item.patch,
});

export const mapPuzzleChoiceView = (choice: PuzzleChoice & { item: Item | null }) => ({
  id: choice.id,
  label: choice.label,
  choiceType: choice.choiceType.toLowerCase(),
  item: choice.item ? mapItemView(choice.item) : null,
  textFallback: choice.textFallback,
  explanation: choice.explanation,
  isCorrect: choice.isCorrect,
  displayOrder: choice.displayOrder,
});

export const mapPuzzleListView = (
  puzzle: Puzzle & {
    champion: Champion | null;
    choices: Array<PuzzleChoice & { item: Item | null }>;
    tags: Array<{ tag: { slug: string; name: string } }>;
  },
) => ({
  id: puzzle.id,
  slug: puzzle.slug,
  title: puzzle.title,
  description: puzzle.description,
  shortPrompt: puzzle.shortPrompt,
  difficulty: difficultyLabel[puzzle.difficulty],
  patch: puzzle.patch,
  role: puzzle.role ? roleLabel[puzzle.role] : null,
  mode: modeLabel[puzzle.mode],
  sourceType: puzzle.sourceType.toLowerCase(),
  champion: puzzle.champion ? mapChampionView(puzzle.champion) : null,
  tags: puzzle.tags.map((tag) => ({ slug: tag.tag.slug, name: tag.tag.name })),
  choiceCount: puzzle.choices.length,
});

export const mapPuzzleDetailView = (
  puzzle: Puzzle & {
    champion: Champion | null;
    choices: Array<PuzzleChoice & { item: Item | null }>;
    scenario: {
      playerChampion: Champion;
      playerRole: Role;
      gameMinute: number;
      playerGold: number;
      playerLevel: number | null;
      kills: number | null;
      deaths: number | null;
      assists: number | null;
      cs: number | null;
      currentBuild: unknown;
      allyTeam: unknown;
      enemyTeam: unknown;
      allyItems: unknown;
      enemyItems: unknown;
      notableThreats: unknown;
      objectiveState: unknown;
      damageProfile: unknown;
      mapState: unknown;
      notes: string | null;
    } | null;
    tags: Array<{ tag: { slug: string; name: string } }>;
  },
  championIndex: Map<string, ReturnType<typeof mapChampionView>>,
  itemIndex: Map<string, ReturnType<typeof mapItemView>>,
) => ({
  ...mapPuzzleListView(puzzle),
  situation: puzzle.situation,
  question: puzzle.question,
  explanation: puzzle.explanation,
  scenario: puzzle.scenario
    ? {
        playerChampion: mapChampionView(puzzle.scenario.playerChampion),
        playerRole: roleLabel[puzzle.scenario.playerRole],
        gameMinute: puzzle.scenario.gameMinute,
        playerGold: puzzle.scenario.playerGold,
        playerLevel: puzzle.scenario.playerLevel,
        kills: puzzle.scenario.kills,
        deaths: puzzle.scenario.deaths,
        assists: puzzle.scenario.assists,
        cs: puzzle.scenario.cs,
        currentBuild: Array.isArray(puzzle.scenario.currentBuild)
          ? puzzle.scenario.currentBuild.map((slug) => itemIndex.get(String(slug)) ?? { id: slug, name: slug })
          : [],
        allyTeam: Array.isArray(puzzle.scenario.allyTeam)
          ? puzzle.scenario.allyTeam.map((slug) => championIndex.get(String(slug)) ?? { id: slug, name: slug })
          : [],
        enemyTeam: Array.isArray(puzzle.scenario.enemyTeam)
          ? puzzle.scenario.enemyTeam.map((slug) => championIndex.get(String(slug)) ?? { id: slug, name: slug })
          : [],
        allyItems: puzzle.scenario.allyItems,
        enemyItems: Array.isArray(puzzle.scenario.enemyItems)
          ? puzzle.scenario.enemyItems.map((entry) =>
              typeof entry === "string" ? itemIndex.get(entry) ?? { id: entry, name: entry } : entry,
            )
          : puzzle.scenario.enemyItems,
        notableThreats: puzzle.scenario.notableThreats,
        objectiveState: puzzle.scenario.objectiveState,
        damageProfile: puzzle.scenario.damageProfile,
        mapState: puzzle.scenario.mapState,
        notes: puzzle.scenario.notes,
      }
    : null,
  choices: puzzle.choices.map(mapPuzzleChoiceView),
});
