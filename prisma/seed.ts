import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PuzzleChoiceType, PuzzleDifficulty, PuzzleMode, PuzzleSourceType, Role, UserAuthProvider } from "@prisma/client";
import { hashPassword } from "../server/src/lib/password.js";
import { slugify } from "../server/src/lib/slug.js";
import { puzzleGenerationService } from "../server/src/services/puzzleGenerationService.js";
import { riotSyncService } from "../server/src/services/riotSyncService.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

type ManualPuzzleSeed = {
  title: string;
  description: string;
  shortPrompt: string;
  situation: string;
  question: string;
  explanation: string;
  mode: PuzzleMode;
  difficulty: PuzzleDifficulty;
  role: Role;
  championSlug: string;
  tags: string[];
  allyTeam: string[];
  enemyTeam: string[];
  enemyItems: string[];
  currentBuild: string[];
  gold: number;
  minute: number;
  choices: Array<{
    itemSlug?: string;
    label: string;
    choiceType: PuzzleChoiceType;
    explanation: string;
    isCorrect: boolean;
    textFallback?: string;
  }>;
};

async function resetDatabase() {
  await prisma.dailyChallengeCompletion.deleteMany();
  await prisma.dailyChallenge.deleteMany();
  await prisma.generatedPuzzleRequest.deleteMany();
  await prisma.importedMatch.deleteMany();
  await prisma.playerProfile.deleteMany();
  await prisma.emailReminderPreference.deleteMany();
  await prisma.userChampionProgress.deleteMany();
  await prisma.userGlobalProgress.deleteMany();
  await prisma.puzzleAttempt.deleteMany();
  await prisma.puzzleTagOnPuzzle.deleteMany();
  await prisma.puzzleScenario.deleteMany();
  await prisma.puzzleChoice.deleteMany();
  await prisma.puzzle.deleteMany();
  await prisma.puzzleTag.deleteMany();
  await prisma.user.deleteMany();
}

async function getChampionId(slug: string) {
  const champion = await prisma.champion.findUnique({ where: { slug } });
  return champion?.id;
}

async function getItemId(slug: string) {
  const item = await prisma.item.findUnique({ where: { slug } });
  return item?.id;
}

