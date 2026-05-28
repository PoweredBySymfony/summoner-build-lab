import type { MlChoiceItem } from "./puzzleChoiceResolution.js";

export type MlCandidateRuleReason = "role-restricted" | "exclusive-group";

type CandidateRuleContext = {
  role?: string | null;
  catalog: MlChoiceItem[];
  ownedItems?: MlChoiceItem[];
};

const BASIC_BOOTS_RIOT_ITEM_ID = 1001;

const normalizeRole = (value?: string | null) => String(value ?? "").trim().toUpperCase();
const normalizeGroupKey = (value: string) => value.trim().toLowerCase();

const toRiotItemId = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function buildIndexes(catalog: MlChoiceItem[]) {
  return {
    byId: new Map(catalog.map((item) => [item.id, item])),
    bySlug: new Map(catalog.map((item) => [item.slug, item])),
    byRiotItemId: new Map(catalog.map((item) => [item.riotItemId, item])),
  };
}

function resolveUpgradeFromItems(item: MlChoiceItem, catalog: MlChoiceItem[]) {
  const indexes = buildIndexes(catalog);
  return item.buildsFrom
    .map(toRiotItemId)
    .filter((value): value is number => value !== null)
    .map((riotItemId) => indexes.byRiotItemId.get(riotItemId) ?? null)
    .filter((entry): entry is MlChoiceItem => Boolean(entry));
}

function getItemClass(item: MlChoiceItem, catalog: MlChoiceItem[]) {
  const upgradeFromItems = resolveUpgradeFromItems(item, catalog);
  const derivesFromBoots = item.isBoots || upgradeFromItems.some((entry) => entry.isBoots || getItemClass(entry, catalog) !== "standard");
  if (!derivesFromBoots) {
    return "standard";
  }

  const buildsFromBasicBoots = item.buildsFrom.some((entry) => toRiotItemId(entry) === BASIC_BOOTS_RIOT_ITEM_ID);
  const upgradesBootsItem = upgradeFromItems.some((entry) => getItemClass(entry, catalog) !== "standard" && entry.riotItemId !== BASIC_BOOTS_RIOT_ITEM_ID);

  if (upgradesBootsItem) {
    return "tier3-boots";
  }
  if (buildsFromBasicBoots) {
    return "tier2-boots";
  }
  return "boots";
}

function getExclusiveGroups(item: MlChoiceItem) {
  const groups = new Set(item.itemGroups.map(normalizeGroupKey));
  if (item.isBoots || groups.has("boots")) {
    groups.add("boots");
  }
  return groups;
}

export function sharesExclusiveGroup(left: MlChoiceItem, right: MlChoiceItem) {
  const leftGroups = getExclusiveGroups(left);
  const rightGroups = getExclusiveGroups(right);
  for (const group of leftGroups) {
    if (rightGroups.has(group)) {
      return true;
    }
  }
  return false;
}

export function getMlCandidateRuleDecision(
  item: MlChoiceItem,
  context: CandidateRuleContext,
) {
  const reasons: MlCandidateRuleReason[] = [];
  const normalizedRole = normalizeRole(context.role);

  if (getItemClass(item, context.catalog) === "tier3-boots" && normalizedRole && normalizedRole !== "MID") {
    reasons.push("role-restricted");
  }

  if ((context.ownedItems ?? []).some((ownedItem) => sharesExclusiveGroup(item, ownedItem))) {
    reasons.push("exclusive-group");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function filterMlCandidateRules(items: MlChoiceItem[], context: CandidateRuleContext) {
  const allowedItems: MlChoiceItem[] = [];
  const rejectedItems: Array<{ item: MlChoiceItem; reasons: MlCandidateRuleReason[] }> = [];

  for (const item of items) {
    const decision = getMlCandidateRuleDecision(item, context);
    if (decision.allowed) {
      allowedItems.push(item);
      continue;
    }
    rejectedItems.push({ item, reasons: decision.reasons });
  }

  return {
    allowedItems,
    rejectedItems,
  };
}
