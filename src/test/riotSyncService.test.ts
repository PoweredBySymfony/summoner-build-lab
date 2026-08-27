import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  latestVersion: vi.fn(),
  championSummary: vi.fn(),
  itemSummary: vi.fn(),
  championIconUrl: vi.fn(),
  championSplashUrl: vi.fn(),
  itemIconUrl: vi.fn(),
  championUpsert: vi.fn(),
  championFindMany: vi.fn(),
  championUpdate: vi.fn(),
  itemFindFirst: vi.fn(),
  itemUpsert: vi.fn(),
  itemDeleteMany: vi.fn(),
  itemUpdateMany: vi.fn(),
  itemFindMany: vi.fn(),
  itemUpdate: vi.fn(),
  riotAccountIndexFindMany: vi.fn(),
  importedMatchFindMany: vi.fn(),
  resolveLeagueIdentity: vi.fn(),
  resolveImportIdentity: vi.fn(),
  upsertIndexedAccount: vi.fn(),
  importRecentMatchesInternal: vi.fn(),
  importMatchForIdentityInternal: vi.fn(),
  getMatchIdsByPuuidOnRegion: vi.fn(),
  getMatchByIdOnRegion: vi.fn(),
  buildPublicPlayerProfile: vi.fn(),
  collectPublicProfileItemIds: vi.fn(),
}));

vi.mock("../../server/src/lib/gameData/dataDragonClient.js", () => ({
  dataDragonClient: {
    getLatestVersion: mocks.latestVersion,
    getChampionSummary: mocks.championSummary,
    getItemSummary: mocks.itemSummary,
    getChampionIconUrl: mocks.championIconUrl,
    getChampionSplashUrl: mocks.championSplashUrl,
    getItemIconUrl: mocks.itemIconUrl,
  },
}));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    champion: {
      upsert: mocks.championUpsert,
      findMany: mocks.championFindMany,
      update: mocks.championUpdate,
    },
    item: {
      findFirst: mocks.itemFindFirst,
      upsert: mocks.itemUpsert,
      deleteMany: mocks.itemDeleteMany,
      updateMany: mocks.itemUpdateMany,
      findMany: mocks.itemFindMany,
      update: mocks.itemUpdate,
    },
    riotAccountIndex: {
      findMany: mocks.riotAccountIndexFindMany,
    },
    importedMatch: {
      findMany: mocks.importedMatchFindMany,
    },
  },
}));

vi.mock("../../server/src/lib/riot/riotIdentity.js", () => ({
  resolveLeagueIdentity: mocks.resolveLeagueIdentity,
  resolveImportIdentity: mocks.resolveImportIdentity,
  upsertIndexedAccount: mocks.upsertIndexedAccount,
}));

vi.mock("../../server/src/lib/riot/matchImportRunner.js", () => ({
  importRecentMatchesInternal: mocks.importRecentMatchesInternal,
  importMatchForIdentityInternal: mocks.importMatchForIdentityInternal,
}));

vi.mock("../../server/src/lib/riot/riotApiClient.js", () => ({
  riotApiClient: {
    getMatchIdsByPuuidOnRegion: mocks.getMatchIdsByPuuidOnRegion,
    getMatchByIdOnRegion: mocks.getMatchByIdOnRegion,
  },
}));

vi.mock("../../server/src/lib/riot/publicPlayerProfile.js", () => ({
  collectPublicProfileItemIds: mocks.collectPublicProfileItemIds,
  buildPublicPlayerProfile: mocks.buildPublicPlayerProfile,
}));

import { riotSyncService } from "../../server/src/services/riotSyncService";

const seenAt = new Date("2026-06-07T08:00:00.000Z");

function accountEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-index-id",
    puuid: "puuid-jinx",
    gameName: "JinxMain",
    tagLine: "EUW",
    normalizedRiotId: "jinxmain#euw",
    lastSeenAt: seenAt,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.latestVersion.mockResolvedValue("16.7");
  mocks.championIconUrl.mockImplementation((version: string, id: string) => `champion-icon:${version}:${id}`);
  mocks.championSplashUrl.mockImplementation((id: string) => `champion-splash:${id}`);
  mocks.itemIconUrl.mockImplementation((version: string, id: string | number) => `item-icon:${version}:${id}`);
  mocks.championUpsert.mockResolvedValue({});
  mocks.itemFindFirst.mockResolvedValue(null);
  mocks.itemUpsert.mockResolvedValue({});
  mocks.itemDeleteMany.mockResolvedValue({ count: 1 });
  mocks.itemUpdateMany.mockResolvedValue({ count: 2 });
  mocks.championFindMany.mockResolvedValue([
    { id: "champion-db-id", championKey: "Jinx", name: "Jinx" },
  ]);
  mocks.itemFindMany.mockResolvedValue([
    { id: "item-db-id", riotItemId: 3031, name: "Infinity Edge", image: "old.png" },
  ]);
  mocks.championUpdate.mockResolvedValue({});
  mocks.itemUpdate.mockResolvedValue({});
  mocks.riotAccountIndexFindMany.mockResolvedValue([]);
  mocks.importedMatchFindMany.mockResolvedValue([{ id: "imported-match-id" }]);
  mocks.resolveLeagueIdentity.mockResolvedValue({
    account: { puuid: "puuid-jinx", gameName: "JinxMain", tagLine: "EUW" },
    summoner: { id: "summoner-id" },
    region: "europe",
    platform: "euw1",
  });
  mocks.resolveImportIdentity.mockResolvedValue({ account: { puuid: "puuid-jinx" } });
  mocks.importRecentMatchesInternal.mockResolvedValue({
    matches: [
      { riotMatchId: "EUW1_1" },
      { riotMatchId: "EUW1_2", timelineMissingReason: "target-participant-missing" },
    ],
  });
  mocks.importMatchForIdentityInternal.mockResolvedValue({ riotMatchId: "EUW1_1" });
  mocks.getMatchIdsByPuuidOnRegion.mockResolvedValue(["EUW1_1"]);
  mocks.getMatchByIdOnRegion.mockResolvedValue({
    metadata: { matchId: "EUW1_1" },
    info: {
      participants: [
        {
          puuid: "puuid-jinx",
          riotIdGameName: "JinxMain",
          riotIdTagline: "EUW",
        },
      ],
    },
  });
  mocks.collectPublicProfileItemIds.mockReturnValue([3031]);
  mocks.buildPublicPlayerProfile.mockReturnValue({ riotId: "JinxMain#EUW" });
  mocks.upsertIndexedAccount.mockResolvedValue(undefined);
});

