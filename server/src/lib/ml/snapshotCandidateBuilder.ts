import { Role } from "@prisma/client";
import {
  collectTimelineItemIds,
  reconstructInventoriesAtTimestamp,
} from "./scenarioInventory.js";
import type { MlPuzzleSnapshot } from "./mlPuzzle.js";
import {
  getPublishabilityFloorGold,
  isMeaningfulPurchaseSnapshotCandidate,
  MIN_MEANINGFUL_PURCHASE_GOLD,
  scoreSnapshotCandidate,
} from "./snapshotQuality.js";
import {
  getSnapshotSegment,
  SNAPSHOT_SEGMENTS,
} from "./snapshotSeriesSelection.js";

export type ScenarioMember = {
  championSlug: string;
  role: Role | null;
  items: string[];
};

type ScenarioMemberDraft = ScenarioMember & {
  participantId: number;
};

type TeamComposition = {
  frontlineCount: number;
  magicDamageCount: number;
  physicalDamageCount: number;
  supportCount: number;
};

export type ScenarioSnapshot = {
  currentBuild: string[];
  allyTeam: ScenarioMember[];
  enemyTeam: ScenarioMember[];
};

export type SnapshotCandidate = {
  snapshotIndex: number;
  rawPurchaseIndex: number;
  snapshot: MlPuzzleSnapshot;
  scenario: ScenarioSnapshot;
  relevanceScore: number;
  actualPurchase: {
    itemSlug: string | null;
    goldTotal: number | null;
    burstPurchaseIndex: number;
    timestampMinutes: number;
  };
};

export type ItemGoldValue = {
  goldTotal: number;
  goldSell: number;
};

export type SnapshotChampionProfile = {
  slug: string;
  tags: string[];
};

const PHYSICAL_TAGS = new Set(["Marksman", "Assassin", "Fighter"]);
const MAGIC_TAGS = new Set(["Mage", "Support"]);
const FRONTLINE_TAGS = new Set(["Tank", "Fighter"]);
const MAX_SNAPSHOT_CANDIDATES = 12;
const MAX_SNAPSHOT_CANDIDATES_PER_SEGMENT = 4;
const SHOP_BURST_WINDOW_MS = 45_000;

const compareText = (left: string, right: string) => left.localeCompare(right);

function safeInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeRole(value: unknown): Role | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  switch (normalized) {
    case "TOP":
      return Role.TOP;
    case "JUNGLE":
      return Role.JUNGLE;
    case "MIDDLE":
    case "MID":
      return Role.MID;
    case "BOTTOM":
    case "BOT":
    case "ADC":
    case "CARRY":
      return Role.ADC;
    case "UTILITY":
    case "SUPPORT":
      return Role.SUPPORT;
    default:
      return null;
  }
}

function resolveParticipantRole(participant: Record<string, unknown>) {
  return (
    normalizeRole(participant.teamPosition) ??
    normalizeRole(participant.individualPosition) ??
    normalizeRole(participant.role) ??
    normalizeRole(participant.lane)
  );
}

function removeItemOnce(items: number[], itemId: number) {
  const index = items.indexOf(itemId);
  if (index >= 0) {
    items.splice(index, 1);
  }
}

function buildChampionProfile(tags: string[]) {
  return {
    frontline: Number(tags.some((tag) => FRONTLINE_TAGS.has(tag))),
    physical: Number(tags.some((tag) => PHYSICAL_TAGS.has(tag))),
    magic: Number(tags.some((tag) => MAGIC_TAGS.has(tag))),
    support: Number(tags.includes("Support")),
  };
}

function resolveItemGoldValue(
  itemGoldIndex: Map<number, ItemGoldValue>,
  itemId: number,
) {
  return itemGoldIndex.get(itemId) ?? {
    goldTotal: 0,
    goldSell: 0,
  };
}

function createEmptyTeamComposition(): TeamComposition {
  return {
    frontlineCount: 0,
    magicDamageCount: 0,
    physicalDamageCount: 0,
    supportCount: 0,
  };
}

function addChampionProfileToComposition(
  composition: TeamComposition,
  profile: ReturnType<typeof buildChampionProfile>,
) {
  composition.frontlineCount += profile.frontline;
  composition.magicDamageCount += profile.magic;
  composition.physicalDamageCount += profile.physical;
  composition.supportCount += profile.support;
}

