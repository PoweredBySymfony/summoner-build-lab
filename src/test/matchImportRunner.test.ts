import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  champion: {
    findUnique: vi.fn(),
  },
  importedMatch: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  playerProfile: {
    upsert: vi.fn(),
  },
  riotAccountIndex: {
    findUnique: vi.fn(),
  },
  persistImportedMatchArtifacts: vi.fn(),
  recordIngestionRun: vi.fn(),
  getMatchByIdOnRegion: vi.fn(),
  getMatchTimelineByIdOnRegion: vi.fn(),
  getMatchIdsByPuuidOnRegion: vi.fn(),
  upsertIndexedAccount: vi.fn(),
  resolveLeagueIdentity: vi.fn(),
}));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    champion: mocks.champion,
    importedMatch: mocks.importedMatch,
    playerProfile: mocks.playerProfile,
    riotAccountIndex: mocks.riotAccountIndex,
  },
}));

vi.mock("../../server/src/repositories/importedMatchArchiveRepository.js", () => ({
  importedMatchArchiveRepository: {
    persistImportedMatchArtifacts: mocks.persistImportedMatchArtifacts,
    recordIngestionRun: mocks.recordIngestionRun,
  },
}));

vi.mock("../../server/src/lib/riot/riotApiClient.js", () => ({
  riotApiClient: {
    getMatchByIdOnRegion: mocks.getMatchByIdOnRegion,
    getMatchTimelineByIdOnRegion: mocks.getMatchTimelineByIdOnRegion,
    getMatchIdsByPuuidOnRegion: mocks.getMatchIdsByPuuidOnRegion,
  },
}));

vi.mock("../../server/src/lib/riot/riotIdentity.js", () => ({
  upsertIndexedAccount: mocks.upsertIndexedAccount,
  resolveLeagueIdentity: mocks.resolveLeagueIdentity,
}));

import {
  buildImportedMatchMetadata,
  fetchMatchBundleWithRetry,
  importMatchForIdentityInternal,
  importRecentMatchesInternal,
  normalizeSourceKind,
} from "../../server/src/lib/riot/matchImportRunner";

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  mocks.champion.findUnique.mockResolvedValue({ slug: "jinx" });
  mocks.importedMatch.findUnique.mockResolvedValue(null);
  mocks.importedMatch.upsert.mockResolvedValue({});
  mocks.playerProfile.upsert.mockResolvedValue({});
  mocks.riotAccountIndex.findUnique.mockResolvedValue({
    puuid: "target-puuid",
    gameName: "BakaAsta",
    tagLine: "EUW",
    region: "europe",
    platform: "euw1",
  });
  mocks.persistImportedMatchArtifacts.mockResolvedValue({
    mongoMatchImportRef: null,
    mongoTimelineRef: null,
  });
  mocks.recordIngestionRun.mockResolvedValue({});
  mocks.upsertIndexedAccount.mockResolvedValue({});
});

function match(participantOverrides: Record<string, unknown> = {}) {
  return {
    metadata: {
      matchId: "EUW1_123",
    },
    info: {
      gameVersion: "16.6.789",
      gameCreation: Date.UTC(2026, 5, 7, 12),
      gameDuration: 1800,
      participants: [
        {
          puuid: "target-puuid",
          riotIdGameName: "BakaAsta",
          riotIdTagline: "EUW",
          championId: 222,
          championName: "Jinx",
          teamPosition: "BOTTOM",
          ...participantOverrides,
        },
        {
          puuid: "ally-puuid",
          riotIdGameName: "Ally",
          riotIdTagline: "EUW",
          championId: 64,
          championName: "LeeSin",
          teamPosition: "JUNGLE",
        },
      ],
    },
  };
}

function timeline() {
  return {
    info: {
      frames: [{ timestamp: 0 }, { timestamp: 60000 }],
    },
  };
}

