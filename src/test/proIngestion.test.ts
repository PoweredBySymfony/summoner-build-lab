import { describe, expect, it } from "vitest";

import {
  buildProIngestionReport,
  buildRoundRobinMatchQueue,
} from "../../server/src/lib/riot/proIngestion";

describe("proIngestion", () => {
  it("builds a round-robin queue and deduplicates repeated match ids", () => {
    const queue = buildRoundRobinMatchQueue(
      [
        {
          seedKey: "seed-1",
          playerName: "Player 1",
          team: "Team A",
          league: "LCK",
          competition: "LCK Cup 2026",
          role: "TOP",
          puuid: "puuid-1",
          region: "asia",
          matchIds: ["A", "B", "C"],
        },
        {
          seedKey: "seed-2",
          playerName: "Player 2",
          team: "Team B",
          league: "LEC",
          competition: "LEC 2026 Winter",
          role: "MID",
          puuid: "puuid-2",
          region: "europe",
          matchIds: ["B", "D", "E"],
        },
      ],
      5,
    );

    expect(queue.map((entry) => entry.matchId)).toEqual(["A", "B", "C", "D", "E"]);
    expect(queue.map((entry) => entry.seedKey)).toEqual(["seed-1", "seed-2", "seed-1", "seed-2", "seed-2"]);
  });

  it("builds an ingestion report with league, role, patch, and timeline coverage distributions", () => {
    const report = buildProIngestionReport([
      {
        patch: "16.6",
        timelineMissingReason: null,
        gameCreationAt: new Date("2026-03-30T10:00:00.000Z"),
        timelineFetchedAt: new Date("2026-03-30T10:05:00.000Z"),
        targetRole: "TOP",
        sourceKind: "PRO_SEED",
        sourceLeague: "LoL Champions Korea",
        sourceCompetition: "LCK Cup 2026",
      },
      {
        patch: "16.6",
        timelineMissingReason: "timeline-fetch-404",
        gameCreationAt: new Date("2026-03-31T10:00:00.000Z"),
        timelineFetchedAt: null,
        targetRole: "MID",
        sourceKind: "PRO_SEED",
        sourceLeague: "League of Legends EMEA Championship",
        sourceCompetition: "LEC 2026 Winter",
      },
    ]);

    expect(report.totalMatches).toBe(2);
    expect(report.totalTimelineMatches).toBe(1);
    expect(report.timelineCoveragePercent).toBe(50);
    expect(report.patchDistribution).toEqual([{ patch: "16.6", count: 2 }]);
    expect(report.roleDistribution).toEqual([
      { role: "MID", count: 1 },
      { role: "TOP", count: 1 },
    ]);
    expect(report.timelineMissingReasons).toEqual([{ reason: "timeline-fetch-404", count: 1 }]);
    expect(report.gameDateRange.min).toBe("2026-03-30T10:00:00.000Z");
    expect(report.gameDateRange.max).toBe("2026-03-31T10:00:00.000Z");
  });
});
