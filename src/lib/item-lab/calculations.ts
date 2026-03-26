import type { ChampionView, GameItem } from "@/types/domain";
import type { ComparisonSummary, ItemLabSetup, LabSide, SetupAnalysis, StatDefinition, StatDelta, StatKey, StatValueMap } from "@/lib/item-lab/types";
import { BuildAnalysisService } from "@/lib/item-lab/BuildAnalysisService";
import { getRoleConfig } from "@/lib/item-lab/roleConfig";

export const MAX_ITEM_SLOTS = 7;

export const STAT_DEFINITIONS: StatDefinition[] = [
  { key: "attackDamage", label: "AD", shortLabel: "AD", group: "offense", decimals: 0 },
  { key: "abilityPower", label: "AP", shortLabel: "AP", group: "offense", decimals: 0 },
  { key: "attackSpeed", label: "Vitesse d'attaque", shortLabel: "AS", group: "offense", decimals: 2 },
  { key: "critChance", label: "Critique", shortLabel: "Crit", group: "offense", decimals: 0, suffix: "%" },
  { key: "armorPen", label: "Pen. armure", shortLabel: "Pen", group: "offense", decimals: 0, suffix: "%" },
  { key: "lethality", label: "Létalité", shortLabel: "Létalité", group: "offense", decimals: 0 },
  { key: "magicPen", label: "Pen. magique", shortLabel: "Mpen", group: "offense", decimals: 0 },
  { key: "abilityHaste", label: "Hâte", shortLabel: "Hâte", group: "offense", decimals: 0 },
  { key: "health", label: "PV", shortLabel: "PV", group: "defense", decimals: 0 },
  { key: "armor", label: "Armure", shortLabel: "Armure", group: "defense", decimals: 0 },
  { key: "magicResist", label: "Rés. magique", shortLabel: "RM", group: "defense", decimals: 0 },
  { key: "moveSpeed", label: "Vitesse", shortLabel: "MS", group: "utility", decimals: 0 },
  { key: "mana", label: "Mana", shortLabel: "Mana", group: "utility", decimals: 0 },
  { key: "healthRegen", label: "Régén. PV", shortLabel: "HP5", group: "utility", decimals: 1 },
  { key: "manaRegen", label: "Régén. mana", shortLabel: "MP5", group: "utility", decimals: 1 },
];

const STAT_LOOKUP = Object.fromEntries(STAT_DEFINITIONS.map((definition) => [definition.key, definition])) as Record<StatKey, StatDefinition>;

const emptyStats = (): StatValueMap => ({
  health: 0,
  mana: 0,
  attackDamage: 0,
  abilityPower: 0,
  attackSpeed: 0,
  critChance: 0,
  armorPen: 0,
  lethality: 0,
  magicPen: 0,
  abilityHaste: 0,
  armor: 0,
  magicResist: 0,
  moveSpeed: 0,
  healthRegen: 0,
  manaRegen: 0,
});

const clamp = (value: number, min = 0, max = 9999) => Math.min(max, Math.max(min, value));
const safeNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const toPercentValue = (value: number) => (Math.abs(value) <= 1 ? value * 100 : value);

const growthFactor = (level: number) => {
  const normalizedLevel = clamp(level, 1, 20);
  const previousLevels = normalizedLevel - 1;
  return previousLevels <= 0 ? 0 : previousLevels * (0.7025 + previousLevels * 0.0175);
};

const scaledStat = (base: number, perLevel: number, level: number) => base + perLevel * growthFactor(level);

const mergeStats = (...sources: StatValueMap[]) => {
  const merged = emptyStats();
  for (const source of sources) {
    for (const key of Object.keys(merged) as StatKey[]) {
      merged[key] += source[key];
    }
  }
  return merged;
};

const getNormalizedItemBonuses = (item: GameItem) => {
  const raw = item.stats ?? {};
  const bonus = emptyStats();

  bonus.health += safeNumber(raw.FlatHPPoolMod);
  bonus.mana += safeNumber(raw.FlatMPPoolMod);
  bonus.attackDamage += safeNumber(raw.FlatPhysicalDamageMod);
  bonus.abilityPower += safeNumber(raw.FlatMagicDamageMod);
  bonus.attackSpeed += toPercentValue(safeNumber(raw.PercentAttackSpeedMod));
  bonus.critChance += toPercentValue(safeNumber(raw.FlatCritChanceMod));
  bonus.armor += safeNumber(raw.FlatArmorMod);
  bonus.magicResist += safeNumber(raw.FlatSpellBlockMod);
  bonus.moveSpeed += safeNumber(raw.FlatMovementSpeedMod);
  bonus.moveSpeed += safeNumber(raw.PercentMovementSpeedMod) * 100;
  bonus.healthRegen += safeNumber(raw.FlatHPRegenMod);
  bonus.healthRegen += safeNumber(raw.PercentHPRegenMod) * 100;
  bonus.manaRegen += safeNumber(raw.FlatMPRegenMod);
  bonus.manaRegen += safeNumber(raw.PercentMPRegenMod) * 100;
  bonus.abilityHaste += safeNumber(raw.FlatAbilityHasteMod);
  bonus.abilityHaste += safeNumber(raw.CooldownReduction);
  bonus.magicPen += safeNumber(raw.FlatMagicPenetrationMod);
  bonus.magicPen += toPercentValue(safeNumber(raw.PercentMagicPenetrationMod));
  bonus.armorPen += toPercentValue(safeNumber(raw.PercentArmorPenetrationMod));
  bonus.lethality += safeNumber(raw.FlatArmorPenetrationMod);

  return bonus;
};

