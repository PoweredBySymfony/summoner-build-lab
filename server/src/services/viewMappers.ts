import { Champion, Item, Puzzle, PuzzleChoice, PuzzleDifficulty, PuzzleMode, Role } from "@prisma/client";

const difficultyLabel: Record<PuzzleDifficulty, string> = {
  BEGINNER: "debutant",
  INTERMEDIATE: "intermediaire",
  ADVANCED: "avance",
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
  CHAMPION_SPECIFIC: "otp",
  PERSONALIZED: "personnalise",
  DAILY: "defi quotidien",
};

const englishRoleLabel: Record<string, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "ADC",
  support: "Support",
};

const objectiveKeyLabel: Record<string, string> = {
  nextObjective: "prochainObjectif",
  soulPointThreat: "menacePointDame",
  soulPointAdverse: "pointDameAdverse",
};

const objectiveValueLabel: Record<string, string> = {
  dragon: "dragon",
  baron: "baron",
  herald: "heraut",
};

const mapStateKeyLabel: Record<string, string> = {
  tempo: "tempo",
  sideLanePriority: "prioriteSide",
};

const mapStateValueLabel: Record<string, string> = {
  contested: "contestee",
  secondary: "secondaire",
};

const damageProfileKeyLabel: Record<string, string> = {
  enemyMagical: "degatsMagiquesEnnemis",
  enemyPhysical: "degatsPhysiquesEnnemis",
};

const plainTextLabelMap: Record<string, string> = {
  beginner: "debutant",
  intermediate: "intermediaire",
  advanced: "avance",
  champion_specific: "otp",
  personalized: "personnalise",
  daily: "defi quotidien",
};

function translateGeneratedCopy(input: string, championName?: string) {
  let value = input.trim();

  value = value.replace(
    /^(.+?) OTP ITEMIZATION PUZZLE$/i,
    (_match, name: string) => `${name} : puzzle d'itemisation OTP`,
  );
  value = value.replace(
    /^(.+?) focused scenario generated from role and matchup heuristics\.$/i,
    (_match, name: string) => `Scenario centre sur ${name}, genere a partir du role et des matchups.`,
  );
  value = value.replace(
    /^What is the best next item purchase on (.+?) in this situation\?$/i,
    (_match, name: string) => `Quel est le meilleur prochain achat sur ${name} dans cette situation ?`,
  );
  value = value.replace(
    /^You are playing (.+?) in (top|jungle|mid|adc|support) around minute (\d+)\.\s*/i,
    (_match, name: string, role: string, minute: string) =>
      `Tu joues ${name} en ${englishRoleLabel[role.toLowerCase()] ?? role} vers la ${minute}e minute. `,
  );
  value = value.replace(
    /Enemy frontline is stacking armor while burst still threatens you\./gi,
    "La frontline ennemie empile l'armure tandis que le burst reste une menace.",
  );
  value = value.replace(
    /Visible enemy items show the type of resistance or burst you need to answer right now\./gi,
    "Les objets ennemis visibles montrent quel type de resistance ou de burst tu dois gerer tout de suite.",
  );
  value = value.replace(
    /Generated from champion-focused OTP heuristics\./gi,
    "Genere a partir des heuristiques OTP centrees sur le champion.",
  );
  value = value.replace(/slightly increases health regen/gi, "Augmente legerement la regeneration de PV");
  value = value.replace(/increases health/gi, "Augmente les points de vie");
  value = value.replace(/grants a bonus to next attack after spell cast/gi, "Accorde un bonus a la prochaine attaque apres un sort");

  if (championName) {
    value = value.replace(new RegExp(`\\b${championName}\\b focused scenario`, "gi"), `Scenario centre sur ${championName}`);
  }

  return plainTextLabelMap[value] ?? value;
}

