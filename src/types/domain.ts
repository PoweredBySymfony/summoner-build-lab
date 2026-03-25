export interface ChampionView {
  id: string;
  databaseId: string;
  riotChampionId?: number | null;
  championKey?: string | null;
  name: string;
  title?: string | null;
  slug: string;
  icon: string;
  splashImage?: string | null;
  image: string;
  roles: string[];
  tags: string[];
  stats: Record<string, unknown>;
  patch: string;
}

export interface GameItem {
  id: string;
  databaseId: string;
  riotItemId: number;
  name: string;
  slug: string;
  icon: string;
  image: string;
  cost: number;
  baseCost?: number | null;
  sellPrice?: number | null;
  category?: string | null;
  tags: string[];
  stats: Record<string, unknown>;
  shortDescription?: string | null;
  fullDescription?: string | null;
  activeEffect?: string | null;
  passiveEffect?: string | null;
  buildsFrom: string[];
  buildsInto: string[];
  mapAvailability?: Record<string, unknown> | null;
  isBoots: boolean;
  isLegendary: boolean;
  isConsumable: boolean;
  isTrinket: boolean;
  isStarter: boolean;
  patch: string;
}

export interface PuzzleChoiceView {
  id: string;
  label: string;
  choiceType: string;
  item: GameItem | null;
  textFallback?: string | null;
  explanation: string;
  isCorrect: boolean;
  displayOrder: number;
}

export interface PuzzleListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortPrompt: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  patch: string;
  role: string | null;
  mode: string;
  sourceType: string;
  champion: ChampionView | null;
  tags: Array<{ slug: string; name: string }>;
  choiceCount: number;
}

export interface PuzzleDetail extends PuzzleListItem {
  situation: string;
  question: string;
  explanation: string;
  scenario: {
    playerChampion: ChampionView;
    playerRole: string;
    gameMinute: number;
    playerGold: number;
    playerLevel?: number | null;
    kills?: number | null;
    deaths?: number | null;
    assists?: number | null;
    cs?: number | null;
    currentBuild: Array<GameItem | { id: string; name: string }>;
    allyTeam: Array<
      | ChampionView
      | {
          id: string;
          name: string;
          champion?: ChampionView | { id: string; name: string };
          role?: string;
          items?: Array<GameItem | { id: string; name: string }>;
          note?: string;
        }
    >;
    enemyTeam: Array<
      | ChampionView
      | {
          id: string;
          name: string;
          champion?: ChampionView | { id: string; name: string };
          role?: string;
          items?: Array<GameItem | { id: string; name: string }>;
          note?: string;
        }
    >;
    allyItems?: unknown;
    enemyItems?: Array<GameItem | { id: string; name: string }> | unknown;
    notableThreats?: unknown;
    objectiveState?: unknown;
    damageProfile?: unknown;
    mapState?: unknown;
    notes?: string | null;
  } | null;
  choices: PuzzleChoiceView[];
}

export interface GeneratedPuzzleSeriesPayload {
  slug: string;
  slugs: string[];
}

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  authProvider: string;
  hasPassword: boolean;
  linkedGoogle: boolean;
}

export interface ProgressOverview {
  global: {
    totalAttempts: number;
    totalCorrect: number;
    dailyStreak: number;
    bestStreak: number;
    lastDailyCompletedAt: string | null;
  };
  championProgress: Array<{
    champion: ChampionView;
    totalAttempts: number;
    correctAttempts: number;
    masteryScore: number;
  }>;
  recentAttempts: Array<{
    id: string;
    isCorrect: boolean;
    answeredAt: string;
    puzzle: {
      slug: string;
      title: string;
      champion?: ChampionView | null;
    };
  }>;
  dailyCompletedCount: number;
}

export interface BootstrapPayload {
  stats: {
    itemCount: number;
    championCount: number;
    puzzleCount: number;
    latestPatch: string;
  };
  featuredItems: GameItem[];
  featuredChampions: ChampionView[];
  featuredPuzzles: PuzzleListItem[];
  dailyChallenge: PuzzleListItem;
  progress: ProgressOverview | null;
}

export interface CatalogPayload {
  champions: ChampionView[];
  items: GameItem[];
  patches: string[];
}

export interface DashboardPayload {
  progress: ProgressOverview;
  dailyChallenge: PuzzleListItem;
}

export interface ChampionLearningPayload {
  champion: ChampionView;
  puzzles: PuzzleListItem[];
  progress: {
    champion: ChampionView;
    totalAttempts: number;
    correctAttempts: number;
    masteryScore: number;
  } | null;
}

export interface DailyChallengePayload {
  id: string;
  challengeDate: string;
  puzzle: PuzzleDetail;
  completions: Array<{ userId: string; completedAt: string; isCorrect: boolean }>;
}

export interface PlayerSearchPayload {
  profile: {
    riotId: string;
    gameName: string;
    tagLine: string;
    puuid: string;
    summonerLevel: number | null;
    profileIconId: number | null;
    region: string;
    platform: string;
  };
  summary: {
    matchesAnalyzed: number;
    wins: number;
    losses: number;
    winRate: number;
    averageKda: number;
    averageCs: number;
    averageCsPerMinute: number;
    averageKillParticipation: number;
    averageDamageToChampions: number;
    averageGoldEarned: number;
    averageVisionScore: number;
    mostPlayedChampions: Array<{
      championName: string;
      games: number;
      wins: number;
      kda: number;
    }>;
  };
  recentMatches: Array<{
    matchId: string;
    championName: string;
    result: "Win" | "Loss";
    kills: number;
    deaths: number;
    assists: number;
    kda: number;
    cs: number;
    damageToChampions: number;
    killParticipation: number;
    queueId: number | null;
    queueLabel?: string | null;
    gameCreation: string | null;
    gameDurationSeconds: number | null;
    goldEarned: number;
    visionScore: number;
    items: Array<{
      riotItemId: number;
      name: string;
      icon: string;
    }>;
  }>;
}

export interface PlayerAutocompleteSuggestion {
  riotId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  region: string | null;
  platform: string | null;
  lastSeenAt: string;
}
