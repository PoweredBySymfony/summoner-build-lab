import type { ChampionView, GameItem } from "@/types/domain";
import type {
  ComparisonSummary,
  ItemLabSetup,
  LabSide,
  SetupAnalysis,
  SetupHeuristicNote,
  SetupProfileScore,
  StatDefinition,
  StatDelta,
  StatKey,
  StatValueMap,
} from "@/lib/item-lab/types";

export const MAX_ITEM_SLOTS = 6;

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

const STAT_LOOKUP = Object.fromEntries(STAT_DEFINITIONS.map((definition) => [definition.key, definition])) as Record<
  StatKey,
  StatDefinition
>;

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
  const normalizedLevel = clamp(level, 1, 18);
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

const getProfileScores = (analysis: {
  stats: StatValueMap;
  items: GameItem[];
  champion: ChampionView;
  scalingScore: number;
}): SetupProfileScore[] => {
  const { stats, items, champion, scalingScore } = analysis;
  const itemTags = items.flatMap((item) => item.tags ?? []);
  const tagText = itemTags.join(" ").toLowerCase();
  const roleTags = champion.tags.join(" ").toLowerCase();

  const burst = clamp(
    Math.round(
      stats.attackDamage * 0.48 +
        stats.abilityPower * 0.62 +
        stats.lethality * 4.2 +
        stats.magicPen * 3.1 +
        stats.critChance * 0.9 +
        stats.abilityHaste * 0.25 +
        (tagText.includes("assassin") ? 12 : 0) +
        (roleTags.includes("assassin") ? 8 : 0),
    ),
    0,
    100,
  );

  const sustainedDps = clamp(
    Math.round(
      stats.attackDamage * 0.34 +
        stats.abilityPower * 0.22 +
        stats.attackSpeed * 28 +
        stats.critChance * 1.1 +
        stats.abilityHaste * 0.35 +
        (tagText.includes("attackspeed") ? 10 : 0) +
        (roleTags.includes("marksman") ? 10 : 0),
    ),
    0,
    100,
  );

  const antiFrontline = clamp(
    Math.round(
      stats.armorPen * 2.8 +
        stats.magicPen * 2.5 +
        stats.attackSpeed * 14 +
        stats.abilityHaste * 0.35 +
        (tagText.includes("armorpen") ? 18 : 0) +
        (tagText.includes("magicpen") ? 14 : 0),
    ),
    0,
    100,
  );

  const antiSquishy = clamp(
    Math.round(
      burst * 0.72 +
        stats.moveSpeed * 0.08 +
        stats.lethality * 2.4 +
        (tagText.includes("boots") ? 4 : 0) +
        (roleTags.includes("mage") ? 4 : 0),
    ),
    0,
    100,
  );

  const survivability = clamp(
    Math.round(
      stats.health * 0.032 +
        stats.armor * 0.82 +
        stats.magicResist * 0.82 +
        stats.healthRegen * 0.4 +
        (tagText.includes("health") ? 8 : 0) +
        (tagText.includes("spellblock") ? 4 : 0),
    ),
    0,
    100,
  );

  return [
    { key: "burst", label: "Burst", value: burst, emphasis: "impact immédiat" },
    { key: "sustainedDps", label: "DPS soutenu", value: sustainedDps, emphasis: "combats longs" },
    { key: "antiFrontline", label: "Anti-frontline", value: antiFrontline, emphasis: "shred des cibles lourdes" },
    { key: "antiSquishy", label: "Anti-squishy", value: antiSquishy, emphasis: "punition rapide" },
    { key: "survivability", label: "Survie", value: survivability, emphasis: scalingScore > 50 ? "stabilité de carry" : "tenue en fight" },
  ];
};

