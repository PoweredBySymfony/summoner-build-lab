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

function compareAttemptsByAdjustedScore<TAttempt extends SnapshotSelectionAttempt>(input: {
  left: TAttempt;
  right: TAttempt;
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}) {
  const leftPenalty = calculateSnapshotReusePenalty({
    attempt: input.left,
    previousSnapshots: input.previousSnapshots,
    now: input.now,
  });
  const rightPenalty = calculateSnapshotReusePenalty({
    attempt: input.right,
    previousSnapshots: input.previousSnapshots,
    now: input.now,
  });

  if (rightPenalty.adjustedQualityScore !== leftPenalty.adjustedQualityScore) {
    return rightPenalty.adjustedQualityScore - leftPenalty.adjustedQualityScore;
  }

  if (input.right.qualityScore !== input.left.qualityScore) {
    return input.right.qualityScore - input.left.qualityScore;
  }

  return input.left.snapshot.timestampMinutes - input.right.snapshot.timestampMinutes;
}

function getPreviousSnapshotForSegment(input: {
  previousSnapshots: SnapshotHistoryEntry[];
  segment: SnapshotSegment;
}) {
  return input.previousSnapshots
    .filter((entry) => getSnapshotSegment(entry.snapshotMinute) === input.segment)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
}

function getPreviousSnapshotDistanceInput(previous: SnapshotHistoryEntry) {
  return {
    snapshotMinute: previous.snapshotMinute,
    goldAvailable: Number(previous.signature.split("::")[2] ?? 0),
    currentItems: (previous.signature.split("::")[3] ?? "").split("|").filter(Boolean),
  };
}

function getSnapshotDistanceFromPrevious<TAttempt extends SnapshotSelectionAttempt>(
  attempt: TAttempt,
  previous: SnapshotHistoryEntry | undefined,
) {
  if (!previous) {
    return 100;
  }

  return computeSnapshotDistanceScore({
    current: {
      snapshotMinute: attempt.snapshot.timestampMinutes,
      goldAvailable: attempt.snapshot.goldAvailable,
      currentItems: attempt.snapshot.currentItems,
    },
    previous: getPreviousSnapshotDistanceInput(previous),
  });
}

function sortSegmentAttempts<TAttempt extends SnapshotSelectionAttempt>(input: {
  attempts: TAttempt[];
  segment: SnapshotSegment;
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}) {
  const previousForSegment = getPreviousSnapshotForSegment({
    previousSnapshots: input.previousSnapshots,
    segment: input.segment,
  });

  return input.attempts
    .filter((attempt) => getSnapshotSegment(attempt.snapshot.timestampMinutes) === input.segment)
    .sort((left, right) => {
      const leftDistance = getSnapshotDistanceFromPrevious(left, previousForSegment);
      const rightDistance = getSnapshotDistanceFromPrevious(right, previousForSegment);
      if (Math.abs(rightDistance - leftDistance) >= 12) {
        return rightDistance - leftDistance;
      }

      return compareAttemptsByAdjustedScore({
        left,
        right,
        previousSnapshots: input.previousSnapshots,
        now: input.now,
      });
    });
}

function collectRepetitionExcluded<TAttempt extends SnapshotSelectionAttempt>(input: {
  segment: SnapshotSegment;
  selectedAttempt: TAttempt | null;
  segmentAttempts: TAttempt[];
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}) {
  return input.segmentAttempts
    .filter((attempt) => attempt.snapshotIndex !== input.selectedAttempt?.snapshotIndex)
    .filter((attempt) => {
      const historyMetrics = getSnapshotHistoryMetrics({
        attempt,
        previousSnapshots: input.previousSnapshots,
        now: input.now,
      });
      return historyMetrics.signatureMatchCount > 0 || historyMetrics.exactMatchCount > 0;
    })
    .map((attempt) => ({
      segment: input.segment,
      snapshotIndex: attempt.snapshotIndex,
      snapshotMinute: Number(attempt.snapshot.timestampMinutes.toFixed(2)),
      qualityScore: attempt.qualityScore,
      rerollDistanceScore: attempt.debugSummary.rerollDistanceScore,
    }));
}

function buildSegmentSummary<TAttempt extends SnapshotSelectionAttempt>(input: {
  segment: SnapshotSegment;
  segmentAttempts: TAttempt[];
  selectedAttempt: TAttempt | null;
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}): SegmentEvaluationSummary {
  const selectedHistoryMetrics = input.selectedAttempt
    ? getSnapshotHistoryMetrics({
        attempt: input.selectedAttempt,
        previousSnapshots: input.previousSnapshots,
        now: input.now,
      })
    : null;

  return {
    segment: input.segment,
    totalAccepted: input.segmentAttempts.length,
    nonLowConfidenceAccepted: input.segmentAttempts.filter((attempt) => !attempt.seed.lowConfidence).length,
    lowConfidenceAccepted: input.segmentAttempts.filter((attempt) => attempt.seed.lowConfidence).length,
    selectedSnapshotIndex: input.selectedAttempt?.snapshotIndex ?? null,
    selectedSnapshotMinute: input.selectedAttempt ? Number(input.selectedAttempt.snapshot.timestampMinutes.toFixed(2)) : null,
    selectedQualityScore: input.selectedAttempt?.qualityScore ?? null,
    selectedFromHistoryFallback:
      Boolean(input.selectedAttempt)
      && Boolean(selectedHistoryMetrics)
      && (selectedHistoryMetrics.signatureMatchCount > 0 || selectedHistoryMetrics.exactMatchCount > 0),
  };
}

