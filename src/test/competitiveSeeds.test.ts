import { describe, expect, it } from "vitest";

import {
  buildCompetitiveSeedManifest,
  dedupeCompetitiveSeeds,
  getEliteEntryIdentity,
  type CompetitiveSeed,
} from "../../server/src/lib/riot/competitiveSeeds";

function seed(overrides: Partial<CompetitiveSeed> = {}): CompetitiveSeed {
  return {
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
    ...overrides,
  };
}

describe("competitiveSeeds", () => {
  it("dedupes seeds by puuid and keeps the highest priority score", () => {
    const result = dedupeCompetitiveSeeds([
      seed({
        priorityTier: "elite",
        priorityScore: 70,
        discoverySource: "riot-league-v4",
        sourceTournamentDate: null,
      }),
      seed(),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.priorityTier).toBe("pro");
    expect(result[0]?.priorityScore).toBe(100);
  });

  it("normalizes seed text, removes duplicate riot ids and sorts by priority", () => {
    const result = dedupeCompetitiveSeeds([
      seed({
        playerName: "  Chovy  ",
        team: "  GEN ",
        riotId: null,
        riotIdCandidates: ["Chovy#KR1", "Chovy#KR1", ""],
        puuid: null,
        priorityScore: 90,
      }),
      seed({
        playerName: "Faker",
        team: "T1",
        riotId: "Faker#KR1",
        riotIdCandidates: ["Faker#KR1"],
        puuid: null,
        priorityScore: 100,
      }),
    ]);

    expect(result.map((entry) => entry.playerName)).toEqual(["Faker", "  Chovy  "]);
    expect(result[1]).toMatchObject({
      team: "GEN",
      riotIdCandidates: ["Chovy#KR1"],
    });
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

  it("builds a manifest from pro seeds without fetching elite ladders when disabled", async () => {
    const manifest = await buildCompetitiveSeedManifest({
      includeElite: false,
      season: "2026",
      seedSetVersion: "test-seed-set",
      proSourcesMetadata: [
        {
          kind: "curated-file",
          enabled: true,
          path: "data/pro.json",
          label: "test",
          sourceCount: 1,
        },
      ],
      proSeeds: [
        {
          playerName: "Caps",
          playerPage: "Caps",
          team: "G2",
          league: "League of Legends EMEA Championship",
          competition: "LEC 2026",
          role: "MID",
          region: "EU",
          riotId: "Caps#EUW",
          riotIdCandidates: ["Caps#EUW"],
          puuid: "caps-puuid",
          source: "curated",
          platformHint: "euw1",
          cluster: "europe",
          sourceTournamentDate: "2026-02-01",
          sourceUrl: "https://example.test",
        },
      ],
      eliteOptions: {
        platforms: ["euw1"],
        tiers: ["challenger"],
        queue: "RANKED_SOLO_5x5",
        maxEntriesPerTier: 1,
      },
    });

    expect(manifest).toMatchObject({
      version: 1,
      seedSetVersion: "test-seed-set",
      season: "2026",
      source: "competitive-seed-merge",
      playerCount: 1,
    });
    expect(manifest.sources.pro).toHaveLength(1);
    expect(manifest.sources.elite).toEqual([
      {
        platform: "euw1",
        tiers: ["challenger"],
        queue: "RANKED_SOLO_5x5",
        maxEntriesPerTier: 1,
      },
    ]);
    expect(manifest.players[0]).toMatchObject({
      playerName: "Caps",
      priorityTier: "pro",
      priorityScore: 90,
      seedSetVersion: "test-seed-set",
    });
  });
});