describe("riotSyncService", () => {
  it("syncs champion catalog entries with inferred roles and Data Dragon assets", async () => {
    mocks.championSummary.mockResolvedValueOnce({
      data: {
        Jinx: {
          id: "Jinx",
          key: "222",
          name: "Jinx",
          title: "the Loose Cannon",
          tags: ["Marksman"],
          stats: { attackdamage: 59 },
        },
        ChoGath: {
          id: "Chogath",
          key: "31",
          name: "Cho'Gath",
          title: "the Terror",
          tags: [],
          stats: {},
        },
      },
    });

    await expect(riotSyncService.syncChampions("16.7")).resolves.toEqual({
      version: "16.7",
      count: 2,
    });
    expect(mocks.championUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "jinx" },
      update: expect.objectContaining({
        rolePrimary: Role.ADC,
        roleSecondary: undefined,
        image: "champion-icon:16.7:Jinx",
      }),
    }));
    expect(mocks.championUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "chogath" },
      update: expect.objectContaining({
        rolePrimary: Role.FLEX,
      }),
    }));
  });

  it("syncs canonical purchasable items, formats descriptions, and cleans removed entries", async () => {
    mocks.itemFindFirst.mockResolvedValueOnce({ id: "conflicting-item" });
    mocks.itemSummary.mockResolvedValueOnce({
      data: {
        "1001": {
          name: "Boots",
          plaintext: "Move&nbsp;fast",
          description: "<mainText><stats>Speed &amp; tempo</stats><br><li>Cheap</li></mainText>",
          gold: { base: 300, total: 300, sell: 210, purchasable: true },
          tags: ["Boots"],
          stats: { FlatMovementSpeedMod: 25 },
          maps: { "11": true },
          inStore: true,
        },
        "9999": {
          name: "Debug Item",
          plaintext: "",
          description: "",
          gold: { base: 0, total: 0, sell: 0, purchasable: false },
          tags: [],
          stats: {},
          maps: { "11": true },
          inStore: true,
        },
      },
    });

    await expect(riotSyncService.syncItems("16.7")).resolves.toEqual({
      version: "16.7",
      count: 1,
      removedNonStandardCount: 1,
    });
    expect(mocks.itemUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { riotItemId: 1001 },
      update: expect.objectContaining({
        slug: "boots-1001",
        shortDescription: "Move fast",
        fullDescription: expect.stringContaining("Speed & tempo"),
        category: "boots",
        isBoots: true,
        isLegendary: false,
      }),
    }));
    expect(mocks.itemDeleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.any(Array),
      }),
    }));
    expect(mocks.itemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { isActive: false },
    }));
  });

  it("refreshes asset URLs and orchestrates full catalog syncs", async () => {
    const syncChampions = vi.spyOn(riotSyncService, "syncChampions").mockResolvedValueOnce({ version: "16.7", count: 1 });
    const syncItems = vi.spyOn(riotSyncService, "syncItems").mockResolvedValueOnce({ version: "16.7", count: 1, removedNonStandardCount: 0 });
    const syncAssets = vi.spyOn(riotSyncService, "syncAssets").mockResolvedValueOnce({ version: "16.7", championCount: 1, itemCount: 1 });

    await expect(riotSyncService.syncAll()).resolves.toEqual({
      version: "16.7",
      champions: { version: "16.7", count: 1 },
      items: { version: "16.7", count: 1, removedNonStandardCount: 0 },
      assets: { version: "16.7", championCount: 1, itemCount: 1 },
    });
    expect(syncChampions).toHaveBeenCalledWith("16.7");
    expect(syncItems).toHaveBeenCalledWith("16.7");
    expect(syncAssets).toHaveBeenCalledWith("16.7");

    syncChampions.mockRestore();
    syncItems.mockRestore();
    syncAssets.mockRestore();

    await expect(riotSyncService.syncAssets("16.8")).resolves.toEqual({
      version: "16.8",
      championCount: 1,
      itemCount: 1,
    });
    expect(mocks.championUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        image: "champion-icon:16.8:Jinx",
        splashImage: "champion-splash:Jinx",
      }),
    }));
    expect(mocks.itemUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        image: "item-icon:16.8:3031",
        patch: "16.8",
      },
    }));
  });

  it("scores autocomplete results and returns compact Riot ID entries", async () => {
    mocks.riotAccountIndexFindMany.mockResolvedValueOnce([
      accountEntry({ gameName: "Other", tagLine: "EUW", normalizedRiotId: "other#euw", lastSeenAt: new Date("2026-06-06") }),
      accountEntry({ gameName: "JinxMain", tagLine: "EUW", normalizedRiotId: "jinxmain#euw", lastSeenAt: new Date("2026-06-05") }),
    ]);

    await expect(riotSyncService.getPlayerAutocomplete("Jinx#EU", 1)).resolves.toEqual([
      expect.objectContaining({
        gameName: "JinxMain",
        tagLine: "EUW",
        riotId: "JinxMain#EUW",
      }),
    ]);
    expect(mocks.riotAccountIndexFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 12,
    }));
    await expect(riotSyncService.getPlayerAutocomplete("   ")).resolves.toEqual([]);
  });

  it("delegates identity resolution and match imports to Riot helpers", async () => {
    await expect(riotSyncService.getAccountProfile("JinxMain", "EUW")).resolves.toMatchObject({
      account: { puuid: "puuid-jinx" },
      region: "europe",
      platform: "euw1",
    });

    await expect(riotSyncService.resolveImportIdentity({ gameName: "JinxMain", tagLine: "EUW" })).resolves.toEqual({
      account: { puuid: "puuid-jinx" },
    });

    await expect(riotSyncService.importRecentMatches("user-id", "puuid-jinx", 2)).resolves.toEqual([
      { id: "imported-match-id" },
    ]);
    expect(mocks.importedMatchFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        riotMatchId: {
          in: ["EUW1_1"],
        },
      },
    }));

    await expect(riotSyncService.importRecentMatchesDetailed("user-id", "puuid-jinx", 2)).resolves.toEqual({
      matches: expect.any(Array),
    });

    await expect(
      riotSyncService.importMatchForIdentity(
        "user-id",
        "EUW1_1",
        { account: { puuid: "puuid-jinx" } } as never,
        { sourceKind: "manual" as never, sourceMetadata: { origin: "test" } },
      ),
    ).resolves.toEqual({ riotMatchId: "EUW1_1" });
    expect(mocks.importMatchForIdentityInternal).toHaveBeenCalledWith(
      { account: { puuid: "puuid-jinx" } },
      expect.objectContaining({
        userId: "user-id",
        matchId: "EUW1_1",
        sourceKind: "manual",
      }),
    );
  });

  it("builds public player profiles and indexes seen participants", async () => {
    await expect(riotSyncService.getPublicPlayerProfile("JinxMain", "EUW", 1)).resolves.toEqual({
      riotId: "JinxMain#EUW",
    });

    expect(mocks.getMatchIdsByPuuidOnRegion).toHaveBeenCalledWith("puuid-jinx", "europe", 1);
    expect(mocks.itemFindMany).toHaveBeenCalledWith({
      where: {
        riotItemId: {
          in: [3031],
        },
      },
      select: {
        riotItemId: true,
        name: true,
        image: true,
      },
    });
    expect(mocks.buildPublicPlayerProfile).toHaveBeenCalledWith(expect.objectContaining({
      region: "europe",
      platform: "euw1",
      itemIndex: expect.any(Map),
      getItemIconUrl: expect.any(Function),
    }));
    expect(mocks.upsertIndexedAccount).toHaveBeenCalledWith({
      puuid: "puuid-jinx",
      gameName: "JinxMain",
      tagLine: "EUW",
    });
  });
});