const manualPuzzles: ManualPuzzleSeed[] = [
  {
    title: "Jinx into armor stack front line",
    description: "Classic marksman decision when double frontline is building armor.",
    shortPrompt: "Two enemies are already itemizing armor and the next dragon fight is front-to-back.",
    situation: "You are 24 minutes into the game on Jinx with Kraken Slayer and Runaan's Hurricane. Enemy Ornn and Sejuani already show plated armor items while Viktor still threatens burst from range.",
    question: "What is the best third item in this exact teamfight setup?",
    explanation: "Lord Dominik's Regards is the cleanest answer because the fight will be played through Ornn and Sejuani first. You need real armor penetration before adding more luxury DPS or survivability.",
    mode: PuzzleMode.GENERAL,
    difficulty: PuzzleDifficulty.INTERMEDIATE,
    role: Role.ADC,
    championSlug: "jinx",
    tags: ["adc", "armor-pen", "front-to-back", "teamfight"],
    allyTeam: ["jinx", "lulu", "orianna", "sejuani", "ornn"],
    enemyTeam: ["viktor", "kaisa", "nautilus", "sejuani", "ornn"],
    enemyItems: ["plated-steelcaps", "thornmail", "frozen-heart"],
    currentBuild: ["kraken-slayer"],
    gold: 3000,
    minute: 24,
    choices: [
      { itemSlug: "lord-dominiks-regards", label: "Lord Dominik's Regards", choiceType: PuzzleChoiceType.ITEM, explanation: "Correct. Frontline armor is the gating factor in the next fight.", isCorrect: true },
      { itemSlug: "bloodthirster", label: "Bloodthirster", choiceType: PuzzleChoiceType.ITEM, explanation: "Sustain is useful, but it does not solve the primary DPS problem.", isCorrect: false },
      { itemSlug: "guardian-angel", label: "Guardian Angel", choiceType: PuzzleChoiceType.ITEM, explanation: "A defensive pivot is too early if you still cannot kill the tanks efficiently.", isCorrect: false },
      { itemSlug: "infinity-edge", label: "Infinity Edge", choiceType: PuzzleChoiceType.ITEM, explanation: "Raw crit spike is attractive, but armor penetration is more urgent here.", isCorrect: false },
    ],
  },
  {
    title: "Ahri versus rising magic resist",
    description: "Mid-lane AP carry adapting when enemy carries buy MR.",
    shortPrompt: "The enemy backline is buying MR and the fight tempo is accelerating.",
    situation: "You are on Ahri at 22 minutes with Luden's Companion and Sorcerer's Shoes. Enemy Xayah and Sylas both just completed magic resist components while your team wants to force soul point.",
    question: "Which purchase gives Ahri the best value now?",
    explanation: "Void Staff gains priority because enemy carries have crossed the MR threshold where flat pen alone is not enough. You keep your pick threat relevant into the next objective fight.",
    mode: PuzzleMode.GENERAL,
    difficulty: PuzzleDifficulty.INTERMEDIATE,
    role: Role.MID,
    championSlug: "ahri",
    tags: ["mage", "magic-pen", "objective", "adaptation"],
    allyTeam: ["ahri", "xayah", "rell", "sejuani", "aatrox"],
    enemyTeam: ["xayah", "rakan", "sylas", "vi", "ksante"],
    enemyItems: ["mercurys-treads", "null-magic-mantle"],
    currentBuild: ["ludens-companion"],
    gold: 2800,
    minute: 22,
    choices: [
      { itemSlug: "void-staff", label: "Void Staff", choiceType: PuzzleChoiceType.ITEM, explanation: "Correct. MR investment changes the equation immediately.", isCorrect: true },
      { itemSlug: "shadowflame", label: "Shadowflame", choiceType: PuzzleChoiceType.ITEM, explanation: "Still playable, but worse once real MR has appeared on priority targets.", isCorrect: false },
      { itemSlug: "zhonyas-hourglass", label: "Zhonya's Hourglass", choiceType: PuzzleChoiceType.ITEM, explanation: "Useful into dive, but less efficient than keeping lethal threat through MR.", isCorrect: false },
      { itemSlug: "rabadons-deathcap", label: "Rabadon's Deathcap", choiceType: PuzzleChoiceType.ITEM, explanation: "Big AP spike, but less efficient than void once multiple threats have MR.", isCorrect: false },
    ],
  },
  {
    title: "Aatrox anti-heal versus immediate spike",
    description: "Bruiser decision between anti-heal and raw damage timing.",
    shortPrompt: "Enemy sustain is deciding the extended skirmishes.",
    situation: "You are ahead on Aatrox at 17 minutes. The enemy has Soraka and Warwick, and every river fight turns into a long sustain battle around Herald and dragon setup.",
    question: "What is the most disciplined purchase?",
    explanation: "Executioner's Calling is the right discipline buy when the whole pattern of the fight is being warped by healing. It is not glamorous, but it unlocks the rest of your damage.",
    mode: PuzzleMode.GENERAL,
    difficulty: PuzzleDifficulty.BEGINNER,
    role: Role.TOP,
    championSlug: "aatrox",
    tags: ["bruiser", "anti-heal", "macro", "tempo"],
    allyTeam: ["aatrox", "lee-sin", "syndra", "kaisa", "nautilus"],
    enemyTeam: ["warwick", "soraka", "ornn", "ahri", "jinx"],
    enemyItems: ["moonstone-renewer", "spirit-visage"],
    currentBuild: [],
    gold: 950,
    minute: 17,
    choices: [
      { label: "Executioner's Calling", textFallback: "Executioner's Calling", choiceType: PuzzleChoiceType.COMPONENT, explanation: "Correct. The healing is too central to ignore.", isCorrect: true },
      { itemSlug: "black-cleaver", label: "Black Cleaver", choiceType: PuzzleChoiceType.ITEM, explanation: "Strong later, but too slow if sustain is already warping the fight.", isCorrect: false },
      { itemSlug: "steraks-gage", label: "Sterak's Gage", choiceType: PuzzleChoiceType.ITEM, explanation: "You gain anti-burst value, not the anti-heal answer you need.", isCorrect: false },
      { itemSlug: "plated-steelcaps", label: "Plated Steelcaps", choiceType: PuzzleChoiceType.BOOTS, explanation: "Safe boots are fine, but they do not answer the real problem here.", isCorrect: false },
    ],
  },
];

