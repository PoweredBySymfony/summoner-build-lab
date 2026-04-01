import { Role } from "@prisma/client";
import { filterRestrictedItems, type ItemRestrictionReason } from "../itemRestrictions.js";
import { resolveItemSlug } from "../itemSlugAliases.js";
import type { MlPuzzleSnapshot } from "./mlPuzzle.js";
import type { MlChoiceItem } from "./puzzleChoiceResolution.js";
import {
  filterMlCandidateRules,
  getMlCandidateRuleDecision,
  sharesExclusiveGroup,
  type MlCandidateRuleReason,
} from "./itemCandidateRules.js";

type CandidateFilterReason =
  | "incoherent-with-champion"
  | "already-owned"
  | "too-cheap"
  | "too-expensive"
  | "exclusive-group"
  | "role-restricted"
  | "patch-restricted";

type ItemProfile = "physical" | "magic" | "tank" | "support" | "utility" | "boots";

export type MlPuzzleBusinessRulesInput = {
  snapshot: MlPuzzleSnapshot;
  championTags: string[];
  goodAnswer: MlChoiceItem;
  rankedCandidates: MlChoiceItem[];
  availableItems: MlChoiceItem[];
  previousChoiceSignatures: string[];
  variationSeed: string;
};

export type MlPuzzleBusinessRulesResult = {
  distractorCandidates: MlChoiceItem[];
  objectiveState: Record<string, string | number | boolean>;
  damageProfile: Record<string, string>;
  mapState: Record<string, string | number | boolean>;
  notes: string;
  debug: {
    variationSeed: string;
    candidatePoolSizeBefore: number;
    candidatePoolSizeAfterChampion: number;
    candidatePoolSizeAfterGold: number;
    candidatePoolSizeAfterFallback: number;
    filterReasonCounts: Record<CandidateFilterReason, number>;
    restrictedCandidateSamples: Array<{ slug: string; reasons: Array<ItemRestrictionReason | MlCandidateRuleReason> }>;
    allowedProfiles: ItemProfile[];
    goldFilter: {
      minGold: number;
      maxGold: number;
      referenceGold: number;
      applied: boolean;
    };
    preferredSignature: string | null;
    previousSignatureCount: number;
    historyAvoided: boolean;
    selectedDistractors: string[];
    goodAnswerViolations: CandidateFilterReason[];
  };
};