const getChampionBaseStats = (champion: ChampionView, level: number) => {
  const stats = champion.stats as Record<string, unknown>;
  const baseStats = emptyStats();

  baseStats.health = scaledStat(safeNumber(stats.hp), safeNumber(stats.hpperlevel), level);
  baseStats.mana = scaledStat(safeNumber(stats.mp), safeNumber(stats.mpperlevel), level);
  baseStats.attackDamage = scaledStat(safeNumber(stats.attackdamage), safeNumber(stats.attackdamageperlevel), level);
  baseStats.armor = scaledStat(safeNumber(stats.armor), safeNumber(stats.armorperlevel), level);
  baseStats.magicResist = scaledStat(safeNumber(stats.spellblock), safeNumber(stats.spellblockperlevel), level);
  baseStats.moveSpeed = safeNumber(stats.movespeed);
  baseStats.healthRegen = scaledStat(safeNumber(stats.hpregen), safeNumber(stats.hpregenperlevel), level);
  baseStats.manaRegen = scaledStat(safeNumber(stats.mpregen), safeNumber(stats.mpregenperlevel), level);
  baseStats.critChance = scaledStat(safeNumber(stats.crit), safeNumber(stats.critperlevel), level);

  const baseAttackSpeed = safeNumber(stats.attackspeed);
  const attackSpeedGrowth = safeNumber(stats.attackspeedperlevel);
  baseStats.attackSpeed = baseAttackSpeed * (1 + (attackSpeedGrowth * growthFactor(level)) / 100);

  return baseStats;
};

const getScalingScore = (champion: ChampionView, analysis: { stats: StatValueMap; items: GameItem[] }) => {
  const stats = champion.stats as Record<string, unknown>;
  const innate =
    safeNumber(stats.attackdamageperlevel) * 1.2 +
    safeNumber(stats.hpperlevel) * 0.08 +
    safeNumber(stats.attackspeedperlevel) * 2 +
    safeNumber(stats.armorperlevel) +
    safeNumber(stats.spellblockperlevel);
  const itemSynergy =
    analysis.stats.critChance * 1.2 +
    analysis.stats.abilityPower * 0.25 +
    analysis.stats.attackSpeed * 30 +
    analysis.items.filter((item) => item.isLegendary).length * 4;

  return clamp(Math.round((innate + itemSynergy) / 8), 0, 100);
};

const buildSummaryLine = (analysis: { champion: ChampionView; profileScores: SetupAnalysis["profileScores"]; level: number }) => {
  const topProfiles = [...analysis.profileScores].sort((left, right) => right.value - left.value).slice(0, 2);
  const profileText = topProfiles.map((entry) => entry.label.toLowerCase()).join(" + ");
  return `${analysis.champion.name} niv. ${analysis.level} oriente ${profileText}.`;
};

export const formatStatValue = (key: StatKey, value: number) => {
  const definition = STAT_LOOKUP[key];
  const rounded = Number(value.toFixed(definition.decimals ?? 0));
  return `${rounded}${definition.suffix ?? ""}`;
};

export const getStatDefinition = (key: StatKey) => STAT_LOOKUP[key];

export const buildChangedStats = (previous: StatValueMap | null, current: StatValueMap): StatDelta[] => {
  if (!previous) {
    return [];
  }

  return (Object.keys(current) as StatKey[])
    .map((key) => ({
      key,
      previous: previous[key],
      current: current[key],
      delta: current[key] - previous[key],
    }))
    .filter((entry) => Math.abs(entry.delta) > 0.009)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
};

