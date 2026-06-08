import {
  GeneratedPuzzleRequestStatus,
  GeneratedPuzzleRequestType,
  Prisma,
  PuzzleSourceType,
} from "@prisma/client";
import { env } from "../config/env.js";
import { getItemGroups } from "../lib/itemGroups.js";
import {
  isLowConfidenceDraftAllowed,
  isMlGenerationConfigured,
  type MlPredictNextItemResponse,
} from "../lib/ml/mlPuzzle.js";
import {
  buildSnapshotCandidates,
  calculateGoldBeforePurchaseFromFrame,
  collectSnapshotBuilderItemIds,
  dedupeAndRankSnapshots,
  type SnapshotCandidate,
  type SnapshotChampionProfile,
} from "../lib/ml/snapshotCandidateBuilder.js";
import { buildPatchLookupCandidates, canonicalizePatch, type PatchFormat } from "../lib/riot/patchCanonical.js";
import {
  assessSnapshotPublishability,
  getPublishabilityFloorGold,
  isMeaningfulPurchaseSnapshotCandidate,
  scoreSnapshotCandidate,
} from "../lib/ml/snapshotQuality.js";
import {
  evaluateSnapshotAttempt,
  logSnapshotAttempt,
  prevalidateSnapshotCandidate,
  type PreparedSnapshotAttempt,
  type SnapshotAttempt,
} from "../lib/ml/snapshotAttemptEvaluator.js";
import {
  buildSnapshotHistoryKey,
  buildSnapshotSignature,
  calculateSnapshotReusePenalty,
  computeSnapshotDistanceScore,
  getSnapshotSegment,
  selectAttemptsForSeries,
  selectBestAttempt,
  type SnapshotHistoryEntry,
} from "../lib/ml/snapshotSeriesSelection.js";
import {
  type MlChoiceItem,
} from "../lib/ml/puzzleChoiceResolution.js";
import { prisma } from "../lib/prisma.js";
import { importedMatchArchiveRepository } from "../repositories/importedMatchArchiveRepository.js";
import { HttpError } from "../utils/http.js";
import {
  buildMlRequestMetadata,
  summarizeNoViableDiagnostics,
} from "../lib/ml/generationDiagnostics.js";
import {
  persistAiGeneratedPuzzle,
  updateGeneratedRequest,
} from "../lib/ml/puzzlePersistence.js";

type ImportedMatchForMl = Awaited<ReturnType<typeof prisma.importedMatch.findUnique>>;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return 0;
}

function isMlConfigured() {
  return isMlGenerationConfigured({
    enabled: env.ML_ENABLED,
    apiUrl: env.ML_API_URL,
  });
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

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      buildsFrom: Array.isArray(item.buildsFrom) ? item.buildsFrom.map(String) : [],
      itemGroups: getItemGroups({
        ...item,
        fullDescription: item.fullDescription,
      }).map(String),
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
      .map((candidate) => /^(\d{1,2})\./.exec(candidate)?.[1] ?? null)
      .filter(Boolean)
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
        .filter(Boolean) ?? [],
    )
    .filter((slugs) => slugs.length === 4)
    .map((slugs) => [...slugs].sort((left, right) => left.localeCompare(right)).join("|"));
}

function extractSnapshotEntriesFromParameters(parameters: unknown, createdAt: Date): SnapshotHistoryEntry[] {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    return [];
  }
  const objectParameters = parameters as Record<string, unknown>;
  let selectedSnapshots: unknown[];
  if (Array.isArray(objectParameters.selectedSnapshots)) {
    selectedSnapshots = objectParameters.selectedSnapshots;
  } else if (objectParameters.selectedSnapshot) {
    selectedSnapshots = [objectParameters.selectedSnapshot];
  } else {
    selectedSnapshots = [];
  }

  const entries: SnapshotHistoryEntry[] = [];
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
    const key = buildSnapshotHistoryKey({ snapshotIndex, snapshotMinute });
    entries.push({
      snapshotIndex,
      snapshotMinute,
      key,
      signature:
        typeof snapshotObject.snapshotSignature === "string" && snapshotObject.snapshotSignature.length > 0
          ? snapshotObject.snapshotSignature
          : key,
      createdAt,
    });
  }
  return entries;
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
    select: { parameters: true, createdAt: true },
  });

  return requests.flatMap((request) =>
    extractSnapshotEntriesFromParameters(request.parameters, request.createdAt),
  );
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
  const championIndex = new Map<number, SnapshotChampionProfile>(
    champions.map((champion) => [
      champion.riotChampionId ?? 0,
      {
        slug: champion.slug,
        tags: Array.isArray(champion.tags) ? champion.tags.map(String) : [],
      },
    ]),
  );

  const itemIdsSeen = collectSnapshotBuilderItemIds(frames);

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

  const builtCandidates = buildSnapshotCandidates({
    importedMatch: {
      patch: importedMatch.patch ?? null,
      targetPuuid: importedMatch.targetPuuid,
      targetChampionSlug: importedMatch.targetChampionSlug ?? null,
      targetRole: importedMatch.targetRole ?? null,
    },
    participants,
    frames,
    championIndex,
    itemSlugIndex,
    itemGoldIndex,
  });

  if (!builtCandidates.targetParticipantFound) {
    throw new HttpError(400, "Target participant was not found in imported match data.");
  }

  const rawCandidates = builtCandidates.rawCandidates;
  const deduped = builtCandidates.dedupedCandidates;
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
    return rawCandidates.slice(-1);
  }
  throw new HttpError(400, "No purchase snapshot could be reconstructed from the imported match.");
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
      const championTags = Array.isArray(champion.tags) ? champion.tags.map(String) : [];
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
        const attempt = await evaluateSnapshotAttempt({
          importedMatchId,
          userId,
          championTags,
          candidate,
          patchChoiceItems,
          previousChoiceSignatures,
          predictNextItem: postPrediction,
        });
        attempts.push(attempt);
        logSnapshotAttempt(request.id, importedMatchId, attempt);
      }

      const selection = selectAttemptsForSeries<PreparedSnapshotAttempt>({
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
