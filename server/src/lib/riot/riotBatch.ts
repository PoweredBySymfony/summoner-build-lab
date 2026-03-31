export type RiotImportInput =
  | { type: "riot-id"; gameName: string; tagLine: string }
  | { type: "puuid"; puuid: string };

export type RiotImportMatchSummary = {
  riotMatchId: string;
  timelineAvailable: boolean;
  timelineMissingReason: string | null;
};

export type RiotImportRunSummary = {
  requestedMatchCount: number;
  importedMatchCount: number;
  skippedMatchCount: number;
  matches: RiotImportMatchSummary[];
};

export type RiotClientMetricsSnapshot = {
  totalRequests: number;
  successfulRequests: number;
  rateLimitResponses: number;
  retryAfterFallbacks: number;
  totalBackoffMs: number;
};

export type RiotBatchSummary = {
  totalTargets: number;
  successfulTargets: number;
  failedTargets: number;
  requestedMatchCount: number;
  importedMatchCount: number;
  timelineOkCount: number;
  timelineMissingReasons: Record<string, number>;
  rateLimitCount: number;
  averageMsPerMatch: number;
  totalDurationMs: number;
};

export type RiotBatchTargetResult = {
  target: string;
  requestedMatchCount: number;
  importedMatchCount: number;
  timelineOkCount: number;
  timelineMissingReasons: Record<string, number>;
  durationMs: number;
  error?: string;
};

export type RiotBatchRunResult = {
  summary: RiotBatchSummary;
  targets: RiotBatchTargetResult[];
};

type BatchRunnerDependencies = {
  resolveTarget: (input: RiotImportInput) => Promise<{ label: string; puuid: string }>;
  importMatches: (resolved: { label: string; puuid: string }) => Promise<RiotImportRunSummary>;
  getMetricsSnapshot: () => RiotClientMetricsSnapshot;
  log?: Pick<Console, "info" | "warn" | "error">;
  now?: () => number;
};

export function formatRiotImportInput(input: RiotImportInput) {
  return input.type === "puuid" ? input.puuid : `${input.gameName}#${input.tagLine}`;
}

