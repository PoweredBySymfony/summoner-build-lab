import { PuzzleSourceType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { getItemGroups } from "../lib/itemGroups.js";
import { getItemRestrictionDecision } from "../lib/itemRestrictions.js";
import { prisma } from "../lib/prisma.js";
import { importedMatchArchiveRepository } from "../repositories/importedMatchArchiveRepository.js";
import { puzzleRepository } from "../repositories/puzzleRepository.js";
import { HttpError } from "../utils/http.js";

type NormalizedStatKey =
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

type NormalizedStats = Record<NormalizedStatKey, number>;

const emptyStats = (): NormalizedStats => ({
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

const statLabels: Record<NormalizedStatKey, string> = {
  health: "PV",
  mana: "Mana",
  attackDamage: "AD",
  abilityPower: "AP",
  attackSpeed: "AS",
  critChance: "Crit",
  armorPen: "Pen. armure",
  lethality: "Lethalite",
  magicPen: "Pen. magique",
  abilityHaste: "Hate",
  armor: "Armure",
  magicResist: "RM",
  moveSpeed: "Vitesse",
  healthRegen: "Regen. PV",
  manaRegen: "Regen. mana",
};

const profileLabels = {
  burst: "Burst",
  sustainedDps: "DPS soutenu",
  antiFrontline: "Anti-frontline",
  antiSquishy: "Anti-squishy",
  survivability: "Survie",
};

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toPercentValue(value: number) {
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function normalizeItemStats(item: { stats: Prisma.JsonValue }) {
  const raw = item.stats as Record<string, unknown>;
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
}

function scoreProfiles(stats: NormalizedStats) {
  const softCap = (raw: number, pivot: number) => Math.round((raw / (raw + pivot)) * 100);
  const burstRaw =
    stats.attackDamage * 0.4 +
    stats.abilityPower * 0.5 +
    stats.lethality * 3.5 +
    stats.magicPen * 2.8 +
    stats.critChance * 0.8 +
    stats.abilityHaste * 0.2;
  const sustainedRaw =
    stats.attackDamage * 0.3 +
    stats.abilityPower * 0.18 +
    stats.attackSpeed * 24 +
    stats.critChance * 0.9 +
    stats.abilityHaste * 0.28;
  const antiFrontRaw =
    stats.armorPen * 2.4 +
    stats.magicPen * 2.2 +
    stats.attackSpeed * 12 +
    stats.abilityHaste * 0.25;
  const antiSquishyRaw =
    burstRaw * 0.68 +
    stats.moveSpeed * 0.06 +
    stats.lethality * 2;
  const survivalRaw =
    stats.health * 0.026 +
    stats.armor * 0.68 +
    stats.magicResist * 0.68 +
    stats.healthRegen * 0.32;

  return {
    burst: softCap(burstRaw, 170),
    sustainedDps: softCap(sustainedRaw, 145),
    antiFrontline: softCap(antiFrontRaw, 118),
    antiSquishy: softCap(antiSquishyRaw, 132),
    survivability: softCap(survivalRaw, 145),
  };
}

function estimateDamageProfile(stats: NormalizedStats) {
  const critMultiplier = 1 + Math.min(100, Math.max(0, stats.critChance)) * 0.0075;
  const attackSpeedMultiplier = 1 + Math.max(0, stats.attackSpeed) / 100;
  const physicalAccess = 1 + Math.max(0, stats.armorPen) * 0.004 + Math.max(0, stats.lethality) * 0.012;
  const magicAccess = 1 + Math.max(0, stats.magicPen) * 0.01;
  const hasteMultiplier = 1 + Math.max(0, stats.abilityHaste) / 180;

  const physicalBurst = stats.attackDamage * 1.35 * critMultiplier * physicalAccess + stats.lethality * 8;
  const magicBurst = stats.abilityPower * 0.82 * magicAccess + stats.magicPen * 5.5;
  const sustainedDps =
    (stats.attackDamage * attackSpeedMultiplier * critMultiplier * physicalAccess)
    + (stats.abilityPower * 0.22 * hasteMultiplier)
    + stats.abilityHaste * 0.35;
  const frontlineDps =
    sustainedDps
    + stats.armorPen * 2.6
    + stats.magicPen * 2.2
    + stats.attackSpeed * 0.7;
  const effectiveDurability =
    stats.health
    + stats.armor * 13
    + stats.magicResist * 13
    + stats.healthRegen * 4;

  return {
    burstWindow: Math.round(physicalBurst + magicBurst),
    sustainedDps: Math.round(sustainedDps),
    frontlineDps: Math.round(frontlineDps),
    effectiveDurability: Math.round(effectiveDurability),
  };
}

function buildDamageRows(recommendedStats: NormalizedStats, comparedStats: NormalizedStats) {
  const recommendedDamage = estimateDamageProfile(recommendedStats);
  const comparedDamage = estimateDamageProfile(comparedStats);
  const labels: Record<keyof typeof recommendedDamage, { label: string; unit: string; positive: string; negative: string }> = {
    burstWindow: {
      label: "Fenetre burst",
      unit: "pts",
      positive: "meilleur spike immediat",
      negative: "moins de burst brut",
    },
    sustainedDps: {
      label: "DPS potentiel",
      unit: "pts",
      positive: "meilleur rendement en combat long",
      negative: "moins de degats continus",
    },
    frontlineDps: {
      label: "Degats vs frontline",
      unit: "pts",
      positive: "meilleure valeur contre resistances",
      negative: "moins de pression sur cibles epaisses",
    },
    effectiveDurability: {
      label: "Survie effective",
      unit: "pts",
      positive: "meilleure marge defensive",
      negative: "moins de marge defensive",
    },
  };

  return (Object.keys(recommendedDamage) as Array<keyof typeof recommendedDamage>).map((key) => {
    const recommendedValue = recommendedDamage[key];
    const comparedValue = comparedDamage[key];
    const delta = recommendedValue - comparedValue;
    return {
      key,
      label: labels[key].label,
      recommendedValue,
      comparedValue,
      delta,
      unit: labels[key].unit,
      interpretation: Math.abs(delta) < 1 ? "equivalent" : delta > 0 ? labels[key].positive : labels[key].negative,
    };
  });
}

function buildEfficiencyRows(input: {
  recommendedGold: number;
  comparedGold: number;
  damageRows: ReturnType<typeof buildDamageRows>;
  profileDeltaRows: Array<{ key: string; label: string; recommendedValue: number; comparedValue: number; delta: number }>;
}) {
  const recommendedDamageScore = input.damageRows.reduce((sum, row) => sum + Math.max(0, row.recommendedValue), 0);
  const comparedDamageScore = input.damageRows.reduce((sum, row) => sum + Math.max(0, row.comparedValue), 0);
  const recommendedProfileScore = input.profileDeltaRows.reduce((sum, row) => sum + Math.max(0, row.recommendedValue), 0);
  const comparedProfileScore = input.profileDeltaRows.reduce((sum, row) => sum + Math.max(0, row.comparedValue), 0);
  const perThousand = (value: number, gold: number) => Math.round((value / Math.max(1, gold)) * 1000);

  return [
    {
      key: "damage-per-1000g",
      label: "Degats / 1000 or",
      recommendedValue: perThousand(recommendedDamageScore, input.recommendedGold),
      comparedValue: perThousand(comparedDamageScore, input.comparedGold),
      delta: 0,
      unit: "pts",
    },
    {
      key: "profile-per-1000g",
      label: "Profil strategic / 1000 or",
      recommendedValue: perThousand(recommendedProfileScore, input.recommendedGold),
      comparedValue: perThousand(comparedProfileScore, input.comparedGold),
      delta: 0,
      unit: "pts",
    },
  ].map((row) => ({
    ...row,
    delta: row.recommendedValue - row.comparedValue,
  }));
}

function buildStrategicVerdict(input: {
  recommendedItemName: string;
  comparedItemName: string;
  blockedReasons: Array<{ code: string; message: string }>;
  damageRows: ReturnType<typeof buildDamageRows>;
  profileDeltaRows: Array<{ key: string; label: string; recommendedValue: number; comparedValue: number; delta: number }>;
  efficiencyRows: ReturnType<typeof buildEfficiencyRows>;
}) {
  const damageDelta = input.damageRows.reduce((sum, row) => sum + row.delta, 0);
  const profileDelta = input.profileDeltaRows.reduce((sum, row) => sum + row.delta, 0);
  const efficiencyDelta = input.efficiencyRows.reduce((sum, row) => sum + row.delta, 0);
  const blockerPenalty = input.blockedReasons.length > 0 ? 80 : 0;
  const total = damageDelta * 0.55 + profileDelta * 6 + efficiencyDelta * 1.2 + blockerPenalty;
  const winner = Math.abs(total) < 15 ? "tie" : total > 0 ? "recommended" : "compared";
  const confidence = Math.abs(total) >= 90 || input.blockedReasons.length > 0 ? "high" : Math.abs(total) >= 35 ? "medium" : "low";
  const bestDamageRows = [...input.damageRows].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta)).slice(0, 2);
  const bestProfileRows = [...input.profileDeltaRows].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta)).slice(0, 2);
  const reasons = [
    ...bestDamageRows.map((row) => `${row.label}: ${row.delta >= 0 ? "+" : ""}${row.delta} ${row.unit} (${row.interpretation}).`),
    ...bestProfileRows.map((row) => `${row.label}: ${row.delta >= 0 ? "+" : ""}${row.delta} pts de profil.`),
    ...input.blockedReasons.slice(0, 2).map((reason) => reason.message),
  ].slice(0, 5);

  return {
    winner,
    confidence,
    summary:
      winner === "recommended"
        ? `${input.recommendedItemName} est plus coherent ici: meilleur compromis degats reels, profil de fight et contraintes d'achat.`
        : winner === "compared"
          ? `${input.comparedItemName} gagne certains chiffres bruts, mais cette lecture doit etre verifiee contre les contraintes du snapshot.`
          : "Les deux options sont proches: la decision depend surtout du contexte de fight et des contraintes d'achat.",
    reasons,
  };
}