export const analyzeSetup = ({
  setup,
  champion,
  items,
  previousStats,
}: {
  setup: ItemLabSetup;
  champion: ChampionView;
  items: GameItem[];
  previousStats?: StatValueMap | null;
}): SetupAnalysis => {
  const roleConfig = getRoleConfig(setup.role);
  const championBase = getChampionBaseStats(champion, setup.level);
  const itemBonuses = items.reduce((accumulator, item) => mergeStats(accumulator, getNormalizedItemBonuses(item)), emptyStats());
  const baseAttackSpeed = championBase.attackSpeed;
  const finalStats = mergeStats(championBase, itemBonuses);

  finalStats.attackSpeed = baseAttackSpeed * (1 + itemBonuses.attackSpeed / 100);
  finalStats.moveSpeed = championBase.moveSpeed + itemBonuses.moveSpeed;
  finalStats.critChance = clamp(championBase.critChance + itemBonuses.critChance, 0, 100);
  finalStats.armorPen = clamp(itemBonuses.armorPen, 0, 100);

  const scalingScore = getScalingScore(champion, { stats: finalStats, items });
  const profileScores = BuildAnalysisService.getProfileScores({ stats: finalStats, items, champion, scalingScore });
  const buildSignals = BuildAnalysisService.deriveBuildSignals({ stats: finalStats, items, profileScores });
  const rawContext = BuildAnalysisService.deriveCompositionArchetypes({ stats: finalStats, items, signals: buildSignals });
  const context = BuildAnalysisService.buildContextSummary({ stats: finalStats, items, signals: buildSignals, context: rawContext });

  return {
    champion,
    role: setup.role,
    roleConfig,
    level: setup.level,
    items,
    itemCount: items.length,
    stats: finalStats,
    bonusStats: itemBonuses,
    changedStats: buildChangedStats(previousStats ?? null, finalStats),
    profileScores,
    buildSignals,
    whyItChanges: BuildAnalysisService.buildWhyItChanges({ bonusStats: itemBonuses, items }),
    context,
    summaryLine: buildSummaryLine({ champion, profileScores, level: setup.level }),
    scalingScore,
    totalGold: items.reduce((sum, item) => sum + item.cost, 0),
  };
};

const buildComparisonCard = (label: string, statA: number, statB: number, formatter: (value: number) => string) => {
  const max = Math.max(statA, statB, 1);
  const leader: LabSide | "tie" = Math.abs(statA - statB) < 0.009 ? "tie" : statA > statB ? "A" : "B";
  const delta = Math.abs(statA - statB);
  return {
    label,
    leader,
    detail: leader === "tie" ? "Équilibre" : `${leader} +${formatter(delta)}`,
    ratioA: (statA / max) * 100,
    ratioB: (statB / max) * 100,
  };
};

export const buildComparisonSummary = (analysisA: SetupAnalysis, analysisB: SetupAnalysis): ComparisonSummary => {
  const standoutStats = (Object.keys(analysisA.stats) as StatKey[])
    .map((key) => ({
      key,
      previous: analysisB.stats[key],
      current: analysisA.stats[key],
      delta: analysisA.stats[key] - analysisB.stats[key],
    }))
    .filter((entry) => Math.abs(entry.delta) > 0.009)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 5);

  const profileA = Object.fromEntries(analysisA.profileScores.map((entry) => [entry.key, entry.value])) as Record<string, number>;
  const profileB = Object.fromEntries(analysisB.profileScores.map((entry) => [entry.key, entry.value])) as Record<string, number>;
  const narrative: string[] = [];

  if (profileA.sustainedDps - profileB.sustainedDps >= 8) narrative.push("A a plus de DPS soutenu.");
  if (profileB.sustainedDps - profileA.sustainedDps >= 8) narrative.push("B a plus de DPS soutenu.");
  if (profileA.burst - profileB.burst >= 8) narrative.push("A a plus de burst.");
  if (profileB.burst - profileA.burst >= 8) narrative.push("B a plus de burst.");
  if (profileA.antiFrontline - profileB.antiFrontline >= 8) narrative.push("A est meilleur contre frontline.");
  if (profileB.antiFrontline - profileA.antiFrontline >= 8) narrative.push("B est meilleur contre frontline.");
  if (analysisA.scalingScore - analysisB.scalingScore >= 8) narrative.push("A scale mieux.");
  if (analysisB.scalingScore - analysisA.scalingScore >= 8) narrative.push("B scale mieux.");

  return {
    cards: [
      buildComparisonCard("Burst", profileA.burst, profileB.burst, (value) => String(Math.round(value))),
      buildComparisonCard("DPS soutenu", profileA.sustainedDps, profileB.sustainedDps, (value) => String(Math.round(value))),
      buildComparisonCard("Anti-frontline", profileA.antiFrontline, profileB.antiFrontline, (value) => String(Math.round(value))),
      buildComparisonCard("Scaling", analysisA.scalingScore, analysisB.scalingScore, (value) => String(Math.round(value))),
    ],
    narrative: narrative.length > 0 ? narrative.slice(0, 4) : ["Les deux setups restent proches sur les heuristiques principales."],
    standoutStats,
  };
};

export const statDefinitionsByGroup = STAT_DEFINITIONS.reduce<Record<string, StatDefinition[]>>((groups, definition) => {
  groups[definition.group] ??= [];
  groups[definition.group].push(definition);
  return groups;
}, {});

export const getStatLabel = (key: StatKey) => STAT_LOOKUP[key]?.label ?? key;
