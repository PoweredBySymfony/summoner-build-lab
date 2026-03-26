import { test, expect } from "../playwright-fixture";

const champion = {
  id: "aatrox",
  databaseId: "champion-db-aatrox",
  riotChampionId: 266,
  championKey: "Aatrox",
  name: "Aatrox",
  title: "the Darkin Blade",
  slug: "aatrox",
  icon: "https://ddragon.leagueoflegends.com/cdn/16.6.1/img/champion/Aatrox.png",
  splashImage: null,
  image: "https://ddragon.leagueoflegends.com/cdn/16.6.1/img/champion/Aatrox.png",
  roles: ["Top"],
  tags: ["Fighter"],
  stats: {},
  patch: "16.6.1",
  isActive: true,
};

const item = (slug: string, name: string, riotItemId: number) => ({
  id: slug,
  databaseId: `db-${slug}`,
  riotItemId,
  name,
  slug,
  icon: `https://ddragon.leagueoflegends.com/cdn/16.6.1/img/item/${riotItemId}.png`,
  image: `https://ddragon.leagueoflegends.com/cdn/16.6.1/img/item/${riotItemId}.png`,
  cost: 3000,
  baseCost: 900,
  sellPrice: 2100,
  category: "fighter",
  tags: [],
  stats: {},
  shortDescription: `${name} description courte`,
  fullDescription: `+40 Attaque\n${name} description longue`,
  activeEffect: null,
  passiveEffect: null,
  buildsFrom: [],
  buildsInto: [],
  buildsFromIcons: [],
  mapAvailability: null,
  isBoots: slug.includes("steelcaps"),
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  patch: "16.6.1",
});

const blackCleaver = item("couperet-noir", "Couperet noir", 3071);
const sterak = item("gage-de-sterak", "Gage de Sterak", 3053);
const guardianAngel = item("ange-gardien", "Ange gardien", 3026);
const maw = item("gueule-de-malmortius", "Gueule de Malmortius", 3156);

const puzzleList = [
  {
    id: "puzzle-1",
    slug: "aatrox-heal-cut-1",
    title: "Aatrox OTP: Couper les soins avant tout",
    description: "Description 1",
    shortPrompt: "Prompt 1",
    difficulty: "intermediaire",
    difficultyKey: "INTERMEDIATE",
    patch: "16.6.1",
    role: "Top",
    roleKey: "TOP",
    mode: "otp",
    modeKey: "CHAMPION_SPECIFIC",
    sourceType: "generated",
    isPublished: true,
    isDailyEligible: true,
    champion,
    tags: [],
    choiceCount: 4,
  },
  {
    id: "puzzle-2",
    slug: "aatrox-armor-break-2",
    title: "Aatrox OTP: Passer l'armure sans perdre ton tempo",
    description: "Description 2",
    shortPrompt: "Prompt 2",
    difficulty: "intermediaire",
    difficultyKey: "INTERMEDIATE",
    patch: "16.6.1",
    role: "Top",
    roleKey: "TOP",
    mode: "otp",
    modeKey: "CHAMPION_SPECIFIC",
    sourceType: "generated",
    isPublished: true,
    isDailyEligible: true,
    champion,
    tags: [],
    choiceCount: 4,
  },
];

