import {
  GeneratedPuzzleRequestStatus,
  GeneratedPuzzleRequestType,
  Prisma,
  PuzzleChoiceType,
  PuzzleDifficulty,
  PuzzleMode,
  PuzzleSourceType,
  Role,
} from "@prisma/client";
import { env } from "../config/env.js";
import { getItemGroups } from "../lib/itemGroups.js";
import {
  buildBackendPuzzleSeed,
  isLowConfidenceDraftAllowed,
  isMlGenerationConfigured,
  mapSnapshotToMlPayload,
  type MlPredictNextItemResponse,
  type MlPuzzleSeed,
  type MlPuzzleSnapshot,
} from "../lib/ml/mlPuzzle.js";
import { getItemRestrictionDecision } from "../lib/itemRestrictions.js";
import { collectTimelineItemIds, reconstructInventoriesAtTimestamp } from "../lib/ml/scenarioInventory.js";
import { buildPatchLookupCandidates, canonicalizePatch, type PatchFormat } from "../lib/riot/patchCanonical.js";
import {
  buildChoiceSignatureForHistory,
  buildMlPuzzleBusinessRules,
  shuffleResolvedChoices,
} from "../lib/ml/puzzleBusinessRules.js";
import {
  resolveMlChoiceItemRef,
  resolveMlPuzzleChoices,
  toChoiceDebugPayload,
  type MlChoiceItem,
} from "../lib/ml/puzzleChoiceResolution.js";
import { resolveItemSlug } from "../lib/itemSlugAliases.js";
import { prisma } from "../lib/prisma.js";
import { importedMatchArchiveRepository } from "../repositories/importedMatchArchiveRepository.js";
import { slugify } from "../lib/slug.js";
import { HttpError } from "../utils/http.js";

type ImportedMatchForMl = Awaited<ReturnType<typeof prisma.importedMatch.findUnique>>;

type ScenarioMember = {
  championSlug: string;
  role: Role | null;
  items: string[];
};

type ScenarioMemberDraft = ScenarioMember & {
  participantId: number;
};

type ScenarioSnapshot = {
  currentBuild: string[];
  allyTeam: ScenarioMember[];
  enemyTeam: ScenarioMember[];
};

type SnapshotCandidate = {
  snapshotIndex: number;
  rawPurchaseIndex: number;
  snapshot: MlPuzzleSnapshot;
  scenario: ScenarioSnapshot;
  relevanceScore: number;
  actualPurchase: {
    itemSlug: string | null;
    goldTotal: number | null;
    burstPurchaseIndex: number;
    timestampMinutes: number;
  };
};

type SnapshotSegment = "early" | "mid" | "late";

type AttemptDebugSummary = {
  snapshotIndex: number;
  snapshotMinute: number;
  patch: string;
  goldAvailable: number;
  snapshotSignature: string;
  rerollDistanceScore?: number;
  rawCandidatePoolSize: number;
  filteredCandidatePoolSize: number;
  goodAnswer: string | null;
  qualityScore: number;
  rejectionReasons: string[];
  lowConfidence: boolean;
  confidenceScore: number;
  confidenceGap: number;
  technicalViable: boolean;
  publishable: boolean;
  publishabilityScore: number;
  publishabilityReasons: string[];
  goodAnswerSource?: "ml-prediction" | "actual-purchase-fallback";
};

type PreparedSnapshotAttempt = {
  status: "accepted";
  technicalViable: true;
  snapshotIndex: number;
  rawPurchaseIndex: number;
  snapshot: MlPuzzleSnapshot;
  scenario: ScenarioSnapshot;
  payload: ReturnType<typeof mapSnapshotToMlPayload>;
  prediction: MlPredictNextItemResponse;
  seed: MlPuzzleSeed;
  resolvedChoices: ReturnType<typeof resolveMlPuzzleChoices>;
  businessRules: ReturnType<typeof buildMlPuzzleBusinessRules>;
  qualityScore: number;
  variationSeed: string;
  choiceSignature: string;
  debugSummary: AttemptDebugSummary;
};

type RejectedSnapshotAttempt = {
  status: "rejected";
  snapshotIndex: number;
  rawPurchaseIndex: number;
  snapshot: MlPuzzleSnapshot;
  payload: ReturnType<typeof mapSnapshotToMlPayload>;
  prediction: MlPredictNextItemResponse | null;
  seed: MlPuzzleSeed | null;
  rejectionReasons: string[];
  debugSummary: AttemptDebugSummary;
  technicalViable: boolean;
  details?: Prisma.InputJsonValue;
};

type SnapshotAttempt = PreparedSnapshotAttempt | RejectedSnapshotAttempt;

type SnapshotHistoryEntry = {
  snapshotIndex: number;
  snapshotMinute: number;
  key: string;
  signature: string;
  createdAt: Date;
};

type SegmentEvaluationSummary = {
  segment: SnapshotSegment;
  totalAccepted: number;
  nonLowConfidenceAccepted: number;
  lowConfidenceAccepted: number;
  selectedSnapshotIndex: number | null;
  selectedSnapshotMinute: number | null;
  selectedQualityScore: number | null;
  selectedFromHistoryFallback: boolean;
};

type SeriesSelectionResult = {
  selectedAttempts: PreparedSnapshotAttempt[];
  primaryAttempt: PreparedSnapshotAttempt | null;
  draft: boolean;
  segmentSummaries: SegmentEvaluationSummary[];
  repetitionExcluded: Array<{
    segment: SnapshotSegment;
    snapshotIndex: number;
    snapshotMinute: number;
    qualityScore: number;
    rerollDistanceScore?: number;
  }>;
};

type MatchGenerationCompletedResponse = {
  generationStatus: "completed";
  requestId: string;
  slug: string;
  slugs: string[];
  sourceType: "ai_generated";
  published: false;
  lowConfidence: boolean;
  draft: boolean;
  message?: string;
};

type MatchGenerationNoViableResponse = {
  generationStatus: "no_viable_snapshot_found" | "no_publishable_snapshot_found";
  failureCode: "no_viable_snapshot_found" | "no_publishable_snapshot_found";
  requestId: string;
  slug: null;
  slugs: [];
  sourceType: "ai_generated";
  published: false;
  lowConfidence: false;
  draft: false;
  retrySuggested: true;
  snapshotsEvaluated: number;
  viableSnapshots: number;
  publishableSnapshots: number;
  nonPublishableButViableSnapshots: number;
  dominantRejectionReasons: string[];
  message: string;
};

export type MatchGenerationResponse =
  | MatchGenerationCompletedResponse
  | MatchGenerationNoViableResponse;

type ResolvedPatchLookup = {
  rawGameVersion: string | null;
  patchCanonical: string | null;
  patchFormat: PatchFormat;
  lookupCandidates: string[];
};

type ItemGoldValue = {
  goldTotal: number;
  goldSell: number;
};

const PHYSICAL_TAGS = new Set(["Marksman", "Assassin", "Fighter"]);
const MAGIC_TAGS = new Set(["Mage", "Support"]);
const FRONTLINE_TAGS = new Set(["Tank", "Fighter"]);
const MIN_SNAPSHOT_MINUTE = 8;
const MAX_SNAPSHOT_MINUTE = 32;
const MAX_SNAPSHOT_CANDIDATES = 12;
const MAX_SNAPSHOT_CANDIDATES_PER_SEGMENT = 4;
const SHOP_BURST_WINDOW_MS = 45_000;
const MIN_MEANINGFUL_PURCHASE_GOLD = 900;
const SNAPSHOT_SEGMENTS: ReadonlyArray<{
  segment: SnapshotSegment;
  minInclusive: number;
  maxExclusive: number;
}> = [
  { segment: "early", minInclusive: 8, maxExclusive: 14 },
  { segment: "mid", minInclusive: 14, maxExclusive: 23 },
  { segment: "late", minInclusive: 23, maxExclusive: 32.01 },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return 0;
}

function normalizeRole(value: unknown): Role | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  switch (normalized) {
    case "TOP":
      return Role.TOP;
    case "JUNGLE":
      return Role.JUNGLE;
    case "MIDDLE":
    case "MID":
      return Role.MID;
    case "BOTTOM":
    case "BOT":
    case "ADC":
    case "CARRY":
      return Role.ADC;
    case "UTILITY":
    case "SUPPORT":
      return Role.SUPPORT;
    default:
      return null;
  }
}

function resolveParticipantRole(participant: Record<string, unknown>) {
  return (
    normalizeRole(participant.teamPosition) ??
    normalizeRole(participant.individualPosition) ??
    normalizeRole(participant.role) ??
    normalizeRole(participant.lane)
  );
}

function removeItemOnce(items: number[], itemId: number) {
  const index = items.indexOf(itemId);
  if (index >= 0) {
    items.splice(index, 1);
  }
}

function buildChampionProfile(tags: string[]) {
  return {
    frontline: Number(tags.some((tag) => FRONTLINE_TAGS.has(tag))),
    physical: Number(tags.some((tag) => PHYSICAL_TAGS.has(tag))),
    magic: Number(tags.some((tag) => MAGIC_TAGS.has(tag))),
    support: Number(tags.includes("Support")),
  };
}

function isMlConfigured() {
  return isMlGenerationConfigured({
    enabled: env.ML_ENABLED,
    apiUrl: env.ML_API_URL,
  });
}

function buildSnapshotHistoryKey(input: {
  snapshotIndex: number;
  snapshotMinute: number;
}) {
  return `${input.snapshotIndex}:${input.snapshotMinute.toFixed(2)}`;
}

function buildSnapshotSignature(input: {
  snapshotMinute: number;
  goldAvailable: number;
  role?: Role | null;
  currentItems: string[];
}) {
  return [
    input.role ?? "FLEX",
    input.snapshotMinute.toFixed(2),
    Math.max(0, Math.round(input.goldAvailable)),
    [...input.currentItems].sort().join("|"),
  ].join("::");
}

function computeSnapshotDistanceScore(input: {
  current: { snapshotMinute: number; goldAvailable: number; currentItems: string[] };
  previous: { snapshotMinute: number; goldAvailable: number; currentItems: string[] };
}) {
  const minuteDelta = Math.min(1, Math.abs(input.current.snapshotMinute - input.previous.snapshotMinute) / 8);
  const goldDelta = Math.min(1, Math.abs(input.current.goldAvailable - input.previous.goldAvailable) / 1800);
  const currentItems = new Set(input.current.currentItems);
  const previousItems = new Set(input.previous.currentItems);
  const overlapCount = [...currentItems].filter((item) => previousItems.has(item)).length;
  const unionCount = new Set([...currentItems, ...previousItems]).size || 1;
  const itemDistance = 1 - overlapCount / unionCount;
  return Number((((minuteDelta * 0.4) + (goldDelta * 0.25) + (itemDistance * 0.35)) * 100).toFixed(2));
}

function getSnapshotSegment(snapshotMinute: number): SnapshotSegment | null {
  for (const entry of SNAPSHOT_SEGMENTS) {
    if (snapshotMinute >= entry.minInclusive && snapshotMinute < entry.maxExclusive) {
      return entry.segment;
    }
  }
  return null;
}