function createSeededRandom(seed: string) {
  let value = 2166136261;
  for (const character of seed) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }

  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: string) {
  const random = createSeededRandom(seed);
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

function uniqueById(items: MlChoiceItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function inferItemProfiles(item: MlChoiceItem) {
  const profiles = new Set<ItemProfile>();
  const category = String(item.category ?? "").trim().toLowerCase();
  const tags = new Set(item.tags.map((tag) => String(tag)));

  if (item.isBoots) {
    profiles.add("boots");
  }
  if (["crit", "onhit", "fighter", "jungle"].includes(category) || tags.has("Damage") || tags.has("CriticalStrike")) {
    profiles.add("physical");
  }
  if (
    ["mage", "mana", "manaregen", "cooldownreduction"].includes(category)
    || tags.has("SpellDamage")
    || tags.has("Mana")
    || tags.has("ManaRegen")
  ) {
    profiles.add("magic");
  }
  if (["tank", "defensive"].includes(category) || tags.has("Armor") || tags.has("SpellBlock") || tags.has("Health")) {
    profiles.add("tank");
  }
  if (category === "utility" || tags.has("ManaRegen")) {
    profiles.add("support");
  }
  if (category === "utility" || tags.has("Active")) {
    profiles.add("utility");
  }
  if (profiles.size === 0) {
    profiles.add("utility");
  }
  return profiles;
}

function inferAllowedProfiles(snapshot: MlPuzzleSnapshot, championTags: string[]) {
  const tags = new Set(championTags.map((tag) => String(tag)));
  const allowed = new Set<ItemProfile>(["boots", "utility"]);

  if (tags.has("Mage") || snapshot.role === Role.MID || snapshot.role === Role.SUPPORT) {
    allowed.add("magic");
  }
  if (
    tags.has("Marksman")
    || tags.has("Fighter")
    || tags.has("Assassin")
    || snapshot.role === Role.ADC
    || snapshot.role === Role.TOP
    || snapshot.role === Role.JUNGLE
  ) {
    allowed.add("physical");
  }
  if (
    tags.has("Tank")
    || tags.has("Support")
    || snapshot.role === Role.TOP
    || snapshot.role === Role.JUNGLE
    || snapshot.role === Role.SUPPORT
  ) {
    allowed.add("tank");
  }
  if (tags.has("Support") || snapshot.role === Role.SUPPORT) {
    allowed.add("support");
  }

  if (snapshot.role === Role.ADC && !tags.has("Mage") && !tags.has("Support")) {
    allowed.delete("magic");
    allowed.delete("support");
  }

  return [...allowed];
}

function isItemCoherent(item: MlChoiceItem, allowedProfiles: ItemProfile[]) {
  const profiles = inferItemProfiles(item);
  return allowedProfiles.some((profile) => profiles.has(profile));
}

function buildGoldWindow(snapshot: MlPuzzleSnapshot, goodAnswer: MlChoiceItem) {
  const applied = snapshot.goldAvailable > 0;
  const referenceGold = applied
    ? Math.max(snapshot.goldAvailable, Math.min(goodAnswer.goldTotal, Math.round(snapshot.goldAvailable * 1.35)))
    : goodAnswer.goldTotal;
  const minGold = applied ? Math.max(900, Math.round(referenceGold * 0.58)) : 0;
  const maxGold = applied ? Math.max(minGold + 600, Math.round(referenceGold * 1.45)) : Number.MAX_SAFE_INTEGER;
  return {
    applied,
    referenceGold,
    minGold,
    maxGold,
  };
}

function scoreCandidate(item: MlChoiceItem, goodAnswer: MlChoiceItem, rankedIndex: Map<string, number>, seed: string) {
  let score = 0;
  const itemProfiles = inferItemProfiles(item);
  const goodProfiles = inferItemProfiles(goodAnswer);

  score += Math.max(0, 50 - (rankedIndex.get(item.slug) ?? 50) * 5);
  if (item.category && item.category === goodAnswer.category) {
    score += 30;
  }
  for (const profile of itemProfiles) {
    if (goodProfiles.has(profile)) {
      score += 10;
    }
  }
  if (item.isLegendary === goodAnswer.isLegendary) {
    score += 6;
  }
  const costGap = Math.abs(item.goldTotal - goodAnswer.goldTotal);
  score += Math.max(0, 25 - Math.floor(costGap / 150));

  const shuffled = shuffleWithSeed([item.slug], `${seed}:${item.slug}`);
  if (shuffled[0] === item.slug) {
    score += 0.001;
  }
  return score;
}

function buildChoiceSignature(goodAnswer: MlChoiceItem, distractors: MlChoiceItem[]) {
  return [goodAnswer.slug, ...distractors.map((item) => item.slug)].sort().join("|");
}

function chooseDistractors(input: {
  goodAnswer: MlChoiceItem;
  candidates: MlChoiceItem[];
  previousChoiceSignatures: string[];
  variationSeed: string;
}) {
  const previousSignatures = new Set(input.previousChoiceSignatures);
  const shuffledCandidates = shuffleWithSeed(input.candidates, input.variationSeed);
  let bestUnused: MlChoiceItem[] | null = null;
  let bestAny: MlChoiceItem[] | null = null;

  for (let first = 0; first < shuffledCandidates.length; first += 1) {
    for (let second = first + 1; second < shuffledCandidates.length; second += 1) {
      for (let third = second + 1; third < shuffledCandidates.length; third += 1) {
        const distractors = [
          shuffledCandidates[first],
          shuffledCandidates[second],
          shuffledCandidates[third],
        ];
        if (
          distractors.some((item) => sharesExclusiveGroup(item, input.goodAnswer))
          || sharesExclusiveGroup(distractors[0], distractors[1])
          || sharesExclusiveGroup(distractors[0], distractors[2])
          || sharesExclusiveGroup(distractors[1], distractors[2])
        ) {
          continue;
        }
        const signature = buildChoiceSignature(input.goodAnswer, distractors);
        if (!bestAny) {
          bestAny = distractors;
        }
        if (!previousSignatures.has(signature)) {
          bestUnused = distractors;
          break;
        }
      }
      if (bestUnused) {
        break;
      }
    }
    if (bestUnused) {
      break;
    }
  }

  const distractors = bestUnused ?? bestAny ?? shuffledCandidates.slice(0, 3);
  return {
    distractors,
    signature: distractors.length === 3 ? buildChoiceSignature(input.goodAnswer, distractors) : null,
    historyAvoided: Boolean(bestUnused),
  };
}

function classifyEnemyDamage(snapshot: MlPuzzleSnapshot) {
  if (snapshot.enemyMagicDamageCount >= snapshot.enemyPhysicalDamageCount + 2) {
    return "majoritairement magique";
  }
  if (snapshot.enemyPhysicalDamageCount >= snapshot.enemyMagicDamageCount + 2) {
    return "majoritairement physique";
  }
  return "mixte";
}

function classifyTempo(snapshot: MlPuzzleSnapshot) {
  if (snapshot.timestampMinutes < 14) {
    return "mid-game naissant";
  }
  if (snapshot.timestampMinutes < 23) {
    return "mid-game contesté";
  }
  return "teamfight d'objectif majeur";
}

function buildPuzzleObjective(snapshot: MlPuzzleSnapshot, championTags: string[], goodAnswer: MlChoiceItem, seed: string) {
  const objective =
    snapshot.timestampMinutes < 14
      ? "sécuriser la prochaine rotation dragon / plaques"
      : snapshot.timestampMinutes < 23
        ? "tenir le prochain fight d'objectif"
        : "convertir un fight Nashor / âme";
  const gameState =
    snapshot.kills + snapshot.assists >= snapshot.deaths + 4
      ? "avantage à convertir"
      : snapshot.deaths >= snapshot.kills + 2
        ? "tempo à stabiliser"
        : "fenêtre encore équilibrée";
  const goldState =
    snapshot.goldAvailable >= 2600
      ? "fenêtre de spike complet"
      : snapshot.goldAvailable >= 1600
        ? "achat intermédiaire décisif"
        : "budget serré";
  const championPlan =
    championTags.includes("Mage")
      ? "conserver une menace magique crédible"
      : championTags.includes("Marksman")
        ? "préserver un DPS front-to-back crédible"
        : championTags.includes("Tank")
          ? "tenir l'entrée et protéger la ligne arrière"
          : "garder un achat cohérent avec le plan du champion";
  const angle = shuffleWithSeed(
    [
      "Évalue le prochain achat le plus crédible pour le fight à venir.",
      "Trouve l'achat qui garde le plan de jeu cohérent sans solution triviale.",
      "La bonne réponse doit rester réaliste pour ce timing et ce profil de champion.",
    ],
    `${seed}:objective-copy`,
  )[0];

  return {
    objectiveState: {
      objectif: objective,
      fenêtre: goldState,
      contexte: gameState,
    },
    damageProfile: {
      planChampion: championPlan,
      profilAdverse: classifyEnemyDamage(snapshot),
    },
    mapState: {
      tempo: classifyTempo(snapshot),
      minute: Math.round(snapshot.timestampMinutes),
      orDisponible: snapshot.goldAvailable,
      itemCible: goodAnswer.name,
    },
    notes: angle,
  };
}

export function buildMlPuzzleBusinessRules(
  input: MlPuzzleBusinessRulesInput,
): MlPuzzleBusinessRulesResult {
  const allowedProfiles = inferAllowedProfiles(input.snapshot, input.championTags);
  const currentItems = new Set(input.snapshot.currentItems.map((slug) => resolveItemSlug(slug)));
  const filterReasonCounts: Record<CandidateFilterReason, number> = {
    "incoherent-with-champion": 0,
    "already-owned": 0,
    "too-cheap": 0,
    "too-expensive": 0,
    "exclusive-group": 0,
    "role-restricted": 0,
    "patch-restricted": 0,
  };
  const restrictedCandidateSamples: Array<{ slug: string; reasons: Array<ItemRestrictionReason | MlCandidateRuleReason> }> = [];
  const goldFilter = buildGoldWindow(input.snapshot, input.goodAnswer);
  const goodAnswerViolations: CandidateFilterReason[] = [];
  const availableBySlug = new Map(input.availableItems.map((item) => [item.slug, item]));
  const ownedItems = input.snapshot.currentItems
    .map((slug) => availableBySlug.get(resolveItemSlug(slug)) ?? null)
    .filter((item): item is MlChoiceItem => Boolean(item));
  const goodAnswerRuleDecision = getMlCandidateRuleDecision(input.goodAnswer, {
    role: input.snapshot.role,
    catalog: input.availableItems,
    ownedItems,
  });
  for (const reason of goodAnswerRuleDecision.reasons) {
    goodAnswerViolations.push(reason);
  }
  if (!isItemCoherent(input.goodAnswer, allowedProfiles)) {
    goodAnswerViolations.push("incoherent-with-champion");
  }
  if (goldFilter.applied && input.goodAnswer.goldTotal < goldFilter.minGold) {
    goodAnswerViolations.push("too-cheap");
  }
  if (goldFilter.applied && input.goodAnswer.goldTotal > goldFilter.maxGold) {
    goodAnswerViolations.push("too-expensive");
  }

  const baseCandidates = uniqueById(
    input.availableItems.filter((item) => item.id !== input.goodAnswer.id),
  );
  const restricted = filterRestrictedItems(baseCandidates, {
    patch: input.snapshot.patch,
    role: input.snapshot.role,
  });
  for (const rejection of restricted.rejectedItems) {
    for (const reason of rejection.reasons) {
      filterReasonCounts[reason] += 1;
    }
    if (restrictedCandidateSamples.length < 20) {
      restrictedCandidateSamples.push({
        slug: rejection.item.slug,
        reasons: rejection.reasons,
      });
    }
  }
  const structural = filterMlCandidateRules(restricted.allowedItems, {
    role: input.snapshot.role,
    catalog: input.availableItems,
    ownedItems,
  });
  for (const rejection of structural.rejectedItems) {
    for (const reason of rejection.reasons) {
      filterReasonCounts[reason] += 1;
    }
    if (restrictedCandidateSamples.length < 20) {
      restrictedCandidateSamples.push({
        slug: rejection.item.slug,
        reasons: rejection.reasons,
      });
    }
  }

  const afterChampion = structural.allowedItems.filter((item) => {
    if (currentItems.has(item.slug)) {
      filterReasonCounts["already-owned"] += 1;
      return false;
    }
    if (!isItemCoherent(item, allowedProfiles)) {
      filterReasonCounts["incoherent-with-champion"] += 1;
      return false;
    }
    return true;
  });

  const afterGold = afterChampion.filter((item) => {
    if (!goldFilter.applied) {
      return true;
    }
    if (item.goldTotal < goldFilter.minGold) {
      filterReasonCounts["too-cheap"] += 1;
      return false;
    }
    if (item.goldTotal > goldFilter.maxGold) {
      filterReasonCounts["too-expensive"] += 1;
      return false;
    }
    return true;
  });

  const rankedIndex = new Map(input.rankedCandidates.map((item, index) => [item.slug, index]));
  const strictCandidates = [...afterGold].sort((left, right) => {
    const scoreDifference =
      scoreCandidate(right, input.goodAnswer, rankedIndex, input.variationSeed)
      - scoreCandidate(left, input.goodAnswer, rankedIndex, input.variationSeed);
    if (scoreDifference !== 0) {
      return scoreDifference;
    }
    return left.slug.localeCompare(right.slug);
  });

  const relaxedFallback = afterChampion
    .filter((item) => !strictCandidates.some((candidate) => candidate.id === item.id))
    .sort((left, right) => {
      const scoreDifference =
        scoreCandidate(right, input.goodAnswer, rankedIndex, `${input.variationSeed}:fallback`)
        - scoreCandidate(left, input.goodAnswer, rankedIndex, `${input.variationSeed}:fallback`);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }
      return left.slug.localeCompare(right.slug);
    });

  const distractorCandidates = uniqueById([...strictCandidates, ...relaxedFallback]).slice(0, 10);
  const selected = chooseDistractors({
    goodAnswer: input.goodAnswer,
    candidates: distractorCandidates,
    previousChoiceSignatures: input.previousChoiceSignatures,
    variationSeed: input.variationSeed,
  });
  const objective = buildPuzzleObjective(
    input.snapshot,
    input.championTags,
    input.goodAnswer,
    input.variationSeed,
  );

  return {
    distractorCandidates,
    objectiveState: objective.objectiveState,
    damageProfile: objective.damageProfile,
    mapState: objective.mapState,
    notes: objective.notes,
    debug: {
      variationSeed: input.variationSeed,
      candidatePoolSizeBefore: baseCandidates.length + 1,
      candidatePoolSizeAfterChampion: afterChampion.length + 1,
      candidatePoolSizeAfterGold: afterGold.length + 1,
      candidatePoolSizeAfterFallback: distractorCandidates.length + 1,
      filterReasonCounts,
      restrictedCandidateSamples,
      allowedProfiles,
      goldFilter,
      preferredSignature: selected.signature,
      previousSignatureCount: input.previousChoiceSignatures.length,
      historyAvoided: selected.historyAvoided,
      selectedDistractors: selected.distractors.map((item) => item.slug),
      goodAnswerViolations,
    },
  };
}

export function buildChoiceSignatureForHistory(
  goodAnswerSlug: string,
  distractorSlugs: string[],
) {
  return [goodAnswerSlug, ...distractorSlugs].sort().join("|");
}

export function shuffleResolvedChoices(
  goodAnswer: MlChoiceItem,
  distractors: MlChoiceItem[],
  variationSeed: string,
) {
  const ordered = shuffleWithSeed(
    [
      { item: goodAnswer, isCorrect: true },
      ...distractors.map((item) => ({ item, isCorrect: false })),
    ],
    `${variationSeed}:choice-order`,
  );
  const correctIndex = ordered.findIndex((entry) => entry.isCorrect);
  if (correctIndex === 0 && ordered.length > 1) {
    [ordered[0], ordered[1]] = [ordered[1], ordered[0]];
  }
  return ordered;
}