const detail = (slug: string, title: string, question: string, shortPrompt: string, choices: Array<{ id: string; item: ReturnType<typeof item> }>) => ({
  id: slug,
  slug,
  title,
  description: title,
  shortPrompt,
  difficulty: "intermediaire",
  difficultyKey: "INTERMEDIATE",
  patch: "16.6.1",
  role: "Top",
  roleKey: "TOP",
  mode: "otp",
  modeKey: "CHAMPION_SPECIFIC",
  sourceType: "generated",
  isPublished: true,
  isDailyEligible: true,
  champion,
  tags: [],
  choiceCount: choices.length,
  situation: `Tu joues ${champion.name} vers 22 min.`,
  question,
  explanation: "Explication globale du puzzle.",
  scenario: {
    playerChampion: champion,
    playerRole: "Top",
    gameMinute: 22,
    playerGold: 3000,
    playerLevel: 13,
    kills: 5,
    deaths: 2,
    assists: 6,
    cs: 184,
    currentBuild: [blackCleaver],
    allyTeam: [],
    enemyTeam: [],
    allyItems: [],
    enemyItems: [],
    notableThreats: {},
    objectiveState: { contesté: "Oui" },
    damageProfile: { physique: "élevé" },
    mapState: { tempo: "5v5 autour mid" },
    notes: "Note tactique.",
  },
  choices: choices.map((choice, index) => ({
    id: choice.id,
    label: choice.item.name,
    choiceType: "item",
    item: choice.item,
    textFallback: choice.item.shortDescription,
    explanation: `${choice.item.name} est une option.`,
    isCorrect: index === 0,
    displayOrder: index + 1,
  })),
});

const puzzle1 = detail(
  "aatrox-heal-cut-1",
  "Aatrox OTP: Couper les soins avant tout",
  "Quel achat est le plus propre ici ?",
  "La sustain adverse transforme chaque fight en guerre d'usure.",
  [
    { id: "choice-1a", item: blackCleaver },
    { id: "choice-1b", item: sterak },
    { id: "choice-1c", item: guardianAngel },
    { id: "choice-1d", item: maw },
  ],
);

const puzzle2 = detail(
  "aatrox-armor-break-2",
  "Aatrox OTP: Passer l'armure sans perdre ton tempo",
  "Quel achat garde le plus de cohérence avec ton rôle ?",
  "La front line adverse investit tôt dans l'armure et ralentit ton impact.",
  [
    { id: "choice-2a", item: blackCleaver },
    { id: "choice-2b", item: sterak },
    { id: "choice-2c", item: guardianAngel },
    { id: "choice-2d", item: maw },
  ],
);

test("la navigation OTP passe à la question suivante sans conserver le résumé précédent", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "summoner-build-lab:puzzle-series",
      JSON.stringify({
        slugs: ["aatrox-heal-cut-1", "aatrox-armor-break-2"],
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ json: { user: { id: "user-1", email: "test@example.com", username: "tester", isAdmin: false, authProvider: "EMAIL", hasPassword: true, linkedGoogle: false } } });
  });

  await page.route("**/api/puzzles?limit=120", async (route) => {
    await route.fulfill({ json: puzzleList });
  });

  await page.route("**/api/puzzles/aatrox-heal-cut-1", async (route) => {
    await route.fulfill({ json: puzzle1 });
  });

  await page.route("**/api/puzzles/aatrox-armor-break-2", async (route) => {
    await route.fulfill({ json: puzzle2 });
  });

  await page.route("**/api/puzzles/aatrox-heal-cut-1/attempts", async (route) => {
    await route.fulfill({
      json: {
        saved: true,
        isCorrect: true,
        correctChoiceId: "choice-1a",
        explanation: "Résumé spécifique de la question 1.",
        globalExplanation: "Bonne lecture de la question 1.",
        requiresAuth: false,
      },
    });
  });

  await page.goto("/training/aatrox-heal-cut-1");

  await expect(page.getByRole("heading", { name: "Aatrox OTP: Couper les soins avant tout" })).toBeVisible();
  await page.getByRole("button", { name: /couperet noir/i }).click();
  await page.getByRole("button", { name: "Valider" }).click();

  await expect(page.getByRole("heading", { name: "Bonne lecture" })).toBeVisible();
  await expect(page.getByText("Bonne lecture de la question 1.")).toBeVisible();

  await page.getByRole("button", { name: /Question suivante de la serie OTP/i }).click();

  await expect(page.getByRole("heading", { name: "Aatrox OTP: Passer l'armure sans perdre ton tempo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bonne lecture" })).toHaveCount(0);
  await expect(page.getByText("Bonne lecture de la question 1.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Valider" })).toBeVisible();
});
