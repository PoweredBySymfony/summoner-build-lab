import { GeneratedPuzzleRequestStatus, GeneratedPuzzleRequestType, Prisma, PuzzleChoiceType, PuzzleDifficulty, PuzzleMode, PuzzleSourceType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/slug.js";
import { HttpError } from "../utils/http.js";

const roleEnemyPools: Record<Role, string[]> = {
  TOP: ["aatrox", "camille", "malphite", "ornn", "gwen"],
  JUNGLE: ["vi", "lee-sin", "sejuani", "lillia", "viego"],
  MID: ["ahri", "orianna", "zed", "syndra", "veigar"],
  ADC: ["jinx", "kaisa", "ezreal", "ashe", "xayah"],
  SUPPORT: ["nautilus", "leona", "lulu", "milio", "thresh"],
  FLEX: ["aatrox", "ahri", "jinx", "nautilus", "sejuani"],
};

const roleItemNeeds: Record<Role, { prompt: string; tags: string[]; correctItemHints: string[]; wrongItemHints: string[] }> = {
  ADC: {
    prompt: "Enemy frontline is stacking armor while burst still threatens you.",
    tags: ["otp", "marksman", "penetration", "survivability"],
    correctItemHints: ["armorpen", "criticalstrike", "onhit"],
    wrongItemHints: ["magicresist", "tank", "support"],
  },
  MID: {
    prompt: "Enemy carries are buying magic resist and the next fight decides tempo.",
    tags: ["otp", "mage", "penetration", "powerspike"],
    correctItemHints: ["magicpen", "spelldamage", "abilitypower"],
    wrongItemHints: ["crit", "tank", "support"],
  },
  TOP: {
    prompt: "You need to keep side-lane pressure while respecting the main enemy threat.",
    tags: ["otp", "toplane", "side-lane", "adaptation"],
    correctItemHints: ["health", "fighter", "armor", "magicresist"],
    wrongItemHints: ["support", "mana", "magicpen"],
  },
  JUNGLE: {
    prompt: "You are playing for mid-game skirmishes and first setup on objective.",
    tags: ["otp", "jungle", "tempo", "objective"],
    correctItemHints: ["abilityhaste", "fighter", "lethality", "spelldamage"],
    wrongItemHints: ["support", "criticalstrike", "mana"],
  },
  SUPPORT: {
    prompt: "Your teamfight value depends on surviving first engage and enabling your carry.",
    tags: ["otp", "support", "teamfight", "peel"],
    correctItemHints: ["support", "health", "magicresist", "armor"],
    wrongItemHints: ["criticalstrike", "lethality", "onhit"],
  },
  FLEX: {
    prompt: "You need the most reliable itemization answer to a mixed enemy teamfight.",
    tags: ["otp", "flex", "adaptation", "macro"],
    correctItemHints: ["health", "fighter", "spelldamage"],
    wrongItemHints: ["support", "consumable"],
  },
};

function randomFrom<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

async function findItemsByHints(hints: string[], limit = 4) {
  const items = await prisma.item.findMany({
    where: {
      isActive: true,
      OR: hints.map((hint) => ({
        OR: [
          { category: { contains: hint, mode: "insensitive" } },
          { name: { contains: hint, mode: "insensitive" } },
        ],
      })),
    },
    take: 24,
    orderBy: [{ goldTotal: "asc" }, { name: "asc" }],
  });

  if (items.length >= limit) {
    return items.slice(0, limit);
  }

  const fallback = await prisma.item.findMany({
    where: {
      isActive: true,
      id: {
        notIn: items.map((item) => item.id),
      },
    },
    take: limit * 2,
    orderBy: [{ isBoots: "asc" }, { goldTotal: "asc" }, { name: "asc" }],
  });

  return [...items, ...fallback].slice(0, limit);
}

async function buildChampionPuzzle(championId: string, userId?: string, importedMatchId?: string) {
  const champion = await prisma.champion.findUnique({ where: { id: championId } });
  if (!champion) {
    throw new HttpError(404, "Champion not found.");
  }

  const role = champion.rolePrimary ?? Role.FLEX;
  const roleConfig = roleItemNeeds[role];
  const enemySlugs = roleEnemyPools[role];
  const correctItems = await findItemsByHints(roleConfig.correctItemHints, 4);
  const wrongItems = await findItemsByHints(roleConfig.wrongItemHints, 6);

  const selectedCorrect = correctItems[0];
  const distractors = wrongItems.slice(0, 3);

  if (!selectedCorrect || distractors.length < 3) {
    throw new HttpError(500, "Not enough catalog data to generate a personalized puzzle.");
  }

  const allChampions = await prisma.champion.findMany({
    where: {
      slug: {
        in: enemySlugs,
      },
    },
  });

  const allyTeam = [champion.slug, "sejuani", "orianna", "xayah", "rakan"];
  const enemyTeam = allChampions.slice(0, 5).map((entry) => entry.slug);
  const enemyItems = distractors.map((item) => item.slug);

  const generatedSlug = `${champion.slug}-${Date.now()}`;
  const title = `${champion.name} OTP itemization puzzle`;

  const puzzle = await prisma.puzzle.create({
    data: {
      title,
      slug: slugify(generatedSlug),
      mode: importedMatchId ? PuzzleMode.PERSONALIZED : PuzzleMode.CHAMPION_SPECIFIC,
      sourceType: importedMatchId ? PuzzleSourceType.IMPORTED_MATCH : PuzzleSourceType.GENERATED,
      difficulty: PuzzleDifficulty.INTERMEDIATE,
      patch: champion.patch,
      description: `${champion.name} focused scenario generated from role and matchup heuristics.`,
      shortPrompt: roleConfig.prompt,
      situation: `You are playing ${champion.name} in ${role.toLowerCase()} around minute 21. ${roleConfig.prompt} Visible enemy items show the type of resistance or burst you need to answer right now.`,
      question: `What is the best next item purchase on ${champion.name} in this situation?`,
      explanation: `${selectedCorrect.name} is the most coherent pivot because it matches the threat profile, keeps your champion's plan online and teaches the adaptation pattern this OTP scenario targets.`,
      role,
      championId: champion.id,
      isPublished: true,
      isDailyEligible: true,
      choices: {
        create: [
          {
            label: selectedCorrect.name,
            choiceType: selectedCorrect.isBoots ? PuzzleChoiceType.BOOTS : PuzzleChoiceType.ITEM,
            itemId: selectedCorrect.id,
            explanation: `${selectedCorrect.name} best covers the immediate itemization problem while keeping your champion's win condition intact.`,
            isCorrect: true,
            displayOrder: 1,
          },
          ...distractors.map((item, index) => ({
            label: item.name,
            choiceType: item.isBoots ? PuzzleChoiceType.BOOTS : PuzzleChoiceType.ITEM,
            itemId: item.id,
            explanation: `${item.name} is plausible, but it underperforms compared with the best adaptation for this exact board state.`,
            isCorrect: false,
            displayOrder: index + 2,
          })),
        ],
      },
      scenario: {
        create: {
          playerChampionId: champion.id,
          playerRole: role,
          gameMinute: 21,
          playerGold: Math.max(selectedCorrect.goldTotal, 2200),
          playerLevel: 13,
          kills: 4,
          deaths: 2,
          assists: 5,
          cs: role === Role.SUPPORT ? 28 : 165,
          currentBuild: [],
          allyTeam,
          enemyTeam,
          allyItems: [],
          enemyItems,
          notableThreats: roleConfig.tags,
          objectiveState: {
            nextObjective: "dragon",
            soulPointThreat: true,
          },
          damageProfile: {
            enemyPhysical: role === Role.ADC || role === Role.TOP ? "high" : "medium",
            enemyMagical: role === Role.MID ? "high" : "medium",
          },
          mapState: {
            tempo: "contested",
            sideLanePriority: role === Role.TOP ? "important" : "secondary",
          },
          notes: importedMatchId ? "Generated from a user's imported Riot match context." : "Generated from champion-focused OTP heuristics.",
        },
      },
      tags: {
        create: roleConfig.tags.map((tag) => ({
          tag: {
            connectOrCreate: {
              where: { slug: slugify(tag) },
              create: { slug: slugify(tag), name: tag },
            },
          },
        })),
      },
    },
    include: {
      scenario: true,
      choices: true,
      champion: true,
      tags: { include: { tag: true } },
    },
  });

  if (userId) {
    await prisma.generatedPuzzleRequest.create({
      data: {
        userId,
        type: importedMatchId ? GeneratedPuzzleRequestType.MATCH_BASED : GeneratedPuzzleRequestType.CHAMPION,
        championId: champion.id,
        importedMatchId,
        parameters: {
          role,
          enemyTeam,
        },
        status: GeneratedPuzzleRequestStatus.COMPLETED,
        resultPuzzleId: puzzle.id,
      },
    });
  }

  return puzzle;
}

export const puzzleGenerationService = {
  generateChampionPuzzle: (championId: string, userId?: string) => buildChampionPuzzle(championId, userId),
  generateMatchBasedPuzzle: async (importedMatchId: string, userId: string) => {
    const match = await prisma.importedMatch.findUnique({ where: { id: importedMatchId } });
    if (!match) {
      throw new HttpError(404, "Imported match not found.");
    }

    const matchData = match.matchData as Prisma.JsonObject;
    const championSlug = String(matchData.playerChampionSlug ?? "");
    const champion = await prisma.champion.findUnique({ where: { slug: championSlug } });
    if (!champion) {
      throw new HttpError(400, "Imported match does not reference a known champion slug.");
    }

    return buildChampionPuzzle(champion.id, userId, importedMatchId);
  },
};
