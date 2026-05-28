import { readFileSync } from "node:fs";
import path from "node:path";

export type ItemRestrictionReason = "role-restricted" | "patch-restricted";

type RestrictionPatchEntry = {
  patch: string;
  globalBlacklist?: string[];
  roleRestrictions?: Record<string, string[]>;
  roleAllowlistOverrides?: Record<string, string[]>;
};

type RestrictionConfig = {
  version: number;
  patches: RestrictionPatchEntry[];
};

type RestrictionContext = {
  patch: string;
  role?: string | null;
};

type RestrictionDecision = {
  allowed: boolean;
  reasons: ItemRestrictionReason[];
};

const configPath = path.resolve(process.cwd(), "ml", "configs", "item_restrictions.json");

let cachedConfig: RestrictionConfig | null = null;

function normalizePatchFamily(patch: string) {
  const trimmed = String(patch ?? "").trim();
  if (!trimmed) {
    return "unknown";
  }

  const segments = trimmed.split(".");
  return segments.length >= 2 ? `${segments[0]}.${segments[1]}` : trimmed;
}

function normalizeRole(role?: string | null) {
  const normalized = String(role ?? "").trim().toUpperCase();
  return normalized || null;
}

function normalizeSlugs(values: string[] | undefined) {
  return new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean));
}

function loadRestrictionConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as RestrictionConfig;
  cachedConfig = parsed;
  return parsed;
}

function resolvePatchEntry(patch: string) {
  const patchFamily = normalizePatchFamily(patch);
  return loadRestrictionConfig().patches.find((entry) => normalizePatchFamily(entry.patch) === patchFamily) ?? null;
}

export function getItemRestrictionDecision(itemSlug: string, context: RestrictionContext): RestrictionDecision {
  const entry = resolvePatchEntry(context.patch);
  if (!entry) {
    return { allowed: true, reasons: [] };
  }

  const normalizedSlug = String(itemSlug ?? "").trim();
  const role = normalizeRole(context.role);
  const allowlist = role ? normalizeSlugs(entry.roleAllowlistOverrides?.[role]) : new Set<string>();
  if (allowlist.has(normalizedSlug)) {
    return { allowed: true, reasons: [] };
  }

  const reasons: ItemRestrictionReason[] = [];
  if (normalizeSlugs(entry.globalBlacklist).has(normalizedSlug)) {
    reasons.push("patch-restricted");
  }
  if (role && normalizeSlugs(entry.roleRestrictions?.[role]).has(normalizedSlug)) {
    reasons.push("role-restricted");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function filterRestrictedItems<T extends { slug: string }>(
  items: T[],
  context: RestrictionContext,
) {
  const allowedItems: T[] = [];
  const rejectedItems: Array<{ item: T; reasons: ItemRestrictionReason[] }> = [];

  for (const item of items) {
    const decision = getItemRestrictionDecision(item.slug, context);
    if (decision.allowed) {
      allowedItems.push(item);
      continue;
    }

    rejectedItems.push({ item, reasons: decision.reasons });
  }

  return { allowedItems, rejectedItems };
}

export function clearItemRestrictionConfigCache() {
  cachedConfig = null;
}
