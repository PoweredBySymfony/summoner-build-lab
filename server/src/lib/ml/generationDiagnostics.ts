import { type Prisma } from "@prisma/client";
import { type SnapshotCandidate } from "./snapshotCandidateBuilder.js";
import {
  type AttemptDebugSummary,
  type PreparedSnapshotAttempt,
  type SnapshotAttempt,
} from "./snapshotAttemptEvaluator.js";
import {
  buildSnapshotHistoryKey,
  buildSnapshotSignature,
  getSnapshotSegment,
  type SegmentEvaluationSummary,
  type SnapshotSegment,
} from "./snapshotSeriesSelection.js";

type MatchGenerationNoViableFailureCode = "no_viable_snapshot_found" | "no_publishable_snapshot_found";

export function countReasons(reasons: string[]): Record<string, number> {
  return reasons.reduce<Record<string, number>>((accumulator, reason) => {
    accumulator[reason] = (accumulator[reason] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function sortReasonEntries(entries: Record<string, number>): string[] {
  return Object.entries(entries)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([reason]) => reason);
}

export function summarizeNoViableDiagnostics(input: {
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

export function buildMlRequestMetadata(input: {
  generationStatus: "completed" | "no_viable_snapshot_found" | "no_publishable_snapshot_found";
  failureCode?: MatchGenerationNoViableFailureCode;
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
