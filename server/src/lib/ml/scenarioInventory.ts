import { resolveItemSlug } from "../itemSlugAliases.js";

type TimelineFrame = Record<string, unknown>;

function safeInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return 0;
}

function removeItemOnce(items: number[], itemId: number) {
  const index = items.indexOf(itemId);
  if (index >= 0) {
    items.splice(index, 1);
  }
}

export type ReconstructedInventories = {
  inventories: Map<number, string[]>;
  eventsApplied: number;
  participantsCovered: number;
};

export function collectTimelineItemIds(frames: TimelineFrame[]) {
  const itemIdsSeen = new Set<number>();

  for (const frame of frames) {
    const events = Array.isArray(frame.events) ? (frame.events as Array<Record<string, unknown>>) : [];
    for (const event of events) {
      const itemId = safeInt(event.itemId);
      const beforeId = safeInt(event.beforeId);
      const afterId = safeInt(event.afterId);

      if (itemId > 0) {
        itemIdsSeen.add(itemId);
      }
      if (beforeId > 0) {
        itemIdsSeen.add(beforeId);
      }
      if (afterId > 0) {
        itemIdsSeen.add(afterId);
      }
    }
  }

  return itemIdsSeen;
}

export function reconstructInventoriesAtTimestamp(input: {
  frames: TimelineFrame[];
  upToTimestamp: number;
  participantIds: number[];
  itemSlugIndex: Map<number, string>;
}): ReconstructedInventories {
  const inventories = new Map<number, number[]>(
    input.participantIds.map((participantId) => [participantId, []]),
  );
  const participantIdSet = new Set(input.participantIds);
  let eventsApplied = 0;

  const sortedFrames = [...input.frames]
    .filter((frame) => typeof frame === "object" && frame !== null)
    .sort((left, right) => safeInt(left.timestamp) - safeInt(right.timestamp));

  for (const frame of sortedFrames) {
    const frameTimestamp = safeInt(frame.timestamp);
    if (frameTimestamp > input.upToTimestamp) {
      break;
    }

    const events = Array.isArray(frame.events) ? (frame.events as Array<Record<string, unknown>>) : [];
    for (const event of events) {
      const eventTimestamp = safeInt(event.timestamp);
      if (eventTimestamp > input.upToTimestamp) {
        continue;
      }

      const participantId = safeInt(event.participantId);
      if (!participantIdSet.has(participantId)) {
        continue;
      }

      const inventory = inventories.get(participantId);
      if (!inventory) {
        continue;
      }

      const eventType = String(event.type ?? "");
      const itemId = safeInt(event.itemId);
      if (eventType === "ITEM_PURCHASED" && itemId > 0) {
        inventory.push(itemId);
        eventsApplied += 1;
        continue;
      }

      if ((eventType === "ITEM_SOLD" || eventType === "ITEM_DESTROYED") && itemId > 0) {
        removeItemOnce(inventory, itemId);
        eventsApplied += 1;
        continue;
      }

      if (eventType === "ITEM_UNDO") {
        const beforeId = safeInt(event.beforeId);
        const afterId = safeInt(event.afterId);
        if (beforeId > 0) {
          removeItemOnce(inventory, beforeId);
        }
        if (afterId > 0) {
          inventory.push(afterId);
        }
        eventsApplied += 1;
      }
    }
  }

  return {
    inventories: new Map(
      [...inventories.entries()].map(([participantId, itemIds]) => [
        participantId,
        itemIds
          .map((itemId) => input.itemSlugIndex.get(itemId))
          .filter((itemSlug): itemSlug is string => Boolean(itemSlug))
          .map((itemSlug) => resolveItemSlug(itemSlug)),
      ]),
    ),
    eventsApplied,
    participantsCovered: input.participantIds.length,
  };
}