const buildWhyItChanges = (analysis: {
  bonusStats: StatValueMap;
  items: GameItem[];
  profileScores: SetupProfileScore[];
}): SetupHeuristicNote[] => {
  const { bonusStats, items } = analysis;
  const notes: SetupHeuristicNote[] = [];

  if (bonusStats.attackSpeed >= 20 || bonusStats.critChance >= 25) {
    notes.push({
      title: "DPS accéléré",
      body: "La montée de vitesse d'attaque et/ou de critique renforce le volume de dégâts sur la durée.",
    });
  }

  if (bonusStats.attackDamage >= 40 || bonusStats.abilityPower >= 70) {
    notes.push({
      title: "Spike de puissance direct",
      body: "Le build gagne un gros palier brut de dégâts, utile pour convertir un timing d'achat en fight gagné.",
    });
  }

  if (bonusStats.armorPen > 0 || bonusStats.magicPen > 0 || bonusStats.lethality > 0) {
    notes.push({
      title: "Réponse aux résistances",
      body: "La pénétration ou la létalité améliorent la valeur des dégâts quand l'adversaire commence à itemiser défensif.",
    });
  }

  if (bonusStats.health >= 250 || bonusStats.armor >= 35 || bonusStats.magicResist >= 35) {
    notes.push({
      title: "Fenêtre de survie plus large",
      body: "Le setup se stabilise mieux grâce au mix PV et résistances, ce qui laisse plus d'espace pour jouer les fights.",
    });
  }

  if (items.some((item) => (item.tags ?? []).some((tag) => /boots|active/i.test(tag)))) {
    notes.push({
      title: "Tempo et accès au fight",
      body: "La mobilité ou les actifs rendent le build plus flexible pour engager, kite ou se repositionner.",
    });
  }

  return notes.slice(0, 3).length > 0
    ? notes.slice(0, 3)
    : [
        {
          title: "Courbe neutre",
          body: "Le setup reste plutôt équilibré: il ne force pas un angle extrême mais garde plusieurs options de jeu ouvertes.",
        },
      ];
};

const buildContextNotes = (analysis: { stats: StatValueMap; profileScores: SetupProfileScore[] }): string[] => {
  const byKey = Object.fromEntries(analysis.profileScores.map((entry) => [entry.key, entry.value])) as Record<string, number>;
  const notes: string[] = [];

  if (byKey.antiFrontline >= 55) notes.push("Fort contre frontline lourde");
  if (byKey.antiSquishy >= 55) notes.push("Fort contre cibles fragiles");
  if (byKey.sustainedDps >= 55) notes.push("Plus adapté aux combats longs");
  if (byKey.burst >= 55) notes.push("Meilleur pour burst rapide");
  if (byKey.survivability >= 55) notes.push("Tolère mieux les engages adverses");
  if (analysis.stats.moveSpeed >= 380) notes.push("Bon pour kiting et tempo latéral");

  return notes.slice(0, 4);
};

const buildSummaryLine = (analysis: { champion: ChampionView; profileScores: SetupProfileScore[]; level: number }) => {
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
  const championBase = getChampionBaseStats(champion, setup.level);
  const itemBonuses = items.reduce((accumulator, item) => mergeStats(accumulator, getNormalizedItemBonuses(item)), emptyStats());
  const baseAttackSpeed = championBase.attackSpeed;
  const finalStats = mergeStats(championBase, itemBonuses);

  finalStats.attackSpeed = baseAttackSpeed * (1 + itemBonuses.attackSpeed / 100);
  finalStats.moveSpeed = championBase.moveSpeed + itemBonuses.moveSpeed;
  finalStats.critChance = clamp(championBase.critChance + itemBonuses.critChance, 0, 100);
  finalStats.armorPen = clamp(itemBonuses.armorPen, 0, 100);

  const scalingScore = getScalingScore(champion, { stats: finalStats, items });
  const profileScores = getProfileScores({ stats: finalStats, items, champion, scalingScore });

  return {
    champion,
    level: setup.level,
    items,
    stats: finalStats,
    bonusStats: itemBonuses,
    changedStats: buildChangedStats(previousStats ?? null, finalStats),
    profileScores,
    whyItChanges: buildWhyItChanges({ bonusStats: itemBonuses, items, profileScores }),
    contextNotes: buildContextNotes({ stats: finalStats, profileScores }),
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
  if (profileA.burst - profileB.burst >= 8) narrative.push("A a plus de burst immédiat.");
  if (profileB.burst - profileA.burst >= 8) narrative.push("B a plus de burst immédiat.");
  if (profileA.survivability - profileB.survivability >= 8) narrative.push("A est plus résistant.");
  if (profileB.survivability - profileA.survivability >= 8) narrative.push("B est plus résistant.");
  if (analysisA.scalingScore - analysisB.scalingScore >= 8) narrative.push("A scale mieux à haut niveau.");
  if (analysisB.scalingScore - analysisA.scalingScore >= 8) narrative.push("B scale mieux à haut niveau.");

  return {
    cards: [
      buildComparisonCard("Burst", profileA.burst, profileB.burst, (value) => String(Math.round(value))),
      buildComparisonCard("DPS soutenu", profileA.sustainedDps, profileB.sustainedDps, (value) => String(Math.round(value))),
      buildComparisonCard("Survie", profileA.survivability, profileB.survivability, (value) => String(Math.round(value))),
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
