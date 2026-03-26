import type {
  BuildSignalMap,
  CompositionArchetypeTag,
  CompositionContext,
  CompositionWeaknessTag,
  SetupHeuristicNote,
  SetupProfileKey,
  SetupProfileScore,
  StatValueMap,
} from "@/lib/item-lab/types";
import type { ChampionView, GameItem } from "@/types/domain";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const hasTag = (tags: string[], matcher: RegExp) => tags.some((tag) => matcher.test(tag));

const getProfileValueMap = (profileScores: SetupProfileScore[]) =>
  Object.fromEntries(profileScores.map((entry) => [entry.key, entry.value])) as Record<SetupProfileKey, number>;

const getNormalizedItemFlags = (items: GameItem[]) => {
  const tags = items.flatMap((item) => item.tags ?? []);

  return {
    hasBoots: items.some((item) => item.isBoots) || hasTag(tags, /boots/i),
    hasActiveMobility: items.some((item) => item.isActive) || hasTag(tags, /active|dash|move/i),
    hasAttackSpeed: hasTag(tags, /attackspeed/i),
    hasCrit: hasTag(tags, /crit|critical/i),
    hasPenetration: hasTag(tags, /armorpen|magicpen|penetration|lethality/i),
    hasHealingPower: hasTag(tags, /heal|shield|regen/i),
    hasLifesteal: hasTag(tags, /lifesteal|omnivamp|vamp/i),
  };
};

const buildShortSummary = (strengths: CompositionArchetypeTag[], weaknesses: CompositionWeaknessTag[]) => {
  if (strengths.includes("Frontline lourde")) {
    return weaknesses.includes("Faible contre poke")
      ? "Bonne valeur contre les cibles robustes, moins stable face au poke."
      : "Build orienté dégâts continus avec vraie valeur contre les cibles robustes.";
  }

  if (strengths.includes("Burst rapide") || strengths.includes("Squishy")) {
    return weaknesses.includes("Faible dans les combats longs")
      ? "Très bon pour punir des cibles fragiles, mais moins constant si le fight dure."
      : "Très bon pour punir des cibles fragiles et convertir des fenêtres courtes.";
  }

  if (strengths.includes("Combat long") || strengths.includes("Sustain")) {
    return "Le setup prend de la valeur quand le fight s'étire et les échanges se répètent.";
  }

  if (strengths.includes("Engage fort")) {
    return "Le build gagne surtout en accès au fight et en capacité à lancer le tempo.";
  }

  return "Le setup reste assez flexible, sans angle de compo ultra dominant pour l'instant.";
};

const buildReasons = ({
  strengths,
  weaknesses,
  stats,
  signals,
}: {
  strengths: CompositionArchetypeTag[];
  weaknesses: CompositionWeaknessTag[];
  stats: StatValueMap;
  signals: BuildSignalMap;
}) => {
  const reasons: string[] = [];

  if (strengths.includes("Frontline lourde")) {
    reasons.push("Pénétration + DPS soutenu donnent de la valeur contre les frontlines.");
  }
  if (strengths.includes("Squishy") || strengths.includes("Burst rapide")) {
    reasons.push("Burst et dégâts directs rendent les cibles fragiles plus faciles à punir.");
  }
  if (strengths.includes("Combat long") || strengths.includes("Sustain")) {
    reasons.push("Le mix tenue + dégâts continus renforce les combats qui durent.");
  }
  if (strengths.includes("Engage fort")) {
    reasons.push("Mobilité et tempo facilitent l'accès au bon angle de fight.");
  }
  if (weaknesses.includes("Faible contre poke")) {
    reasons.push("Le manque de mobilité et de sustain réduit la tenue contre le poke.");
  }
  if (weaknesses.includes("Faible contre burst")) {
    reasons.push("La fenêtre défensive reste courte contre un engage ou un burst sec.");
  }
  if (weaknesses.includes("Faible contre frontline")) {
    reasons.push("Sans shred ni DPS long, la valeur baisse contre les cibles épaisses.");
  }
  if (weaknesses.includes("Faible dans les combats longs")) {
    reasons.push("Le build pic vite, mais garde moins de valeur si le fight s'étire.");
  }

  if (reasons.length === 0) {
    if (signals.mobilityScore >= 55 && stats.moveSpeed >= 380) {
      reasons.push("Le setup reste lisible grâce à une bonne mobilité de combat.");
    } else {
      reasons.push("Le build reste équilibré, sans faiblesse structurelle majeure détectée.");
    }
  }

  return reasons.slice(0, 2);
};

