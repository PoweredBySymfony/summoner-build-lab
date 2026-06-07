import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/api/client";
import {
  buildPublicPlayerProfile,
  collectPublicProfileItemIds,
  resolveQueueLabel,
} from "../../server/src/lib/riot/publicPlayerProfile";
import {
  itemStatBadgeTintClass,
  itemStatIconTintClass,
  itemTooltipArrowClass,
  itemTooltipClassNames,
} from "@/lib/itemStatVisuals";

afterEach(() => {
  vi.restoreAllMocks();
});

function match(overrides: Record<string, unknown> = {}) {
  return {
    metadata: { matchId: "EUW1_1" },
    info: {
      gameCreation: Date.UTC(2026, 5, 7),
      gameDuration: 1800,
      queueId: 420,
      participants: [
        {
          puuid: "puuid-jinx",
          teamId: 100,
          championName: "Jinx",
          win: true,
          kills: 10,
          deaths: 2,
          assists: 8,
          totalDamageDealtToChampions: 24000,
          totalMinionsKilled: 210,
          neutralMinionsKilled: 12,
          goldEarned: 14500,
          visionScore: 22,
          item0: 3031,
          item1: 6672,
          item2: 0,
          item3: null,
          item4: 3006,
          item5: 0,
          item6: 3363,
        },
        {
          puuid: "ally",
          teamId: 100,
          kills: 8,
        },
      ],
    },
    ...overrides,
  };
}

describe("public profile and API helpers", () => {
  it("builds a public Riot profile summary from match records", () => {
    const itemIndex = new Map([
      [3031, { riotItemId: 3031, name: "Infinity Edge", image: "ie.png" }],
      [6672, { riotItemId: 6672, name: "Kraken Slayer", image: null }],
    ]);

    const profile = buildPublicPlayerProfile({
      account: { gameName: "BakaAsta", tagLine: "EUW", puuid: "puuid-jinx" },
      summoner: { summonerLevel: 420, profileIconId: 29 },
      region: "europe",
      platform: "euw1",
      matches: [
        match(),
        match({
          metadata: { matchId: "EUW1_2" },
          info: {
            ...match().info,
            queueId: 450,
            participants: [
              {
                puuid: "puuid-jinx",
                teamId: 200,
                championName: "Jinx",
                win: false,
                kills: 2,
                deaths: 4,
                assists: 6,
                totalDamageDealtToChampions: 12000,
                totalMinionsKilled: 80,
                neutralMinionsKilled: 0,
                goldEarned: 8500,
                visionScore: 5,
                item0: 6672,
              },
            ],
          },
        }),
        { info: { participants: [{ puuid: "someone-else" }] } },
      ],
      itemIndex,
      getItemIconUrl: (riotItemId) => `fallback-${riotItemId}.png`,
    });

    expect(profile.profile).toMatchObject({
      riotId: "BakaAsta#EUW",
      summonerLevel: 420,
      region: "europe",
    });
    expect(profile.summary).toMatchObject({
      matchesAnalyzed: 2,
      wins: 1,
      losses: 1,
      winRate: 50,
      mostPlayedChampions: [{ championName: "Jinx", games: 2, wins: 1, kda: 4.33 }],
    });
    expect(profile.recentMatches[0]).toMatchObject({
      matchId: "EUW1_1",
      queueLabel: "Class\u00e9e Solo/Duo",
      kda: 9,
      cs: 222,
      killParticipation: 100,
      items: [
        { riotItemId: 3031, name: "Infinity Edge", icon: "ie.png" },
        { riotItemId: 6672, name: "Kraken Slayer", icon: "fallback-6672.png" },
        { riotItemId: 3006, name: "Item 3006", icon: "fallback-3006.png" },
        { riotItemId: 3363, name: "Item 3363", icon: "fallback-3363.png" },
      ],
    });
  });

  it("collects unique public item ids and resolves queue labels", () => {
    expect(collectPublicProfileItemIds([match(), match()], "puuid-jinx")).toEqual([3031, 6672, 3006, 3363]);
    expect(collectPublicProfileItemIds([match()], "missing")).toEqual([]);
    expect(resolveQueueLabel(440)).toBe("Class\u00e9e Flex");
    expect(resolveQueueLabel(450)).toBe("ARAM");
    expect(resolveQueueLabel(123)).toBe("File 123");
    expect(resolveQueueLabel(null)).toBe("File inconnue");
  });

  it("wraps fetch with API defaults, JSON errors and offline messages", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(apiFetch<{ ok: boolean }>("/health", { headers: { "X-Test": "1" } })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "Content-Type": "application/json", "X-Test": "1" }),
      }),
    );

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Nope" }), { status: 400 }));
    await expect(apiFetch("/bad")).rejects.toThrow("Nope");

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiFetch<void>("/empty")).resolves.toBeUndefined();

    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(apiFetch("/offline")).rejects.toThrow("Impossible de joindre l'application locale");
  });

  it("exposes stable item tooltip visual class maps", () => {
    expect(itemStatIconTintClass.attackDamage).toContain("text-");
    expect(itemStatBadgeTintClass.abilityPower).toContain("border-");
    expect(itemTooltipClassNames.panel).toContain("bg-popover");
    expect(itemTooltipArrowClass.top).toContain("border-b");
    expect(itemTooltipArrowClass.right).toContain("border-l");
  });
});