function translateKeyValueRecord(
  value: unknown,
  keyMap: Record<string, string>,
  valueMap: Record<string, string> = {},
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
      const normalizedKey = keyMap[key] ?? key;
      if (typeof entryValue === "string") {
        return [normalizedKey, valueMap[entryValue] ?? plainTextLabelMap[entryValue] ?? translateGeneratedCopy(entryValue)];
      }

      return [normalizedKey, entryValue];
    }),
  );
}

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
  shortDescription: item.shortDescription ? translateGeneratedCopy(item.shortDescription) : item.shortDescription,
  fullDescription: item.fullDescription,
  activeEffect: item.activeEffect ? translateGeneratedCopy(item.activeEffect) : item.activeEffect,
  passiveEffect: item.passiveEffect ? translateGeneratedCopy(item.passiveEffect) : item.passiveEffect,
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
  textFallback: choice.textFallback ? translateGeneratedCopy(choice.textFallback) : choice.textFallback,
  explanation: translateGeneratedCopy(choice.explanation, choice.item?.name ?? undefined),
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
  title: translateGeneratedCopy(puzzle.title, puzzle.champion?.name ?? undefined),
  description: translateGeneratedCopy(puzzle.description, puzzle.champion?.name ?? undefined),
  shortPrompt: translateGeneratedCopy(puzzle.shortPrompt, puzzle.champion?.name ?? undefined),
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
  situation: translateGeneratedCopy(puzzle.situation, puzzle.champion?.name ?? undefined),
  question: translateGeneratedCopy(puzzle.question, puzzle.champion?.name ?? undefined),
  explanation: translateGeneratedCopy(puzzle.explanation, puzzle.champion?.name ?? undefined),
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
          ? puzzle.scenario.currentBuild.map((entry) => {
              if (typeof entry === "string") {
                return itemIndex.get(entry) ?? { id: entry, name: entry };
              }

              if (entry && typeof entry === "object" && "itemSlug" in entry) {
                const itemSlug = String(entry.itemSlug);
                return itemIndex.get(itemSlug) ?? { id: itemSlug, name: itemSlug };
              }

              return { id: String(entry), name: String(entry) };
            })
          : [],
        allyTeam: Array.isArray(puzzle.scenario.allyTeam)
          ? puzzle.scenario.allyTeam.map((entry) => {
              if (typeof entry === "string") {
                return championIndex.get(entry) ?? { id: entry, name: entry };
              }

              if (entry && typeof entry === "object" && "championSlug" in entry) {
                const championSlug = String(entry.championSlug);
                return {
                  id: championSlug,
                  name: championSlug,
                  champion: championIndex.get(championSlug) ?? { id: championSlug, name: championSlug },
                  role: "role" in entry ? roleLabel[String(entry.role) as Role] ?? String(entry.role) : null,
                  items: Array.isArray(entry.items)
                    ? entry.items.map((itemSlug) => itemIndex.get(String(itemSlug)) ?? { id: itemSlug, name: itemSlug })
                    : [],
                  note: "note" in entry ? String(entry.note) : undefined,
                };
              }

              return { id: String(entry), name: String(entry) };
            })
          : [],
        enemyTeam: Array.isArray(puzzle.scenario.enemyTeam)
          ? puzzle.scenario.enemyTeam.map((entry) => {
              if (typeof entry === "string") {
                return championIndex.get(entry) ?? { id: entry, name: entry };
              }

              if (entry && typeof entry === "object" && "championSlug" in entry) {
                const championSlug = String(entry.championSlug);
                return {
                  id: championSlug,
                  name: championSlug,
                  champion: championIndex.get(championSlug) ?? { id: championSlug, name: championSlug },
                  role: "role" in entry ? roleLabel[String(entry.role) as Role] ?? String(entry.role) : null,
                  items: Array.isArray(entry.items)
                    ? entry.items.map((itemSlug) => itemIndex.get(String(itemSlug)) ?? { id: itemSlug, name: itemSlug })
                    : [],
                  note: "note" in entry ? String(entry.note) : undefined,
                };
              }

              return { id: String(entry), name: String(entry) };
            })
          : [],
        allyItems: puzzle.scenario.allyItems,
        enemyItems: Array.isArray(puzzle.scenario.enemyItems)
          ? puzzle.scenario.enemyItems.map((entry) =>
              typeof entry === "string" ? itemIndex.get(entry) ?? { id: entry, name: entry } : entry,
            )
          : puzzle.scenario.enemyItems,
        notableThreats: puzzle.scenario.notableThreats,
        objectiveState: translateKeyValueRecord(puzzle.scenario.objectiveState, objectiveKeyLabel, objectiveValueLabel),
        damageProfile: translateKeyValueRecord(puzzle.scenario.damageProfile, damageProfileKeyLabel),
        mapState: translateKeyValueRecord(puzzle.scenario.mapState, mapStateKeyLabel, mapStateValueLabel),
        notes: puzzle.scenario.notes ? translateGeneratedCopy(puzzle.scenario.notes, puzzle.champion?.name ?? undefined) : puzzle.scenario.notes,
      }
    : null,
  choices: puzzle.choices.map(mapPuzzleChoiceView),
});
