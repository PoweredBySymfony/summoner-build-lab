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
    title: "Jinx face à une front line qui stack l'armure",
    description: "Décision classique de carry quand la double frontline investit déjà dans l'armure.",
    shortPrompt: "Deux ennemis ont déjà de l'armure et le prochain dragon se joue en front-to-back.",
    situation: "Tu es à 24 minutes sur Jinx avec Kraken Slayer et Runaan. Ornn et Sejuani ont déjà de l'armure, pendant que Viktor menace encore le fight à distance.",
    question: "Quel est le meilleur troisième item dans ce setup précis ?",
    explanation: "Lord Dominik's Regards est la réponse la plus propre parce que le fight passera d'abord par Ornn et Sejuani. Il faut de la vraie pénétration d'armure avant le luxe ou la survie.",
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
      { itemSlug: "lord-dominiks-regards", label: "Lord Dominik's Regards", choiceType: PuzzleChoiceType.ITEM, explanation: "Correct. L'armure de front line bloque tout le fight.", isCorrect: true },
      { itemSlug: "bloodthirster", label: "Bloodthirster", choiceType: PuzzleChoiceType.ITEM, explanation: "La sustain est utile, mais elle ne règle pas ton problème principal de DPS.", isCorrect: false },
      { itemSlug: "guardian-angel", label: "Guardian Angel", choiceType: PuzzleChoiceType.ITEM, explanation: "Le pivot défensif est trop tôt si tu n'arrives pas encore à tomber les tanks.", isCorrect: false },
      { itemSlug: "infinity-edge", label: "Infinity Edge", choiceType: PuzzleChoiceType.ITEM, explanation: "Le spike crit est tentant, mais la pénétration d'armure est prioritaire ici.", isCorrect: false },
    ],
  },
  {
    title: "Ahri contre la montée de résistance magique",
    description: "Carry AP mid qui doit s'adapter quand les cibles prioritaires achètent de la MR.",
    shortPrompt: "Le backline adverse commence à acheter de la MR et le tempo s'accélère.",
    situation: "Tu joues Ahri à 22 minutes avec Blackfire Torch et Sorcerer's Shoes. Xayah et Sylas viennent de compléter de la résistance magique alors que ton équipe veut forcer le soul point.",
    question: "Quel achat donne la meilleure valeur à Ahri maintenant ?",
    explanation: "Void Staff passe devant parce que les carries ennemis ont franchi le seuil où la flat pen seule ne suffit plus. Tu gardes ainsi ta menace de pick au prochain objectif.",
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
      { itemSlug: "void-staff", label: "Void Staff", choiceType: PuzzleChoiceType.ITEM, explanation: "Correct. La MR change immédiatement l'équation.", isCorrect: true },
      { itemSlug: "shadowflame", label: "Shadowflame", choiceType: PuzzleChoiceType.ITEM, explanation: "Encore jouable, mais moins rentable dès que la vraie MR apparaît sur les cibles prioritaires.", isCorrect: false },
      { itemSlug: "zhonyas-hourglass", label: "Zhonya's Hourglass", choiceType: PuzzleChoiceType.ITEM, explanation: "Utile contre la dive, mais moins efficace que de conserver ta létalité malgré la MR.", isCorrect: false },
      { itemSlug: "rabadons-deathcap", label: "Rabadon's Deathcap", choiceType: PuzzleChoiceType.ITEM, explanation: "Gros spike AP, mais moins efficace que Void Staff quand plusieurs menaces ont déjà de la MR.", isCorrect: false },
    ],
  },
  {
    title: "Aatrox : anti-heal contre spike immédiat",
    description: "Décision bruiser entre blessures graves et timing de dégâts bruts.",
    shortPrompt: "La sustain adverse décide actuellement les longues escarmouches.",
    situation: "Tu es devant sur Aatrox à 17 minutes. L'équipe adverse a Soraka et Warwick, et chaque fight rivière devient une guerre d'usure autour du Herald et du dragon.",
    question: "Quel est l'achat le plus discipliné ?",
    explanation: "Executioner's Calling est le bon achat de discipline quand toute la structure du fight est déformée par les soins. Ce n'est pas flashy, mais ça débloque le reste de tes dégâts.",
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
      { label: "Executioner's Calling", textFallback: "Executioner's Calling", choiceType: PuzzleChoiceType.COMPONENT, explanation: "Correct. Les soins sont trop centraux pour être ignorés.", isCorrect: true },
      { itemSlug: "black-cleaver", label: "Black Cleaver", choiceType: PuzzleChoiceType.ITEM, explanation: "Fort plus tard, mais trop lent si la sustain déforme déjà le fight.", isCorrect: false },
      { itemSlug: "steraks-gage", label: "Sterak's Gage", choiceType: PuzzleChoiceType.ITEM, explanation: "Tu gagnes de la value anti-burst, pas la réponse anti-heal nécessaire.", isCorrect: false },
      { itemSlug: "plated-steelcaps", label: "Plated Steelcaps", choiceType: PuzzleChoiceType.BOOTS, explanation: "Des bottes safe sont correctes, mais elles ne répondent pas au vrai problème ici.", isCorrect: false },
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
