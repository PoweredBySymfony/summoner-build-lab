import { describe, expect, it } from "vitest";

import { dedupeCompetitiveSeeds, getEliteEntryIdentity } from "../../server/src/lib/riot/competitiveSeeds";

describe("competitiveSeeds", () => {
  it("dedupes seeds by puuid and keeps the highest priority score", () => {
    const result = dedupeCompetitiveSeeds([
      {
        playerName: "Viper",
        team: "HLE",
        league: "LoL Champions Korea",
        competition: "LCK 2026",
        role: "ADC",
        region: "KR",
        riotId: "Viper#KR1",
        riotIdCandidates: ["Viper#KR1"],
        puuid: "puuid-1",
        priorityTier: "elite",
        priorityScore: 70,
        discoverySource: "riot-league-v4",
        seedSetVersion: "2026-premium-v1",
        platformHint: "kr",
        cluster: "asia",
        season: "2026",
        sourceTournamentDate: null,
      },
      {
        playerName: "Viper",
        team: "HLE",
        league: "LoL Champions Korea",
        competition: "LCK 2026",
        role: "ADC",
        region: "KR",
        riotId: "Viper#KR1",
        riotIdCandidates: ["Viper#KR1"],
        puuid: "puuid-1",
        priorityTier: "pro",
        priorityScore: 100,
        discoverySource: "leaguepedia-cargo",
        seedSetVersion: "2026-premium-v1",
        platformHint: "kr",
        cluster: "asia",
        season: "2026",
        sourceTournamentDate: "2026-03-16",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.priorityTier).toBe("pro");
    expect(result[0]?.priorityScore).toBe(100);
  });

  it("prefers puuid from the ladder payload and keeps summonerId as legacy fallback", () => {
    expect(
      getEliteEntryIdentity({
        puuid: "puuid-123",
        summonerId: "legacy-summoner-id",
      }),
    ).toEqual({
      puuid: "puuid-123",
      summonerId: "legacy-summoner-id",
    });

    expect(
      getEliteEntryIdentity({
        puuid: "   ",
        summonerId: "legacy-summoner-id",
      }),
    ).toEqual({
      puuid: null,
      summonerId: "legacy-summoner-id",
    });
  });
});