export function parseBatchTargets(rawInputs: string[]) {
  const normalized = rawInputs
    .map((value) => value.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const parsed: RiotImportInput[] = [];

  for (const entry of normalized) {
    const value = entry.replace(/^riot:/i, "").trim();
    const puuidValue = value.replace(/^puuid:/i, "").trim();
    const isRiotId = value.includes("#");

    if (isRiotId) {
      const [gameName, ...tagLineParts] = value.split("#");
      const tagLine = tagLineParts.join("#").trim().toUpperCase();
      const normalizedKey = `riot:${gameName.trim().toLowerCase()}#${tagLine}`;
      if (!gameName.trim() || !tagLine || seen.has(normalizedKey)) {
        continue;
      }

      seen.add(normalizedKey);
      parsed.push({
        type: "riot-id",
        gameName: gameName.trim(),
        tagLine,
      });
      continue;
    }

    if (!puuidValue || seen.has(`puuid:${puuidValue}`)) {
      continue;
    }

    seen.add(`puuid:${puuidValue}`);
    parsed.push({
      type: "puuid",
      puuid: puuidValue,
    });
  }

  return parsed;
}

export function summarizeImportRun(run: RiotImportRunSummary) {
  const timelineMissingReasons: Record<string, number> = {};
  let timelineOkCount = 0;

  for (const match of run.matches) {
    if (match.timelineAvailable) {
      timelineOkCount += 1;
      continue;
    }

    const reason = match.timelineMissingReason ?? "unknown";
    timelineMissingReasons[reason] = (timelineMissingReasons[reason] ?? 0) + 1;
  }

  return {
    requestedMatchCount: run.requestedMatchCount,
    importedMatchCount: run.importedMatchCount,
    skippedMatchCount: run.skippedMatchCount,
    timelineOkCount,
    timelineMissingReasons,
  };
}

function diffMetrics(
  before: RiotClientMetricsSnapshot,
  after: RiotClientMetricsSnapshot,
): RiotClientMetricsSnapshot {
  return {
    totalRequests: after.totalRequests - before.totalRequests,
    successfulRequests: after.successfulRequests - before.successfulRequests,
    rateLimitResponses: after.rateLimitResponses - before.rateLimitResponses,
    retryAfterFallbacks: after.retryAfterFallbacks - before.retryAfterFallbacks,
    totalBackoffMs: after.totalBackoffMs - before.totalBackoffMs,
  };
}

export async function runRiotImportBatch(
  targets: RiotImportInput[],
  dependencies: BatchRunnerDependencies,
): Promise<RiotBatchRunResult> {
  const log = dependencies.log ?? console;
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const initialMetrics = dependencies.getMetricsSnapshot();
  const results: RiotBatchTargetResult[] = [];

  let successfulTargets = 0;
  let requestedMatchCount = 0;
  let importedMatchCount = 0;
  let timelineOkCount = 0;
  const timelineMissingReasons: Record<string, number> = {};

  for (const target of targets) {
    const targetStartedAt = now();
    const formattedTarget = formatRiotImportInput(target);

    try {
      const resolved = await dependencies.resolveTarget(target);
      const run = await dependencies.importMatches(resolved);
      const summary = summarizeImportRun(run);

      successfulTargets += 1;
      requestedMatchCount += summary.requestedMatchCount;
      importedMatchCount += summary.importedMatchCount;
      timelineOkCount += summary.timelineOkCount;

      for (const [reason, count] of Object.entries(summary.timelineMissingReasons)) {
        timelineMissingReasons[reason] = (timelineMissingReasons[reason] ?? 0) + count;
      }

      const result: RiotBatchTargetResult = {
        target: resolved.label,
        requestedMatchCount: summary.requestedMatchCount,
        importedMatchCount: summary.importedMatchCount,
        timelineOkCount: summary.timelineOkCount,
        timelineMissingReasons: summary.timelineMissingReasons,
        durationMs: now() - targetStartedAt,
      };
      results.push(result);

      log.info(
        `[riot-import-batch] target=${resolved.label} requested=${summary.requestedMatchCount} imported=${summary.importedMatchCount} timelineOk=${summary.timelineOkCount}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        target: formattedTarget,
        requestedMatchCount: 0,
        importedMatchCount: 0,
        timelineOkCount: 0,
        timelineMissingReasons: {},
        durationMs: now() - targetStartedAt,
        error: message,
      });
      log.error(`[riot-import-batch] target=${formattedTarget} failed: ${message}`);
    }
  }

  const finalMetrics = dependencies.getMetricsSnapshot();
  const metricDelta = diffMetrics(initialMetrics, finalMetrics);
  const totalDurationMs = now() - startedAt;

  return {
    summary: {
      totalTargets: targets.length,
      successfulTargets,
      failedTargets: targets.length - successfulTargets,
      requestedMatchCount,
      importedMatchCount,
      timelineOkCount,
      timelineMissingReasons,
      rateLimitCount: metricDelta.rateLimitResponses,
      averageMsPerMatch: requestedMatchCount > 0 ? totalDurationMs / requestedMatchCount : 0,
      totalDurationMs,
    },
    targets: results,
  };
}

export type DailyIngestionRow = {
  patch: string | null;
  timelineMissingReason: string | null;
  gameCreationAt: Date | null;
  timelineFetchedAt: Date | null;
};

export type DailyIngestionReport = {
  totalMatches: number;
  timelineCoveragePercent: number;
  patchDistribution: Array<{ patch: string; count: number }>;
  timelineMissingReasons: Array<{ reason: string; count: number }>;
  gameDateRange: {
    min: string | null;
    max: string | null;
  };
};

export function buildDailyIngestionReport(rows: DailyIngestionRow[]): DailyIngestionReport {
  const patchCounts = new Map<string, number>();
  const missingCounts = new Map<string, number>();
  let timelineCount = 0;
  let minGameDate: Date | null = null;
  let maxGameDate: Date | null = null;

  for (const row of rows) {
    patchCounts.set(row.patch ?? "unknown", (patchCounts.get(row.patch ?? "unknown") ?? 0) + 1);

    if (row.timelineFetchedAt) {
      timelineCount += 1;
    } else if (row.timelineMissingReason) {
      missingCounts.set(
        row.timelineMissingReason,
        (missingCounts.get(row.timelineMissingReason) ?? 0) + 1,
      );
    } else {
      missingCounts.set("unknown", (missingCounts.get("unknown") ?? 0) + 1);
    }

    if (row.gameCreationAt && (!minGameDate || row.gameCreationAt < minGameDate)) {
      minGameDate = row.gameCreationAt;
    }

    if (row.gameCreationAt && (!maxGameDate || row.gameCreationAt > maxGameDate)) {
      maxGameDate = row.gameCreationAt;
    }
  }

  return {
    totalMatches: rows.length,
    timelineCoveragePercent: rows.length > 0 ? (timelineCount / rows.length) * 100 : 0,
    patchDistribution: [...patchCounts.entries()]
      .map(([patch, count]) => ({ patch, count }))
      .sort((left, right) => right.count - left.count || left.patch.localeCompare(right.patch)),
    timelineMissingReasons: [...missingCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
    gameDateRange: {
      min: minGameDate?.toISOString() ?? null,
      max: maxGameDate?.toISOString() ?? null,
    },
  };
}
