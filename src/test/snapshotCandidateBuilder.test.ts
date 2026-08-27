import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildSnapshotCandidates,
  calculateGoldBeforePurchaseFromFrame,
  collectSnapshotBuilderItemIds,
  dedupeAndRankSnapshots,
  type SnapshotCandidate,
} from "../../server/src/lib/ml/snapshotCandidateBuilder";

function snapshotCandidate(input: {
  snapshotIndex: number;
  timestampMinutes: number;
  relevanceScore: number;
  currentItems?: string[];
}): SnapshotCandidate {
  return {
    snapshotIndex: input.snapshotIndex,
    rawPurchaseIndex: input.snapshotIndex,
    relevanceScore: input.relevanceScore,
    snapshot: {
      patch: "15.20",
      championSlug: "jinx",
      role: Role.ADC,
      goldAvailable: 1300,
      level: 9,
      kills: 2,
      deaths: 1,
      assists: 4,
      cs: 140,
      timestampMinutes: input.timestampMinutes,
      currentItems: input.currentItems ?? ["kraken-slayer"],
      allyFrontlineCount: 1,
      allyMagicDamageCount: 1,
      allyPhysicalDamageCount: 3,
      allySupportCount: 1,
      enemyFrontlineCount: 2,
      enemyMagicDamageCount: 2,
      enemyPhysicalDamageCount: 2,
      enemySupportCount: 1,
    },
    scenario: {
      currentBuild: input.currentItems ?? ["kraken-slayer"],
      allyTeam: [],
      enemyTeam: [],
    },
    actualPurchase: {
      itemSlug: "infinity-edge",
      goldTotal: 3400,
      burstPurchaseIndex: 0,
      timestampMinutes: input.timestampMinutes,
    },
  };
}

describe("snapshotCandidateBuilder", () => {
  it("replays purchase, sale, undo and foreign participant events to calculate pre-purchase gold", () => {
    const goldBeforePurchase = calculateGoldBeforePurchaseFromFrame({
      participantId: 1,
      purchaseEventIndex: 1,
      endingGold: 500,
      itemGoldIndex: new Map([
        [1001, { goldTotal: 300, goldSell: 210 }],
        [2001, { goldTotal: 1300, goldSell: 910 }],
      ]),
      events: [
        { type: "ITEM_SOLD", participantId: 1, itemId: 1001 },
        { type: "ITEM_PURCHASED", participantId: 1, itemId: 2001 },
        { type: "ITEM_PURCHASED", participantId: 2, itemId: 1001 },
        { type: "ITEM_UNDO", participantId: 1, beforeId: 2001, afterId: 1001 },
      ],
    });

    expect(goldBeforePurchase).toBe(1800);
  });

  it("ranks snapshots by segment and removes near-duplicate inventories", () => {
    const ranked = dedupeAndRankSnapshots([
      snapshotCandidate({ snapshotIndex: 1, timestampMinutes: 12, relevanceScore: 80, currentItems: ["a", "b"] }),
      snapshotCandidate({ snapshotIndex: 2, timestampMinutes: 13, relevanceScore: 100, currentItems: ["b", "a"] }),
      snapshotCandidate({ snapshotIndex: 3, timestampMinutes: 21, relevanceScore: 70, currentItems: ["c"] }),
      snapshotCandidate({ snapshotIndex: 4, timestampMinutes: 31, relevanceScore: -1, currentItems: ["d"] }),
    ]);

    expect(ranked.map((candidate) => candidate.snapshotIndex)).toEqual([2, 3]);
  });

  it("collects item ids from timeline frames", () => {
    expect(
      collectSnapshotBuilderItemIds([
        {
          events: [
            { type: "ITEM_PURCHASED", itemId: 1001 },
            { type: "ITEM_UNDO", beforeId: 2001, afterId: 3001 },
          ],
        },
      ]),
    ).toEqual(new Set([1001, 2001, 3001]));
  });

  it("builds raw snapshot candidates with combat stats and reconstructed teams", () => {
    const result = buildSnapshotCandidates({
      importedMatch: {
        patch: "15.20",
        targetPuuid: "target-puuid",
        targetChampionSlug: "jinx",
        targetRole: Role.ADC,
      },
      championIndex: new Map([
        [1, { slug: "jinx", tags: ["Marksman"] }],
        [2, { slug: "leona", tags: ["Tank", "Support"] }],
        [3, { slug: "ahri", tags: ["Mage"] }],
      ]),
      itemSlugIndex: new Map([
        [1001, "boots"],
        [2001, "infinity-edge"],
      ]),
      itemGoldIndex: new Map([
        [1001, { goldTotal: 300, goldSell: 210 }],
        [2001, { goldTotal: 3400, goldSell: 2380 }],
      ]),
      participants: [
        {
          participantId: 1,
          puuid: "target-puuid",
          teamId: 100,
          championId: 1,
          teamPosition: "BOTTOM",
        },
        {
          participantId: 2,
          puuid: "ally-puuid",
          teamId: 100,
          championId: 2,
          teamPosition: "UTILITY",
        },
        {
          participantId: 3,
          puuid: "enemy-puuid",
          teamId: 200,
          championId: 3,
          teamPosition: "MIDDLE",
        },
      ],
      frames: [
        {
          timestamp: 600_000,
          participantFrames: {
            "1": {
              currentGold: 400,
              level: 8,
              minionsKilled: 90,
              jungleMinionsKilled: 5,
            },
          },
          events: [
            { type: "CHAMPION_KILL", killerId: 1, victimId: 3, assistingParticipantIds: [2] },
            { type: "ITEM_PURCHASED", participantId: 1, itemId: 1001, timestamp: 600_000 },
          ],
        },
        {
          timestamp: 900_000,
          participantFrames: {
            "1": {
              currentGold: 500,
              level: 10,
              minionsKilled: 135,
              jungleMinionsKilled: 8,
            },
          },
          events: [
            { type: "ITEM_PURCHASED", participantId: 2, itemId: 1001, timestamp: 700_000 },
            { type: "ITEM_PURCHASED", participantId: 1, itemId: 2001, timestamp: 900_000 },
          ],
        },
      ],
    });

    expect(result.targetParticipantFound).toBe(true);
    expect(result.rawCandidates).toHaveLength(2);
    expect(result.rawCandidates[0]?.snapshot).toMatchObject({
      championSlug: "jinx",
      role: Role.ADC,
      kills: 1,
      deaths: 0,
      assists: 0,
      cs: 95,
      goldAvailable: 700,
    });
    expect(result.rawCandidates[1]?.scenario.currentBuild).toEqual(["boots"]);
    expect(result.rawCandidates[1]?.scenario.allyTeam).toEqual([
      { championSlug: "jinx", role: Role.ADC, items: ["boots", "lame-dinfini"] },
      { championSlug: "leona", role: Role.SUPPORT, items: ["boots"] },
    ]);
  });

  it("returns an empty result when the target participant is absent", () => {
    expect(
      buildSnapshotCandidates({
        importedMatch: {
          patch: "15.20",
          targetPuuid: "missing",
          targetChampionSlug: "jinx",
          targetRole: Role.ADC,
        },
        participants: [],
        frames: [],
        championIndex: new Map(),
        itemSlugIndex: new Map(),
        itemGoldIndex: new Map(),
      }),
    ).toEqual({
      rawCandidates: [],
      filteredCandidates: [],
      dedupedCandidates: [],
      targetParticipantFound: false,
    });
  });
});