function replayGoldEvent(input: {
  event: Record<string, unknown>;
  index: number;
  purchaseEventIndex: number;
  workingGold: number;
  itemGoldIndex: Map<number, ItemGoldValue>;
}) {
  const eventType = String(input.event.type ?? "");
  const itemId = safeInt(input.event.itemId);

  if (eventType === "ITEM_PURCHASED" && itemId > 0) {
    const updatedGold = input.workingGold + resolveItemGoldValue(input.itemGoldIndex, itemId).goldTotal;
    return {
      workingGold: updatedGold,
      shouldStop: input.index === input.purchaseEventIndex,
    };
  }

  if (eventType === "ITEM_SOLD" && itemId > 0) {
    return {
      workingGold: input.workingGold - resolveItemGoldValue(input.itemGoldIndex, itemId).goldSell,
      shouldStop: false,
    };
  }

  return {
    workingGold: input.workingGold,
    shouldStop: eventType === "ITEM_UNDO" && input.index === input.purchaseEventIndex,
  };
}

export function calculateGoldBeforePurchaseFromFrame(input: {
  events: Array<Record<string, unknown>>;
  participantId: number;
  purchaseEventIndex: number;
  endingGold: number;
  itemGoldIndex: Map<number, ItemGoldValue>;
}) {
  let workingGold = input.endingGold;

  for (let index = input.events.length - 1; index >= input.purchaseEventIndex; index -= 1) {
    const event = input.events[index];
    if (safeInt(event.participantId) !== input.participantId) {
      continue;
    }

    const replay = replayGoldEvent({
      event,
      index,
      purchaseEventIndex: input.purchaseEventIndex,
      workingGold,
      itemGoldIndex: input.itemGoldIndex,
    });
    workingGold = replay.workingGold;
    if (replay.shouldStop) {
      return workingGold;
    }
  }

  return workingGold;
}

const buildCurrentItemsSignature = (currentItems: string[]) =>
  [...currentItems].sort(compareText).join("|");

function isSameSnapshotCandidate(left: SnapshotCandidate, right: SnapshotCandidate) {
  return (
    buildCurrentItemsSignature(left.snapshot.currentItems) === buildCurrentItemsSignature(right.snapshot.currentItems)
    && Math.abs(right.snapshot.timestampMinutes - left.snapshot.timestampMinutes) < 3
  );
}

function appendUniqueSnapshotCandidate(kept: SnapshotCandidate[], candidate: SnapshotCandidate) {
  if (kept.find((existing) => isSameSnapshotCandidate(candidate, existing))) {
    return false;
  }

  kept.push(candidate);
  return true;
}

function fillSnapshotsForSegment(
  kept: SnapshotCandidate[],
  sorted: SnapshotCandidate[],
  segment: ReturnType<typeof getSnapshotSegment>,
) {
  let keptForSegment = 0;

  for (const candidate of sorted) {
    if (getSnapshotSegment(candidate.snapshot.timestampMinutes) !== segment) {
      continue;
    }
    if (!appendUniqueSnapshotCandidate(kept, candidate)) {
      continue;
    }
    keptForSegment += 1;
    if (kept.length >= MAX_SNAPSHOT_CANDIDATES || keptForSegment >= MAX_SNAPSHOT_CANDIDATES_PER_SEGMENT) {
      break;
    }
  }
}

function fillRemainingSnapshots(kept: SnapshotCandidate[], sorted: SnapshotCandidate[]) {
  for (const candidate of sorted) {
    appendUniqueSnapshotCandidate(kept, candidate);
    if (kept.length >= MAX_SNAPSHOT_CANDIDATES) {
      break;
    }
  }
}

export function dedupeAndRankSnapshots(candidates: SnapshotCandidate[]) {
  const sorted = [...candidates]
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .filter((candidate) => candidate.relevanceScore >= 0);
  const kept: SnapshotCandidate[] = [];

  for (const segmentConfig of SNAPSHOT_SEGMENTS) {
    fillSnapshotsForSegment(kept, sorted, segmentConfig.segment);
    if (kept.length >= MAX_SNAPSHOT_CANDIDATES) {
      break;
    }
  }

  if (kept.length < MAX_SNAPSHOT_CANDIDATES) {
    fillRemainingSnapshots(kept, sorted);
  }

  return [...new Map(kept.map((candidate) => [candidate.snapshotIndex, candidate])).values()]
    .sort((left, right) => left.snapshot.timestampMinutes - right.snapshot.timestampMinutes);
}

export function collectSnapshotBuilderItemIds(frames: Array<Record<string, unknown>>) {
  return collectTimelineItemIds(frames);
}

function updateCombatStats(
  event: Record<string, unknown>,
  participantId: number,
  current: { kills: number; deaths: number; assists: number },
) {
  if (String(event.type ?? "") !== "CHAMPION_KILL") {
    return current;
  }

  return {
    kills: current.kills + Number(safeInt(event.killerId) === participantId),
    deaths: current.deaths + Number(safeInt(event.victimId) === participantId),
    assists: current.assists + Number(
      Array.isArray(event.assistingParticipantIds)
      && event.assistingParticipantIds.map((value) => safeInt(value)).includes(participantId),
    ),
  };
}

