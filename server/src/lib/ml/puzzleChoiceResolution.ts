import { getItemRestrictionDecision, type ItemRestrictionReason } from "../itemRestrictions.js";
import { resolveItemSlug } from "../itemSlugAliases.js";
import { slugify } from "../slug.js";
import { getMlCandidateRuleDecision, sharesExclusiveGroup } from "./itemCandidateRules.js";

export type MlChoiceItem = {
  id: string;
  slug: string;
  name: string;
  riotItemId: number;
  goldTotal: number;
  patch: string;
  category: string | null;
  tags: string[];
  isBoots: boolean;
  isLegendary: boolean;
  isConsumable: boolean;
  isStarter: boolean;
  isTrinket: boolean;
  isActive: boolean;
  buildsFrom: string[];
  itemGroups: string[];
};

export type MlChoiceResolutionInput = {
  patch: string;
  role?: string | null;
  currentItemSlugs: string[];
  goodAnswer: string | null;
  distractors: string[];
  rankedItemSlugs?: string[];
  availableItems: MlChoiceItem[];
  fallbackItems: MlChoiceItem[];
};

export type MlChoiceResolutionResult = {
  goodAnswer: MlChoiceItem;
  distractors: MlChoiceItem[];
  resolvedItems: MlChoiceItem[];
  unresolvedItems: string[];
  fallbackItemsUsed: string[];
  duplicateInputs: string[];
  restrictedItems: Array<{ input: string; reasons: ItemRestrictionReason[] }>;
};

function normalizePatchPrefix(patch: string) {
  return `${patch.trim()}.`;
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => String(tag)).filter(Boolean))];
}

function normalizeMlItemRef(value: string) {
  const raw = String(value ?? "").trim();
  const aliasSlug = resolveItemSlug(raw);
  const canonicalSlug = slugify(aliasSlug);
  const riotItemId = /^\d+$/.test(raw) ? Number(raw) : null;
  return {
    raw,
    aliasSlug,
    canonicalSlug,
    riotItemId,
  };
}

export function resolveMlChoiceItemRef(
  rawValue: string | null | undefined,
  availableItems: MlChoiceItem[],
) {
  if (!rawValue) {
    return null;
  }

  const availableBySlug = new Map(availableItems.map((item) => [item.slug, item]));
  const availableByRiotId = new Map(availableItems.map((item) => [item.riotItemId, item]));
  const ref = normalizeMlItemRef(rawValue);
  if (!ref.raw) {
    return null;
  }

  if (ref.riotItemId && availableByRiotId.has(ref.riotItemId)) {
    return availableByRiotId.get(ref.riotItemId) ?? null;
  }

  return availableBySlug.get(ref.aliasSlug) ?? availableBySlug.get(ref.canonicalSlug) ?? null;
}

function scoreFallbackItem(
  item: MlChoiceItem,
  reference: MlChoiceItem,
  patch: string,
) {
  let score = 0;
  if (item.patch === patch || item.patch.startsWith(normalizePatchPrefix(patch))) {
    score += 50;
  }
  if (item.category && item.category === reference.category) {
    score += 20;
  }
  if (item.isBoots === reference.isBoots) {
    score += 10;
  }
  if (item.isLegendary === reference.isLegendary) {
    score += 5;
  }
  const sharedTags = item.tags.filter((tag) => reference.tags.includes(tag)).length;
  score += sharedTags * 3;
  return score;
}

