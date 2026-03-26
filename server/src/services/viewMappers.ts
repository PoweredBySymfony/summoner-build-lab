import { Champion, Item, Puzzle, PuzzleChoice, PuzzleDifficulty, PuzzleMode, Role } from "@prisma/client";
import { resolveItemSlug } from "../lib/itemSlugAliases.js";

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
  nextObjective: "Prochain objectif",
  soulPointThreat: "Menace point d'ame",
  soulPointAdverse: "Point d'ame adverse",
};

const objectiveValueLabel: Record<string, string> = {
  dragon: "dragon",
  baron: "baron",
  herald: "heraut",
};

const mapStateKeyLabel: Record<string, string> = {
  tempo: "Tempo",
  sideLanePriority: "Priorite side",
};

const mapStateValueLabel: Record<string, string> = {
  contested: "contestee",
  secondary: "secondaire",
};

const damageProfileKeyLabel: Record<string, string> = {
  enemyMagical: "Degats magiques ennemis",
  enemyPhysical: "Degats physiques ennemis",
};

const plainTextLabelMap: Record<string, string> = {
  beginner: "debutant",
  intermediate: "intermediaire",
  advanced: "avance",
  champion_specific: "otp",
  personalized: "personnalise",
  daily: "defi quotidien",
};

const itemNameMap: Record<string, string> = {
  "Quest: Support": "Quête : support",
  Sheen: "Brillance",
  "Rejuvenation Bead": "Collier rafraîchissant",
  "Ruby Crystal": "Cristal de rubis",
};

const encodingArtifactMap: Record<string, string> = {
  "Ã©": "é",
  "Ã¨": "è",
  "Ã ": "à",
  "Ã¹": "ù",
  "Ã§": "ç",
  "Ãª": "ê",
  "Ã®": "î",
  "Ã´": "ô",
  "Ã»": "û",
  "Ã«": "ë",
  "Ã¯": "ï",
  "Ã¼": "ü",
  "Ã‰": "É",
};

function translateItemName(input: string) {
  return itemNameMap[input] ?? input;
}

function repairEncodingArtifacts(input: string) {
  let value = input;
  for (const [artifact, replacement] of Object.entries(encodingArtifactMap)) {
    value = value.replaceAll(artifact, replacement);
  }
  return value;
}

export function translateGeneratedCopy(input: string, championName?: string) {
  let value = repairEncodingArtifacts(input.trim());

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
  value = value.replace(
    /^(.+?) is the most coherent pivot because it matches the threat profile, keeps your champion's plan online and teaches the adaptation pattern this OTP scenario targets\.$/i,
    (_match, itemName: string) =>
      `${translateItemName(itemName)} est le pivot le plus coherent ici : il repond au profil de menace, garde le plan du champion intact et enseigne bien le pattern d'adaptation vise par ce scenario OTP.`,
  );
  value = value.replace(
    /^(.+?) is plausible, but it underperforms compared with the best adaptation for this exact board state\.$/i,
    (_match, itemName: string) =>
      `${translateItemName(itemName)} est jouable, mais reste moins performant que la meilleure adaptation pour cet etat de partie precis.`,
  );
  value = value.replace(
    /^(.+?) best covers the immediate itemization problem while keeping your champion's win condition intact\.$/i,
    (_match, itemName: string) =>
      `${translateItemName(itemName)} couvre le mieux le probleme d'itemisation immediat tout en preservant la condition de victoire de ton champion.`,
  );
  value = value.replace(
    /^(.+?) is the most coherent purchase here\.(.*)$/i,
    (_match, itemName: string, rest: string) =>
      `${translateItemName(itemName)} est l'achat le plus coherent ici.${rest ? ` ${rest.trim()}` : ""}`,
  );
  value = value.replace(/slightly increases health regen/gi, "Augmente legerement la regeneration de PV");
  value = value.replace(/increases health/gi, "Augmente les points de vie");
  value = value.replace(/grants a bonus to next attack after spell cast/gi, "Accorde un bonus a la prochaine attaque apres un sort");

  if (championName) {
    value = value.replace(new RegExp(`\\b${championName}\\b focused scenario`, "gi"), `Scenario centre sur ${championName}`);
  }

  return plainTextLabelMap[value] ?? repairEncodingArtifacts(value);
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

      if (typeof entryValue === "boolean") {
        return [normalizedKey, entryValue ? "Oui" : "Non"];
      }

      return [normalizedKey, entryValue];
    }),
  );
}

function resolveIndexedItem(
  itemRef: string,
  itemIndex: Map<string, ReturnType<typeof mapItemView>>,
) {
  return itemIndex.get(itemRef) ?? itemIndex.get(resolveItemSlug(itemRef)) ?? { id: itemRef, name: itemRef };
}

function resolveIndexedChampion(
  championRef: string,
  championIndex: Map<string, ReturnType<typeof mapChampionView>>,
) {
  return championIndex.get(championRef) ?? { id: championRef, name: championRef };
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
  isActive: champion.isActive,
});