function applyInventoryEvent(inventory: number[], event: Record<string, unknown>) {
  const eventType = String(event.type ?? "");
  const itemId = safeInt(event.itemId);

  if ((eventType === "ITEM_SOLD" || eventType === "ITEM_DESTROYED") && itemId > 0) {
    removeItemOnce(inventory, itemId);
  }
  if (eventType === "ITEM_UNDO") {
    removeItemOnce(inventory, safeInt(event.beforeId));
    if (safeInt(event.afterId) > 0) {
      inventory.push(safeInt(event.afterId));
    }
  }
}

function buildScenarioTeams(input: {
  allyTeamDraft: ScenarioMemberDraft[];
  enemyTeamDraft: ScenarioMemberDraft[];
  inventories: Map<number, string[]>;
}) {
  return {
    allyTeam: input.allyTeamDraft.map(({ participantId: _participantId, ...member }) => ({
      ...member,
      items: input.inventories.get(_participantId) ?? [],
    })),
    enemyTeam: input.enemyTeamDraft.map(({ participantId: _participantId, ...member }) => ({
      ...member,
      items: input.inventories.get(_participantId) ?? [],
    })),
  };
}

function collectTeamDrafts(input: {
  participants: Array<Record<string, unknown>>;
  championIndex: Map<number, SnapshotChampionProfile>;
  ownTeamId: number;
}) {
  const allyTeamDraft: ScenarioMemberDraft[] = [];
  const enemyTeamDraft: ScenarioMemberDraft[] = [];
  const allyComposition = createEmptyTeamComposition();
  const enemyComposition = createEmptyTeamComposition();

  for (const participant of input.participants) {
    const champion = input.championIndex.get(safeInt(participant.championId));
    if (!champion) {
      continue;
    }

    const profile = buildChampionProfile(champion.tags);
    const member = {
      participantId: safeInt(participant.participantId),
      championSlug: champion.slug,
      role: resolveParticipantRole(participant),
      items: [],
    };

    if (safeInt(participant.teamId) === input.ownTeamId) {
      allyTeamDraft.push(member);
      addChampionProfileToComposition(allyComposition, profile);
    } else {
      enemyTeamDraft.push(member);
      addChampionProfileToComposition(enemyComposition, profile);
    }
  }

  return {
    allyTeamDraft,
    enemyTeamDraft,
    allyComposition,
    enemyComposition,
  };
}

function buildCandidateRelevanceScore(input: {
  snapshot: MlPuzzleSnapshot;
  burstPurchaseIndex: number;
  actualPurchaseGoldTotal: number | null;
}) {
  return (
    scoreSnapshotCandidate(input.snapshot)
    - (input.burstPurchaseIndex > 0 ? input.burstPurchaseIndex * 8 : 0)
    - (
      (input.actualPurchaseGoldTotal ?? 0) < getPublishabilityFloorGold(input.snapshot.goldAvailable)
        ? 24
        : 0
    )
    - (
      input.burstPurchaseIndex > 0 && (input.actualPurchaseGoldTotal ?? 0) < MIN_MEANINGFUL_PURCHASE_GOLD
        ? 20
        : 0
    )
  );
}