export const BuildAnalysisService = {
  getProfileScores({
    stats,
    items,
    champion,
    scalingScore,
  }: {
    stats: StatValueMap;
    items: GameItem[];
    champion: ChampionView;
    scalingScore: number;
  }): SetupProfileScore[] {
    const itemTags = items.flatMap((item) => item.tags ?? []);
    const tagText = itemTags.join(" ").toLowerCase();
    const roleTags = champion.tags.join(" ").toLowerCase();

    const burstRaw =
      stats.attackDamage * 0.4 +
      stats.abilityPower * 0.5 +
      stats.lethality * 3.5 +
      stats.magicPen * 2.8 +
      stats.critChance * 0.8 +
      stats.abilityHaste * 0.2 +
      (tagText.includes("assassin") ? 10 : 0) +
      (roleTags.includes("assassin") ? 8 : 0);
    const sustainedRaw =
      stats.attackDamage * 0.3 +
      stats.abilityPower * 0.18 +
      stats.attackSpeed * 24 +
      stats.critChance * 0.9 +
      stats.abilityHaste * 0.28 +
      (tagText.includes("attackspeed") ? 8 : 0) +
      (roleTags.includes("marksman") ? 10 : 0);
    const antiFrontRaw =
      stats.armorPen * 2.4 +
      stats.magicPen * 2.2 +
      stats.attackSpeed * 12 +
      stats.abilityHaste * 0.25 +
      (tagText.includes("armorpen") ? 14 : 0) +
      (tagText.includes("magicpen") ? 12 : 0);
    const antiSquishyRaw =
      burstRaw * 0.68 +
      stats.moveSpeed * 0.06 +
      stats.lethality * 2 +
      (tagText.includes("boots") ? 4 : 0) +
      (roleTags.includes("mage") ? 4 : 0);
    const survivalRaw =
      stats.health * 0.026 +
      stats.armor * 0.68 +
      stats.magicResist * 0.68 +
      stats.healthRegen * 0.32 +
      (tagText.includes("health") ? 6 : 0) +
      (tagText.includes("spellblock") ? 4 : 0);

    const softCap = (raw: number, pivot: number) => Math.round((raw / (raw + pivot)) * 100);

    return [
      { key: "burst", label: "Burst", value: softCap(burstRaw, 170), emphasis: "impact immédiat" },
      { key: "sustainedDps", label: "DPS soutenu", value: softCap(sustainedRaw, 145), emphasis: "combats longs" },
      { key: "antiFrontline", label: "Anti-frontline", value: softCap(antiFrontRaw, 118), emphasis: "valeur contre cibles épaisses" },
      { key: "antiSquishy", label: "Anti-squishy", value: softCap(antiSquishyRaw, 132), emphasis: "punition rapide" },
      { key: "survivability", label: "Survie", value: softCap(survivalRaw, 145), emphasis: scalingScore > 50 ? "stabilité de carry" : "tenue en fight" },
    ];
  },

  deriveBuildSignals({
    stats,
    items,
    profileScores,
  }: {
    stats: StatValueMap;
    items: GameItem[];
    profileScores: SetupProfileScore[];
  }): BuildSignalMap {
    const profiles = getProfileValueMap(profileScores);
    const flags = getNormalizedItemFlags(items);

    const mobilityScore = clamp(
      (stats.moveSpeed >= 385 ? 35 : 0) +
        (flags.hasBoots ? 20 : 0) +
        (flags.hasActiveMobility ? 20 : 0) +
        (flags.hasAttackSpeed ? 10 : 0),
    );

    const sustainScore = clamp(
      (flags.hasLifesteal || flags.hasHealingPower ? 40 : 0) +
        (stats.healthRegen >= 12 ? 20 : 0) +
        (profiles.survivability >= 55 ? 20 : 0) +
        (profiles.sustainedDps >= 55 ? 10 : 0),
    );

    const pokeStabilityScore = clamp(
      (stats.moveSpeed >= 380 ? 30 : 0) +
        (sustainScore >= 45 ? 25 : 0) +
        (profiles.survivability >= 55 ? 20 : 0) -
        (profiles.burst >= 60 && profiles.survivability < 40 ? 20 : 0),
    );

    return {
      burstScore: profiles.burst,
      sustainedDpsScore: profiles.sustainedDps,
      survivabilityScore: profiles.survivability,
      antiFrontlineScore: profiles.antiFrontline,
      mobilityScore,
      sustainScore,
      pokeStabilityScore,
    };
  },

  deriveCompositionArchetypes({
    stats,
    items,
    signals,
  }: {
    stats: StatValueMap;
    items: GameItem[];
    signals: BuildSignalMap;
  }): Omit<CompositionContext, "summary" | "reasons" | "tags" | "isUnlocked" | "isComplete"> {
    const itemCount = items.length;
    if (itemCount < 2) {
      return {
        strengths: [],
        weaknesses: [],
        confidence: "low",
      };
    }

    const strengths: CompositionArchetypeTag[] = [];
    const weaknesses: CompositionWeaknessTag[] = [];

    if (
      signals.antiFrontlineScore >= 55 ||
      (signals.sustainedDpsScore >= 60 && (stats.armorPen > 15 || stats.magicPen > 10))
    ) {
      strengths.push("Frontline lourde");
    }

    if (
      signals.burstScore >= 60 ||
      (stats.critChance >= 50 && stats.attackDamage >= 180) ||
      (stats.lethality >= 12 && signals.burstScore >= 50)
    ) {
      strengths.push("Squishy");
    }

    if (signals.sustainScore >= 55) {
      strengths.push("Sustain");
    }

    if (
      (signals.mobilityScore >= 45 && signals.burstScore >= 45) ||
      (stats.abilityHaste >= 35 && (stats.abilityPower >= 180 || stats.attackDamage >= 180))
    ) {
      strengths.push("Poke");
    }

    if (signals.mobilityScore >= 60 && (signals.burstScore >= 50 || signals.survivabilityScore >= 50)) {
      strengths.push("Engage fort");
    }

    if (signals.sustainedDpsScore >= 55 && (signals.survivabilityScore >= 45 || signals.sustainScore >= 45)) {
      strengths.push("Combat long");
    }

    if (signals.burstScore >= 65) {
      strengths.push("Burst rapide");
    }

    if (signals.pokeStabilityScore < 35 && stats.moveSpeed < 375 && signals.survivabilityScore < 45) {
      weaknesses.push("Faible contre poke");
    }

    if (signals.survivabilityScore < 40 && stats.health < 2200 && (stats.armor < 80 || stats.magicResist < 50)) {
      weaknesses.push("Faible contre burst");
    }

    if (signals.antiFrontlineScore < 40 && signals.sustainedDpsScore < 50) {
      weaknesses.push("Faible contre frontline");
    }

    if (signals.burstScore >= 60 && signals.sustainedDpsScore < 40 && signals.sustainScore < 35) {
      weaknesses.push("Faible dans les combats longs");
    }

    const confidence =
      itemCount >= 6 || (itemCount >= 4 && strengths.length >= 2)
        ? "high"
        : itemCount >= 3
          ? "medium"
          : "low";

    return {
      strengths: strengths.slice(0, 3),
      weaknesses: weaknesses.slice(0, 2),
      confidence,
    };
  },

  buildContextSummary({
    stats,
    items,
    signals,
    context,
  }: {
    stats: StatValueMap;
    items: GameItem[];
    signals: BuildSignalMap;
    context: Omit<CompositionContext, "summary" | "reasons" | "tags" | "isUnlocked" | "isComplete">;
  }): CompositionContext {
    const itemCount = items.length;
    const isUnlocked = itemCount >= 2;
    const isComplete = itemCount >= 6;

    if (!isUnlocked) {
      return {
        ...context,
        summary: "Ajoute au moins 2 items pour débloquer la lecture de compo type.",
        reasons: [],
        tags: [],
        isUnlocked,
        isComplete,
      };
    }

    const tags = [...context.strengths, ...context.weaknesses].slice(0, isComplete ? 5 : 3);

    return {
      ...context,
      summary: buildShortSummary(context.strengths, context.weaknesses),
      reasons: buildReasons({ strengths: context.strengths, weaknesses: context.weaknesses, stats, signals }),
      tags,
      isUnlocked,
      isComplete,
    };
  },

  buildWhyItChanges({
    bonusStats,
    items,
  }: {
    bonusStats: StatValueMap;
    items: GameItem[];
  }): SetupHeuristicNote[] {
    const notes: SetupHeuristicNote[] = [];

    if (bonusStats.attackSpeed >= 20 || bonusStats.critChance >= 25) {
      notes.push({ title: "DPS accéléré", body: "Via vitesse d'attaque ou critique." });
    }

    if (bonusStats.attackDamage >= 40 || bonusStats.abilityPower >= 70) {
      notes.push({ title: "Spike immédiat", body: "Gros palier brut de dégâts." });
    }

    if (bonusStats.armorPen > 0 || bonusStats.magicPen > 0 || bonusStats.lethality > 0) {
      notes.push({ title: "Shred renforcé", body: "La pénétration gagne de la valeur contre les résistances." });
    }

    if (bonusStats.health >= 250 || bonusStats.armor >= 35 || bonusStats.magicResist >= 35) {
      notes.push({ title: "Fenêtre défensive", body: "Plus d'espace pour tenir et rejouer le fight." });
    }

    if (items.some((item) => item.isBoots || item.isActive || (item.tags ?? []).some((tag) => /boots|active/i.test(tag)))) {
      notes.push({ title: "Accès au fight", body: "Le setup gagne en tempo, kite ou repositionnement." });
    }

    return notes.slice(0, 3).length > 0 ? notes.slice(0, 3) : [{ title: "Courbe neutre", body: "Le setup reste assez équilibré." }];
  },
};