function buildMlRequestMetadata(input: {
  generationStatus: MatchGenerationResponse["generationStatus"];
  failureCode?: MatchGenerationNoViableResponse["failureCode"];
  selectedAttempts?: PreparedSnapshotAttempt[];
  attemptSummaries: AttemptDebugSummary[];
  payload?: Record<string, unknown>;
  resultPuzzles?: Array<{ id: string; slug: string }>;
  segmentSummaries?: SegmentEvaluationSummary[];
  repetitionExcluded?: Array<{
    segment: SnapshotSegment;
    snapshotIndex: number;
    snapshotMinute: number;
    qualityScore: number;
    rerollDistanceScore?: number;
  }>;
  dominantRejectionReasons?: string[];
  snapshotsEvaluated?: number;
  viableSnapshots?: number;
  publishableSnapshots?: number;
  nonPublishableButViableSnapshots?: number;
  prevalidationRejectedBySnapshot?: Record<number, string[]>;
  draft?: boolean;
}) {
  const primaryAttempt = input.selectedAttempts?.[0];
  return {
    generationStatus: input.generationStatus,
    failureCode: input.failureCode ?? null,
    selectedSnapshot:
      primaryAttempt
        ? {
            snapshotIndex: primaryAttempt.snapshotIndex,
            rawPurchaseIndex: primaryAttempt.rawPurchaseIndex,
            snapshotMinute: primaryAttempt.snapshot.timestampMinutes,
            qualityScore: primaryAttempt.qualityScore,
            rerollDistanceScore: primaryAttempt.debugSummary.rerollDistanceScore ?? null,
            variationSeed: primaryAttempt.variationSeed,
            choiceSignature: primaryAttempt.choiceSignature,
            snapshotSignature: buildSnapshotSignature({
              snapshotMinute: primaryAttempt.snapshot.timestampMinutes,
              goldAvailable: primaryAttempt.snapshot.goldAvailable,
              role: primaryAttempt.snapshot.role,
              currentItems: primaryAttempt.snapshot.currentItems,
            }),
          }
        : null,
    selectedSnapshots:
      input.selectedAttempts?.map((attempt) => ({
        snapshotIndex: attempt.snapshotIndex,
        rawPurchaseIndex: attempt.rawPurchaseIndex,
        snapshotMinute: attempt.snapshot.timestampMinutes,
        qualityScore: attempt.qualityScore,
        rerollDistanceScore: attempt.debugSummary.rerollDistanceScore ?? null,
        variationSeed: attempt.variationSeed,
        choiceSignature: attempt.choiceSignature,
        segment: getSnapshotSegment(attempt.snapshot.timestampMinutes),
        historyKey: buildSnapshotHistoryKey({
          snapshotIndex: attempt.snapshotIndex,
          snapshotMinute: attempt.snapshot.timestampMinutes,
        }),
        snapshotSignature: buildSnapshotSignature({
          snapshotMinute: attempt.snapshot.timestampMinutes,
          goldAvailable: attempt.snapshot.goldAvailable,
          role: attempt.snapshot.role,
          currentItems: attempt.snapshot.currentItems,
        }),
      })) ?? [],
    attemptsSummary: {
      snapshotsEvaluated: input.snapshotsEvaluated ?? input.attemptSummaries.length,
      successfulSnapshots: input.attemptSummaries.filter((entry) => entry.publishable).length,
      attempts: input.attemptSummaries,
    },
    dominantRejectionReasons: input.dominantRejectionReasons ?? [],
    viableSnapshots: input.viableSnapshots ?? input.attemptSummaries.filter((entry) => entry.technicalViable).length,
    publishableSnapshots: input.publishableSnapshots ?? input.attemptSummaries.filter((entry) => entry.publishable).length,
    nonPublishableButViableSnapshots:
      input.nonPublishableButViableSnapshots
      ?? input.attemptSummaries.filter((entry) => entry.technicalViable && !entry.publishable).length,
    prevalidationRejectedBySnapshot: input.prevalidationRejectedBySnapshot ?? {},
    draft: input.draft ?? false,
    segmentsEvaluated: input.segmentSummaries ?? [],
    repetitionExcluded: input.repetitionExcluded ?? [],
    resultPuzzleIds: input.resultPuzzles?.map((entry) => entry.id) ?? [],
    resultPuzzleSlugs: input.resultPuzzles?.map((entry) => entry.slug) ?? [],
    payload: input.payload as Prisma.InputJsonValue | undefined,
    prediction: primaryAttempt?.prediction as Prisma.InputJsonValue | undefined,
    seed: primaryAttempt?.seed as Prisma.InputJsonValue | undefined,
    businessRules: primaryAttempt
      ? ({
          ...primaryAttempt.businessRules.debug,
          choiceSignature: primaryAttempt.choiceSignature,
          variationSeed: primaryAttempt.variationSeed,
        } as Prisma.InputJsonValue)
      : undefined,
  } as Prisma.InputJsonValue;
}

