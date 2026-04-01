import { describe, expect, it } from "vitest";

import { mlPuzzleGenerationServiceTestables } from "../../server/src/services/mlPuzzleGenerationService";

describe("mlPuzzleGenerationService patch resolution", () => {
  it("resolves year-based 26.x patches with legacy alias lookup", () => {
    const resolved = mlPuzzleGenerationServiceTestables.resolveEffectivePatchLookup({
      importedMatchPatch: "26.6",
      gameCreationAt: new Date("2026-04-01T00:00:00.000Z"),
      matchData: {
        raw: {
          info: {
            gameVersion: "26.6.123.456",
          },
        },
      },
      snapshotFallbackPatch: "26.6",
    });

    expect(resolved).toEqual({
      rawGameVersion: "26.6.123.456",
      patchCanonical: "26.6",
      patchFormat: "year_patch",
      lookupCandidates: ["26.6", "16.6"],
    });
  });

  it("canonicalizes legacy 16.x versions into 26.x while preserving alias lookup", () => {
    const resolved = mlPuzzleGenerationServiceTestables.resolveEffectivePatchLookup({
      importedMatchPatch: "16.6",
      gameCreationAt: new Date("2026-04-01T00:00:00.000Z"),
      matchData: {
        raw: {
          info: {
            gameVersion: "16.6.604.8769",
          },
        },
      },
      snapshotFallbackPatch: "16.6",
    });

    expect(resolved).toEqual({
      rawGameVersion: "16.6.604.8769",
      patchCanonical: "26.6",
      patchFormat: "legacy_patch",
      lookupCandidates: ["26.6", "16.6"],
    });
  });
});
