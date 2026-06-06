import type { MlPuzzleSnapshot } from "./mlPuzzle.js";

export type SnapshotSegment = "early" | "mid" | "late";

export type SnapshotHistoryEntry = {
  snapshotIndex: number;
  snapshotMinute: number;
  key: string;
  signature: string;
  createdAt: Date;
};

export type SegmentEvaluationSummary = {
  segment: SnapshotSegment;
  totalAccepted: number;
  nonLowConfidenceAccepted: number;
  lowConfidenceAccepted: number;
  selectedSnapshotIndex: number | null;
  selectedSnapshotMinute: number | null;
  selectedQualityScore: number | null;
  selectedFromHistoryFallback: boolean;
};

export type SnapshotSelectionAttempt = {
  status: "accepted" | "rejected";
  snapshotIndex: number;
  snapshot: MlPuzzleSnapshot;
  seed: {
    lowConfidence: boolean;
  };
  qualityScore: number;
  debugSummary: {
    rerollDistanceScore?: number;
  };
};

export type SeriesSelectionResult<TAttempt extends SnapshotSelectionAttempt> = {
  selectedAttempts: TAttempt[];
  primaryAttempt: TAttempt | null;
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

export const SNAPSHOT_SEGMENTS: ReadonlyArray<{
  segment: SnapshotSegment;
  minInclusive: number;
  maxExclusive: number;
}> = [
  { segment: "early", minInclusive: 8, maxExclusive: 14 },
  { segment: "mid", minInclusive: 14, maxExclusive: 23 },
  { segment: "late", minInclusive: 23, maxExclusive: 32.01 },
];

const compareText = (left: string, right: string) => left.localeCompare(right);

export function buildSnapshotHistoryKey(input: {
  snapshotIndex: number;
  snapshotMinute: number;
}) {
  return `${input.snapshotIndex}:${input.snapshotMinute.toFixed(2)}`;
}

export function buildSnapshotSignature(input: {
  snapshotMinute: number;
  goldAvailable: number;
  role: string | null;
  currentItems: string[];
}) {
  return [
    input.role ?? "FLEX",
    input.snapshotMinute.toFixed(2),
    Math.max(0, Math.round(input.goldAvailable)),
    [...input.currentItems].sort(compareText).join("|"),
  ].join("::");
}

export function computeSnapshotDistanceScore(input: {
  current: {
    snapshotMinute: number;
    goldAvailable: number;
    currentItems: string[];
  };
  previous: {
    snapshotMinute: number;
    goldAvailable: number;
    currentItems: string[];
  };
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

export function getSnapshotSegment(snapshotMinute: number): SnapshotSegment | null {
  return SNAPSHOT_SEGMENTS.find(
    (entry) => snapshotMinute >= entry.minInclusive && snapshotMinute < entry.maxExclusive,
  )?.segment ?? null;
}

function getSnapshotHistoryMetrics<TAttempt extends SnapshotSelectionAttempt>(input: {
  attempt: TAttempt;
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

export function calculateSnapshotReusePenalty<TAttempt extends SnapshotSelectionAttempt>(input: {
  attempt: TAttempt;
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

export function selectBestAttempt<TAttempt extends SnapshotSelectionAttempt>(input: {
  attempts: Array<TAttempt | { status: "rejected" }>;
  allowLowConfidenceDraft: boolean;
}) {
  const accepted = input.attempts.filter((attempt): attempt is TAttempt => attempt.status === "accepted");
  const publishedCandidates = accepted.filter((attempt) => !attempt.seed.lowConfidence);
  const draftCandidates = accepted.filter((attempt) => attempt.seed.lowConfidence);
  const byScore = (left: TAttempt, right: TAttempt) =>
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

export function selectAttemptsForSeries<TAttempt extends SnapshotSelectionAttempt>(input: {
  attempts: Array<TAttempt | { status: "rejected" }>;
  allowLowConfidenceDraft: boolean;
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}): SeriesSelectionResult<TAttempt> {
  const accepted = input.attempts.filter((attempt): attempt is TAttempt => attempt.status === "accepted");
  const byAdjustedScore = (left: TAttempt, right: TAttempt) => {
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

  const chooseFromPool = (pool: TAttempt[]) => {
    const selectedAttempts: TAttempt[] = [];
    const segmentSummaries: SegmentEvaluationSummary[] = [];
    const repetitionExcluded: SeriesSelectionResult<TAttempt>["repetitionExcluded"] = [];

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
