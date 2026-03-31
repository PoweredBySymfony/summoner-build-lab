import { describe, expect, it } from "vitest";

import {
  buildDailyIngestionReport,
  parseBatchTargets,
  runRiotImportBatch,
} from "../../server/src/lib/riot/riotBatch";

describe("riotBatch", () => {
  it("deduplicates riot ids and puuids when parsing batch inputs", () => {
    expect(
      parseBatchTargets([
        "PlayerOne#euw",
        "playerone#EUW",
        "puuid:abc123",
        "abc123",
      ]),
    ).toEqual([
      {
        type: "riot-id",
        gameName: "PlayerOne",
        tagLine: "EUW",
      },
      {
        type: "puuid",
        puuid: "abc123",
      },
    ]);
  });

  it("stays idempotent when the importer upserts existing matches", async () => {
    const storedMatches = new Map<string, { timelineAvailable: boolean; timelineMissingReason: string | null }>();
    const inputs = parseBatchTargets(["player#EUW"]);

    const runOnce = async () =>
      runRiotImportBatch(inputs, {
        now: (() => {
          let current = 0;
          return () => {
            current += 10;
            return current;
          };
        })(),
        getMetricsSnapshot: () => ({
          totalRequests: 0,
          successfulRequests: 0,
          rateLimitResponses: 0,
          retryAfterFallbacks: 0,
          totalBackoffMs: 0,
        }),
        resolveTarget: async () => ({ label: "player#EUW", puuid: "puuid-1" }),
        importMatches: async () => {
          storedMatches.set("EUW1_1", {
            timelineAvailable: true,
            timelineMissingReason: null,
          });

          return {
            requestedMatchCount: 1,
            importedMatchCount: storedMatches.size,
            skippedMatchCount: 0,
            matches: [
              {
                riotMatchId: "EUW1_1",
                timelineAvailable: true,
                timelineMissingReason: null,
              },
            ],
          };
        },
      });

    const first = await runOnce();
    const second = await runOnce();

    expect(storedMatches.size).toBe(1);
    expect(first.summary.importedMatchCount).toBe(1);
    expect(second.summary.importedMatchCount).toBe(1);
    expect(second.summary.failedTargets).toBe(0);
  });

  it("builds the daily ingestion report with timeline coverage and missing reasons", () => {
    const report = buildDailyIngestionReport([
      {
        patch: "15.1",
        timelineMissingReason: null,
        gameCreationAt: new Date("2026-03-29T10:00:00.000Z"),
        timelineFetchedAt: new Date("2026-03-29T10:05:00.000Z"),
      },
      {
        patch: "15.1",
        timelineMissingReason: "timeline-fetch-429",
        gameCreationAt: new Date("2026-03-30T10:00:00.000Z"),
        timelineFetchedAt: null,
      },
    ]);

    expect(report.totalMatches).toBe(2);
    expect(report.timelineCoveragePercent).toBe(50);
    expect(report.patchDistribution).toEqual([{ patch: "15.1", count: 2 }]);
    expect(report.timelineMissingReasons).toEqual([{ reason: "timeline-fetch-429", count: 1 }]);
    expect(report.gameDateRange.min).toBe("2026-03-29T10:00:00.000Z");
    expect(report.gameDateRange.max).toBe("2026-03-30T10:00:00.000Z");
  });
});