describe("matchImportRunner", () => {
  it("normalizes blank source kinds to null", () => {
    expect(normalizeSourceKind(undefined)).toBeNull();
    expect(normalizeSourceKind(null)).toBeNull();
    expect(normalizeSourceKind("   ")).toBeNull();
    expect(normalizeSourceKind(" PRO_SEED ")).toBe("PRO_SEED");
  });

  it("builds stable imported match metadata for persistence and reports", () => {
    expect(
      buildImportedMatchMetadata({
        riotMatchId: "EUW1_123",
        patch: "15.20",
        sourceRegion: "europe",
        sourceKind: "PRO_SEED",
        sourceMetadata: {
          seed: {
            playerName: "Caps",
            team: "G2",
          },
        },
        targetPuuid: "target-puuid",
        targetGameName: "Caps",
        targetTagLine: "EUW",
        participant: {
          championId: 103,
        },
        championSlug: "ahri",
        targetRole: Role.MID,
        gameCreationAt: new Date("2026-06-06T12:00:00.000Z"),
        gameDurationSeconds: 1800,
      }),
    ).toEqual({
      riotMatchId: "EUW1_123",
      patch: "15.20",
      sourceRegion: "europe",
      sourceKind: "PRO_SEED",
      sourceMetadata: {
        seed: {
          playerName: "Caps",
          team: "G2",
        },
      },
      targetPuuid: "target-puuid",
      targetGameName: "Caps",
      targetTagLine: "EUW",
      targetChampionId: 103,
      targetChampionSlug: "ahri",
      targetRole: Role.MID,
      gameCreationAt: "2026-06-06T12:00:00.000Z",
      gameDurationSeconds: 1800,
    });
  });

  it("retries transient Riot bundle failures before succeeding", async () => {
    mocks.getMatchByIdOnRegion
      .mockRejectedValueOnce(new HttpError(503, "busy"))
      .mockResolvedValueOnce(match());
    mocks.getMatchTimelineByIdOnRegion
      .mockResolvedValueOnce(timeline())
      .mockResolvedValueOnce(timeline());

    await expect(fetchMatchBundleWithRetry("EUW1_123", "europe", 2)).resolves.toEqual({
      match: match(),
      timeline: timeline(),
    });
  });

  it("skips imports when the target participant is missing", async () => {
    mocks.getMatchByIdOnRegion.mockResolvedValueOnce({
      metadata: { matchId: "EUW1_missing" },
      info: {
        gameVersion: "16.6.789",
        gameCreation: Date.UTC(2026, 5, 7, 12),
        participants: [{ puuid: "someone-else" }],
      },
    });
    mocks.getMatchTimelineByIdOnRegion.mockResolvedValueOnce(timeline());

    await expect(
      importMatchForIdentityInternal(
        {
          puuid: "target-puuid",
          gameName: "BakaAsta",
          tagLine: "EUW",
          region: "europe",
          platform: "euw1",
        },
        {
          userId: "user-1",
          matchId: "EUW1_missing",
        },
      ),
    ).resolves.toMatchObject({
      riotMatchId: "EUW1_missing",
      created: false,
      skippedReason: "target-participant-missing",
      timelineAvailable: true,
    });
    expect(mocks.importedMatch.upsert).not.toHaveBeenCalled();
  });

  it("skips existing matches owned by another target when requested", async () => {
    mocks.getMatchByIdOnRegion.mockResolvedValueOnce(match());
    mocks.getMatchTimelineByIdOnRegion.mockResolvedValueOnce(timeline());
    mocks.importedMatch.findUnique.mockResolvedValueOnce({
      id: "existing-id",
      targetPuuid: "other-puuid",
      sourceKind: "USER_SYNC",
    });

    await expect(
      importMatchForIdentityInternal(
        {
          puuid: "target-puuid",
          gameName: "BakaAsta",
          tagLine: "EUW",
          region: "europe",
          platform: "euw1",
        },
        {
          userId: "user-1",
          matchId: "EUW1_123",
          skipExistingWithDifferentTarget: true,
        },
      ),
    ).resolves.toMatchObject({
      riotMatchId: "EUW1_123",
      created: false,
      skippedReason: "existing-match-different-target",
      targetChampionSlug: "jinx",
      targetRole: Role.ADC,
    });
    expect(mocks.persistImportedMatchArtifacts).not.toHaveBeenCalled();
  });

  it("imports and persists match payloads with source metadata", async () => {
    mocks.getMatchByIdOnRegion.mockResolvedValueOnce(match());
    mocks.getMatchTimelineByIdOnRegion.mockResolvedValueOnce(timeline());

    await expect(
      importMatchForIdentityInternal(
        {
          puuid: "target-puuid",
          gameName: "BakaAsta",
          tagLine: "EUW",
          region: "europe",
          platform: "euw1",
        },
        {
          userId: "user-1",
          matchId: "EUW1_123",
          sourceKind: " PRO_SEED ",
          sourceMetadata: { seed: "caps" },
        },
      ),
    ).resolves.toMatchObject({
      riotMatchId: "EUW1_123",
      created: true,
      skippedReason: null,
      targetChampionSlug: "jinx",
      targetRole: Role.ADC,
      timelineAvailable: true,
    });

    expect(mocks.upsertIndexedAccount).toHaveBeenCalledTimes(2);
    expect(mocks.persistImportedMatchArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        riotMatchId: "EUW1_123",
        sourceKind: "PRO_SEED",
        targetPuuid: "target-puuid",
      }),
    );
    expect(mocks.importedMatch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { riotMatchId: "EUW1_123" },
        create: expect.objectContaining({
          userId: "user-1",
          targetChampionSlug: "jinx",
          targetRole: Role.ADC,
          sourceKind: "PRO_SEED",
        }),
      }),
    );
  });

  it("imports recent matches and records ingestion summaries", async () => {
    mocks.getMatchIdsByPuuidOnRegion.mockResolvedValueOnce(["EUW1_123"]);
    mocks.getMatchByIdOnRegion.mockResolvedValueOnce(match());
    mocks.getMatchTimelineByIdOnRegion.mockResolvedValueOnce(timeline());

    await expect(
      importRecentMatchesInternal("user-1", "target-puuid", 1, {
        sourceKind: "USER_SYNC",
      }),
    ).resolves.toEqual({
      requestedMatchCount: 1,
      importedMatchCount: 1,
      skippedMatchCount: 0,
      matches: [
        {
          riotMatchId: "EUW1_123",
          timelineAvailable: true,
          timelineMissingReason: null,
        },
      ],
    });

    expect(mocks.playerProfile.upsert).toHaveBeenCalled();
    expect(mocks.recordIngestionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "USER_SYNC",
        requestedMatchCount: 1,
        importedMatchCount: 1,
        timelineOkCount: 1,
      }),
    );
  });
});
