import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildImportedMatchMetadata,
  normalizeSourceKind,
} from "../../server/src/lib/riot/matchImportRunner";

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
});
