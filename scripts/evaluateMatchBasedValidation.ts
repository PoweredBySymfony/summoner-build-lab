import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { puzzleGenerationService } from "../server/src/services/puzzleGenerationService.js";
import { prisma } from "../server/src/lib/prisma.js";

type CliOptions = {
  sampleSize: number;
  strictPatchPrefix: string;
  outputJsonPath: string;
  outputMarkdownPath: string;
  userEmail: string | null;
  importedMatchIds: string[] | null;
  baselineReportPath: string | null;
};

type JsonRecord = Record<string, unknown>;

type AttemptSummary = {
  snapshotIndex: number;
  snapshotMinute: number;
  patch: string;
  goldAvailable: number;
  snapshotSignature?: string;
  rawCandidatePoolSize: number;
  filteredCandidatePoolSize: number;
  goodAnswer: string | null;
  qualityScore: number;
  rejectionReasons: string[];
  lowConfidence: boolean;
  confidenceScore: number;
  confidenceGap: number;
};

type EvaluationRow = {
  index: number;
  importedMatchId: string;
  requestId: string;
  patch: string | null;
  sourceKind: string | null;
  sourceTier: string | null;
  championSlug: string | null;
  role: string | null;
  generationStatus: string;
  selectedSnapshotIndex: number | null;
  minute: number | null;
  gold: number | null;
  candidatePoolSize: number | null;
  qualityScore: number | null;
  failureReason: string | null;
  rejectionReasons: string[];
  observedRejectionReasons: string[];
  attemptsEvaluated: number;
  successfulSnapshots: number;
  selectedSnapshotHistoryKey: string | null;
  selectedSnapshotSignature: string | null;
  selectedSnapshotSegment: string | null;
  lowConfidence: boolean | null;
  draft: boolean | null;
  resultSlug: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sampleSize: 15,
    strictPatchPrefix: "26.",
    outputJsonPath: path.join("reports", "match-based-validation-report.json"),
    outputMarkdownPath: path.join("reports", "match-based-validation-report.md"),
    userEmail: null,
    importedMatchIds: null,
    baselineReportPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--sample-size":
        if (next) {
          options.sampleSize = Number(next);
        }
        index += 1;
        break;
      case "--strict-patch-prefix":
        if (next) {
          options.strictPatchPrefix = next;
        }
        index += 1;
        break;
      case "--output-json":
        if (next) {
          options.outputJsonPath = next;
        }
        index += 1;
        break;
      case "--output-markdown":
        if (next) {
          options.outputMarkdownPath = next;
        }
        index += 1;
        break;
      case "--user-email":
        if (next) {
          options.userEmail = next;
        }
        index += 1;
        break;
      case "--imported-match-ids":
        if (next) {
          options.importedMatchIds = next.split(",").map((entry) => entry.trim()).filter(Boolean);
        }
        index += 1;
        break;
      case "--baseline-report":
        if (next) {
          options.baselineReportPath = next;
        }
        index += 1;
        break;
      default:
        break;
    }
  }

  if (!Number.isFinite(options.sampleSize) || options.sampleSize < 1 || options.sampleSize > 20) {
    throw new Error("--sample-size must be between 1 and 20.");
  }

  return options;
}

