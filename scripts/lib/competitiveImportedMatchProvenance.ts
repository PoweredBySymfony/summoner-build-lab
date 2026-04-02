import { access } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

export const COMPETITIVE_SOURCE_KINDS = ["PRO_SEED", "ELITE_SEED", "FALLBACK_SEED"] as const;

export type CompetitiveSourceTier = "pro" | "elite" | "fallback" | "unknown";

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sourceTierFromSourceKind(sourceKind: string | null | undefined): CompetitiveSourceTier {
  switch (sourceKind) {
    case "PRO_SEED":
      return "pro";
    case "ELITE_SEED":
      return "elite";
    case "FALLBACK_SEED":
      return "fallback";
    default:
      return "unknown";
  }
}

export function asCompetitiveSourceMetadata(value: unknown) {
  return isRecord(value) ? value : {};
}

export function getSeedMetadata(value: unknown) {
  const metadata = asCompetitiveSourceMetadata(value);
  return isRecord(metadata.seed) ? metadata.seed : {};
}

export function getIngestionMetadata(value: unknown) {
  const metadata = asCompetitiveSourceMetadata(value);
  return isRecord(metadata.ingestion) ? metadata.ingestion : {};
}

export function inferRegionHintFromLeague(league: string | null | undefined) {
  const normalized = league?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }
  if (
    normalized.includes("world championship")
    || normalized.includes("mid-season invitational")
    || normalized.includes("first stand")
  ) {
    return "International";
  }
  if (normalized.includes("lol champions korea")) {
    return "Korea";
  }
  if (normalized.includes("league of legends pro league")) {
    return "China";
  }
  if (
    normalized.includes("league of legends emea championship")
    || normalized.includes("league of legends european championship")
  ) {
    return "EMEA";
  }
  if (normalized.includes("league of legends championship of the americas")) {
    return "Americas";
  }
  return null;
}

function normalizeCompetitiveRegionHint(input: {
  region: string | null | undefined;
  league: string | null | undefined;
  sourceRegion: string | null | undefined;
}) {
  const inferredFromLeague = inferRegionHintFromLeague(input.league);
  const normalizedRegion = input.region?.trim() ?? "";
  const lowerRegion = normalizedRegion.toLowerCase();
  const isClusterValue = lowerRegion === "asia" || lowerRegion === "americas" || lowerRegion === "europe" || lowerRegion === "sea";

  if ((!normalizedRegion || isClusterValue) && inferredFromLeague) {
    return inferredFromLeague;
  }
  if (normalizedRegion) {
    return normalizedRegion;
  }
  return input.sourceRegion ?? null;
}

export function extractCompetitiveProvenance(input: {
  sourceKind?: string | null;
  sourceRegion?: string | null;
  sourceMetadata?: unknown;
}) {
  const seed = getSeedMetadata(input.sourceMetadata);
  const fallbackTier = sourceTierFromSourceKind(input.sourceKind ?? null);
  const priorityTier =
    typeof seed.priorityTier === "string" && seed.priorityTier.length > 0
      ? seed.priorityTier
      : fallbackTier;
  const sourceLeague = typeof seed.league === "string" && seed.league.length > 0 ? seed.league : null;
  const sourceRegionHint = normalizeCompetitiveRegionHint({
    region: typeof seed.region === "string" ? seed.region : null,
    league: sourceLeague,
    sourceRegion: input.sourceRegion,
  });
  const sourceUrl = typeof seed.sourceUrl === "string" && seed.sourceUrl.length > 0 ? seed.sourceUrl : null;

  return {
    priorityTier,
    sourceLeague,
    sourceRegionHint,
    sourceUrl,
    hasKnownTier: priorityTier !== "unknown",
  };
}

export function mergeCompetitiveSourceMetadata(input: {
  sourceKind?: string | null;
  sourceRegion?: string | null;
  existingMetadata?: unknown;
  seed?: JsonRecord;
  ingestion?: JsonRecord;
  backfill?: JsonRecord;
}) {
  const existingMetadata = asCompetitiveSourceMetadata(input.existingMetadata);
  const existingSeed = getSeedMetadata(existingMetadata);
  const existingIngestion = getIngestionMetadata(existingMetadata);
  const fallbackTier = sourceTierFromSourceKind(input.sourceKind ?? null);
  const mergedSeed: JsonRecord = {
    ...existingSeed,
    priorityTier:
      input.seed?.priorityTier
      ?? existingSeed.priorityTier
      ?? fallbackTier,
    region:
      input.seed?.region
      ?? existingSeed.region
      ?? input.sourceRegion
      ?? null,
    ...input.seed,
  };

  if (mergedSeed.priorityTier === undefined || mergedSeed.priorityTier === null || mergedSeed.priorityTier === "") {
    mergedSeed.priorityTier = fallbackTier;
  }
  mergedSeed.region = normalizeCompetitiveRegionHint({
    region: typeof mergedSeed.region === "string" ? mergedSeed.region : null,
    league: typeof mergedSeed.league === "string" ? mergedSeed.league : null,
    sourceRegion: input.sourceRegion,
  });

  return {
    ...existingMetadata,
    seed: mergedSeed,
    ingestion: {
      ...existingIngestion,
      ...input.ingestion,
    },
    ...(input.backfill ? { backfill: input.backfill } : {}),
  } as Prisma.InputJsonObject;
}

export async function resolveFirstExistingPath(candidates: string[]) {
  for (const candidate of candidates) {
    const absolutePath = path.resolve(candidate);
    try {
      await access(absolutePath);
      return absolutePath;
    } catch {
      continue;
    }
  }
  return path.resolve(candidates[0] ?? "");
}
