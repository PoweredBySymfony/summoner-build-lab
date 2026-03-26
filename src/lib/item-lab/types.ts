import type { ChampionView, GameItem } from "@/types/domain";

export type LabMode = "mirror" | "duel";
export type LabSide = "A" | "B";

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
  level: number;
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

export interface SetupProfileScore {
  key: "burst" | "sustainedDps" | "antiFrontline" | "antiSquishy" | "survivability";
  label: string;
  value: number;
  emphasis: string;
}

export interface SetupAnalysis {
  champion: ChampionView;
  level: number;
  items: GameItem[];
  stats: StatValueMap;
  bonusStats: StatValueMap;
  changedStats: StatDelta[];
  profileScores: SetupProfileScore[];
  whyItChanges: SetupHeuristicNote[];
  contextNotes: string[];
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