export function resolveMlPuzzleChoices(input: MlChoiceResolutionInput): MlChoiceResolutionResult {
  const seenInputKeys = new Set<string>();
  const duplicateInputs: string[] = [];

  const resolveItem = (rawValue: string) => {
    const ref = normalizeMlItemRef(rawValue);
    if (!ref.raw) {
      return null;
    }

    const key = ref.riotItemId ? `riot:${ref.riotItemId}` : `slug:${ref.canonicalSlug}`;
    if (seenInputKeys.has(key)) {
      duplicateInputs.push(ref.raw);
    } else {
      seenInputKeys.add(key);
    }

    return resolveMlChoiceItemRef(rawValue, input.availableItems);
  };

  const unresolvedItems: string[] = [];
  const restrictedItems: Array<{ input: string; reasons: ItemRestrictionReason[] }> = [];
  const restrictedKeys = new Set<string>();
  const recordRestrictedItem = (value: string, reasons: ItemRestrictionReason[]) => {
    const key = `${value}::${reasons.join(",")}`;
    if (restrictedKeys.has(key)) {
      return;
    }
    restrictedKeys.add(key);
    restrictedItems.push({ input: value, reasons });
  };
  const goodAnswer = input.goodAnswer ? resolveItem(input.goodAnswer) : null;
  if (!goodAnswer) {
    if (input.goodAnswer) {
      unresolvedItems.push(input.goodAnswer);
    }
    throw new Error("good-answer-unresolved");
  }
  const goodAnswerRestriction = getItemRestrictionDecision(goodAnswer.slug, {
    patch: input.patch,
    role: input.role,
  });
  if (!goodAnswerRestriction.allowed) {
    recordRestrictedItem(input.goodAnswer ?? goodAnswer.slug, goodAnswerRestriction.reasons);
    throw new Error(`good-answer-${goodAnswerRestriction.reasons.join("+")}`);
  }
  const catalog = input.availableItems;
  const availableBySlug = new Map(catalog.map((item) => [item.slug, item]));
  const ownedItems = input.currentItemSlugs
    .map((slug) => availableBySlug.get(resolveItemSlug(slug)) ?? null)
    .filter((item): item is MlChoiceItem => Boolean(item));
  const goodAnswerRuleDecision = getMlCandidateRuleDecision(goodAnswer, {
    role: input.role,
    catalog,
    ownedItems,
  });
  if (!goodAnswerRuleDecision.allowed) {
    throw new Error(`good-answer-${goodAnswerRuleDecision.reasons.join("+")}`);
  }

  const currentItems = new Set(input.currentItemSlugs.map((slug) => resolveItemSlug(slug)));
  const resolvedDistractors: MlChoiceItem[] = [];
  const usedIds = new Set<string>([goodAnswer.id]);
  const distractorCandidates = [
    ...input.distractors,
    ...(input.rankedItemSlugs ?? []),
  ];

  for (const rawValue of distractorCandidates) {
    const item = resolveItem(rawValue);
    if (!item) {
      if (String(rawValue).trim()) {
        unresolvedItems.push(String(rawValue));
      }
      continue;
    }
    if (usedIds.has(item.id)) {
      duplicateInputs.push(String(rawValue));
      continue;
    }
    const restrictionDecision = getItemRestrictionDecision(item.slug, {
      patch: input.patch,
      role: input.role,
    });
    if (!restrictionDecision.allowed) {
      recordRestrictedItem(String(rawValue), restrictionDecision.reasons);
      continue;
    }
    const candidateRuleDecision = getMlCandidateRuleDecision(item, {
      role: input.role,
      catalog,
      ownedItems,
    });
    if (!candidateRuleDecision.allowed) {
      continue;
    }
    if (sharesExclusiveGroup(item, goodAnswer) || resolvedDistractors.some((entry) => sharesExclusiveGroup(item, entry))) {
      continue;
    }
    usedIds.add(item.id);
    resolvedDistractors.push(item);
    if (resolvedDistractors.length >= 3) {
      break;
    }
  }

  const fallbackItemsUsed: string[] = [];
  if (resolvedDistractors.length < 3) {
    const fallbackCandidates = input.fallbackItems
      .filter((item) => item.isActive)
      .filter((item) => !item.isConsumable && !item.isStarter && !item.isTrinket)
      .filter((item) => !currentItems.has(item.slug))
      .filter((item) => !usedIds.has(item.id))
      .filter((item) => {
        const restrictionDecision = getItemRestrictionDecision(item.slug, {
          patch: input.patch,
          role: input.role,
        });
        if (!restrictionDecision.allowed) {
          recordRestrictedItem(item.slug, restrictionDecision.reasons);
          return false;
        }
        return true;
      })
      .filter((item) => getMlCandidateRuleDecision(item, {
        role: input.role,
        catalog,
        ownedItems,
      }).allowed)
      .filter((item) => !sharesExclusiveGroup(item, goodAnswer))
      .sort((left, right) => {
        const scoreDiff = scoreFallbackItem(right, goodAnswer, input.patch) - scoreFallbackItem(left, goodAnswer, input.patch);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return left.slug.localeCompare(right.slug);
      });

    for (const item of fallbackCandidates) {
      if (resolvedDistractors.some((entry) => sharesExclusiveGroup(item, entry))) {
        continue;
      }
      usedIds.add(item.id);
      resolvedDistractors.push(item);
      fallbackItemsUsed.push(item.slug);
      if (resolvedDistractors.length >= 3) {
        break;
      }
    }
  }

  if (resolvedDistractors.length < 3) {
    throw new Error("insufficient-distractors");
  }

  return {
    goodAnswer,
    distractors: resolvedDistractors.slice(0, 3),
    resolvedItems: [goodAnswer, ...resolvedDistractors.slice(0, 3)],
    unresolvedItems,
    fallbackItemsUsed,
    duplicateInputs: [...new Set(duplicateInputs)],
    restrictedItems,
  };
}

export function toChoiceDebugPayload(result: MlChoiceResolutionResult) {
  return {
    goodAnswer: result.goodAnswer.slug,
    distractors: result.distractors.map((item) => item.slug),
    resolvedItems: result.resolvedItems.map((item) => ({
      slug: item.slug,
      riotItemId: item.riotItemId,
      patch: item.patch,
    })),
    unresolvedItems: result.unresolvedItems,
    fallbackItemsUsed: result.fallbackItemsUsed,
    duplicateInputs: result.duplicateInputs,
    restrictedItems: result.restrictedItems,
  };
}