export function buildSnapshotCandidates(input: {
  importedMatch: {
    patch: string | null;
    targetPuuid: string;
    targetChampionSlug: string | null;
    targetRole: Role | null;
  };
  participants: Array<Record<string, unknown>>;
  frames: Array<Record<string, unknown>>;
  championIndex: Map<number, SnapshotChampionProfile>;
  itemSlugIndex: Map<number, string>;
  itemGoldIndex: Map<number, ItemGoldValue>;
}) {
  const targetParticipant = input.participants.find(
    (entry) => String(entry.puuid ?? "") === input.importedMatch.targetPuuid,
  );
  if (!targetParticipant) {
    return {
      rawCandidates: [] as SnapshotCandidate[],
      filteredCandidates: [] as SnapshotCandidate[],
      dedupedCandidates: [] as SnapshotCandidate[],
      targetParticipantFound: false,
    };
  }

  const participantId = safeInt(targetParticipant.participantId);
  const ownTeamId = safeInt(targetParticipant.teamId);
  const {
    allyTeamDraft,
    enemyTeamDraft,
    allyComposition,
    enemyComposition,
  } = collectTeamDrafts({
    participants: input.participants,
    championIndex: input.championIndex,
    ownTeamId,
  });

  const sortedFrames = input.frames
    .filter((frame) => typeof frame === "object" && frame !== null)
    .sort((left, right) => safeInt(left.timestamp) - safeInt(right.timestamp));
  const inventory: number[] = [];
  let combatStats = {
    kills: 0,
    deaths: 0,
    assists: 0,
  };
  const rawCandidates: SnapshotCandidate[] = [];
  let lastPurchaseTimestamp = Number.NEGATIVE_INFINITY;
  let burstPurchaseIndex = 0;

  for (const frame of sortedFrames) {
    const participantFrames = frame.participantFrames as Record<string, Record<string, unknown>> | undefined;
    const participantFrame = participantFrames?.[String(participantId)] ?? {};
    const events = Array.isArray(frame.events) ? (frame.events as Array<Record<string, unknown>>) : [];

    for (const [eventIndex, event] of events.entries()) {
      const eventType = String(event.type ?? "");
      const eventParticipantId = safeInt(event.participantId);

      combatStats = updateCombatStats(event, participantId, combatStats);

      if (eventParticipantId !== participantId) {
        continue;
      }

      const itemId = safeInt(event.itemId);
      if (eventType === "ITEM_PURCHASED" && itemId > 0) {
        const purchaseTimestamp = safeInt(event.timestamp);
        burstPurchaseIndex =
          purchaseTimestamp - lastPurchaseTimestamp <= SHOP_BURST_WINDOW_MS
            ? burstPurchaseIndex + 1
            : 0;
        lastPurchaseTimestamp = purchaseTimestamp;
        const goldBeforePurchase = calculateGoldBeforePurchaseFromFrame({
          events,
          participantId,
          purchaseEventIndex: eventIndex,
          endingGold: safeInt(participantFrame.currentGold),
          itemGoldIndex: input.itemGoldIndex,
        });
        const currentBuild = inventory
          .map((value) => input.itemSlugIndex.get(value))
          .filter((value): value is string => Boolean(value));
        const reconstructedInventories = reconstructInventoriesAtTimestamp({
          frames: sortedFrames,
          upToTimestamp: safeInt(event.timestamp),
          participantIds: [
            ...allyTeamDraft.map((member) => member.participantId),
            ...enemyTeamDraft.map((member) => member.participantId),
          ],
          itemSlugIndex: input.itemSlugIndex,
        });
        console.info(
          `[ml-puzzle] reconstructed team inventories snapshotMinute=${(safeInt(event.timestamp) / 60000).toFixed(2)} participants=${reconstructedInventories.participantsCovered} eventsApplied=${reconstructedInventories.eventsApplied}`,
        );
        const { allyTeam, enemyTeam } = buildScenarioTeams({
          allyTeamDraft,
          enemyTeamDraft,
          inventories: reconstructedInventories.inventories,
        });
        const snapshot = {
          patch: input.importedMatch.patch ?? "unknown",
          championSlug: input.importedMatch.targetChampionSlug ?? "",
          role: input.importedMatch.targetRole,
          goldAvailable: goldBeforePurchase,
          level: safeInt(participantFrame.level),
          ...combatStats,
          cs: safeInt(participantFrame.minionsKilled) + safeInt(participantFrame.jungleMinionsKilled),
          timestampMinutes: safeInt(event.timestamp) / 60000,
          currentItems: currentBuild,
          allyFrontlineCount: allyComposition.frontlineCount,
          allyMagicDamageCount: allyComposition.magicDamageCount,
          allyPhysicalDamageCount: allyComposition.physicalDamageCount,
          allySupportCount: allyComposition.supportCount,
          enemyFrontlineCount: enemyComposition.frontlineCount,
          enemyMagicDamageCount: enemyComposition.magicDamageCount,
          enemyPhysicalDamageCount: enemyComposition.physicalDamageCount,
          enemySupportCount: enemyComposition.supportCount,
        } satisfies MlPuzzleSnapshot;
        const actualPurchase = {
          itemSlug: input.itemSlugIndex.get(itemId) ?? null,
          goldTotal: input.itemGoldIndex.get(itemId)?.goldTotal ?? null,
          burstPurchaseIndex,
          timestampMinutes: purchaseTimestamp / 60000,
        };
        rawCandidates.push({
          snapshotIndex: rawCandidates.length,
          rawPurchaseIndex: rawCandidates.length,
          snapshot,
          scenario: {
            currentBuild,
            allyTeam,
            enemyTeam,
          },
          relevanceScore: buildCandidateRelevanceScore({
            snapshot,
            burstPurchaseIndex,
            actualPurchaseGoldTotal: actualPurchase.goldTotal,
          }),
          actualPurchase,
        });
        inventory.push(itemId);
        continue;
      }

      applyInventoryEvent(inventory, event);
    }
  }

  const filteredCandidates = rawCandidates.filter(isMeaningfulPurchaseSnapshotCandidate);
  const dedupedCandidates = dedupeAndRankSnapshots(filteredCandidates);

  return {
    rawCandidates,
    filteredCandidates,
    dedupedCandidates,
    targetParticipantFound: true,
  };
}
