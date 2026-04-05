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
      exportPayload: {
        filename: `item-proof-${puzzle.slug}-${recommendedChoice.item.slug}-vs-${comparedItem.slug}.csv`,
        rows: statRows.map((row) => ({
          type: "stat",
          label: row.label,
          recommended: row.recommendedValue,
          compared: row.comparedValue,
          delta: row.delta,
        })).concat(
          profileDeltaRows.map((row) => ({
            type: "profile",
            label: row.label,
            recommended: row.recommendedValue,
            compared: row.comparedValue,
            delta: row.delta,
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