function chooseAttemptsFromPool<TAttempt extends SnapshotSelectionAttempt>(input: {
  pool: TAttempt[];
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}) {
  const selectedAttempts: TAttempt[] = [];
  const segmentSummaries: SegmentEvaluationSummary[] = [];
  const repetitionExcluded: SeriesSelectionResult<TAttempt>["repetitionExcluded"] = [];

  for (const segmentConfig of SNAPSHOT_SEGMENTS) {
    const segmentAttempts = sortSegmentAttempts({
      attempts: input.pool,
      segment: segmentConfig.segment,
      previousSnapshots: input.previousSnapshots,
      now: input.now,
    });
    const selectedAttempt = segmentAttempts[0] ?? null;

    if (selectedAttempt) {
      selectedAttempt.debugSummary.rerollDistanceScore = getSnapshotDistanceFromPrevious(
        selectedAttempt,
        getPreviousSnapshotForSegment({
          previousSnapshots: input.previousSnapshots,
          segment: segmentConfig.segment,
        }),
      );
      selectedAttempts.push(selectedAttempt);
    }

    repetitionExcluded.push(...collectRepetitionExcluded({
      segment: segmentConfig.segment,
      selectedAttempt,
      segmentAttempts,
      previousSnapshots: input.previousSnapshots,
      now: input.now,
    }));
    segmentSummaries.push(buildSegmentSummary({
      segment: segmentConfig.segment,
      segmentAttempts,
      selectedAttempt,
      previousSnapshots: input.previousSnapshots,
      now: input.now,
    }));
  }

  return {
    selectedAttempts,
    segmentSummaries,
    repetitionExcluded,
  };
}

function orderSelectedAttempts<TAttempt extends SnapshotSelectionAttempt>(input: {
  selectedAttempts: TAttempt[];
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}) {
  const primaryAttempt = [...input.selectedAttempts].sort((left, right) =>
    compareAttemptsByAdjustedScore({
      left,
      right,
      previousSnapshots: input.previousSnapshots,
      now: input.now,
    }))[0] ?? null;

  const orderedAttempts = primaryAttempt
    ? [
        primaryAttempt,
        ...input.selectedAttempts
          .filter((attempt) => attempt.snapshotIndex !== primaryAttempt.snapshotIndex)
          .sort((left, right) => left.snapshot.timestampMinutes - right.snapshot.timestampMinutes),
      ]
    : [];

  return {
    primaryAttempt,
    orderedAttempts,
  };
}

function buildSeriesSelectionResult<TAttempt extends SnapshotSelectionAttempt>(input: {
  selection: ReturnType<typeof chooseAttemptsFromPool<TAttempt>>;
  draft: boolean;
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}): SeriesSelectionResult<TAttempt> {
  const { primaryAttempt, orderedAttempts } = orderSelectedAttempts({
    selectedAttempts: input.selection.selectedAttempts,
    previousSnapshots: input.previousSnapshots,
    now: input.now,
  });

  return {
    selectedAttempts: orderedAttempts,
    primaryAttempt,
    draft: input.draft,
    segmentSummaries: input.selection.segmentSummaries,
    repetitionExcluded: input.selection.repetitionExcluded,
  };
}

function buildEmptySeriesSelection<TAttempt extends SnapshotSelectionAttempt>(
  accepted: TAttempt[],
): SeriesSelectionResult<TAttempt> {
  return {
    selectedAttempts: [],
    primaryAttempt: null,
    draft: false,
    segmentSummaries: SNAPSHOT_SEGMENTS.map((segmentConfig) => {
      const segmentAttempts = accepted.filter(
        (attempt) => getSnapshotSegment(attempt.snapshot.timestampMinutes) === segmentConfig.segment,
      );
      return {
        segment: segmentConfig.segment,
        totalAccepted: segmentAttempts.length,
        nonLowConfidenceAccepted: segmentAttempts.filter((attempt) => !attempt.seed.lowConfidence).length,
        lowConfidenceAccepted: segmentAttempts.filter((attempt) => attempt.seed.lowConfidence).length,
        selectedSnapshotIndex: null,
        selectedSnapshotMinute: null,
        selectedQualityScore: null,
        selectedFromHistoryFallback: false,
      };
    }),
    repetitionExcluded: [],
  };
}

export function selectAttemptsForSeries<TAttempt extends SnapshotSelectionAttempt>(input: {
  attempts: Array<TAttempt | { status: "rejected" }>;
  allowLowConfidenceDraft: boolean;
  previousSnapshots: SnapshotHistoryEntry[];
  now?: Date;
}): SeriesSelectionResult<TAttempt> {
  const accepted = input.attempts.filter((attempt): attempt is TAttempt => attempt.status === "accepted");

  const publishedCandidates = accepted.filter((attempt) => !attempt.seed.lowConfidence);
  const publishedSelection = chooseAttemptsFromPool({
    pool: publishedCandidates,
    previousSnapshots: input.previousSnapshots,
    now: input.now,
  });
  if (publishedSelection.selectedAttempts.length > 0) {
    return buildSeriesSelectionResult({
      selection: publishedSelection,
      draft: false,
      previousSnapshots: input.previousSnapshots,
      now: input.now,
    });
  }

  if (input.allowLowConfidenceDraft) {
    const draftCandidates = accepted.filter((attempt) => attempt.seed.lowConfidence);
    const draftSelection = chooseAttemptsFromPool({
      pool: draftCandidates,
      previousSnapshots: input.previousSnapshots,
      now: input.now,
    });
    if (draftSelection.selectedAttempts.length > 0) {
      return buildSeriesSelectionResult({
        selection: draftSelection,
        draft: true,
        previousSnapshots: input.previousSnapshots,
        now: input.now,
      });
    }
  }

  return buildEmptySeriesSelection(accepted);
}
