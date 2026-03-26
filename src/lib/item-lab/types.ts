import type { ChampionView, GameItem } from "@/types/domain";

export type LabMode = "mirror" | "duel";
export type LabSide = "A" | "B";
export type LabRoleKey = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

export type StatKey =
  | "health"
  | "mana"
  | "attackDamage"
  | "abilityPower"
  | "attackSpeed"
  | "critChance"
  | "armorPen"
  | "lethality"
  | "magicPen"
  | "abilityHaste"
  | "armor"
  | "magicResist"
  | "moveSpeed"
  | "healthRegen"
  | "manaRegen";

export type StatGroupKey = "offense" | "defense" | "utility";
export type StatValueMap = Record<StatKey, number>;

export interface StatDefinition {
  key: StatKey;
  label: string;
  shortLabel: string;
  group: StatGroupKey;
  decimals?: number;
  suffix?: string;
}

export interface ItemLabSetup {
  championId: string;
  role: LabRoleKey;
  level: number;
  itemIds: Array<string | null>;
}

export interface RoleConfig {
  maxLevel: number;
  maxItems: number;
}

export interface EnemyChampionSetup {
  championId: string;
  itemIds: Array<string | null>;
}

export interface StatDelta {
  key: StatKey;
  previous: number;
  current: number;
  delta: number;
}

export interface SetupHeuristicNote {
  title: string;
  body: string;
}

export type SetupProfileKey = "burst" | "sustainedDps" | "antiFrontline" | "antiSquishy" | "survivability";

export interface SetupProfileScore {
  key: SetupProfileKey;
  label: string;
  value: number;
  emphasis: string;
}

export type CompositionArchetypeTag =
  | "Frontline lourde"
  | "Squishy"
  | "Sustain"
  | "Poke"
  | "Engage fort"
  | "Combat long"
  | "Burst rapide";

export type CompositionWeaknessTag =
  | "Faible contre poke"
  | "Faible contre burst"
  | "Faible contre frontline"
  | "Faible dans les combats longs";

export interface BuildSignalMap {
  burstScore: number;
  sustainedDpsScore: number;
  survivabilityScore: number;
  antiFrontlineScore: number;
  mobilityScore: number;
  sustainScore: number;
  pokeStabilityScore: number;
}

export interface CompositionContext {
  strengths: CompositionArchetypeTag[];
  weaknesses: CompositionWeaknessTag[];
  confidence: "low" | "medium" | "high";
  summary: string;
  reasons: string[];
  tags: string[];
  isUnlocked: boolean;
  isComplete: boolean;
}

export interface SetupAnalysis {
  champion: ChampionView;
  role: LabRoleKey;
  roleConfig: RoleConfig;
  level: number;
  items: GameItem[];
  itemCount: number;
  stats: StatValueMap;
  bonusStats: StatValueMap;
  changedStats: StatDelta[];
  profileScores: SetupProfileScore[];
  buildSignals: BuildSignalMap;
  whyItChanges: SetupHeuristicNote[];
  context: CompositionContext;
  summaryLine: string;
  scalingScore: number;
  totalGold: number;
}

export interface ComparisonCard {
  label: string;
  leader: LabSide | "tie";
  detail: string;
  ratioA: number;
  ratioB: number;
}

export interface ComparisonSummary {
  cards: ComparisonCard[];
  narrative: string[];
  standoutStats: StatDelta[];
}

export interface SavedLabExperiment {
  id: string;
  name: string;
  mode: LabMode;
  setupA: ItemLabSetup;
  setupB: ItemLabSetup;
  createdAt: string;
  updatedAt: string;
}