async function createManualPuzzle(seed: ManualPuzzleSeed) {
  const championId = await getChampionId(seed.championSlug);
  if (!championId) {
    return null;
  }

  const puzzle = await prisma.puzzle.create({
    data: {
      title: seed.title,
      slug: slugify(seed.title),
      mode: seed.mode,
      sourceType: PuzzleSourceType.MANUAL,
      difficulty: seed.difficulty,
      patch: (await prisma.champion.findUnique({ where: { id: championId } }))!.patch,
      description: seed.description,
      shortPrompt: seed.shortPrompt,
      situation: seed.situation,
      question: seed.question,
      explanation: seed.explanation,
      role: seed.role,
      championId,
      isPublished: true,
      isDailyEligible: true,
      choices: {
        create: await Promise.all(
          seed.choices.map(async (choice, index) => ({
            label: choice.label,
            choiceType: choice.choiceType,
            itemId: choice.itemSlug ? await getItemId(choice.itemSlug) : undefined,
            textFallback: choice.textFallback,
            explanation: choice.explanation,
            isCorrect: choice.isCorrect,
            displayOrder: index + 1,
          })),
        ),
      },
      scenario: {
        create: {
          playerChampionId: championId,
          playerRole: seed.role,
          gameMinute: seed.minute,
          playerGold: seed.gold,
          playerLevel: seed.role === Role.SUPPORT ? 10 : 13,
          kills: 3,
          deaths: 2,
          assists: 4,
          cs: seed.role === Role.SUPPORT ? 32 : 165,
          currentBuild: seed.currentBuild,
          allyTeam: seed.allyTeam,
          enemyTeam: seed.enemyTeam,
          enemyItems: seed.enemyItems,
          notableThreats: seed.tags,
          objectiveState: { nextObjective: "dragon", contest: true },
          damageProfile: { primary: seed.role === Role.MID ? "mixed" : "physical" },
          mapState: { tempo: "contested" },
          notes: "Manual teaching puzzle seeded for baseline curriculum.",
        },
      },
      tags: {
        create: seed.tags.map((tag) => ({
          tag: {
            connectOrCreate: {
              where: { slug: slugify(tag) },
              create: { slug: slugify(tag), name: tag },
            },
          },
        })),
      },
    },
  });

  return puzzle;
}

async function main() {
  await resetDatabase();
  const syncResult = await riotSyncService.syncAll();
  console.log(`Synced catalog for patch ${syncResult.version}`);

  const passwordHash = await hashPassword("Password123!");
  const demoUser = await prisma.user.create({
    data: {
      email: "demo@summonerbuildlab.dev",
      username: "SummonerCoach",
      passwordHash,
      authProvider: UserAuthProvider.EMAIL,
      globalProgress: {
        create: {
          dailyStreak: 3,
          bestStreak: 5,
        },
      },
      emailPreference: {
        create: {
          dailyReminderEnabled: true,
          preferredHour: 19,
          timezone: "Europe/Paris",
        },
      },
    },
  });

  const createdManual = [];
  for (const puzzle of manualPuzzles) {
    const created = await createManualPuzzle(puzzle);
    if (created) createdManual.push(created);
  }

  const champions = await prisma.champion.findMany({ orderBy: { name: "asc" } });
  for (const champion of champions) {
    await puzzleGenerationService.generateChampionPuzzle(champion.id, demoUser.id);
  }

  const allPublished = await prisma.puzzle.findMany({
    where: { isPublished: true },
    include: { choices: true, champion: true },
    orderBy: { createdAt: "asc" },
  });

  for (const puzzle of allPublished.slice(0, 18)) {
    const correctChoice = puzzle.choices.find((choice) => choice.isCorrect) ?? puzzle.choices[0];
    if (!correctChoice) continue;

    await prisma.puzzleAttempt.create({
      data: {
        userId: demoUser.id,
        puzzleId: puzzle.id,
        selectedChoiceId: correctChoice.id,
        isCorrect: correctChoice.isCorrect,
      },
    });
  }

  if (allPublished[0]) {
    await prisma.dailyChallenge.create({
      data: {
        puzzleId: allPublished[0].id,
        challengeDate: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    });
  }

  console.log(`Seed complete: ${champions.length} champions, ${(await prisma.item.count())} items, ${await prisma.puzzle.count()} puzzles.`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
