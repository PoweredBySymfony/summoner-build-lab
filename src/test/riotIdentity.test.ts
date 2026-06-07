import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  riotAccountIndex: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  getAccountByRiotIdOnRegion: vi.fn(),
  getSummonerByPuuidOnPlatform: vi.fn(),
  getRegionForPlatform: vi.fn(),
}));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    riotAccountIndex: mocks.riotAccountIndex,
  },
}));

vi.mock("../../server/src/lib/riot/riotApiClient.js", () => ({
  riotApiClient: {
    getAccountByRiotIdOnRegion: mocks.getAccountByRiotIdOnRegion,
    getSummonerByPuuidOnPlatform: mocks.getSummonerByPuuidOnPlatform,
    getRegionForPlatform: mocks.getRegionForPlatform,
  },
}));

import {
  normalizeRiotId,
  resolveImportIdentity,
  resolveLeagueIdentity,
  upsertIndexedAccount,
} from "../../server/src/lib/riot/riotIdentity";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRegionForPlatform.mockImplementation((platform: string) => (platform === "kr" ? "asia" : "europe"));
});

describe("riotIdentity", () => {
  it("normalizes Riot IDs for stable indexing", () => {
    expect(normalizeRiotId("  BakaAsta ", " euw ")).toBe("bakaasta#EUW");
  });

  it("upserts indexed accounts with normalized ids and preserved cached fields", async () => {
    mocks.riotAccountIndex.findUnique.mockResolvedValueOnce({
      puuid: "puuid-1",
      platform: "euw1",
      region: "europe",
      profileIconId: 29,
      summonerLevel: 420,
    });
    mocks.riotAccountIndex.upsert.mockResolvedValueOnce({});

    await upsertIndexedAccount({
      puuid: "puuid-1",
      gameName: "BakaAsta",
      tagLine: "EUW",
    });

    expect(mocks.riotAccountIndex.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { puuid: "puuid-1" },
        update: expect.objectContaining({
          normalizedRiotId: "bakaasta#EUW",
          platform: "euw1",
          region: "europe",
          profileIconId: 29,
          summonerLevel: 420,
        }),
        create: expect.objectContaining({
          normalizedRiotId: "bakaasta#EUW",
        }),
      }),
    );
  });

  it("resolves a Riot ID by trying account regions then preferred platform first", async () => {
    mocks.riotAccountIndex.findUnique.mockResolvedValueOnce({ platform: "kr" });
    mocks.getAccountByRiotIdOnRegion
      .mockRejectedValueOnce(new HttpError(404, "not in americas"))
      .mockResolvedValueOnce({ puuid: "puuid-1", gameName: "BakaAsta", tagLine: "EUW" });
    mocks.getSummonerByPuuidOnPlatform.mockResolvedValueOnce({
      profileIconId: 29,
      summonerLevel: 420,
    });
    mocks.riotAccountIndex.findUnique.mockResolvedValueOnce(null);
    mocks.riotAccountIndex.upsert.mockResolvedValueOnce({});

    const resolved = await resolveLeagueIdentity("BakaAsta", "EUW");

    expect(mocks.getAccountByRiotIdOnRegion).toHaveBeenNthCalledWith(1, "BakaAsta", "EUW", "americas");
    expect(mocks.getAccountByRiotIdOnRegion).toHaveBeenNthCalledWith(2, "BakaAsta", "EUW", "asia");
    expect(mocks.getSummonerByPuuidOnPlatform).toHaveBeenCalledWith("puuid-1", "kr");
    expect(resolved).toMatchObject({
      account: { puuid: "puuid-1" },
      accountRegion: "asia",
      platform: "kr",
      region: "asia",
    });
  });

  it("returns indexed puuid imports without calling Riot APIs when platform and region are cached", async () => {
    mocks.riotAccountIndex.findUnique.mockResolvedValueOnce({
      puuid: "puuid-1",
      gameName: "BakaAsta",
      tagLine: "EUW",
      platform: "euw1",
      region: "europe",
    });

    await expect(resolveImportIdentity({ type: "puuid", puuid: "puuid-1" })).resolves.toEqual({
      puuid: "puuid-1",
      gameName: "BakaAsta",
      tagLine: "EUW",
      platform: "euw1",
      region: "europe",
    });
    expect(mocks.getSummonerByPuuidOnPlatform).not.toHaveBeenCalled();
  });

  it("falls back to platform lookup for unknown puuid imports", async () => {
    mocks.riotAccountIndex.findUnique.mockResolvedValueOnce(null);
    mocks.getSummonerByPuuidOnPlatform
      .mockRejectedValueOnce(new HttpError(404, "not on br1"))
      .mockResolvedValueOnce({ profileIconId: 30 });

    await expect(resolveImportIdentity({ type: "puuid", puuid: "puuid-2" })).resolves.toMatchObject({
      puuid: "puuid-2",
      gameName: null,
      tagLine: null,
      platform: "eun1",
      region: "europe",
    });
  });
});
