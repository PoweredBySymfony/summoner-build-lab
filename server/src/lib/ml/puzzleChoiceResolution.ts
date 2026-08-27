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
  return [...new Set(tags.map(String).filter(Boolean))];
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

type DistractorResolutionCtx = {
  input: MlChoiceResolutionInput;
  goodAnswer: MlChoiceItem;
  catalog: MlChoiceItem[];
  ownedItems: MlChoiceItem[];
  currentItems: Set<string>;
  usedIds: Set<string>;
  resolvedDistractors: MlChoiceItem[];
  unresolvedItems: string[];
  duplicateInputs: string[];
  restrictedItems: Array<{ input: string; reasons: ItemRestrictionReason[] }>;
  restrictedKeys: Set<string>;
  fallbackItemsUsed: string[];
  seenInputKeys: Set<string>;
};

function resolveTrackedItem(rawValue: string, ctx: DistractorResolutionCtx): MlChoiceItem | null {
  const ref = normalizeMlItemRef(rawValue);
  if (!ref.raw) return null;
  const key = ref.riotItemId ? `riot:${ref.riotItemId}` : `slug:${ref.canonicalSlug}`;
  if (ctx.seenInputKeys.has(key)) {
    ctx.duplicateInputs.push(ref.raw);
  } else {
    ctx.seenInputKeys.add(key);
  }
  return resolveMlChoiceItemRef(rawValue, ctx.input.availableItems);
}

function trackRestrictedItem(value: string, reasons: ItemRestrictionReason[], ctx: DistractorResolutionCtx): void {
  const key = `${value}::${reasons.join(",")}`;
  if (ctx.restrictedKeys.has(key)) return;
  ctx.restrictedKeys.add(key);
  ctx.restrictedItems.push({ input: value, reasons });
}

function fillFromPrimaryDistractors(candidates: string[], ctx: DistractorResolutionCtx): void {
  for (const rawValue of candidates.filter(Boolean)) {
    if (ctx.resolvedDistractors.length >= 3) break;
    const item = resolveTrackedItem(rawValue, ctx);
    if (!item) {
      ctx.unresolvedItems.push(rawValue);
      continue;
    }
    if (ctx.usedIds.has(item.id)) {
      ctx.duplicateInputs.push(rawValue);
      continue;
    }
    const restrictionDecision = getItemRestrictionDecision(item.slug, { patch: ctx.input.patch, role: ctx.input.role });
    if (!restrictionDecision.allowed) {
      trackRestrictedItem(rawValue, restrictionDecision.reasons, ctx);
      continue;
    }
    const ruleDecision = getMlCandidateRuleDecision(item, { role: ctx.input.role, catalog: ctx.catalog, ownedItems: ctx.ownedItems });
    if (!ruleDecision.allowed) continue;
    if (sharesExclusiveGroup(item, ctx.goodAnswer) || ctx.resolvedDistractors.some((e) => sharesExclusiveGroup(item, e))) continue;
    ctx.usedIds.add(item.id);
    ctx.resolvedDistractors.push(item);
  }
}

function fillFromFallbackDistractors(ctx: DistractorResolutionCtx): void {
  const { input, goodAnswer, catalog, ownedItems, currentItems, usedIds, resolvedDistractors } = ctx;
  const fallbackCandidates = input.fallbackItems
    .filter((item) => item.isActive && !item.isConsumable && !item.isStarter && !item.isTrinket)
    .filter((item) => !currentItems.has(item.slug) && !usedIds.has(item.id))
    .filter((item) => {
      const rd = getItemRestrictionDecision(item.slug, { patch: input.patch, role: input.role });
      if (!rd.allowed) { trackRestrictedItem(item.slug, rd.reasons, ctx); return false; }
      return true;
    })
    .filter((item) => getMlCandidateRuleDecision(item, { role: input.role, catalog, ownedItems }).allowed)
    .filter((item) => !sharesExclusiveGroup(item, goodAnswer))
    .sort((l, r) => {
      const diff = scoreFallbackItem(r, goodAnswer, input.patch) - scoreFallbackItem(l, goodAnswer, input.patch);
      return diff === 0 ? l.slug.localeCompare(r.slug) : diff;
    });

  for (const item of fallbackCandidates) {
    if (resolvedDistractors.length >= 3) break;
    if (resolvedDistractors.some((e) => sharesExclusiveGroup(item, e))) continue;
    usedIds.add(item.id);
    resolvedDistractors.push(item);
    ctx.fallbackItemsUsed.push(item.slug);
  }
}

export function resolveMlPuzzleChoices(input: MlChoiceResolutionInput): MlChoiceResolutionResult {
  const catalog = input.availableItems;
  const availableBySlug = new Map(catalog.map((item) => [item.slug, item]));
  const ownedItems = input.currentItemSlugs
    .map((slug) => availableBySlug.get(resolveItemSlug(slug)) ?? null)
    .filter((item): item is MlChoiceItem => !!item);

  const ctx: DistractorResolutionCtx = {
    input,
    goodAnswer: null as unknown as MlChoiceItem,
    catalog,
    ownedItems,
    currentItems: new Set(input.currentItemSlugs.map((slug) => resolveItemSlug(slug))),
    usedIds: new Set<string>(),
    resolvedDistractors: [],
    unresolvedItems: [],
    duplicateInputs: [],
    restrictedItems: [],
    restrictedKeys: new Set<string>(),
    fallbackItemsUsed: [],
    seenInputKeys: new Set<string>(),
  };

  const goodAnswer = input.goodAnswer ? resolveTrackedItem(input.goodAnswer, ctx) : null;
  if (!goodAnswer) {
    if (input.goodAnswer) ctx.unresolvedItems.push(input.goodAnswer);
    throw new Error("good-answer-unresolved");
  }
  ctx.goodAnswer = goodAnswer;
  ctx.usedIds.add(goodAnswer.id);

  const goodAnswerRestriction = getItemRestrictionDecision(goodAnswer.slug, { patch: input.patch, role: input.role });
  if (!goodAnswerRestriction.allowed) {
    trackRestrictedItem(input.goodAnswer ?? goodAnswer.slug, goodAnswerRestriction.reasons, ctx);
    throw new Error(`good-answer-${goodAnswerRestriction.reasons.join("+")}`);
  }
  const goodAnswerRuleDecision = getMlCandidateRuleDecision(goodAnswer, { role: input.role, catalog, ownedItems });
  if (!goodAnswerRuleDecision.allowed) {
    throw new Error(`good-answer-${goodAnswerRuleDecision.reasons.join("+")}`);
  }

  const distractorCandidates = [...input.distractors, ...(input.rankedItemSlugs ?? [])];
  fillFromPrimaryDistractors(distractorCandidates, ctx);
  if (ctx.resolvedDistractors.length < 3) {
    fillFromFallbackDistractors(ctx);
  }

  if (ctx.resolvedDistractors.length < 3) {
    throw new Error("insufficient-distractors");
  }

  return {
    goodAnswer,
    distractors: ctx.resolvedDistractors.slice(0, 3),
    resolvedItems: [goodAnswer, ...ctx.resolvedDistractors.slice(0, 3)],
    unresolvedItems: ctx.unresolvedItems,
    fallbackItemsUsed: ctx.fallbackItemsUsed,
    duplicateInputs: [...new Set(ctx.duplicateInputs)],
    restrictedItems: ctx.restrictedItems,
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
