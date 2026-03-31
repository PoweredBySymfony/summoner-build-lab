import { describe, expect, it } from "vitest";

import {
  collectTimelineItemIds,
  reconstructInventoriesAtTimestamp,
} from "../../server/src/lib/ml/scenarioInventory";

describe("scenarioInventory", () => {
  it("collects item ids across all participants, not only the target player", () => {
    const itemIds = collectTimelineItemIds([
      {
        timestamp: 1_000,
        events: [
          { timestamp: 1_000, type: "ITEM_PURCHASED", participantId: 1, itemId: 1001 },
          { timestamp: 1_050, type: "ITEM_PURCHASED", participantId: 7, itemId: 3142 },
          { timestamp: 1_100, type: "ITEM_UNDO", participantId: 8, beforeId: 1055, afterId: 1036 },
        ],
      },
    ]);

    expect([...itemIds].sort((left, right) => left - right)).toEqual([1001, 1036, 1055, 3142]);
  });

  it("reconstructs participant inventories at a snapshot timestamp with purchase, sale, destroy, and undo", () => {
    const result = reconstructInventoriesAtTimestamp({
      participantIds: [1, 2],
      upToTimestamp: 2_500,
      itemSlugIndex: new Map([
        [1001, "bottes"],
        [2003, "potion-de-vie"],
        [1055, "dague"],
        [1036, "epee-longue"],
      ]),
      frames: [
        {
          timestamp: 1_000,
          events: [
            { timestamp: 1_000, type: "ITEM_PURCHASED", participantId: 1, itemId: 1001 },
            { timestamp: 1_050, type: "ITEM_PURCHASED", participantId: 2, itemId: 2003 },
          ],
        },
        {
          timestamp: 2_000,
          events: [
            { timestamp: 2_000, type: "ITEM_PURCHASED", participantId: 1, itemId: 1055 },
            { timestamp: 2_050, type: "ITEM_SOLD", participantId: 2, itemId: 2003 },
            { timestamp: 2_100, type: "ITEM_PURCHASED", participantId: 2, itemId: 1036 },
            { timestamp: 2_150, type: "ITEM_UNDO", participantId: 2, beforeId: 1036, afterId: 2003 },
            { timestamp: 2_200, type: "ITEM_DESTROYED", participantId: 1, itemId: 1055 },
          ],
        },
        {
          timestamp: 3_000,
          events: [
            { timestamp: 3_000, type: "ITEM_PURCHASED", participantId: 1, itemId: 1036 },
          ],
        },
      ],
    });

    expect(result.participantsCovered).toBe(2);
    expect(result.eventsApplied).toBe(7);
    expect(result.inventories.get(1)).toEqual(["bottes"]);
    expect(result.inventories.get(2)).toEqual(["potion-de-vie"]);
  });
});