function asObject(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function countBy(values: string[]) {
  return Object.entries(
    values.reduce<Record<string, number>>((accumulator, value) => {
      accumulator[value] = (accumulator[value] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

async function loadJsonFile(filePath: string) {
  const raw = await readFile(path.resolve(filePath), "utf-8");
  return JSON.parse(raw) as JsonRecord;
}

function toAttemptSummary(value: unknown): AttemptSummary | null {
  const record = asObject(value);
  if (!record) {
    return null;
  }

  return {
    snapshotIndex: Number(record.snapshotIndex ?? -1),
    snapshotMinute: Number(record.snapshotMinute ?? 0),
    patch: String(record.patch ?? "unknown"),
    goldAvailable: Number(record.goldAvailable ?? 0),
    snapshotSignature: asString(record.snapshotSignature) ?? undefined,
    rawCandidatePoolSize: Number(record.rawCandidatePoolSize ?? 0),
    filteredCandidatePoolSize: Number(record.filteredCandidatePoolSize ?? 0),
    goodAnswer: asString(record.goodAnswer),
    qualityScore: Number(record.qualityScore ?? 0),
    rejectionReasons: asArray(record.rejectionReasons).map((entry) => String(entry)),
    lowConfidence: Boolean(record.lowConfidence),
    confidenceScore: Number(record.confidenceScore ?? 0),
    confidenceGap: Number(record.confidenceGap ?? 0),
  };
}

function resolveSourceTier(sourceMetadata: unknown) {
  const metadata = asObject(sourceMetadata);
  const seed = asObject(metadata?.seed);
  return asString(seed?.priorityTier) ?? "unknown";
}

function selectFailureAttempt(attempts: AttemptSummary[]) {
  return [...attempts]
    .filter((attempt) => attempt.rejectionReasons.length > 0)
    .sort((left, right) => right.qualityScore - left.qualityScore || left.rejectionReasons.length - right.rejectionReasons.length)[0] ?? null;
}

function buildMarkdown(input: {
  generatedAt: string;
  sampleSize: number;
  strictPatchPrefix: string;
  userEmail: string;
  summary: JsonRecord;
  generations: EvaluationRow[];
  reproductionCommands: string[];
}) {
  const summary = input.summary;
  const rejectionReasonCounts = asArray(summary.rejectionReasonCounts).map((entry) => {
    const record = asObject(entry);
    return {
      reason: asString(record?.reason) ?? "unknown",
      count: asNumber(record?.count) ?? 0,
    };
  });
  const snapshotSegmentCounts = asArray(summary.snapshotSegmentCounts).map((entry) => {
    const record = asObject(entry);
    return {
      segment: asString(record?.segment) ?? "unknown",
      count: asNumber(record?.count) ?? 0,
    };
  });

  return [
    "# Match-Based Validation Report",
    "",
    `- Generated at: ${input.generatedAt}`,
    `- Evaluation user: ${input.userEmail}`,
    `- Sample size: ${input.sampleSize}`,
    `- Strict patch prefix: ${input.strictPatchPrefix}`,
    `- Completed rate: ${String(summary.completedRate ?? 0)}`,
    `- No viable snapshot found rate: ${String(summary.noViableSnapshotFoundRate ?? 0)}`,
    `- Distinct selected snapshots: ${String(summary.distinctSelectedSnapshotCount ?? 0)}`,
    `- Distinct selected snapshot signatures: ${String(summary.distinctSelectedSnapshotSignatureCount ?? 0)}`,
    `- Reused selected snapshot signatures: ${String(summary.reusedSelectedSnapshotSignatureCount ?? 0)}`,
    `- Distinct champions covered: ${String(summary.distinctChampionCount ?? 0)}`,
    "",
    "## Rejection Reasons",
    ...rejectionReasonCounts.slice(0, 12).map((entry) => `- ${entry.reason}: ${entry.count}`),
    "",
    "## Snapshot Diversity",
    ...snapshotSegmentCounts.map((entry) => `- ${entry.segment}: ${entry.count}`),
    "",
    "## Generations",
    ...input.generations.map((row) =>
      [
        `- #${row.index} ${row.importedMatchId} [${row.patch ?? "unknown"} ${row.championSlug ?? "unknown"} ${row.role ?? "unknown"}]`,
        `  status=${row.generationStatus}`,
        ` snapshot=${row.selectedSnapshotIndex ?? "none"}`,
        ` minute=${row.minute ?? "n/a"}`,
        ` gold=${row.gold ?? "n/a"}`,
        ` candidatePool=${row.candidatePoolSize ?? "n/a"}`,
        ` quality=${row.qualityScore ?? "n/a"}`,
        row.failureReason ? ` failure=${row.failureReason}` : "",
      ].join(""),
    ),
    "",
    "## Reproduction",
    ...input.reproductionCommands.map((command) => `- \`${command}\``),
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let patchCatalogFallbackOccurrences = 0;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const trackPatchCatalogFallback = (args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("[ml-puzzle] patch-catalog-fallback")) {
      patchCatalogFallbackOccurrences += 1;
    }
  };
  console.info = (...args: Parameters<typeof console.info>) => {
    trackPatchCatalogFallback(args);
    originalInfo(...args);
  };
  console.warn = (...args: Parameters<typeof console.warn>) => {
    trackPatchCatalogFallback(args);
    originalWarn(...args);
  };

  try {
  const evaluationUser = options.userEmail
    ? await prisma.user.findUnique({
        where: { email: options.userEmail },
        select: { id: true, email: true, isAdmin: true },
      })
    : await prisma.user.findFirst({
        where: { isAdmin: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, isAdmin: true },
      }) ?? await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, isAdmin: true },
      });

  if (!evaluationUser) {
    throw new Error("No user found in database. Provide --user-email or create a user first.");
  }

  const baselineReport = options.baselineReportPath ? await loadJsonFile(options.baselineReportPath) : null;
  const baselineGenerations = asArray(asObject(baselineReport)?.generations)
    .map(asObject)
    .filter((entry): entry is JsonRecord => entry !== null);
  const forcedImportedMatchIds = options.importedMatchIds
    ?? baselineGenerations
      .map((entry) => asString(entry.importedMatchId))
      .filter((entry): entry is string => Boolean(entry));

  const candidateMatches = await prisma.importedMatch.findMany({
    where: {
      timelineFetchedAt: { not: null },
      timelineMissingReason: null,
      ...(forcedImportedMatchIds.length > 0
        ? { id: { in: forcedImportedMatchIds } }
        : { patch: { startsWith: options.strictPatchPrefix } }),
    },
    orderBy: [
      { createdAt: "desc" },
      { gameCreationAt: "desc" },
    ],
    select: {
      id: true,
      patch: true,
      sourceKind: true,
      sourceMetadata: true,
      targetChampionSlug: true,
      targetRole: true,
      createdAt: true,
      gameCreationAt: true,
    },
  });

  if (candidateMatches.length === 0) {
    throw new Error(`No imported matches found for patch prefix ${options.strictPatchPrefix}.`);
  }

  const priorRequests = await prisma.generatedPuzzleRequest.findMany({
    where: {
      userId: evaluationUser.id,
      type: "MATCH_BASED",
      importedMatchId: { in: candidateMatches.map((match) => match.id) },
    },
    select: {
      importedMatchId: true,
    },
  });

  const requestCountByMatchId = priorRequests.reduce<Record<string, number>>((accumulator, request) => {
    if (request.importedMatchId) {
      accumulator[request.importedMatchId] = (accumulator[request.importedMatchId] ?? 0) + 1;
    }
    return accumulator;
  }, {});

  const matches = forcedImportedMatchIds.length > 0
    ? forcedImportedMatchIds
      .map((matchId) => candidateMatches.find((match) => match.id === matchId) ?? null)
      .filter((entry): entry is (typeof candidateMatches)[number] => entry !== null)
    : [...candidateMatches]
      .sort((left, right) => {
        const leftCount = requestCountByMatchId[left.id] ?? 0;
        const rightCount = requestCountByMatchId[right.id] ?? 0;
        if (leftCount !== rightCount) {
          return leftCount - rightCount;
        }
        return right.createdAt.getTime() - left.createdAt.getTime();
      })
      .slice(0, options.sampleSize);

  const generations: EvaluationRow[] = [];

  for (const [index, match] of matches.entries()) {
    const response = await puzzleGenerationService.generateMatchBasedPuzzle(match.id, evaluationUser.id, {
      actorIsAdmin: evaluationUser.isAdmin,
    });

    const requestRecord = await prisma.generatedPuzzleRequest.findUnique({
      where: { id: response.requestId },
      select: {
        parameters: true,
      },
    });

    const parameters = asObject(requestRecord?.parameters) ?? {};
    const attemptsSummary = asObject(parameters.attemptsSummary);
    const attempts = asArray(attemptsSummary?.attempts)
      .map(toAttemptSummary)
      .filter((entry): entry is AttemptSummary => entry !== null);
    const selectedSnapshot = asObject(parameters.selectedSnapshot);
    const selectedSnapshots = asArray(parameters.selectedSnapshots).map(asObject).filter((entry): entry is JsonRecord => entry !== null);
    const primarySelectedSnapshot = selectedSnapshot ?? selectedSnapshots[0] ?? null;
    const primarySelectedSnapshotWithHistory = selectedSnapshots[0] ?? selectedSnapshot ?? null;
    const selectedSnapshotIndex = asNumber(primarySelectedSnapshot?.snapshotIndex);
    const selectedAttempt = selectedSnapshotIndex === null
      ? null
      : attempts.find((attempt) => attempt.snapshotIndex === selectedSnapshotIndex) ?? null;
    const failureAttempt = selectFailureAttempt(attempts);
    const failureReason = response.generationStatus === "no_viable_snapshot_found"
      ? failureAttempt?.rejectionReasons.join(", ") ?? "no-accepted-snapshot"
      : null;
    const effectiveAttempt = selectedAttempt ?? failureAttempt;

    generations.push({
      index: index + 1,
      importedMatchId: match.id,
      requestId: response.requestId,
      patch: match.patch,
      sourceKind: match.sourceKind,
      sourceTier: resolveSourceTier(match.sourceMetadata),
      championSlug: match.targetChampionSlug,
      role: match.targetRole,
      generationStatus: response.generationStatus,
      selectedSnapshotIndex,
      minute: effectiveAttempt?.snapshotMinute ?? asNumber(primarySelectedSnapshot?.snapshotMinute),
      gold: effectiveAttempt?.goldAvailable ?? null,
      candidatePoolSize: effectiveAttempt?.filteredCandidatePoolSize ?? null,
      qualityScore: effectiveAttempt?.qualityScore ?? asNumber(primarySelectedSnapshot?.qualityScore),
      failureReason,
      rejectionReasons: failureAttempt?.rejectionReasons ?? [],
      observedRejectionReasons: attempts.flatMap((attempt) => attempt.rejectionReasons),
      attemptsEvaluated: asNumber(attemptsSummary?.snapshotsEvaluated) ?? attempts.length,
      successfulSnapshots: asNumber(attemptsSummary?.successfulSnapshots) ?? attempts.filter((attempt) => attempt.rejectionReasons.length === 0).length,
      selectedSnapshotHistoryKey: asString(primarySelectedSnapshotWithHistory?.historyKey),
      selectedSnapshotSignature:
        asString(primarySelectedSnapshotWithHistory?.snapshotSignature)
        ?? selectedAttempt?.snapshotSignature
        ?? null,
      selectedSnapshotSegment: asString(primarySelectedSnapshotWithHistory?.segment),
      lowConfidence: "lowConfidence" in response ? response.lowConfidence : null,
      draft: "draft" in response ? response.draft : null,
      resultSlug: response.slug,
    });
  }

  const completedCount = generations.filter((row) => row.generationStatus === "completed").length;
  const noViableCount = generations.filter((row) => row.generationStatus === "no_viable_snapshot_found").length;
  const rejectionReasonCounts = countBy(
    generations.flatMap((row) => row.observedRejectionReasons),
  ).map(({ key, count }) => ({
    reason: key,
    count,
  }));
  const snapshotSegmentCounts = countBy(
    generations.map((row) => row.selectedSnapshotSegment ?? "none"),
  ).map(({ key, count }) => ({
    segment: key,
    count,
  }));
  const selectedSnapshotKeys = new Set(
    generations
      .map((row) => row.selectedSnapshotHistoryKey)
      .filter((entry): entry is string => Boolean(entry)),
  );
  const selectedSnapshotSignatures = generations
    .map((row) => row.selectedSnapshotSignature)
    .filter((entry): entry is string => Boolean(entry));
  const distinctSelectedSnapshotSignatures = new Set(selectedSnapshotSignatures);
  const summary = {
    completedCount,
    noViableSnapshotFoundCount: noViableCount,
    totalGenerations: generations.length,
    completedRate: Number((completedCount / generations.length).toFixed(4)),
    noViableSnapshotFoundRate: Number((noViableCount / generations.length).toFixed(4)),
    rejectionReasonCounts,
    distinctSelectedSnapshotCount: selectedSnapshotKeys.size,
    distinctSelectedSnapshotSignatureCount: distinctSelectedSnapshotSignatures.size,
    reusedSelectedSnapshotSignatureCount: selectedSnapshotSignatures.length - distinctSelectedSnapshotSignatures.size,
    patchCatalogFallbackOccurrences,
    distinctChampionCount: new Set(generations.map((row) => row.championSlug).filter((entry): entry is string => Boolean(entry))).size,
    snapshotSegmentCounts,
    averageCandidatePoolSize: Number(
      (
        generations
          .map((row) => row.candidatePoolSize)
          .filter((entry): entry is number => typeof entry === "number")
          .reduce((sum, value, _index, array) => sum + value / array.length, 0)
      ).toFixed(2),
    ),
  };
  const baselineSummary = asObject(asObject(baselineReport)?.summary);
  const delta = baselineSummary
    ? {
        completedRateDelta: Number(((asNumber(summary.completedRate) ?? 0) - (asNumber(baselineSummary.completedRate) ?? 0)).toFixed(4)),
        noViableSnapshotFoundRateDelta: Number(
          ((asNumber(summary.noViableSnapshotFoundRate) ?? 0) - (asNumber(baselineSummary.noViableSnapshotFoundRate) ?? 0)).toFixed(4),
        ),
        distinctSelectedSnapshotCountDelta: (summary.distinctSelectedSnapshotCount ?? 0) - (asNumber(baselineSummary.distinctSelectedSnapshotCount) ?? 0),
        distinctSelectedSnapshotSignatureCountDelta:
          (summary.distinctSelectedSnapshotSignatureCount ?? 0)
          - (asNumber(baselineSummary.distinctSelectedSnapshotSignatureCount) ?? 0),
        averageCandidatePoolSizeDelta: Number(
          ((asNumber(summary.averageCandidatePoolSize) ?? 0) - (asNumber(baselineSummary.averageCandidatePoolSize) ?? 0)).toFixed(2),
        ),
        rejectionReasonDeltas: Array.from(
          new Set([
            ...asArray(baselineSummary.rejectionReasonCounts)
              .map((entry) => asString(asObject(entry)?.reason))
              .filter((entry): entry is string => Boolean(entry)),
            ...summary.rejectionReasonCounts.map((entry) => entry.reason),
          ]),
        )
          .sort((left, right) => left.localeCompare(right))
          .map((reason) => ({
            reason,
            countDelta:
              (summary.rejectionReasonCounts.find((entry) => entry.reason === reason)?.count ?? 0)
              - (
                asArray(baselineSummary.rejectionReasonCounts)
                  .map(asObject)
                  .find((entry) => asString(entry?.reason) === reason)?.count as number | undefined
                ?? 0
              ),
          })),
      }
    : null;

  const reproductionCommands = [
    "npm run ml:export-raw",
    "cd ml",
    ".\\.venv\\Scripts\\python.exe scripts\\tasks.py build-dataset",
    ".\\.venv\\Scripts\\python.exe scripts\\tasks.py train-baseline",
    `npm run audit:match-based-validation -- --sample-size ${options.sampleSize}${options.userEmail ? ` --user-email ${options.userEmail}` : ""}${forcedImportedMatchIds.length > 0 ? ` --imported-match-ids ${forcedImportedMatchIds.join(",")}` : ""}${options.baselineReportPath ? ` --baseline-report ${options.baselineReportPath}` : ""}`,
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    baseline: {
      state: "premium-v1-frozen",
      note: "Validation match-based apres retrain baseline sans modifier le coeur ML.",
    },
    evaluationUser: {
      id: evaluationUser.id,
      email: evaluationUser.email,
      isAdmin: evaluationUser.isAdmin,
    },
    selectionPolicy: {
      strictPatchPrefix: options.strictPatchPrefix,
      sampleSize: options.sampleSize,
      ordering: "fewest-previous-requests-first, then newest imported matches",
    },
    summary,
    delta,
    generations,
    reproduction: {
      commands: reproductionCommands,
    },
  };

  await mkdir(path.dirname(path.resolve(options.outputJsonPath)), { recursive: true });
  await mkdir(path.dirname(path.resolve(options.outputMarkdownPath)), { recursive: true });
  await writeFile(path.resolve(options.outputJsonPath), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  await writeFile(
    path.resolve(options.outputMarkdownPath),
    buildMarkdown({
      generatedAt: String(report.generatedAt),
      sampleSize: options.sampleSize,
      strictPatchPrefix: options.strictPatchPrefix,
      userEmail: evaluationUser.email,
      summary: summary as JsonRecord,
      generations,
      reproductionCommands,
    }),
    "utf-8",
  );

  console.info(
    JSON.stringify(
      {
        generatedAt: report.generatedAt,
        outputJsonPath: path.resolve(options.outputJsonPath),
        outputMarkdownPath: path.resolve(options.outputMarkdownPath),
        summary,
      },
      null,
      2,
    ),
  );
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
}

main()
  .catch((error) => {
    console.error("[match-based-validation] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