async function postPrediction(payload: object): Promise<MlPredictNextItemResponse> {
  if (!env.ML_API_URL) {
    throw new HttpError(503, "ML_API_URL is not configured.");
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= env.ML_API_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ML_API_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.ML_API_URL.replace(/\/$/, "")}/predict-next-item`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpError(response.status, `ML API request failed with status ${response.status}.`);
      }

      return (await response.json()) as MlPredictNextItemResponse;
    } catch (error) {
      lastError = error;
      if (attempt === env.ML_API_RETRY_COUNT) {
        break;
      }
      await sleep(200 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof HttpError) {
    throw lastError;
  }
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new HttpError(504, "ML API request timed out.");
  }
  throw new HttpError(502, "Unable to reach ML API.");
}

async function getItemsBySlugs(slugs: string[]) {
  const requested = [...new Set(slugs.map((slug) => resolveItemSlug(slug)))];
  const items = await prisma.item.findMany({
    where: {
      slug: { in: requested },
    },
  });
  return new Map(items.map((item) => [item.slug, item]));
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveItemGoldValue(
  itemGoldIndex: Map<number, ItemGoldValue>,
  itemId: number,
) {
  return itemGoldIndex.get(itemId) ?? {
    goldTotal: 0,
    goldSell: 0,
  };
}

function calculateGoldBeforePurchaseFromFrame(input: {
  events: Array<Record<string, unknown>>;
  participantId: number;
  purchaseEventIndex: number;
  endingGold: number;
  itemGoldIndex: Map<number, ItemGoldValue>;
}) {
  let workingGold = input.endingGold;

  for (let index = input.events.length - 1; index >= input.purchaseEventIndex; index -= 1) {
    const event = input.events[index];
    if (safeInt(event.participantId) !== input.participantId) {
      continue;
    }

    const eventType = String(event.type ?? "");
    const itemId = safeInt(event.itemId);

    if (eventType === "ITEM_PURCHASED" && itemId > 0) {
      workingGold += resolveItemGoldValue(input.itemGoldIndex, itemId).goldTotal;
      if (index === input.purchaseEventIndex) {
        return workingGold;
      }
      continue;
    }

    if (eventType === "ITEM_SOLD" && itemId > 0) {
      workingGold -= resolveItemGoldValue(input.itemGoldIndex, itemId).goldSell;
      continue;
    }

    if (eventType === "ITEM_UNDO") {
      if (index === input.purchaseEventIndex) {
        return workingGold;
      }
      continue;
    }
  }

  return workingGold;
}

function resolveEffectivePatchLookup(input: {
  importedMatchPatch?: string | null;
  gameCreationAt?: Date | string | number | null;
  matchData?: Prisma.JsonValue;
  snapshotFallbackPatch?: string | null;
}): ResolvedPatchLookup {
  const matchData = asRecord(input.matchData);
  const raw = asRecord(matchData?.raw);
  const info = asRecord(raw?.info);
  const rawGameVersion = asOptionalString(info?.gameVersion);
  const patchSource = rawGameVersion ?? input.importedMatchPatch ?? input.snapshotFallbackPatch ?? null;
  const patchInfo = canonicalizePatch(patchSource, input.gameCreationAt);

  return {
    rawGameVersion,
    patchCanonical: patchInfo.patchCanonical,
    patchFormat: patchInfo.patchFormat,
    lookupCandidates: buildPatchLookupCandidates(patchInfo.patchCanonical, patchInfo.patchFormat),
  };
}

function mapChoiceItems(
  items: Array<{
    id: string;
    slug: string;
    name: string;
    riotItemId: number;
    goldTotal: number | null;
    patch: string;
    category: string | null;
    tags: Prisma.JsonValue;
    isBoots: boolean;
    isLegendary: boolean;
    isConsumable: boolean;
    isStarter: boolean;
    isTrinket: boolean;
    isActive: boolean;
    buildsFrom: Prisma.JsonValue;
    fullDescription: string | null;
  }>,
) {
  return items.map(
    (item): MlChoiceItem => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
      buildsFrom: Array.isArray(item.buildsFrom) ? item.buildsFrom.map((entry) => String(entry)) : [],
      itemGroups: getItemGroups({
        ...item,
        fullDescription: item.fullDescription,
      }).map((group) => String(group)),
    }),
  );
}

async function getPatchChoiceItems(input: ResolvedPatchLookup) {
  const select = {
    id: true,
    slug: true,
    name: true,
    riotItemId: true,
    goldTotal: true,
    patch: true,
    category: true,
    tags: true,
    isBoots: true,
    isLegendary: true,
    isConsumable: true,
    isStarter: true,
    isTrinket: true,
    isActive: true,
    buildsFrom: true,
    fullDescription: true,
  } as const;

  const fetchItemsByPatchPrefixes = (prefixes: string[]) =>
    prisma.item.findMany({
      where: {
        isActive: true,
        OR: prefixes.map((candidate) => ({
          patch: {
            startsWith: candidate,
          },
        })),
      },
      orderBy: [
        { patch: "desc" },
        { riotItemId: "asc" },
      ],
      select,
    });

  if (input.lookupCandidates.length === 0) {
    const fallbackItems = await prisma.item.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { patch: "desc" },
        { riotItemId: "asc" },
      ],
      select,
    });

    console.warn(
      "[ml-puzzle] patch-catalog-unresolved",
      JSON.stringify({
        requestedPatch: input.patchCanonical,
        patchFormat: input.patchFormat,
        resolvedPatchPrefix: null,
        patchItemCount: 0,
        fallbackItemCount: fallbackItems.length,
      }),
    );

    return mapChoiceItems(fallbackItems);
  }

  const directPatchItems = await fetchItemsByPatchPrefixes(input.lookupCandidates);
  const directResolvedPatchPrefix = input.lookupCandidates.find((candidate) =>
    directPatchItems.some((item) => item.patch.startsWith(candidate)),
  ) ?? input.lookupCandidates[0] ?? null;

  if (directPatchItems.length >= 100) {
    console.info(
      "[ml-puzzle] patch-catalog-resolved",
      JSON.stringify({
        requestedPatch: input.patchCanonical,
        patchFormat: input.patchFormat,
        lookupCandidates: input.lookupCandidates,
        resolvedPatchPrefix: directResolvedPatchPrefix,
        patchItemCount: directPatchItems.length,
        resolutionMode: "direct",
      }),
    );
    return mapChoiceItems(directPatchItems);
  }

  const familyPrefixes = [...new Set(
    input.lookupCandidates
      .map((candidate) => candidate.match(/^(\d{1,2})\./)?.[1] ?? null)
      .filter((entry): entry is string => Boolean(entry))
      .map((major) => `${major}.`),
  )];

  const familyPatchVersions = familyPrefixes.length === 0
    ? []
    : await prisma.item.groupBy({
        by: ["patch"],
        where: {
          isActive: true,
          OR: familyPrefixes.map((prefix) => ({
            patch: {
              startsWith: prefix,
            },
          })),
        },
        _count: {
          patch: true,
        },
        orderBy: {
          patch: "desc",
        },
      });

  const familyPatchVersion = familyPatchVersions.find((entry) => entry._count.patch >= 100)?.patch
    ?? familyPatchVersions[0]?.patch
    ?? null;
  const familyPatchItems = familyPatchVersion ? await fetchItemsByPatchPrefixes([familyPatchVersion]) : [];

  console.info(
    "[ml-puzzle] patch-catalog-resolved",
    JSON.stringify({
      requestedPatch: input.patchCanonical,
      patchFormat: input.patchFormat,
      lookupCandidates: input.lookupCandidates,
      resolvedPatchPrefix: familyPatchVersion ?? directResolvedPatchPrefix,
      patchItemCount: familyPatchItems.length,
      directPatchItemCount: directPatchItems.length,
      familyPrefixes,
      resolutionMode: familyPatchItems.length > 0 ? "family-fallback" : "direct-empty",
    }),
  );

  if (familyPatchItems.length === 0) {
    console.warn(
      "[ml-puzzle] patch-catalog-empty",
      JSON.stringify({
        requestedPatch: input.patchCanonical,
        patchFormat: input.patchFormat,
        lookupCandidates: input.lookupCandidates,
        resolvedPatchPrefix: familyPatchVersion ?? directResolvedPatchPrefix,
        patchItemCount: 0,
      }),
    );
  }

  return mapChoiceItems(familyPatchItems);
}

async function getPreviousChoiceSignatures(input: {
  importedMatchId: string;
  userId: string;
}) {
  const requests = await prisma.generatedPuzzleRequest.findMany({
    where: {
      importedMatchId: input.importedMatchId,
      userId: input.userId,
      status: GeneratedPuzzleRequestStatus.COMPLETED,
      resultPuzzleId: { not: null },
    },
    select: {
      resultPuzzle: {
        select: {
          sourceType: true,
          choices: {
            select: {
              item: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return requests
    .filter((requestRecord) => requestRecord.resultPuzzle?.sourceType === PuzzleSourceType.AI_GENERATED)
    .map((requestRecord) =>
      requestRecord.resultPuzzle?.choices
        .map((choice) => choice.item?.slug)
        .filter((slug): slug is string => Boolean(slug)) ?? [],
    )
    .filter((slugs) => slugs.length === 4)
    .map((slugs) => [...slugs].sort().join("|"));
}

async function getPreviousServedSnapshots(input: {
  importedMatchId: string;
  userId: string;
}) {
  const requests = await prisma.generatedPuzzleRequest.findMany({
    where: {
      importedMatchId: input.importedMatchId,
      userId: input.userId,
      status: GeneratedPuzzleRequestStatus.COMPLETED,
    },
    select: {
      parameters: true,
      createdAt: true,
    },
  });

  const entries: SnapshotHistoryEntry[] = [];
  for (const request of requests) {
    const parameters = request.parameters;
    if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
      continue;
    }

    const objectParameters = parameters as Record<string, unknown>;
    const selectedSnapshots = Array.isArray(objectParameters.selectedSnapshots)
      ? objectParameters.selectedSnapshots
      : objectParameters.selectedSnapshot
        ? [objectParameters.selectedSnapshot]
        : [];

    for (const snapshotEntry of selectedSnapshots) {
      if (!snapshotEntry || typeof snapshotEntry !== "object" || Array.isArray(snapshotEntry)) {
        continue;
      }
      const snapshotObject = snapshotEntry as Record<string, unknown>;
      const snapshotIndex = Number(snapshotObject.snapshotIndex);
      const snapshotMinute = Number(snapshotObject.snapshotMinute);
      if (!Number.isFinite(snapshotIndex) || !Number.isFinite(snapshotMinute)) {
        continue;
      }
      entries.push({
        snapshotIndex,
        snapshotMinute,
        key: buildSnapshotHistoryKey({
          snapshotIndex,
          snapshotMinute,
        }),
        signature:
          typeof snapshotObject.snapshotSignature === "string" && snapshotObject.snapshotSignature.length > 0
            ? snapshotObject.snapshotSignature
            : buildSnapshotHistoryKey({
              snapshotIndex,
              snapshotMinute,
            }),
        createdAt: request.createdAt,
      });
    }
  }

  return entries;
}

function getSnapshotHistoryMetrics(input: {
  attempt: PreparedSnapshotAttempt;
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}) {
  const historyKey = buildSnapshotHistoryKey({
    snapshotIndex: input.attempt.snapshotIndex,
    snapshotMinute: input.attempt.snapshot.timestampMinutes,
  });
  const signature = buildSnapshotSignature({
    snapshotMinute: input.attempt.snapshot.timestampMinutes,
    goldAvailable: input.attempt.snapshot.goldAvailable,
    role: input.attempt.snapshot.role,
    currentItems: input.attempt.snapshot.currentItems,
  });
  const nowMs = (input.now ?? new Date()).getTime();
  const signatureMatches = input.previousSnapshots.filter((entry) => entry.signature === signature);
  const exactMatches = signatureMatches.filter((entry) => entry.key === historyKey);
  const recentSignatureMatches = signatureMatches.filter((entry) => nowMs - entry.createdAt.getTime() <= 24 * 60 * 60 * 1000);
  const recentExactMatches = exactMatches.filter((entry) => nowMs - entry.createdAt.getTime() <= 24 * 60 * 60 * 1000);

  return {
    historyKey,
    signature,
    exactMatchCount: exactMatches.length,
    signatureMatchCount: signatureMatches.length,
    recentExactMatchCount: recentExactMatches.length,
    recentSignatureMatchCount: recentSignatureMatches.length,
  };
}

function calculateSnapshotReusePenalty(input: {
  attempt: PreparedSnapshotAttempt;
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}) {
  const metrics = getSnapshotHistoryMetrics(input);
  const penalty = (
    metrics.exactMatchCount * 18
    + metrics.signatureMatchCount * 8
    + metrics.recentExactMatchCount * 18
    + metrics.recentSignatureMatchCount * 10
  );

  return {
    ...metrics,
    penalty,
    adjustedQualityScore: Number((input.attempt.qualityScore - penalty).toFixed(2)),
  };
}

function scoreSnapshotCandidate(snapshot: MlPuzzleSnapshot) {
  let score = 0;
  const minute = snapshot.timestampMinutes;

  if (minute < MIN_SNAPSHOT_MINUTE || minute > MAX_SNAPSHOT_MINUTE) {
    return -1;
  }
  score += Math.max(0, 42 - Math.abs(minute - 18) * 2.2);
  score += snapshot.currentItems.length >= 2 && snapshot.currentItems.length <= 4 ? 18 : 6;
  score += snapshot.goldAvailable >= 900 && snapshot.goldAvailable <= 2800 ? 16 : 4;
  score += snapshot.level >= 8 ? 10 : 0;
  score += snapshot.cs >= 80 ? 8 : 0;
  score += snapshot.kills + snapshot.assists >= snapshot.deaths ? 6 : 2;

  return score;
}

function isMeaningfulPurchaseSnapshotCandidate(candidate: SnapshotCandidate) {
  if (candidate.snapshot.currentItems.length < 1 || candidate.snapshot.currentItems.length > 5) {
    return false;
  }
  if (candidate.snapshot.level < 6) {
    return false;
  }
  const publishabilityFloor = getPublishabilityFloorGold(candidate.snapshot.goldAvailable);
  if (
    candidate.actualPurchase.burstPurchaseIndex > 0
    && (candidate.actualPurchase.goldTotal ?? 0) < Math.max(MIN_MEANINGFUL_PURCHASE_GOLD, publishabilityFloor)
  ) {
    return false;
  }
  return true;
}

function countReasons(reasons: string[]) {
  return reasons.reduce<Record<string, number>>((accumulator, reason) => {
    accumulator[reason] = (accumulator[reason] ?? 0) + 1;
    return accumulator;
  }, {});
}

function sortReasonEntries(entries: Record<string, number>) {
  return Object.entries(entries)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([reason]) => reason);
}

function getPublishabilityFloorGold(snapshotGold: number) {
  return Math.max(900, Math.round(Math.max(0, snapshotGold) * 0.35));
}

function getDistractorDecisionBand(goodAnswerGold: number, snapshotGold: number) {
  const baseline = Math.max(goodAnswerGold, getPublishabilityFloorGold(snapshotGold));
  return Math.max(750, Math.round(baseline * 0.55));
}

function isPublishabilityCredibleDistractor(input: {
  item: MlChoiceItem;
  goodAnswer: MlChoiceItem;
  snapshotGold: number;
}) {
  const allowedGap = getDistractorDecisionBand(input.goodAnswer.goldTotal, input.snapshotGold);
  const costGap = Math.abs(input.item.goldTotal - input.goodAnswer.goldTotal);
  if (costGap <= allowedGap) {
    return true;
  }

  const sharedCategory = Boolean(input.item.category) && input.item.category === input.goodAnswer.category;
  const sharedTagCount = input.item.tags.filter((tag) => input.goodAnswer.tags.includes(tag)).length;
  const sameUpgradeFamily = input.item.itemGroups.some((group) => input.goodAnswer.itemGroups.includes(group));
  const sameTier = input.item.isLegendary === input.goodAnswer.isLegendary;
  const softGap = allowedGap + 450;

  return (
    costGap <= softGap
    && !input.item.isConsumable
    && !input.item.isStarter
    && !input.item.isTrinket
    && (
      sharedCategory
      || sharedTagCount >= 2
      || sameUpgradeFamily
      || sameTier
    )
  );
}

function canOverrideLowConfidence(input: {
  seed: MlPuzzleSeed;
  prediction: MlPredictNextItemResponse;
  publishabilityScore: number;
  candidatePoolSizeAfterFallback: number;
  goodAnswerSource: "ml-prediction" | "actual-purchase-fallback";
}) {
  if (!input.seed.lowConfidence || !input.prediction.model_ready) {
    return false;
  }

  if (input.publishabilityScore < 94 || input.candidatePoolSizeAfterFallback < 8) {
    return false;
  }

  if (input.seed.confidenceScore >= 0.33 && input.seed.confidenceGap >= 0.05) {
    return true;
  }

  return (
    input.goodAnswerSource === "actual-purchase-fallback"
    && input.seed.confidenceScore >= 0.28
    && input.seed.confidenceGap >= 0.04
  );
}

function assessSnapshotPublishability(input: {
  snapshot: MlPuzzleSnapshot;
  goodAnswer: MlChoiceItem;
  distractors: MlChoiceItem[];
  businessRules: ReturnType<typeof buildMlPuzzleBusinessRules>;
}) {
  const reasons: string[] = [];
  const floorGold = getPublishabilityFloorGold(input.snapshot.goldAvailable);
  const goodAnswerAssessment = input.businessRules.debug.goodAnswerGoldAssessment;
  const goodAnswerIsLegitimateComponent = goodAnswerAssessment === "legitimate-component";
  const goodAnswerIsTrivial =
    input.goodAnswer.goldTotal < floorGold
    && !goodAnswerIsLegitimateComponent;

  if (goodAnswerIsTrivial) {
    reasons.push("publishability-trivial-good-answer");
  }

  const credibleDistractors = input.distractors.filter((item) => {
    return isPublishabilityCredibleDistractor({
      item,
      goodAnswer: input.goodAnswer,
      snapshotGold: input.snapshot.goldAvailable,
    });
  });
  const allowedGap = getDistractorDecisionBand(input.goodAnswer.goldTotal, input.snapshot.goldAvailable);

  if (credibleDistractors.length < 3) {
    reasons.push("publishability-insufficient-credible-distractors");
  }

  const publishabilityScore =
    (goodAnswerIsTrivial ? 0 : 60)
    + Math.min(40, credibleDistractors.length * 12)
    - Math.max(0, input.businessRules.debug.goodAnswerViolations.length * 20);

  return {
    publishable: reasons.length === 0,
    reasons,
    publishabilityScore: Number(Math.max(0, publishabilityScore).toFixed(2)),
    floorGold,
    credibleDistractorCount: credibleDistractors.length,
    distractorBandMaxGap: allowedGap,
  };
}

function summarizeNoViableDiagnostics(input: {
  snapshotCandidates: SnapshotCandidate[];
  attempts: SnapshotAttempt[];
  prevalidationRejections?: Record<number, string[]>;
}) {
  const reasonCounts: Record<string, number> = {};

  for (const reasons of Object.values(input.prevalidationRejections ?? {})) {
    for (const [reason, count] of Object.entries(countReasons(reasons))) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + count;
    }
  }

  for (const attempt of input.attempts) {
    if (attempt.status !== "rejected") {
      continue;
    }
    for (const [reason, count] of Object.entries(countReasons(attempt.rejectionReasons))) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + count;
    }
  }

  return {
    snapshotsEvaluated: input.snapshotCandidates.length,
    viableSnapshots: input.attempts.filter((attempt) => attempt.status === "accepted" || attempt.technicalViable).length,
    publishableSnapshots: input.attempts.filter((attempt) => attempt.status === "accepted").length,
    nonPublishableButViableSnapshots: input.attempts.filter((attempt) => attempt.status === "rejected" && attempt.technicalViable).length,
    dominantRejectionReasons: sortReasonEntries(reasonCounts).slice(0, 5),
  };
}

function prevalidateSnapshotCandidate(input: {
  candidate: SnapshotCandidate;
  patchChoiceItems: MlChoiceItem[];
  championTags: string[];
}) {
  const actualPurchaseSlug = input.candidate.actualPurchase.itemSlug;
  if (!actualPurchaseSlug) {
    return {
      allowed: false,
      rejectionReasons: ["actual-next-item-unresolved"],
    };
  }

  const actualGoodAnswer = resolveMlChoiceItemRef(actualPurchaseSlug, input.patchChoiceItems);
  if (!actualGoodAnswer) {
    return {
      allowed: false,
      rejectionReasons: ["actual-next-item-unresolved"],
    };
  }

  const businessRules = buildMlPuzzleBusinessRules({
    snapshot: input.candidate.snapshot,
    championTags: input.championTags,
    goodAnswer: actualGoodAnswer,
    rankedCandidates: [actualGoodAnswer],
    availableItems: input.patchChoiceItems,
    previousChoiceSignatures: [],
    variationSeed: `prevalidation:${input.candidate.snapshotIndex}`,
  });

  const rejectionReasons = [
    ...businessRules.debug.goodAnswerViolations.map((reason) => `good-answer-${reason}`),
  ];
  if (businessRules.debug.candidatePoolSizeAfterFallback < 6) {
    rejectionReasons.push("candidate-pool-too-small");
  }

  return {
    allowed: rejectionReasons.length === 0,
    rejectionReasons,
  };
}

function dedupeAndRankSnapshots(candidates: SnapshotCandidate[]) {
  const sorted = [...candidates]
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .filter((candidate) => candidate.relevanceScore >= 0);
  const kept: SnapshotCandidate[] = [];

  const isDuplicateOfKept = (candidate: SnapshotCandidate) => {
    const candidateSignature = [...candidate.snapshot.currentItems].sort().join("|");
    return kept.find((existing) => {
      const existingSignature = [...existing.snapshot.currentItems].sort().join("|");
      return (
        candidateSignature === existingSignature
        && Math.abs(existing.snapshot.timestampMinutes - candidate.snapshot.timestampMinutes) < 3
      );
    });
  };

  for (const segmentConfig of SNAPSHOT_SEGMENTS) {
    let keptForSegment = 0;
    for (const candidate of sorted) {
      if (getSnapshotSegment(candidate.snapshot.timestampMinutes) !== segmentConfig.segment) {
        continue;
      }
      if (isDuplicateOfKept(candidate)) {
        continue;
      }
      kept.push(candidate);
      keptForSegment += 1;
      if (kept.length >= MAX_SNAPSHOT_CANDIDATES || keptForSegment >= MAX_SNAPSHOT_CANDIDATES_PER_SEGMENT) {
        break;
      }
    }
    if (kept.length >= MAX_SNAPSHOT_CANDIDATES) {
      break;
    }
  }

  if (kept.length < MAX_SNAPSHOT_CANDIDATES) {
    for (const candidate of sorted) {
      if (isDuplicateOfKept(candidate)) {
        continue;
      }
      kept.push(candidate);
      if (kept.length >= MAX_SNAPSHOT_CANDIDATES) {
        break;
      }
    }
  }

  return [...new Map(kept.map((candidate) => [candidate.snapshotIndex, candidate])).values()]
    .sort((left, right) => left.snapshot.timestampMinutes - right.snapshot.timestampMinutes);
}

async function buildSnapshotCandidatesFromImportedMatch(
  importedMatch: NonNullable<ImportedMatchForMl>,
): Promise<SnapshotCandidate[]> {
  const storedBundle = await importedMatchArchiveRepository.getImportedMatchBundle({
    riotMatchId: importedMatch.riotMatchId,
    fallbackMatchData: importedMatch.matchData,
    fallbackTimelineData: importedMatch.timelineData,
  });
  const matchData = storedBundle.matchData as Prisma.JsonObject;
  const timelineData = storedBundle.timelineData as Prisma.JsonObject | null;
  const matchRaw = matchData.raw as Prisma.JsonObject | undefined;
  const timelineRaw = timelineData?.raw as Prisma.JsonObject | undefined;
  const info = matchRaw?.info as Prisma.JsonObject | undefined;
  const timelineInfo = timelineRaw?.info as Prisma.JsonObject | undefined;
  const participants = Array.isArray(info?.participants)
    ? (info?.participants as Array<Record<string, unknown>>)
    : [];
  const frames = Array.isArray(timelineInfo?.frames)
    ? (timelineInfo?.frames as Array<Record<string, unknown>>)
    : [];

  if (!participants.length || !frames.length || !importedMatch.targetPuuid) {
    throw new HttpError(400, "Imported match does not contain enough data for ML generation.");
  }

  const targetParticipant = participants.find(
    (entry) => String(entry.puuid ?? "") === importedMatch.targetPuuid,
  );
  if (!targetParticipant) {
    throw new HttpError(400, "Target participant was not found in imported match data.");
  }

  const participantId = safeInt(targetParticipant.participantId);
  const ownTeamId = safeInt(targetParticipant.teamId);
  const championIds = [...new Set(participants.map((entry) => safeInt(entry.championId)).filter((id) => id > 0))];
  const champions = await prisma.champion.findMany({
    where: {
      riotChampionId: { in: championIds },
    },
    select: {
      riotChampionId: true,
      slug: true,
      tags: true,
    },
  });
  const championIndex = new Map(
    champions.map((champion) => [
      champion.riotChampionId ?? 0,
      {
        slug: champion.slug,
        tags: Array.isArray(champion.tags) ? champion.tags.map((tag) => String(tag)) : [],
      },
    ]),
  );

  const itemIdsSeen = collectTimelineItemIds(frames as Array<Record<string, unknown>>);

  const itemRows = itemIdsSeen.size
    ? await prisma.item.findMany({
        where: {
          riotItemId: { in: [...itemIdsSeen] },
        },
        select: {
          riotItemId: true,
          slug: true,
          goldTotal: true,
          goldSell: true,
        },
      })
    : [];
  const itemSlugIndex = new Map(itemRows.map((item) => [item.riotItemId, item.slug]));
  const itemGoldIndex = new Map(itemRows.map((item) => [
    item.riotItemId,
    {
      goldTotal: item.goldTotal,
      goldSell: item.goldSell ?? Math.floor(item.goldTotal * 0.7),
    },
  ]));

  const allyTeamDraft: ScenarioMemberDraft[] = [];
  const enemyTeamDraft: ScenarioMemberDraft[] = [];
  let allyFrontlineCount = 0;
  let allyMagicDamageCount = 0;
  let allyPhysicalDamageCount = 0;
  let allySupportCount = 0;
  let enemyFrontlineCount = 0;
  let enemyMagicDamageCount = 0;
  let enemyPhysicalDamageCount = 0;
  let enemySupportCount = 0;

  for (const participant of participants) {
    const champion = championIndex.get(safeInt(participant.championId));
    if (!champion) {
      continue;
    }

    const profile = buildChampionProfile(champion.tags);
    const member = {
      participantId: safeInt(participant.participantId),
      championSlug: champion.slug,
      role: resolveParticipantRole(participant),
      items: [],
    };

    if (safeInt(participant.teamId) === ownTeamId) {
      allyTeamDraft.push(member);
      allyFrontlineCount += profile.frontline;
      allyMagicDamageCount += profile.magic;
      allyPhysicalDamageCount += profile.physical;
      allySupportCount += profile.support;
    } else {
      enemyTeamDraft.push(member);
      enemyFrontlineCount += profile.frontline;
      enemyMagicDamageCount += profile.magic;
      enemyPhysicalDamageCount += profile.physical;
      enemySupportCount += profile.support;
    }
  }

  const sortedFrames = frames
    .filter((frame) => typeof frame === "object" && frame !== null)
    .sort((left, right) => safeInt(left.timestamp) - safeInt(right.timestamp));
  const inventory: number[] = [];
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  const rawCandidates: SnapshotCandidate[] = [];
  let lastPurchaseTimestamp = Number.NEGATIVE_INFINITY;
  let burstPurchaseIndex = 0;

  for (const frame of sortedFrames) {
    const participantFrames = frame.participantFrames as Record<string, Record<string, unknown>> | undefined;
    const participantFrame = participantFrames?.[String(participantId)] ?? {};
    const events = Array.isArray(frame.events) ? (frame.events as Array<Record<string, unknown>>) : [];

    for (const [eventIndex, event] of events.entries()) {
      const eventType = String(event.type ?? "");
      const eventParticipantId = safeInt(event.participantId);

      if (eventType === "CHAMPION_KILL") {
        if (safeInt(event.killerId) === participantId) {
          kills += 1;
        }
        if (safeInt(event.victimId) === participantId) {
          deaths += 1;
        }
        if (
          Array.isArray(event.assistingParticipantIds) &&
          event.assistingParticipantIds.map((value) => safeInt(value)).includes(participantId)
        ) {
          assists += 1;
        }
      }

      if (eventParticipantId !== participantId) {
        continue;
      }

      const itemId = safeInt(event.itemId);
      if (eventType === "ITEM_PURCHASED" && itemId > 0) {
        const purchaseTimestamp = safeInt(event.timestamp);
        burstPurchaseIndex =
          purchaseTimestamp - lastPurchaseTimestamp <= SHOP_BURST_WINDOW_MS
            ? burstPurchaseIndex + 1
            : 0;
        lastPurchaseTimestamp = purchaseTimestamp;
        const goldBeforePurchase = calculateGoldBeforePurchaseFromFrame({
          events,
          participantId,
          purchaseEventIndex: eventIndex,
          endingGold: safeInt(participantFrame.currentGold),
          itemGoldIndex,
        });
        const currentBuild = inventory
          .map((value) => itemSlugIndex.get(value))
          .filter((value): value is string => Boolean(value));
        const reconstructedInventories = reconstructInventoriesAtTimestamp({
          frames: sortedFrames,
          upToTimestamp: safeInt(event.timestamp),
          participantIds: [
            ...allyTeamDraft.map((member) => member.participantId),
            ...enemyTeamDraft.map((member) => member.participantId),
          ],
          itemSlugIndex,
        });
        console.info(
          `[ml-puzzle] reconstructed team inventories snapshotMinute=${(safeInt(event.timestamp) / 60000).toFixed(2)} participants=${reconstructedInventories.participantsCovered} eventsApplied=${reconstructedInventories.eventsApplied}`,
        );
        const allyTeam = allyTeamDraft.map(({ participantId: _participantId, ...member }) => ({
          ...member,
          items: reconstructedInventories.inventories.get(_participantId) ?? [],
        }));
        const enemyTeam = enemyTeamDraft.map(({ participantId: _participantId, ...member }) => ({
          ...member,
          items: reconstructedInventories.inventories.get(_participantId) ?? [],
        }));
        const snapshot = {
          patch: importedMatch.patch ?? "unknown",
          championSlug: importedMatch.targetChampionSlug ?? "",
          role: importedMatch.targetRole,
          goldAvailable: goldBeforePurchase,
          level: safeInt(participantFrame.level),
          kills,
          deaths,
          assists,
          cs: safeInt(participantFrame.minionsKilled) + safeInt(participantFrame.jungleMinionsKilled),
          timestampMinutes: safeInt(event.timestamp) / 60000,
          currentItems: currentBuild,
          allyFrontlineCount,
          allyMagicDamageCount,
          allyPhysicalDamageCount,
          allySupportCount,
          enemyFrontlineCount,
          enemyMagicDamageCount,
          enemyPhysicalDamageCount,
          enemySupportCount,
        } satisfies MlPuzzleSnapshot;
        const actualPurchase = {
          itemSlug: itemSlugIndex.get(itemId) ?? null,
          goldTotal: itemGoldIndex.get(itemId)?.goldTotal ?? null,
          burstPurchaseIndex,
          timestampMinutes: purchaseTimestamp / 60000,
        };
        rawCandidates.push({
          snapshotIndex: rawCandidates.length,
          rawPurchaseIndex: rawCandidates.length,
          snapshot,
          scenario: {
            currentBuild,
            allyTeam,
            enemyTeam,
          },
          relevanceScore:
            scoreSnapshotCandidate(snapshot)
            - (burstPurchaseIndex > 0 ? burstPurchaseIndex * 8 : 0)
            - (
              (actualPurchase.goldTotal ?? 0) < getPublishabilityFloorGold(snapshot.goldAvailable)
                ? 24
                : 0
            )
            - (burstPurchaseIndex > 0 && (actualPurchase.goldTotal ?? 0) < MIN_MEANINGFUL_PURCHASE_GOLD ? 20 : 0),
          actualPurchase,
        });
        inventory.push(itemId);
        continue;
      }

      if ((eventType === "ITEM_SOLD" || eventType === "ITEM_DESTROYED") && itemId > 0) {
        removeItemOnce(inventory, itemId);
      }
      if (eventType === "ITEM_UNDO") {
        removeItemOnce(inventory, safeInt(event.beforeId));
        if (safeInt(event.afterId) > 0) {
          inventory.push(safeInt(event.afterId));
        }
      }
    }
  }

  const filtered = rawCandidates.filter(isMeaningfulPurchaseSnapshotCandidate);
  const deduped = dedupeAndRankSnapshots(filtered);
  const snapshotRef = await importedMatchArchiveRepository.persistSnapshotCandidates({
    riotMatchId: importedMatch.riotMatchId,
    importedMatchId: importedMatch.id,
    patch: importedMatch.patch ?? null,
    targetChampionSlug: importedMatch.targetChampionSlug ?? null,
    targetRole: importedMatch.targetRole ?? null,
    candidates: deduped.map((candidate) => ({
      snapshotIndex: candidate.snapshotIndex,
      rawPurchaseIndex: candidate.rawPurchaseIndex,
      snapshotMinute: Number(candidate.snapshot.timestampMinutes.toFixed(2)),
      goldAvailable: candidate.snapshot.goldAvailable,
      currentItems: candidate.snapshot.currentItems,
      relevanceScore: candidate.relevanceScore,
      actualPurchaseSlug: candidate.actualPurchase.itemSlug,
      actualPurchaseGoldTotal: candidate.actualPurchase.goldTotal,
      purchaseBurstIndex: candidate.actualPurchase.burstPurchaseIndex,
    })),
  });
  if (snapshotRef && importedMatch.mongoSnapshotRef !== snapshotRef) {
    await prisma.importedMatch.update({
      where: { id: importedMatch.id },
      data: {
        mongoSnapshotRef: snapshotRef,
      },
    });
  }

  if (deduped.length > 0) {
    return deduped;
  }
  if (rawCandidates.length > 0) {
    return [rawCandidates[rawCandidates.length - 1]];
  }
  throw new HttpError(400, "No purchase snapshot could be reconstructed from the imported match.");
}

function buildRejectedAttempt(input: {
  candidate: SnapshotCandidate;
  payload: ReturnType<typeof mapSnapshotToMlPayload>;
  prediction?: MlPredictNextItemResponse | null;
  seed?: MlPuzzleSeed | null;
  rawCandidatePoolSize: number;
  filteredCandidatePoolSize: number;
  goodAnswer: string | null;
  rejectionReasons: string[];
  qualityScore?: number;
  technicalViable?: boolean;
  publishabilityScore?: number;
  publishabilityReasons?: string[];
  goodAnswerSource?: "ml-prediction" | "actual-purchase-fallback";
  details?: Prisma.InputJsonValue;
}): RejectedSnapshotAttempt {
  return {
    status: "rejected",
    snapshotIndex: input.candidate.snapshotIndex,
    rawPurchaseIndex: input.candidate.rawPurchaseIndex,
    snapshot: input.candidate.snapshot,
    payload: input.payload,
    prediction: input.prediction ?? null,
    seed: input.seed ?? null,
    rejectionReasons: input.rejectionReasons,
    technicalViable: Boolean(input.technicalViable),
    debugSummary: {
      snapshotIndex: input.candidate.snapshotIndex,
      snapshotMinute: Number(input.candidate.snapshot.timestampMinutes.toFixed(2)),
      patch: input.candidate.snapshot.patch,
      goldAvailable: input.candidate.snapshot.goldAvailable,
      snapshotSignature: buildSnapshotSignature({
        snapshotMinute: input.candidate.snapshot.timestampMinutes,
        goldAvailable: input.candidate.snapshot.goldAvailable,
        role: input.candidate.snapshot.role,
        currentItems: input.candidate.snapshot.currentItems,
      }),
      rawCandidatePoolSize: input.rawCandidatePoolSize,
      filteredCandidatePoolSize: input.filteredCandidatePoolSize,
      goodAnswer: input.goodAnswer,
      qualityScore: input.qualityScore ?? 0,
      rejectionReasons: input.rejectionReasons,
      lowConfidence: input.seed?.lowConfidence ?? false,
      confidenceScore: input.seed?.confidenceScore ?? 0,
      confidenceGap: input.seed?.confidenceGap ?? 0,
      technicalViable: Boolean(input.technicalViable),
      publishable: false,
      publishabilityScore: input.publishabilityScore ?? 0,
      publishabilityReasons: input.publishabilityReasons ?? [],
      goodAnswerSource: input.goodAnswerSource,
    },
    details: input.details,
  };
}

function calculateQualityScore(input: {
  seed: MlPuzzleSeed;
  prediction: MlPredictNextItemResponse;
  businessRules: ReturnType<typeof buildMlPuzzleBusinessRules>;
  resolvedChoices: ReturnType<typeof resolveMlPuzzleChoices>;
}) {
  const uniqueCategories = new Set(
    input.resolvedChoices.resolvedItems.map((item) => String(item.category ?? "unknown")),
  ).size;
  const uniqueCostBuckets = new Set(
    input.resolvedChoices.resolvedItems.map((item) => Math.round(item.goldTotal / 500)),
  ).size;

  let score = 0;
  score += Math.min(22, input.businessRules.debug.candidatePoolSizeAfterFallback * 2);
  score += Math.max(0, Math.min(18, input.seed.confidenceScore * 20));
  score += Math.max(0, Math.min(18, input.seed.confidenceGap * 90));
  score += Math.max(0, 14 - input.businessRules.debug.goodAnswerViolations.length * 7);
  score += uniqueCategories * 4;
  score += uniqueCostBuckets * 3;
  score += input.seed.lowConfidence ? 0 : 12;
  score += input.prediction.model_ready ? 6 : 0;
  return Number(score.toFixed(2));
}

function logSnapshotAttempt(requestId: string, importedMatchId: string, attempt: SnapshotAttempt) {
  console.info(
    "[ml-puzzle] snapshot-attempt",
    JSON.stringify({
      requestId,
      importedMatchId,
      ...attempt.debugSummary,
      selected: attempt.status === "accepted",
    }),
  );
}

async function prepareSnapshotAttempt(input: {
  importedMatchId: string;
  userId: string;
  championTags: string[];
  candidate: SnapshotCandidate;
  patchChoiceItems: MlChoiceItem[];
  previousChoiceSignatures: string[];
}): Promise<SnapshotAttempt> {
  const payload = mapSnapshotToMlPayload(input.candidate.snapshot);

  try {
    const prediction = await postPrediction(payload);
    const seed = buildBackendPuzzleSeed(prediction);
    const predictedGoodAnswer = resolveMlChoiceItemRef(seed.goodAnswer, input.patchChoiceItems);
    const actualPurchaseFallback = input.candidate.actualPurchase.itemSlug
      ? resolveMlChoiceItemRef(input.candidate.actualPurchase.itemSlug, input.patchChoiceItems)
      : null;
    const actualPurchaseVerdict = prevalidateSnapshotCandidate({
      candidate: input.candidate,
      patchChoiceItems: input.patchChoiceItems,
      championTags: input.championTags,
    });

    let resolvedGoodAnswer = predictedGoodAnswer;
    let goodAnswerSource: "ml-prediction" | "actual-purchase-fallback" = "ml-prediction";
    if (!resolvedGoodAnswer && actualPurchaseFallback && actualPurchaseVerdict.allowed) {
      resolvedGoodAnswer = actualPurchaseFallback;
      goodAnswerSource = "actual-purchase-fallback";
    }

    if (!resolvedGoodAnswer) {
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: 0,
        goodAnswer: seed.goodAnswer,
        rejectionReasons: ["good-answer-unresolved"],
        details: {
          actualPurchaseItemSlug: input.candidate.actualPurchase.itemSlug,
          actualPurchaseVerdict,
        } satisfies Prisma.InputJsonValue,
      });
    }
    const goodAnswerRestriction = getItemRestrictionDecision(resolvedGoodAnswer.slug, {
      patch: input.candidate.snapshot.patch,
      role: input.candidate.snapshot.role,
    });
    if (!goodAnswerRestriction.allowed) {
      console.info(
        "[ml-puzzle] restriction-reject",
        JSON.stringify({
          scope: "good-answer",
          patch: input.candidate.snapshot.patch,
          role: input.candidate.snapshot.role,
          slug: resolvedGoodAnswer.slug,
          reasons: goodAnswerRestriction.reasons,
        }),
      );
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: 0,
        goodAnswer: resolvedGoodAnswer.slug,
        rejectionReasons: goodAnswerRestriction.reasons.map((reason) => `good-answer-${reason}`),
        details: {
          goodAnswerSource,
          actualPurchaseItemSlug: input.candidate.actualPurchase.itemSlug,
        } satisfies Prisma.InputJsonValue,
      });
    }

    const variationSeed = `${input.importedMatchId}:${input.userId}:${input.candidate.snapshotIndex}:${Date.now()}`;
    const rankedResolvedItems = prediction.top_k_predictions
      .map((entry) => resolveMlChoiceItemRef(entry.item_slug, input.patchChoiceItems))
      .filter((item): item is MlChoiceItem => Boolean(item));
    let businessRules = buildMlPuzzleBusinessRules({
      snapshot: input.candidate.snapshot,
      championTags: input.championTags,
      goodAnswer: resolvedGoodAnswer,
      rankedCandidates: rankedResolvedItems,
      availableItems: input.patchChoiceItems,
      previousChoiceSignatures: input.previousChoiceSignatures,
      variationSeed,
    });
    if (
      goodAnswerSource === "ml-prediction"
      && actualPurchaseFallback
      && actualPurchaseVerdict.allowed
      && businessRules.debug.goodAnswerViolations.some((reason) =>
        reason === "too-cheap" || reason === "too-expensive" || reason === "incoherent-with-champion",
      )
    ) {
      resolvedGoodAnswer = actualPurchaseFallback;
      goodAnswerSource = "actual-purchase-fallback";
      businessRules = buildMlPuzzleBusinessRules({
        snapshot: input.candidate.snapshot,
        championTags: input.championTags,
        goodAnswer: resolvedGoodAnswer,
        rankedCandidates: [resolvedGoodAnswer, ...rankedResolvedItems],
        availableItems: input.patchChoiceItems,
        previousChoiceSignatures: input.previousChoiceSignatures,
        variationSeed: `${variationSeed}:actual-purchase`,
      });
    }
    if (businessRules.debug.restrictedCandidateSamples.length > 0) {
      console.info(
        "[ml-puzzle] restriction-reject",
        JSON.stringify({
          scope: "candidate-pool",
          patch: input.candidate.snapshot.patch,
          role: input.candidate.snapshot.role,
          rejected: businessRules.debug.restrictedCandidateSamples,
          counts: {
            roleRestricted: businessRules.debug.filterReasonCounts["role-restricted"],
            patchRestricted: businessRules.debug.filterReasonCounts["patch-restricted"],
          },
        }),
      );
    }

    const rejectionReasons: string[] = [];
    if (businessRules.debug.goodAnswerViolations.length > 0) {
      rejectionReasons.push(...businessRules.debug.goodAnswerViolations.map((reason) => `good-answer-${reason}`));
    }
    if (businessRules.debug.candidatePoolSizeAfterFallback < 6) {
      rejectionReasons.push("candidate-pool-too-small");
    }

    const choiceResolutionInput = {
      patch: input.candidate.snapshot.patch,
      role: input.candidate.snapshot.role,
      currentItemSlugs: input.candidate.snapshot.currentItems,
      goodAnswer: resolvedGoodAnswer.slug,
      distractors: businessRules.debug.selectedDistractors,
      rankedItemSlugs: businessRules.distractorCandidates.map((item) => item.slug),
      availableItems: input.patchChoiceItems,
      fallbackItems: businessRules.distractorCandidates,
    };

    let resolvedChoices: ReturnType<typeof resolveMlPuzzleChoices> | null = null;
    try {
      resolvedChoices = resolveMlPuzzleChoices(choiceResolutionInput);
    } catch (error) {
      rejectionReasons.push(`choice-resolution-${error instanceof Error ? error.message : String(error)}`);
    }

    if (!resolvedChoices || rejectionReasons.length > 0) {
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: businessRules.debug.candidatePoolSizeAfterFallback,
        goodAnswer: resolvedGoodAnswer.slug,
        rejectionReasons,
        goodAnswerSource,
        details: {
          goodAnswerSource,
          businessRules: businessRules.debug,
          choiceResolution: resolvedChoices ? toChoiceDebugPayload(resolvedChoices) : null,
        } as Prisma.InputJsonValue,
      });
    }

    const publishabilityAssessment = assessSnapshotPublishability({
      snapshot: input.candidate.snapshot,
      goodAnswer: resolvedChoices.goodAnswer,
      distractors: resolvedChoices.distractors,
      businessRules,
    });
    if (!publishabilityAssessment.publishable) {
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: businessRules.debug.candidatePoolSizeAfterFallback,
        goodAnswer: resolvedChoices.goodAnswer.slug,
        rejectionReasons: publishabilityAssessment.reasons,
        technicalViable: true,
        publishabilityScore: publishabilityAssessment.publishabilityScore,
        publishabilityReasons: publishabilityAssessment.reasons,
        goodAnswerSource,
        details: {
          goodAnswerSource,
          businessRules: businessRules.debug,
          publishability: publishabilityAssessment,
          choiceResolution: toChoiceDebugPayload(resolvedChoices),
        } as Prisma.InputJsonValue,
      });
    }

    const effectiveLowConfidence = !canOverrideLowConfidence({
      seed,
      prediction,
      publishabilityScore: publishabilityAssessment.publishabilityScore,
      candidatePoolSizeAfterFallback: businessRules.debug.candidatePoolSizeAfterFallback,
      goodAnswerSource,
    }) && seed.lowConfidence;
    if (effectiveLowConfidence) {
      return buildRejectedAttempt({
        candidate: input.candidate,
        payload,
        prediction,
        seed,
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: businessRules.debug.candidatePoolSizeAfterFallback,
        goodAnswer: resolvedChoices.goodAnswer.slug,
        rejectionReasons: ["low-confidence"],
        technicalViable: true,
        publishabilityScore: publishabilityAssessment.publishabilityScore,
        publishabilityReasons: [],
        goodAnswerSource,
        details: {
          goodAnswerSource,
          businessRules: businessRules.debug,
          publishability: publishabilityAssessment,
          choiceResolution: toChoiceDebugPayload(resolvedChoices),
        } as Prisma.InputJsonValue,
      });
    }

    const qualityScore = calculateQualityScore({
      seed: {
        ...seed,
        lowConfidence: effectiveLowConfidence,
      },
      prediction,
      businessRules,
      resolvedChoices,
    });
    const choiceSignature = buildChoiceSignatureForHistory(
      resolvedChoices.goodAnswer.slug,
      resolvedChoices.distractors.map((item) => item.slug),
    );

    return {
      status: "accepted",
      technicalViable: true,
      snapshotIndex: input.candidate.snapshotIndex,
      rawPurchaseIndex: input.candidate.rawPurchaseIndex,
      snapshot: input.candidate.snapshot,
      scenario: input.candidate.scenario,
      payload,
      prediction,
        seed: {
          ...seed,
          lowConfidence: effectiveLowConfidence,
        },
        resolvedChoices,
        businessRules,
        qualityScore,
      variationSeed,
      choiceSignature,
      debugSummary: {
        snapshotIndex: input.candidate.snapshotIndex,
        snapshotMinute: Number(input.candidate.snapshot.timestampMinutes.toFixed(2)),
        patch: input.candidate.snapshot.patch,
        goldAvailable: input.candidate.snapshot.goldAvailable,
        snapshotSignature: buildSnapshotSignature({
          snapshotMinute: input.candidate.snapshot.timestampMinutes,
          goldAvailable: input.candidate.snapshot.goldAvailable,
          role: input.candidate.snapshot.role,
          currentItems: input.candidate.snapshot.currentItems,
        }),
        rawCandidatePoolSize: prediction.candidate_pool_size,
        filteredCandidatePoolSize: businessRules.debug.candidatePoolSizeAfterFallback,
        goodAnswer: resolvedChoices.goodAnswer.slug,
        qualityScore,
        rejectionReasons: [],
        lowConfidence: effectiveLowConfidence,
        confidenceScore: seed.confidenceScore,
        confidenceGap: seed.confidenceGap,
        technicalViable: true,
        publishable: true,
        publishabilityScore: publishabilityAssessment.publishabilityScore,
        publishabilityReasons: [],
        goodAnswerSource,
      },
    };
  } catch (error) {
    return buildRejectedAttempt({
      candidate: input.candidate,
      payload,
      rawCandidatePoolSize: 0,
      filteredCandidatePoolSize: 0,
      goodAnswer: null,
      rejectionReasons: [
        error instanceof HttpError ? `attempt-http-${error.status}` : error instanceof Error ? error.message : String(error),
      ],
      goodAnswerSource: "ml-prediction",
      details:
        error instanceof HttpError
          ? ({ status: error.status, details: error.details } as Prisma.InputJsonValue)
          : undefined,
    });
  }
}

function selectBestAttempt(input: {
  attempts: SnapshotAttempt[];
  allowLowConfidenceDraft: boolean;
}) {
  const accepted = input.attempts.filter((attempt): attempt is PreparedSnapshotAttempt => attempt.status === "accepted");
  const publishedCandidates = accepted.filter((attempt) => !attempt.seed.lowConfidence);
  const draftCandidates = accepted.filter((attempt) => attempt.seed.lowConfidence);
  const byScore = (left: PreparedSnapshotAttempt, right: PreparedSnapshotAttempt) =>
    right.qualityScore - left.qualityScore;

  if (publishedCandidates.length > 0) {
    return {
      selectedAttempt: [...publishedCandidates].sort(byScore)[0],
      draft: false,
    };
  }

  if (input.allowLowConfidenceDraft && draftCandidates.length > 0) {
    return {
      selectedAttempt: [...draftCandidates].sort(byScore)[0],
      draft: true,
    };
  }

  return {
    selectedAttempt: null,
    draft: false,
  };
}

function selectAttemptsForSeries(input: {
  attempts: SnapshotAttempt[];
  allowLowConfidenceDraft: boolean;
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}): SeriesSelectionResult {
  const accepted = input.attempts.filter((attempt): attempt is PreparedSnapshotAttempt => attempt.status === "accepted");
  const byAdjustedScore = (left: PreparedSnapshotAttempt, right: PreparedSnapshotAttempt) => {
    const leftPenalty = calculateSnapshotReusePenalty({
      attempt: left,
      previousSnapshots: input.previousSnapshots,
      now: input.now,
    });
    const rightPenalty = calculateSnapshotReusePenalty({
      attempt: right,
      previousSnapshots: input.previousSnapshots,
      now: input.now,
    });
    if (rightPenalty.adjustedQualityScore !== leftPenalty.adjustedQualityScore) {
      return rightPenalty.adjustedQualityScore - leftPenalty.adjustedQualityScore;
    }
    if (right.qualityScore !== left.qualityScore) {
      return right.qualityScore - left.qualityScore;
    }
    return left.snapshot.timestampMinutes - right.snapshot.timestampMinutes;
  };

  const chooseFromPool = (pool: PreparedSnapshotAttempt[]) => {
    const selectedAttempts: PreparedSnapshotAttempt[] = [];
    const segmentSummaries: SegmentEvaluationSummary[] = [];
    const repetitionExcluded: SeriesSelectionResult["repetitionExcluded"] = [];

    for (const segmentConfig of SNAPSHOT_SEGMENTS) {
      const previousForSegment = input.previousSnapshots
        .filter((entry) => getSnapshotSegment(entry.snapshotMinute) === segmentConfig.segment)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
      const segmentAttempts = pool
        .filter((attempt) => getSnapshotSegment(attempt.snapshot.timestampMinutes) === segmentConfig.segment)
        .sort((left, right) => {
          const leftDistance = previousForSegment
            ? computeSnapshotDistanceScore({
                current: {
                  snapshotMinute: left.snapshot.timestampMinutes,
                  goldAvailable: left.snapshot.goldAvailable,
                  currentItems: left.snapshot.currentItems,
                },
                previous: {
                  snapshotMinute: previousForSegment.snapshotMinute,
                  goldAvailable: Number(previousForSegment.signature.split("::")[2] ?? 0),
                  currentItems: (previousForSegment.signature.split("::")[3] ?? "").split("|").filter(Boolean),
                },
              })
            : 100;
          const rightDistance = previousForSegment
            ? computeSnapshotDistanceScore({
                current: {
                  snapshotMinute: right.snapshot.timestampMinutes,
                  goldAvailable: right.snapshot.goldAvailable,
                  currentItems: right.snapshot.currentItems,
                },
                previous: {
                  snapshotMinute: previousForSegment.snapshotMinute,
                  goldAvailable: Number(previousForSegment.signature.split("::")[2] ?? 0),
                  currentItems: (previousForSegment.signature.split("::")[3] ?? "").split("|").filter(Boolean),
                },
              })
            : 100;
          if (Math.abs(rightDistance - leftDistance) >= 12) {
            return rightDistance - leftDistance;
          }
          return byAdjustedScore(left, right);
        });
      const selectedAttempt = segmentAttempts[0] ?? null;
      if (selectedAttempt) {
        selectedAttempt.debugSummary.rerollDistanceScore = previousForSegment
          ? computeSnapshotDistanceScore({
              current: {
                snapshotMinute: selectedAttempt.snapshot.timestampMinutes,
                goldAvailable: selectedAttempt.snapshot.goldAvailable,
                currentItems: selectedAttempt.snapshot.currentItems,
              },
              previous: {
                snapshotMinute: previousForSegment.snapshotMinute,
                goldAvailable: Number(previousForSegment.signature.split("::")[2] ?? 0),
                currentItems: (previousForSegment.signature.split("::")[3] ?? "").split("|").filter(Boolean),
              },
            })
          : 100;
        selectedAttempts.push(selectedAttempt);
      }
      for (const repeatedAttempt of segmentAttempts) {
        if (selectedAttempt && repeatedAttempt.snapshotIndex === selectedAttempt.snapshotIndex) {
          continue;
        }
        const historyMetrics = getSnapshotHistoryMetrics({
          attempt: repeatedAttempt,
          previousSnapshots: input.previousSnapshots,
          now: input.now,
        });
        if (historyMetrics.signatureMatchCount === 0 && historyMetrics.exactMatchCount === 0) {
          continue;
        }
        repetitionExcluded.push({
          segment: segmentConfig.segment,
          snapshotIndex: repeatedAttempt.snapshotIndex,
          snapshotMinute: Number(repeatedAttempt.snapshot.timestampMinutes.toFixed(2)),
          qualityScore: repeatedAttempt.qualityScore,
          rerollDistanceScore: repeatedAttempt.debugSummary.rerollDistanceScore,
        });
      }
      const selectedHistoryMetrics = selectedAttempt
        ? getSnapshotHistoryMetrics({
          attempt: selectedAttempt,
          previousSnapshots: input.previousSnapshots,
          now: input.now,
        })
        : null;
      segmentSummaries.push({
        segment: segmentConfig.segment,
        totalAccepted: segmentAttempts.length,
        nonLowConfidenceAccepted: segmentAttempts.filter((attempt) => !attempt.seed.lowConfidence).length,
        lowConfidenceAccepted: segmentAttempts.filter((attempt) => attempt.seed.lowConfidence).length,
        selectedSnapshotIndex: selectedAttempt?.snapshotIndex ?? null,
        selectedSnapshotMinute: selectedAttempt ? Number(selectedAttempt.snapshot.timestampMinutes.toFixed(2)) : null,
        selectedQualityScore: selectedAttempt?.qualityScore ?? null,
        selectedFromHistoryFallback:
          Boolean(selectedAttempt)
          && Boolean(selectedHistoryMetrics)
          && (selectedHistoryMetrics.signatureMatchCount > 0 || selectedHistoryMetrics.exactMatchCount > 0),
      });
    }

    return {
      selectedAttempts,
      segmentSummaries,
      repetitionExcluded,
    };
  };

  const publishedCandidates = accepted.filter((attempt) => !attempt.seed.lowConfidence);
  const publishedSelection = chooseFromPool(publishedCandidates);
  if (publishedSelection.selectedAttempts.length > 0) {
    const primaryAttempt = [...publishedSelection.selectedAttempts].sort(byAdjustedScore)[0] ?? null;
    const orderedAttempts = primaryAttempt
      ? [
          primaryAttempt,
          ...publishedSelection.selectedAttempts
            .filter((attempt) => attempt.snapshotIndex !== primaryAttempt.snapshotIndex)
            .sort((left, right) => left.snapshot.timestampMinutes - right.snapshot.timestampMinutes),
        ]
      : [];
    return {
      selectedAttempts: orderedAttempts,
      primaryAttempt,
      draft: false,
      segmentSummaries: publishedSelection.segmentSummaries,
      repetitionExcluded: publishedSelection.repetitionExcluded,
    };
  }

  if (input.allowLowConfidenceDraft) {
    const draftCandidates = accepted.filter((attempt) => attempt.seed.lowConfidence);
    const draftSelection = chooseFromPool(draftCandidates);
    if (draftSelection.selectedAttempts.length > 0) {
      const primaryAttempt = [...draftSelection.selectedAttempts].sort(byAdjustedScore)[0] ?? null;
      const orderedAttempts = primaryAttempt
        ? [
            primaryAttempt,
            ...draftSelection.selectedAttempts
              .filter((attempt) => attempt.snapshotIndex !== primaryAttempt.snapshotIndex)
              .sort((left, right) => left.snapshot.timestampMinutes - right.snapshot.timestampMinutes),
          ]
        : [];
      return {
        selectedAttempts: orderedAttempts,
        primaryAttempt,
        draft: true,
        segmentSummaries: draftSelection.segmentSummaries,
        repetitionExcluded: draftSelection.repetitionExcluded,
      };
    }
  }

  return {
    selectedAttempts: [],
    primaryAttempt: null,
    draft: false,
    segmentSummaries: SNAPSHOT_SEGMENTS.map((segmentConfig) => ({
      segment: segmentConfig.segment,
      totalAccepted: accepted.filter((attempt) => getSnapshotSegment(attempt.snapshot.timestampMinutes) === segmentConfig.segment)
        .length,
      nonLowConfidenceAccepted: accepted.filter(
        (attempt) => getSnapshotSegment(attempt.snapshot.timestampMinutes) === segmentConfig.segment && !attempt.seed.lowConfidence,
      ).length,
      lowConfidenceAccepted: accepted.filter(
        (attempt) => getSnapshotSegment(attempt.snapshot.timestampMinutes) === segmentConfig.segment && attempt.seed.lowConfidence,
      ).length,
      selectedSnapshotIndex: null,
      selectedSnapshotMinute: null,
      selectedQualityScore: null,
      selectedFromHistoryFallback: false,
    })),
    repetitionExcluded: [],
  };
}

async function persistAiGeneratedPuzzle(input: {
  championId: string;
  championName: string;
  championSlug: string;
  attempt: PreparedSnapshotAttempt;
  draft: boolean;
  seriesIndex: number;
  primary: boolean;
}) {
  const choiceSlugs = [
    input.attempt.resolvedChoices.goodAnswer.slug,
    ...input.attempt.resolvedChoices.distractors.map((item) => item.slug),
  ];
  const itemIndex = await getItemsBySlugs(choiceSlugs);
  const orderedChoices = shuffleResolvedChoices(
    input.attempt.resolvedChoices.goodAnswer,
    input.attempt.resolvedChoices.distractors,
    input.attempt.variationSeed,
  );
  const metadataSummary = [
    `lowConfidence=${input.attempt.seed.lowConfidence}`,
    `confidence=${input.attempt.seed.confidenceScore.toFixed(4)}`,
    `gap=${input.attempt.seed.confidenceGap.toFixed(4)}`,
    `candidatePoolSize=${input.attempt.seed.candidatePoolSize}`,
    `snapshotMinute=${input.attempt.snapshot.timestampMinutes.toFixed(2)}`,
    `snapshotIndex=${input.attempt.snapshotIndex}`,
    `qualityScore=${input.attempt.qualityScore.toFixed(2)}`,
    `variationSeed=${input.attempt.variationSeed}`,
    `choiceSignature=${input.attempt.choiceSignature}`,
  ].join(" | ");
  const uniqueSlugSeed = [
    input.championSlug,
    "ai-generated",
    Date.now(),
    process.hrtime.bigint().toString(),
    input.attempt.snapshotIndex,
    input.seriesIndex + 1,
    input.attempt.variationSeed,
  ].join("-");

  return prisma.puzzle.create({
    data: {
      title: `${input.championName} AI item puzzle`,
      slug: slugify(uniqueSlugSeed),
      mode: PuzzleMode.PERSONALIZED,
      sourceType: PuzzleSourceType.AI_GENERATED,
      difficulty:
        input.attempt.seed.difficulty === "easy"
          ? PuzzleDifficulty.BEGINNER
          : input.attempt.seed.difficulty === "medium"
            ? PuzzleDifficulty.INTERMEDIATE
            : PuzzleDifficulty.ADVANCED,
      patch: input.attempt.snapshot.patch,
      description: input.draft
        ? `Brouillon genere par le service ML pour ${input.championName}, a revoir avant toute publication.`
        : `Puzzle genere par le service ML pour ${input.championName}.`,
      shortPrompt: input.draft
        ? `Brouillon ML faible confiance pour ${input.championName}.`
        : `Le modele propose le prochain item le plus coherent pour ${input.championName}.`,
      situation: `Tu joues ${input.championName} vers ${input.attempt.snapshot.timestampMinutes.toFixed(1)} minutes avec ${input.attempt.snapshot.goldAvailable} gold disponible.`,
      question: "Quel est le meilleur prochain achat dans cette situation ?",
      explanation: `La prediction ML privilegie ${itemIndex.get(resolveItemSlug(input.attempt.resolvedChoices.goodAnswer.slug))?.name ?? input.attempt.resolvedChoices.goodAnswer.slug}.`,
      role: input.attempt.snapshot.role,
      championId: input.championId,
      isPublished: false,
      isDailyEligible: false,
      choices: {
        create: orderedChoices.map(({ item: resolvedItem, isCorrect }, index) => {
          const item = itemIndex.get(resolveItemSlug(resolvedItem.slug))!;
          return {
            label: item.name,
            choiceType: item.isBoots ? PuzzleChoiceType.BOOTS : PuzzleChoiceType.ITEM,
            itemId: item.id,
            explanation: isCorrect
              ? "Choix principal du modele ranking."
              : "Distracteur plausible propose pour revue manuelle.",
            isCorrect,
            displayOrder: index + 1,
          };
        }),
      },
      scenario: {
        create: {
          playerChampionId: input.championId,
          playerRole: input.attempt.snapshot.role ?? Role.FLEX,
          gameMinute: Math.max(1, Math.round(input.attempt.snapshot.timestampMinutes)),
          playerGold: input.attempt.snapshot.goldAvailable,
          playerLevel: input.attempt.snapshot.level,
          kills: input.attempt.snapshot.kills,
          deaths: input.attempt.snapshot.deaths,
          assists: input.attempt.snapshot.assists,
          cs: input.attempt.snapshot.cs,
          currentBuild: input.attempt.scenario.currentBuild as Prisma.InputJsonValue,
          allyTeam: input.attempt.scenario.allyTeam as Prisma.InputJsonValue,
          enemyTeam: input.attempt.scenario.enemyTeam as Prisma.InputJsonValue,
          objectiveState: input.attempt.businessRules.objectiveState as Prisma.InputJsonValue,
          damageProfile: input.attempt.businessRules.damageProfile as Prisma.InputJsonValue,
          mapState: input.attempt.businessRules.mapState as Prisma.InputJsonValue,
          notes: `${input.attempt.businessRules.notes} ${metadataSummary}`,
        },
      },
      tags: {
        create: [
          "ai-generated",
          "ml",
          "next-item",
          "ml-draft",
          "ml-series",
          ...(input.primary ? ["ml-series-primary"] : []),
          ...(input.draft ? ["low-confidence"] : []),
        ].map((tag) => ({
          tag: {
            connectOrCreate: {
              where: { slug: slugify(tag) },
              create: { slug: slugify(tag), name: tag },
            },
          },
        })),
      },
    },
  });
}

async function updateGeneratedRequest(input: {
  requestId: string;
  status: GeneratedPuzzleRequestStatus;
  parameters: Prisma.InputJsonValue;
  resultPuzzleId?: string;
}) {
  await prisma.generatedPuzzleRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.status,
      parameters: input.parameters,
      resultPuzzleId: input.resultPuzzleId,
    },
  });
}

export const mlPuzzleGenerationService = {
  isConfigured() {
    return isMlConfigured();
  },

  async generateFromImportedMatch(
    importedMatchId: string,
    userId: string,
    options?: {
      forceDraftOnLowConfidence?: boolean;
      actorIsAdmin?: boolean;
    },
  ): Promise<MatchGenerationResponse> {
    if (!isMlConfigured()) {
      throw new HttpError(503, "ML puzzle generation is not configured.");
    }

    const request = await prisma.generatedPuzzleRequest.create({
      data: {
        userId,
        type: GeneratedPuzzleRequestType.MATCH_BASED,
        importedMatchId,
        status: GeneratedPuzzleRequestStatus.PROCESSING,
        parameters: { mode: "ml-api-multi-snapshot" },
      },
    });

    try {
      const importedMatch = await prisma.importedMatch.findUnique({
        where: { id: importedMatchId },
      });
      if (!importedMatch) {
        throw new HttpError(404, "Imported match not found.");
      }

      const champion = await prisma.champion.findUnique({
        where: { slug: importedMatch.targetChampionSlug ?? "" },
      });
      if (!champion) {
        throw new HttpError(400, "Champion not found for AI-generated puzzle.");
      }

      const allowLowConfidenceDraft = isLowConfidenceDraftAllowed({
        isAdmin: Boolean(options?.actorIsAdmin),
        envEnabled: env.ML_ALLOW_LOW_CONFIDENCE_DRAFTS,
        forceDraftOnLowConfidence: options?.forceDraftOnLowConfidence,
      });
      const snapshotCandidates = await buildSnapshotCandidatesFromImportedMatch(importedMatch);
      const effectivePatch = resolveEffectivePatchLookup({
        importedMatchPatch: importedMatch.patch,
        gameCreationAt: importedMatch.gameCreationAt,
        matchData: importedMatch.matchData,
        snapshotFallbackPatch: snapshotCandidates[0]?.snapshot.patch ?? null,
      });
      const patchChoiceItems = await getPatchChoiceItems(effectivePatch);
      const previousChoiceSignatures = await getPreviousChoiceSignatures({
        importedMatchId,
        userId,
      });
      const previousServedSnapshots = await getPreviousServedSnapshots({
        importedMatchId,
        userId,
      });
      const championTags = Array.isArray(champion.tags) ? champion.tags.map((tag) => String(tag)) : [];
      const prevalidation = snapshotCandidates.map((candidate) => ({
        candidate,
        verdict: prevalidateSnapshotCandidate({
          candidate,
          patchChoiceItems,
          championTags,
        }),
      }));
      const prevalidationRejectedBySnapshot = Object.fromEntries(
        prevalidation
          .filter((entry) => !entry.verdict.allowed)
          .map((entry) => [entry.candidate.snapshotIndex, entry.verdict.rejectionReasons]),
      ) satisfies Record<number, string[]>;
      const viableSnapshotCandidates = prevalidation
        .filter((entry) => entry.verdict.allowed)
        .map((entry) => entry.candidate);
      const attempts: SnapshotAttempt[] = [];

      for (const candidate of viableSnapshotCandidates) {
        const attempt = await prepareSnapshotAttempt({
          importedMatchId,
          userId,
          championTags,
          candidate,
          patchChoiceItems,
          previousChoiceSignatures,
        });
        attempts.push(attempt);
        logSnapshotAttempt(request.id, importedMatchId, attempt);
      }

      const selection = selectAttemptsForSeries({
        attempts,
        allowLowConfidenceDraft,
        previousSnapshots: previousServedSnapshots,
      });
      console.info(
        "[ml-puzzle] generation-history",
        JSON.stringify({
          requestId: request.id,
          importedMatchId,
          userId,
          memoryCacheHit: false,
          previousSnapshotCount: previousServedSnapshots.length,
          previousSnapshotKeys: previousServedSnapshots.map((entry) => entry.key),
          previousSnapshotSignatures: [...new Set(previousServedSnapshots.map((entry) => entry.signature))].slice(0, 12),
        }),
      );
      console.info(
        "[ml-puzzle] segments-evaluated",
        JSON.stringify({
          requestId: request.id,
          importedMatchId,
          previousSnapshotKeys: previousServedSnapshots.map((entry) => entry.key),
          segments: selection.segmentSummaries,
        }),
      );
      console.info(
        "[ml-puzzle] snapshot-prevalidation",
        JSON.stringify({
          requestId: request.id,
          importedMatchId,
          candidates: snapshotCandidates.length,
          viableCandidates: viableSnapshotCandidates.length,
          rejectedBySnapshot: prevalidationRejectedBySnapshot,
        }),
      );
      if (selection.repetitionExcluded.length > 0) {
        console.info(
          "[ml-puzzle] snapshots-excluded-for-repetition",
          JSON.stringify({
            requestId: request.id,
            importedMatchId,
            excluded: selection.repetitionExcluded,
          }),
        );
      }

      if (selection.primaryAttempt) {
        const persistedPuzzles = [];
        for (const [seriesIndex, attempt] of selection.selectedAttempts.entries()) {
          const puzzle = await persistAiGeneratedPuzzle({
            championId: champion.id,
            championName: champion.name,
            championSlug: champion.slug,
            attempt,
            draft: selection.draft,
            seriesIndex,
            primary: attempt.snapshotIndex === selection.primaryAttempt.snapshotIndex,
          });
          persistedPuzzles.push(puzzle);
        }
        const primaryPuzzle = persistedPuzzles[0]!;
        await updateGeneratedRequest({
          requestId: request.id,
          status: GeneratedPuzzleRequestStatus.COMPLETED,
          resultPuzzleId: primaryPuzzle.id,
          parameters: buildMlRequestMetadata({
            generationStatus: "completed",
            selectedAttempts: selection.selectedAttempts,
            attemptSummaries: attempts.map((attempt) => attempt.debugSummary),
            payload: selection.primaryAttempt.payload,
            resultPuzzles: persistedPuzzles.map((puzzle) => ({ id: puzzle.id, slug: puzzle.slug })),
            segmentSummaries: selection.segmentSummaries,
            repetitionExcluded: selection.repetitionExcluded,
            draft: selection.draft,
          }),
        });
        console.info(
          "[ml-puzzle] selected-snapshots",
          JSON.stringify({
            requestId: request.id,
            importedMatchId,
            selectedSnapshots: selection.selectedAttempts.map((attempt) => ({
              segment: getSnapshotSegment(attempt.snapshot.timestampMinutes),
              snapshotIndex: attempt.snapshotIndex,
              snapshotMinute: attempt.snapshot.timestampMinutes,
              snapshotSignature: buildSnapshotSignature({
                snapshotMinute: attempt.snapshot.timestampMinutes,
                goldAvailable: attempt.snapshot.goldAvailable,
                role: attempt.snapshot.role,
                currentItems: attempt.snapshot.currentItems,
              }),
              qualityScore: attempt.qualityScore,
              adjustedQualityScore: calculateSnapshotReusePenalty({
                attempt,
                previousSnapshots: previousServedSnapshots,
              }).adjustedQualityScore,
              historyKey: buildSnapshotHistoryKey({
                snapshotIndex: attempt.snapshotIndex,
                snapshotMinute: attempt.snapshot.timestampMinutes,
              }),
            })),
            candidates: attempts.map((attempt) => ({
              snapshotIndex: attempt.snapshotIndex,
              snapshotMinute: Number(attempt.snapshot.timestampMinutes.toFixed(2)),
              snapshotSignature: attempt.debugSummary.snapshotSignature,
              status: attempt.status,
              qualityScore: attempt.debugSummary.qualityScore,
              rejectionReasons: attempt.debugSummary.rejectionReasons,
              reuse:
                attempt.status === "accepted"
                  ? calculateSnapshotReusePenalty({
                    attempt,
                    previousSnapshots: previousServedSnapshots,
                  })
                  : null,
            })),
            lowConfidence: selection.primaryAttempt.seed.lowConfidence,
            draft: selection.draft,
          }),
        );

        return {
          generationStatus: "completed",
          requestId: request.id,
          slug: primaryPuzzle.slug,
          slugs: persistedPuzzles.map((puzzle) => puzzle.slug),
          sourceType: "ai_generated",
          published: false,
          lowConfidence: selection.primaryAttempt.seed.lowConfidence,
          draft: selection.draft,
        };
      }

      const diagnostics = summarizeNoViableDiagnostics({
        snapshotCandidates,
        attempts,
        prevalidationRejections: prevalidationRejectedBySnapshot,
      });
      const failureCode =
        diagnostics.viableSnapshots > 0 && diagnostics.publishableSnapshots === 0
          ? "no_publishable_snapshot_found"
          : "no_viable_snapshot_found";
      await updateGeneratedRequest({
        requestId: request.id,
        status: GeneratedPuzzleRequestStatus.FAILED,
        parameters: buildMlRequestMetadata({
          failureCode,
          generationStatus: failureCode,
          attemptSummaries: attempts.map((attempt) => attempt.debugSummary),
          prevalidationRejectedBySnapshot,
          ...diagnostics,
          segmentSummaries: selection.segmentSummaries,
          repetitionExcluded: selection.repetitionExcluded,
        }),
      });
      console.warn(
        "[ml-puzzle] no-viable-snapshot",
        JSON.stringify({
          requestId: request.id,
          importedMatchId,
          snapshotsEvaluated: diagnostics.snapshotsEvaluated,
          viableSnapshots: diagnostics.viableSnapshots,
          publishableSnapshots: diagnostics.publishableSnapshots,
          nonPublishableButViableSnapshots: diagnostics.nonPublishableButViableSnapshots,
          dominantRejectionReasons: diagnostics.dominantRejectionReasons,
        }),
      );

      return {
        generationStatus: failureCode,
        failureCode,
        requestId: request.id,
        slug: null,
        slugs: [],
        sourceType: "ai_generated",
        published: false,
        lowConfidence: false,
        draft: false,
        retrySuggested: true,
        snapshotsEvaluated: diagnostics.snapshotsEvaluated,
        viableSnapshots: diagnostics.viableSnapshots,
        publishableSnapshots: diagnostics.publishableSnapshots,
        nonPublishableButViableSnapshots: diagnostics.nonPublishableButViableSnapshots,
        dominantRejectionReasons: diagnostics.dominantRejectionReasons,
        message:
          failureCode === "no_publishable_snapshot_found"
            ? "La partie a bien ete importee et certains snapshots etaient techniquement viables, mais aucun n'etait assez publiable. Le backend a rejete des moments ou la bonne reponse restait trop triviale ou les distracteurs n'etaient pas assez credibles."
            : "La partie a bien ete importee, mais aucun snapshot suffisamment credible n'a ete trouve sur cette partie. Le backend a essaye plusieurs moments d'achat et tu peux relancer plus tard apres enrichissement du modele.",
      };
    } catch (error) {
      await updateGeneratedRequest({
        requestId: request.id,
        status: GeneratedPuzzleRequestStatus.FAILED,
        parameters: {
          generationStatus: "failed",
          reason: error instanceof Error ? error.message : String(error),
        } as Prisma.InputJsonValue,
      });
      throw error;
    }
  },
};

export const mlPuzzleGenerationServiceTestables = {
  scoreSnapshotCandidate,
  dedupeAndRankSnapshots,
  selectBestAttempt,
  getSnapshotSegment,
  selectAttemptsForSeries,
  computeSnapshotDistanceScore,
  resolveEffectivePatchLookup,
  calculateGoldBeforePurchaseFromFrame,
  isMeaningfulPurchaseSnapshotCandidate,
  summarizeNoViableDiagnostics,
  assessSnapshotPublishability,
  getPublishabilityFloorGold,
};