export const mapItemView = (item: Item) => ({
  id: item.slug,
  databaseId: item.id,
  riotItemId: item.riotItemId,
  name: translateItemName(item.name),
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
  buildsFromIcons: Array.isArray(item.buildsFrom)
    ? item.buildsFrom
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry) && entry > 0)
        .map((riotItemId) => ({
          riotItemId,
          icon: `https://ddragon.leagueoflegends.com/cdn/${item.patch}/img/item/${riotItemId}.png`,
        }))
    : [],
  mapAvailability: item.mapAvailability,
  isBoots: item.isBoots,
  isLegendary: item.isLegendary,
  isConsumable: item.isConsumable,
  isTrinket: item.isTrinket,
  isStarter: item.isStarter,
  isActive: item.isActive,
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
  difficultyKey: puzzle.difficulty,
  patch: puzzle.patch,
  role: puzzle.role ? roleLabel[puzzle.role] : null,
  roleKey: puzzle.role,
  mode: modeLabel[puzzle.mode],
  modeKey: puzzle.mode,
  sourceType: puzzle.sourceType.toLowerCase(),
  isPublished: puzzle.isPublished,
  isDailyEligible: puzzle.isDailyEligible,
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
                return resolveIndexedItem(entry, itemIndex);
              }

              if (entry && typeof entry === "object" && "itemSlug" in entry) {
                const itemSlug = String(entry.itemSlug);
                return resolveIndexedItem(itemSlug, itemIndex);
              }

              if (entry && typeof entry === "object" && "itemId" in entry) {
                return resolveIndexedItem(String(entry.itemId), itemIndex);
              }

              if (entry && typeof entry === "object" && "riotItemId" in entry) {
                return resolveIndexedItem(String(entry.riotItemId), itemIndex);
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
                const championRef =
                  ("championId" in entry && entry.championId ? String(entry.championId) : null) ??
                  ("riotChampionId" in entry && entry.riotChampionId ? String(entry.riotChampionId) : null) ??
                  ("championKey" in entry && entry.championKey ? String(entry.championKey) : null) ??
                  championSlug;
                return {
                  id: championSlug,
                  name: championSlug,
                  champion: resolveIndexedChampion(championRef, championIndex),
                  role: "role" in entry ? roleLabel[String(entry.role) as Role] ?? String(entry.role) : null,
                  items: Array.isArray(entry.items)
                    ? entry.items.map((itemEntry) => {
                        if (typeof itemEntry === "string") {
                          return resolveIndexedItem(itemEntry, itemIndex);
                        }

                        if (itemEntry && typeof itemEntry === "object" && "itemId" in itemEntry) {
                          return resolveIndexedItem(String(itemEntry.itemId), itemIndex);
                        }

                        if (itemEntry && typeof itemEntry === "object" && "riotItemId" in itemEntry) {
                          return resolveIndexedItem(String(itemEntry.riotItemId), itemIndex);
                        }

                        if (itemEntry && typeof itemEntry === "object" && "itemSlug" in itemEntry) {
                          return resolveIndexedItem(String(itemEntry.itemSlug), itemIndex);
                        }

                        return { id: String(itemEntry), name: String(itemEntry) };
                      })
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
                const championRef =
                  ("championId" in entry && entry.championId ? String(entry.championId) : null) ??
                  ("riotChampionId" in entry && entry.riotChampionId ? String(entry.riotChampionId) : null) ??
                  ("championKey" in entry && entry.championKey ? String(entry.championKey) : null) ??
                  championSlug;
                return {
                  id: championSlug,
                  name: championSlug,
                  champion: resolveIndexedChampion(championRef, championIndex),
                  role: "role" in entry ? roleLabel[String(entry.role) as Role] ?? String(entry.role) : null,
                  items: Array.isArray(entry.items)
                    ? entry.items.map((itemEntry) => {
                        if (typeof itemEntry === "string") {
                          return resolveIndexedItem(itemEntry, itemIndex);
                        }

                        if (itemEntry && typeof itemEntry === "object" && "itemId" in itemEntry) {
                          return resolveIndexedItem(String(itemEntry.itemId), itemIndex);
                        }

                        if (itemEntry && typeof itemEntry === "object" && "riotItemId" in itemEntry) {
                          return resolveIndexedItem(String(itemEntry.riotItemId), itemIndex);
                        }

                        if (itemEntry && typeof itemEntry === "object" && "itemSlug" in itemEntry) {
                          return resolveIndexedItem(String(itemEntry.itemSlug), itemIndex);
                        }

                        return { id: String(itemEntry), name: String(itemEntry) };
                      })
                    : [],
                  note: "note" in entry ? String(entry.note) : undefined,
                };
              }

              return { id: String(entry), name: String(entry) };
            })
          : [],
        allyItems: puzzle.scenario.allyItems,
        enemyItems: Array.isArray(puzzle.scenario.enemyItems)
          ? puzzle.scenario.enemyItems.map((entry) => (typeof entry === "string" ? resolveIndexedItem(entry, itemIndex) : entry))
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
