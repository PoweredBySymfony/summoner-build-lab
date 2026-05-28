const CANONICAL_SEASON_2026_START = Date.parse("2026-01-01T00:00:00.000Z");

export type PatchFormat = "year_patch" | "legacy_patch" | "unknown";
export type PatchBucket = "exact_target_patch" | "adjacent_recent_patch" | "out_of_target_patch";

export type CanonicalPatchResult = {
  patchCanonical: string | null;
  patchFormat: PatchFormat;
};

function normalizeDateInput(value?: Date | string | number | null) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function parsePatchComponents(patchRaw?: string | null) {
  const normalized = String(patchRaw ?? "").trim();
  const match = normalized.match(/^(\d{1,2})\.(\d{1,2})/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
  };
}

export function canonicalizePatch(
  patchRaw?: string | null,
  gameCreationAt?: Date | string | number | null,
): CanonicalPatchResult {
  const parsed = parsePatchComponents(patchRaw);
  if (!parsed) {
    return {
      patchCanonical: null,
      patchFormat: "unknown",
    };
  }

  const gameDate = normalizeDateInput(gameCreationAt);
  if (parsed.major >= 20 && parsed.major <= 29) {
    return {
      patchCanonical: `${parsed.major}.${parsed.minor}`,
      patchFormat: "year_patch",
    };
  }

  if (parsed.major >= 10 && parsed.major <= 19) {
    const shouldConvert = Boolean(gameDate && gameDate.getTime() >= CANONICAL_SEASON_2026_START);
    return {
      patchCanonical: `${shouldConvert ? parsed.major + 10 : parsed.major}.${parsed.minor}`,
      patchFormat: "legacy_patch",
    };
  }

  return {
    patchCanonical: `${parsed.major}.${parsed.minor}`,
    patchFormat: "unknown",
  };
}

export function classifyPatchBucket(
  patchCanonical: string | null,
  preferredPatchPrefixes: string[],
  adjacentPatchPrefixes: string[],
): PatchBucket {
  if (!patchCanonical) {
    return "out_of_target_patch";
  }
  if (preferredPatchPrefixes.some((prefix) => patchCanonical.startsWith(prefix))) {
    return "exact_target_patch";
  }
  if (adjacentPatchPrefixes.some((prefix) => patchCanonical.startsWith(prefix))) {
    return "adjacent_recent_patch";
  }
  return "out_of_target_patch";
}

export function buildPatchLookupCandidates(
  patchCanonical?: string | null,
  patchFormat?: PatchFormat,
) {
  if (!patchCanonical) {
    return [];
  }

  const values = new Set<string>([patchCanonical]);
  const match = patchCanonical.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (match) {
    const major = Number(match[1]);
    const minor = Number(match[2]);
    if (major >= 20 && major <= 29) {
      values.add(`${major - 10}.${minor}`);
    }
  }

  return [...values];
}