function extractScenarioItemSlugs(currentBuild: unknown) {
  if (!Array.isArray(currentBuild)) {
    return [];
  }

  return currentBuild
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry && typeof entry === "object" && "itemSlug" in entry) {
        return String((entry as Record<string, unknown>).itemSlug ?? "");
      }
      if (entry && typeof entry === "object" && "id" in entry) {
        return String((entry as Record<string, unknown>).id ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

function evaluateCandidateBlockers(input: {
  item: {
    slug: string;
    name: string;
    goldTotal: number;
    riotItemId: number;
    isBoots: boolean;
    stats: Prisma.JsonValue;
    buildsFrom: Prisma.JsonValue;
    fullDescription: string | null;
    patch: string;
  };
  currentItems: Array<{
    slug: string;
    riotItemId: number;
    isBoots: boolean;
    stats: Prisma.JsonValue;
    buildsFrom: Prisma.JsonValue;
    fullDescription: string | null;
    name: string;
    patch: string;
  }>;
  role: string | null;
  patch: string;
  availableGold: number;
}) {
  const reasons: Array<{ code: string; message: string }> = [];

  if (input.currentItems.some((entry) => entry.slug === input.item.slug)) {
    reasons.push({ code: "duplicate-item", message: "Item deja present dans l'inventaire du snapshot." });
  }

  if (input.item.goldTotal > input.availableGold) {
    reasons.push({ code: "budget-exceeded", message: "Cout superieur a l'or disponible dans l'enonce." });
  }

  const restrictionDecision = getItemRestrictionDecision(input.item.slug, {
    patch: input.patch,
    role: input.role,
  });
  for (const reason of restrictionDecision.reasons) {
    reasons.push({
      code: reason,
      message: reason === "role-restricted" ? "Item restreint pour ce role." : "Item restreint pour ce patch.",
    });
  }

  const itemGroups = new Set(getItemGroups(input.item));
  const conflictingItem = input.currentItems.find((entry) => {
    const otherGroups = getItemGroups(entry);
    return otherGroups.some((group) => itemGroups.has(group));
  });
  if (conflictingItem) {
    reasons.push({
      code: "exclusive-group",
      message: `${conflictingItem.name} occupe deja une famille d'item incompatible.`,
    });
  }

  if (input.item.isBoots && input.currentItems.some((entry) => entry.isBoots)) {
    reasons.push({
      code: "boots-conflict",
      message: "Le build du snapshot possede deja des bottes.",
    });
  }

  return reasons;
}

function buildCacheKey(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => String(part ?? "")).join("::");
}

export const itemExplanationService = {
  async buildExplanation(input: {
    puzzleSlug: string;
    selectedChoiceId?: string;
    comparedItemSlug?: string;
    currentUserId?: string | null;
  }) {
    const puzzle = await puzzleRepository.findBySlug(input.puzzleSlug);
    if (!puzzle) {
      throw new HttpError(404, "Puzzle introuvable.");
    }
    if (!puzzle.isPublished && !input.currentUserId) {
      throw new HttpError(403, "La preuve item n'est disponible que pour les puzzles publies.");
    }
    if (!puzzle.scenario || !puzzle.scenario.playerChampion) {
      throw new HttpError(400, "Ce puzzle ne contient pas de scenario exploitable.");
    }

    const recommendedChoice = puzzle.choices.find((choice) => choice.isCorrect && choice.item);
    if (!recommendedChoice?.item) {
      throw new HttpError(400, "Ce puzzle ne contient pas de bonne reponse item exploitable.");
    }

    const selectedChoice = input.selectedChoiceId
      ? puzzle.choices.find((choice) => choice.id === input.selectedChoiceId)
      : null;
    const fallbackWrongChoice = puzzle.choices.find((choice) => !choice.isCorrect && choice.item);
    const comparedSlug = input.comparedItemSlug ?? selectedChoice?.item?.slug ?? fallbackWrongChoice?.item?.slug;
    if (!comparedSlug) {
      throw new HttpError(400, "Impossible de trouver un item de comparaison.");
    }

    const currentBuildSlugs = extractScenarioItemSlugs(puzzle.scenario.currentBuild);
    const [currentItems, comparedItem] = await Promise.all([
      prisma.item.findMany({
        where: { slug: { in: currentBuildSlugs } },
      }),
      prisma.item.findUnique({
        where: { slug: comparedSlug },
      }),
    ]);
    if (!comparedItem) {
      throw new HttpError(404, "Item de comparaison introuvable.");
    }

    const availableGold = puzzle.scenario.playerGold ?? 0;
    const cacheKey = buildCacheKey([
      "v2",
      puzzle.id,
      recommendedChoice.item.slug,
      comparedItem.slug,
      puzzle.scenario.playerLevel ?? 0,
      availableGold,
      currentBuildSlugs.sort().join("|"),
    ]);
    const cached = await importedMatchArchiveRepository.getCachedItemExplanation(cacheKey);
    if (cached?.payload) {
      return {
        ...(cached.payload as Record<string, unknown>),
        cacheHit: true,
      };
    }

    const patch = puzzle.patch;
    const role = puzzle.role ?? null;
    const alternativePool = await prisma.item.findMany({
      where: {
        patch,
        isActive: true,
        isConsumable: false,
        isStarter: false,
        isTrinket: false,
        goldTotal: {
          lte: Math.max(availableGold, recommendedChoice.item.goldTotal),
        },
      },
      orderBy: [{ goldTotal: "asc" }, { name: "asc" }],
      take: 120,
    });

    const comparedBlockedReasons = evaluateCandidateBlockers({
      item: comparedItem,
      currentItems,
      role,
      patch,
      availableGold,
    });
    const alternatives = alternativePool.map((item) => ({
      item,
      blockedReasons: evaluateCandidateBlockers({
        item,
        currentItems,
        role,
        patch,
        availableGold,
      }),
    }));

    const recommendedStats = normalizeItemStats(recommendedChoice.item);
    const comparedStats = normalizeItemStats(comparedItem);
    const recommendedProfiles = scoreProfiles(recommendedStats);
    const comparedProfiles = scoreProfiles(comparedStats);

    const statRows = (Object.keys(recommendedStats) as Array<keyof typeof recommendedStats>)
      .map((key) => ({
        key,
        label: statLabels[key],
        recommendedValue: recommendedStats[key],
        comparedValue: comparedStats[key],
        delta: Number((recommendedStats[key] - comparedStats[key]).toFixed(2)),
      }))
      .filter((row) => Math.abs(row.recommendedValue) > 0.01 || Math.abs(row.comparedValue) > 0.01)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

    const profileDeltaRows = (Object.keys(recommendedProfiles) as Array<keyof typeof recommendedProfiles>).map((key) => ({
      key,
      label: profileLabels[key],
      recommendedValue: recommendedProfiles[key],
      comparedValue: comparedProfiles[key],
      delta: recommendedProfiles[key] - comparedProfiles[key],
    }));
    const damageRows = buildDamageRows(recommendedStats, comparedStats);
    const efficiencyRows = buildEfficiencyRows({
      recommendedGold: recommendedChoice.item.goldTotal,
      comparedGold: comparedItem.goldTotal,
      damageRows,
      profileDeltaRows,
    });
    const strategicVerdict = buildStrategicVerdict({
      recommendedItemName: recommendedChoice.item.name,
      comparedItemName: comparedItem.name,
      blockedReasons: comparedBlockedReasons,
      damageRows,
      profileDeltaRows,
      efficiencyRows,
    });

    const payload = {
      recommendedItem: {
        slug: recommendedChoice.item.slug,
        name: recommendedChoice.item.name,
        goldTotal: recommendedChoice.item.goldTotal,
      },
      comparedItem: {
        slug: comparedItem.slug,
        name: comparedItem.name,
        goldTotal: comparedItem.goldTotal,
      },
      availableAlternatives: alternatives
        .filter((entry) => entry.blockedReasons.length === 0)
        .slice(0, 24)
        .map((entry) => ({
          slug: entry.item.slug,
          name: entry.item.name,
          goldTotal: entry.item.goldTotal,
        })),
      budgetEligibleAlternatives: alternatives
        .filter((entry) => entry.item.goldTotal <= availableGold)
        .slice(0, 24)
        .map((entry) => ({
          slug: entry.item.slug,
          name: entry.item.name,
          goldTotal: entry.item.goldTotal,
          blockedReasons: entry.blockedReasons,
        })),
      blockedReasons: comparedBlockedReasons,
      statRows,
      profileDeltaRows,
      damageRows,
      efficiencyRows,
      strategicVerdict,
      exportPayload: {
        filename: `item-proof-${puzzle.slug}-${recommendedChoice.item.slug}-vs-${comparedItem.slug}.csv`,
        rows: statRows.map((row) => ({
          type: "stat",
          label: row.label,
          recommended: row.recommendedValue,
          compared: row.comparedValue,
          delta: row.delta,
          unit: "",
          note: "",
        })).concat(
          profileDeltaRows.map((row) => ({
            type: "profile",
            label: row.label,
            recommended: row.recommendedValue,
            compared: row.comparedValue,
            delta: row.delta,
            unit: "pts",
            note: "",
          })),
          damageRows.map((row) => ({
            type: "damage",
            label: row.label,
            recommended: row.recommendedValue,
            compared: row.comparedValue,
            delta: row.delta,
            unit: row.unit,
            note: row.interpretation,
          })),
          efficiencyRows.map((row) => ({
            type: "efficiency",
            label: row.label,
            recommended: row.recommendedValue,
            compared: row.comparedValue,
            delta: row.delta,
            unit: row.unit,
            note: "",
          })),
        ),
      },
      cacheHit: false,
      puzzleContext: {
        slug: puzzle.slug,
        sourceType: puzzle.sourceType === PuzzleSourceType.AI_GENERATED ? "ai_generated" : "standard",
        role,
        patch,
        level: puzzle.scenario.playerLevel,
        goldAvailable: availableGold,
        currentBuildSlugs,
      },
    };

    await importedMatchArchiveRepository.cacheItemExplanation(cacheKey, payload as Prisma.InputJsonValue);
    return payload;
  },
};
