export interface LocalizedText {
  fr: string;
  en: string;
}

export interface ChampionView {
  id: string;
  databaseId: string;
  name: string;
  icon: string;
  roles: string[];
  damageType: string;
  threat: LocalizedText;
  tags: string[];
}

export interface GameItem {
  id: string;
  databaseId: string;
  riotItemId: number;
  name: string;
  cost: number;
  combineCost?: number;
  icon: string;
  stats: Array<{ label: string; value: string }>;
  passive?: LocalizedText;
  passiveName?: string;
  active?: LocalizedText;
  activeName?: string;
  components: Array<{ name: string; cost: number; icon: string }>;
  tags: string[];
  category: string;
  patch: string;
  description?: LocalizedText;
}

export interface PuzzleChoiceView {
  id: string;
  label: LocalizedText;
  choiceType: string;
  item: GameItem | null;
  textFallback?: LocalizedText;
  explanation: LocalizedText;
  isCorrect: boolean;
  displayOrder: number;
}

export interface PuzzleListItem {
  id: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  difficulty: "beginner" | "intermediate" | "advanced";
  patch: string;
  role: string;
  moduleKey: string;
  champion: ChampionView | null;
  tags: string[];
  choiceCount: number;
}

export interface PuzzleDetail extends PuzzleListItem {
  situation: LocalizedText;
  question: LocalizedText;
  explanation: LocalizedText;
  gameContext: {
    minute?: number;
    gold?: number;
    objective?: string;
    currentBuild?: string[];
    scoreboard?: string;
    notes?: string[];
    [key: string]: unknown;
  };
  allyTeam: ChampionView[];
  enemyTeam: ChampionView[];
  choices: PuzzleChoiceView[];
}

export interface BootstrapPayload {
  stats: {
    itemCount: number;
    championCount: number;
    puzzleCount: number;
    moduleCount: number;
    latestPatch: string;
  };
  featuredItems: GameItem[];
  featuredChampions: ChampionView[];
  featuredPuzzles: PuzzleListItem[];
}

export interface ModuleView {
  id: string;
  title: string;
  difficulty: PuzzleListItem["difficulty"];
  patch: string;
  scenarios: number;
  roles: string[];
  progress: number;
  puzzles: PuzzleListItem[];
}

export interface DashboardPayload {
  user: {
    username: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    streak: number;
  };
  stats: {
    accuracy: number;
    sessions: number;
    totalPuzzles: number;
  };
  featuredItems: GameItem[];
  recentAttempts: Array<{
    id: string;
    puzzleSlug: string;
    puzzleTitle: LocalizedText;
    isCorrect: boolean;
    answeredAt: string;
  }>;
}
