import { GeneratedPuzzleRequestStatus, GeneratedPuzzleRequestType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  env: {
    ML_ENABLED: true,
    ML_API_URL: "http://ml-api.test",
    ML_API_TIMEOUT_MS: 4000,
    ML_API_RETRY_COUNT: 1,
    ML_ALLOW_LOW_CONFIDENCE_DRAFTS: false,
  },
  // prisma
  generatedPuzzleRequestCreate: vi.fn(),
  generatedPuzzleRequestFindMany: vi.fn(),
  importedMatchFindUnique: vi.fn(),
  importedMatchUpdate: vi.fn(),
  championFindUnique: vi.fn(),
  championFindMany: vi.fn(),
  itemFindMany: vi.fn(),
  itemGroupBy: vi.fn(),
  // ml/mlPuzzle
  isMlGenerationConfigured: vi.fn(),
  isLowConfidenceDraftAllowed: vi.fn(),
  // repository
  getImportedMatchBundle: vi.fn(),
  persistSnapshotCandidates: vi.fn(),
  // snapshotCandidateBuilder
  buildSnapshotCandidates: vi.fn(),
  collectSnapshotBuilderItemIds: vi.fn(),
  // snapshotAttemptEvaluator
  prevalidateSnapshotCandidate: vi.fn(),
  evaluateSnapshotAttempt: vi.fn(),
  logSnapshotAttempt: vi.fn(),
  // snapshotSeriesSelection
  selectAttemptsForSeries: vi.fn(),
  buildSnapshotHistoryKey: vi.fn(),
  buildSnapshotSignature: vi.fn(),
  calculateSnapshotReusePenalty: vi.fn(),
  getSnapshotSegment: vi.fn(),
  // puzzlePersistence
  persistAiGeneratedPuzzle: vi.fn(),
  updateGeneratedRequest: vi.fn(),
  // generationDiagnostics
  buildMlRequestMetadata: vi.fn(),
  summarizeNoViableDiagnostics: vi.fn(),
  // patchCanonical
  canonicalizePatch: vi.fn(),
  buildPatchLookupCandidates: vi.fn(),
  // itemGroups
  getItemGroups: vi.fn(),
}));

vi.mock("../../server/src/config/env.js", () => ({ env: mocks.env }));

vi.mock("../../server/src/lib/prisma.js", () => ({
  prisma: {
    generatedPuzzleRequest: {
      create: mocks.generatedPuzzleRequestCreate,
      findMany: mocks.generatedPuzzleRequestFindMany,
    },
    importedMatch: {
      findUnique: mocks.importedMatchFindUnique,
      update: mocks.importedMatchUpdate,
    },
    champion: {
      findUnique: mocks.championFindUnique,
      findMany: mocks.championFindMany,
    },
    item: {
      findMany: mocks.itemFindMany,
      groupBy: mocks.itemGroupBy,
    },
  },
}));

vi.mock("../../server/src/lib/ml/mlPuzzle.js", () => ({
  isMlGenerationConfigured: mocks.isMlGenerationConfigured,
  isLowConfidenceDraftAllowed: mocks.isLowConfidenceDraftAllowed,
}));

vi.mock("../../server/src/repositories/importedMatchArchiveRepository.js", () => ({
  importedMatchArchiveRepository: {
    getImportedMatchBundle: mocks.getImportedMatchBundle,
    persistSnapshotCandidates: mocks.persistSnapshotCandidates,
  },
}));

vi.mock("../../server/src/lib/ml/snapshotCandidateBuilder.js", () => ({
  buildSnapshotCandidates: mocks.buildSnapshotCandidates,
  collectSnapshotBuilderItemIds: mocks.collectSnapshotBuilderItemIds,
  calculateGoldBeforePurchaseFromFrame: vi.fn(),
  dedupeAndRankSnapshots: vi.fn(),
}));

vi.mock("../../server/src/lib/ml/snapshotAttemptEvaluator.js", () => ({
  prevalidateSnapshotCandidate: mocks.prevalidateSnapshotCandidate,
  evaluateSnapshotAttempt: mocks.evaluateSnapshotAttempt,
  logSnapshotAttempt: mocks.logSnapshotAttempt,
}));

vi.mock("../../server/src/lib/ml/snapshotSeriesSelection.js", () => ({
  selectAttemptsForSeries: mocks.selectAttemptsForSeries,
  buildSnapshotHistoryKey: mocks.buildSnapshotHistoryKey,
  buildSnapshotSignature: mocks.buildSnapshotSignature,
  calculateSnapshotReusePenalty: mocks.calculateSnapshotReusePenalty,
  getSnapshotSegment: mocks.getSnapshotSegment,
  selectBestAttempt: vi.fn(),
  computeSnapshotDistanceScore: vi.fn(),
}));

vi.mock("../../server/src/lib/ml/puzzlePersistence.js", () => ({
  persistAiGeneratedPuzzle: mocks.persistAiGeneratedPuzzle,
  updateGeneratedRequest: mocks.updateGeneratedRequest,
}));

vi.mock("../../server/src/lib/ml/generationDiagnostics.js", () => ({
  buildMlRequestMetadata: mocks.buildMlRequestMetadata,
  summarizeNoViableDiagnostics: mocks.summarizeNoViableDiagnostics,
}));

vi.mock("../../server/src/lib/riot/patchCanonical.js", () => ({
  canonicalizePatch: mocks.canonicalizePatch,
  buildPatchLookupCandidates: mocks.buildPatchLookupCandidates,
}));

vi.mock("../../server/src/lib/itemGroups.js", () => ({
  getItemGroups: mocks.getItemGroups,
}));

vi.mock("../../server/src/lib/ml/snapshotQuality.js", () => ({
  scoreSnapshotCandidate: vi.fn(),
  getPublishabilityFloorGold: vi.fn(),
  isMeaningfulPurchaseSnapshotCandidate: vi.fn(),
  assessSnapshotPublishability: vi.fn(),
}));

import {
  mlPuzzleGenerationService,
  mlPuzzleGenerationServiceTestables,
} from "../../server/src/services/mlPuzzleGenerationService";

// ------- Fixtures -------

const mockImportedMatch = {
  id: "imported-match-id",
  riotMatchId: "EUW1_1234567890",
  targetPuuid: "puuid-123",
  targetChampionSlug: "jinx",
  targetRole: "BOTTOM",
  patch: "16.7",
  gameCreationAt: new Date("2026-01-15"),
  matchData: null,
  timelineData: null,
  mongoSnapshotRef: null,
};

const mockChampion = {
  id: "champion-jinx",
  slug: "jinx",
  name: "Jinx",
  tags: ["Marksman"],
  riotChampionId: 222,
};

const mockBundle = {
  matchData: {
    raw: {
      info: {
        gameVersion: "16.7.321.6840",
        participants: [{ puuid: "puuid-123", championId: 222, participantId: 1 }],
      },
    },
  },
  timelineData: {
    raw: {
      info: {
        frames: [{ timestamp: 60000, participantFrames: { "1": {} }, events: [] }],
      },
    },
  },
};

function makeItems(count = 120) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    slug: `item-slug-${i}`,
    name: `Item ${i}`,
    riotItemId: 1000 + i,
    goldTotal: 2500,
    goldSell: 1750,
    patch: "16.7.321.6840",
    category: null,
    tags: [],
    isBoots: false,
    isLegendary: i % 10 === 0,
    isConsumable: false,
    isStarter: false,
    isTrinket: false,
    isActive: true,
    buildsFrom: [],
    fullDescription: null,
  }));
}

const mockSnapshotCandidate = {
  snapshotIndex: 0,
  rawPurchaseIndex: 0,
  snapshot: {
    timestampMinutes: 18.5,
    goldAvailable: 1500,
    currentItems: ["long-sword"],
    role: "BOTTOM",
    patch: "16.7",
    level: 12,
    cs: 120,
    kills: 3,
    assists: 2,
    deaths: 1,
  },
  actualPurchase: {
    itemSlug: "infinity-edge",
    goldTotal: 3400,
    burstPurchaseIndex: 0,
  },
  relevanceScore: 85,
};

const mockAttempt = {
  status: "accepted" as const,
  snapshotIndex: 0,
  snapshot: mockSnapshotCandidate.snapshot,
  seed: { lowConfidence: false },
  qualityScore: 80,
  payload: { inputItems: ["long-sword"] },
  debugSummary: {
    snapshotIndex: 0,
    snapshotMinute: 18.5,
    snapshotSignature: "sig-0",
    status: "accepted",
    qualityScore: 80,
    rejectionReasons: [],
  },
};

const baseSelectionResult = {
  selectedAttempts: [mockAttempt],
  primaryAttempt: mockAttempt,
  draft: false,
  segmentSummaries: [],
  repetitionExcluded: [],
};

const noViableDiagnostics = {
  snapshotsEvaluated: 1,
  viableSnapshots: 0,
  publishableSnapshots: 0,
  nonPublishableButViableSnapshots: 0,
  dominantRejectionReasons: ["level-too-low"],
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.isMlGenerationConfigured.mockReturnValue(true);
  mocks.isLowConfidenceDraftAllowed.mockReturnValue(false);

  mocks.generatedPuzzleRequestCreate.mockResolvedValue({ id: "req-id-1" });
  mocks.generatedPuzzleRequestFindMany.mockResolvedValue([]);
  mocks.importedMatchFindUnique.mockResolvedValue(mockImportedMatch);
  mocks.importedMatchUpdate.mockResolvedValue(mockImportedMatch);
  mocks.championFindUnique.mockResolvedValue(mockChampion);
  mocks.championFindMany.mockResolvedValue([{ riotChampionId: 222, slug: "jinx", tags: ["Marksman"] }]);
  mocks.itemFindMany.mockResolvedValue(makeItems());
  mocks.itemGroupBy.mockResolvedValue([]);

  mocks.getImportedMatchBundle.mockResolvedValue(mockBundle);
  mocks.persistSnapshotCandidates.mockResolvedValue("snap-ref-123");

  mocks.collectSnapshotBuilderItemIds.mockReturnValue(new Set([3031, 3033]));
  mocks.buildSnapshotCandidates.mockReturnValue({
    targetParticipantFound: true,
    rawCandidates: [mockSnapshotCandidate],
    dedupedCandidates: [mockSnapshotCandidate],
  });

  mocks.canonicalizePatch.mockReturnValue({ patchCanonical: "16.7", patchFormat: "year_patch" });
  mocks.buildPatchLookupCandidates.mockReturnValue(["16.7", "16."]);
  mocks.getItemGroups.mockReturnValue(["Damage"]);

  mocks.prevalidateSnapshotCandidate.mockReturnValue({ allowed: true, rejectionReasons: [] });
  mocks.evaluateSnapshotAttempt.mockResolvedValue(mockAttempt);
  mocks.logSnapshotAttempt.mockReturnValue(undefined);

  mocks.selectAttemptsForSeries.mockReturnValue(baseSelectionResult);
  mocks.buildSnapshotHistoryKey.mockReturnValue("0:18.50");
  mocks.buildSnapshotSignature.mockReturnValue("jinx-sig-123");
  mocks.calculateSnapshotReusePenalty.mockReturnValue({ adjustedQualityScore: 80 });
  mocks.getSnapshotSegment.mockReturnValue("mid");

  mocks.persistAiGeneratedPuzzle.mockResolvedValue({ id: "puzzle-id-1", slug: "jinx-mid-puzzle" });
  mocks.updateGeneratedRequest.mockResolvedValue(undefined);
  mocks.buildMlRequestMetadata.mockReturnValue({ metaKey: "meta-value" });
  mocks.summarizeNoViableDiagnostics.mockReturnValue(noViableDiagnostics);
});

// ------- Tests -------

describe("mlPuzzleGenerationService.isConfigured()", () => {
  it("returns true when isMlGenerationConfigured returns true", () => {
    mocks.isMlGenerationConfigured.mockReturnValue(true);
    expect(mlPuzzleGenerationService.isConfigured()).toBe(true);
    expect(mocks.isMlGenerationConfigured).toHaveBeenCalledWith({
      enabled: mocks.env.ML_ENABLED,
      apiUrl: mocks.env.ML_API_URL,
    });
  });

  it("returns false when isMlGenerationConfigured returns false", () => {
    mocks.isMlGenerationConfigured.mockReturnValue(false);
    expect(mlPuzzleGenerationService.isConfigured()).toBe(false);
  });
});

describe("mlPuzzleGenerationService.generateFromImportedMatch()", () => {
  it("throws 503 without creating a request when ML is not configured", async () => {
    mocks.isMlGenerationConfigured.mockReturnValue(false);

    await expect(
      mlPuzzleGenerationService.generateFromImportedMatch("match-id", "user-id"),
    ).rejects.toMatchObject({ status: 503 } satisfies Partial<HttpError>);

    expect(mocks.generatedPuzzleRequestCreate).not.toHaveBeenCalled();
  });

  it("throws 404 and marks request FAILED when imported match not found", async () => {
    mocks.importedMatchFindUnique.mockResolvedValue(null);

    await expect(
      mlPuzzleGenerationService.generateFromImportedMatch("missing-match", "user-id"),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);

    expect(mocks.generatedPuzzleRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        importedMatchId: "missing-match",
        userId: "user-id",
        type: GeneratedPuzzleRequestType.MATCH_BASED,
        status: GeneratedPuzzleRequestStatus.PROCESSING,
      }),
    });
    expect(mocks.updateGeneratedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-id-1", status: GeneratedPuzzleRequestStatus.FAILED }),
    );
  });

  it("throws 400 and marks request FAILED when champion not found for the match", async () => {
    mocks.championFindUnique.mockResolvedValue(null);

    await expect(
      mlPuzzleGenerationService.generateFromImportedMatch("imported-match-id", "user-id"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);

    expect(mocks.updateGeneratedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: GeneratedPuzzleRequestStatus.FAILED }),
    );
  });

  it("throws 400 and marks request FAILED when match bundle has no participants or frames", async () => {
    mocks.getImportedMatchBundle.mockResolvedValue({
      matchData: { raw: { info: { participants: [], gameVersion: "16.7.1" } } },
      timelineData: null,
    });

    await expect(
      mlPuzzleGenerationService.generateFromImportedMatch("imported-match-id", "user-id"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);

    expect(mocks.updateGeneratedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: GeneratedPuzzleRequestStatus.FAILED }),
    );
  });

  it("returns completed response on successful generation", async () => {
    const result = await mlPuzzleGenerationService.generateFromImportedMatch(
      "imported-match-id",
      "user-id",
    );

    expect(result).toMatchObject({
      generationStatus: "completed",
      requestId: "req-id-1",
      slug: "jinx-mid-puzzle",
      slugs: ["jinx-mid-puzzle"],
      sourceType: "ai_generated",
      published: false,
      lowConfidence: false,
      draft: false,
    });
    expect(mocks.persistAiGeneratedPuzzle).toHaveBeenCalledTimes(1);
    expect(mocks.updateGeneratedRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-id-1",
        status: GeneratedPuzzleRequestStatus.COMPLETED,
        resultPuzzleId: "puzzle-id-1",
      }),
    );
  });

  it("generates multiple puzzles for a series and returns all slugs", async () => {
    const attempt2 = { ...mockAttempt, snapshotIndex: 1 };
    mocks.selectAttemptsForSeries.mockReturnValue({
      ...baseSelectionResult,
      selectedAttempts: [mockAttempt, attempt2],
    });
    let callCount = 0;
    mocks.persistAiGeneratedPuzzle.mockImplementation(async () => ({
      id: `puzzle-${callCount}`,
      slug: `jinx-puzzle-${callCount++}`,
    }));

    const result = await mlPuzzleGenerationService.generateFromImportedMatch(
      "imported-match-id",
      "user-id",
    );

    expect(result).toMatchObject({
      generationStatus: "completed",
      slug: "jinx-puzzle-0",
      slugs: ["jinx-puzzle-0", "jinx-puzzle-1"],
    });
    expect(mocks.persistAiGeneratedPuzzle).toHaveBeenCalledTimes(2);
  });

  it("marks result as draft and low-confidence when selection is low confidence", async () => {
    const lcAttempt = { ...mockAttempt, seed: { lowConfidence: true } };
    mocks.selectAttemptsForSeries.mockReturnValue({
      ...baseSelectionResult,
      selectedAttempts: [lcAttempt],
      primaryAttempt: lcAttempt,
      draft: true,
    });
    mocks.isLowConfidenceDraftAllowed.mockReturnValue(true);

    const result = await mlPuzzleGenerationService.generateFromImportedMatch(
      "imported-match-id",
      "user-id",
      { forceDraftOnLowConfidence: true, actorIsAdmin: true },
    );

    expect(result).toMatchObject({
      generationStatus: "completed",
      lowConfidence: true,
      draft: true,
    });
  });

  it("returns no_viable_snapshot_found when selection has no primary attempt", async () => {
    mocks.selectAttemptsForSeries.mockReturnValue({
      selectedAttempts: [],
      primaryAttempt: null,
      draft: false,
      segmentSummaries: [],
      repetitionExcluded: [],
    });

    const result = await mlPuzzleGenerationService.generateFromImportedMatch(
      "imported-match-id",
      "user-id",
    );

    expect(result).toMatchObject({
      generationStatus: "no_viable_snapshot_found",
      failureCode: "no_viable_snapshot_found",
      slug: null,
      slugs: [],
      retrySuggested: true,
      snapshotsEvaluated: 1,
      viableSnapshots: 0,
    });
    expect(mocks.updateGeneratedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: GeneratedPuzzleRequestStatus.FAILED }),
    );
  });

  it("returns no_publishable_snapshot_found when viable but unpublishable snapshots exist", async () => {
    mocks.selectAttemptsForSeries.mockReturnValue({
      selectedAttempts: [],
      primaryAttempt: null,
      draft: false,
      segmentSummaries: [],
      repetitionExcluded: [],
    });
    mocks.summarizeNoViableDiagnostics.mockReturnValue({
      snapshotsEvaluated: 2,
      viableSnapshots: 2,
      publishableSnapshots: 0,
      nonPublishableButViableSnapshots: 2,
      dominantRejectionReasons: ["answer-too-obvious"],
    });

    const result = await mlPuzzleGenerationService.generateFromImportedMatch(
      "imported-match-id",
      "user-id",
    );

    expect(result).toMatchObject({
      generationStatus: "no_publishable_snapshot_found",
      failureCode: "no_publishable_snapshot_found",
      viableSnapshots: 2,
      publishableSnapshots: 0,
    });
  });

  it("skips ML evaluation for prevalidation-rejected snapshots", async () => {
    mocks.prevalidateSnapshotCandidate.mockReturnValue({
      allowed: false,
      rejectionReasons: ["level-too-low", "insufficient-items"],
    });
    mocks.selectAttemptsForSeries.mockReturnValue({
      selectedAttempts: [],
      primaryAttempt: null,
      draft: false,
      segmentSummaries: [],
      repetitionExcluded: [],
    });

    const result = await mlPuzzleGenerationService.generateFromImportedMatch(
      "imported-match-id",
      "user-id",
    );

    expect(result).toMatchObject({ generationStatus: "no_viable_snapshot_found" });
    expect(mocks.evaluateSnapshotAttempt).not.toHaveBeenCalled();
  });

  it("uses fallback item catalog when patch lookup candidates is empty", async () => {
    mocks.buildPatchLookupCandidates.mockReturnValue([]);

    const result = await mlPuzzleGenerationService.generateFromImportedMatch(
      "imported-match-id",
      "user-id",
    );

    expect(result).toMatchObject({ generationStatus: "completed" });
    expect(mocks.itemFindMany).toHaveBeenCalled();
  });

  it("passes previously served snapshots to selectAttemptsForSeries", async () => {
    mocks.generatedPuzzleRequestFindMany.mockResolvedValue([
      {
        parameters: {
          selectedSnapshots: [
            { snapshotIndex: 0, snapshotMinute: 15.5, snapshotSignature: "sig-prev" },
          ],
        },
        resultPuzzle: null,
        createdAt: new Date("2026-01-10"),
      },
    ]);
    mocks.buildSnapshotHistoryKey.mockReturnValue("0:15.50");

    const result = await mlPuzzleGenerationService.generateFromImportedMatch(
      "imported-match-id",
      "user-id",
    );

    expect(result).toMatchObject({ generationStatus: "completed" });
    expect(mocks.selectAttemptsForSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        previousSnapshots: expect.arrayContaining([
          expect.objectContaining({ snapshotMinute: 15.5, signature: "sig-prev" }),
        ]),
      }),
    );
  });

  it("uses importedMatch.patch when no gameVersion found in bundle matchData", async () => {
    mocks.getImportedMatchBundle.mockResolvedValue({
      matchData: {
        raw: {
          info: {
            // no gameVersion
            participants: [{ puuid: "puuid-123", championId: 222, participantId: 1 }],
          },
        },
      },
      timelineData: {
        raw: {
          info: {
            frames: [{ timestamp: 60000, participantFrames: { "1": {} }, events: [] }],
          },
        },
      },
    });

    const result = await mlPuzzleGenerationService.generateFromImportedMatch(
      "imported-match-id",
      "user-id",
    );

    expect(result).toMatchObject({ generationStatus: "completed" });
    // canonicalizePatch receives importedMatch.patch ("16.7") as fallback
    expect(mocks.canonicalizePatch).toHaveBeenCalledWith("16.7", expect.anything());
  });

  it("updates mongoSnapshotRef when persistSnapshotCandidates returns a new ref", async () => {
    await mlPuzzleGenerationService.generateFromImportedMatch("imported-match-id", "user-id");

    // mockImportedMatch.mongoSnapshotRef is null; persistSnapshotCandidates returns "snap-ref-123"
    expect(mocks.importedMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mongoSnapshotRef: "snap-ref-123" }),
      }),
    );
  });
});

describe("mlPuzzleGenerationServiceTestables.resolveEffectivePatchLookup()", () => {
  beforeEach(() => {
    mocks.canonicalizePatch.mockReturnValue({ patchCanonical: "16.7", patchFormat: "year_patch" });
    mocks.buildPatchLookupCandidates.mockReturnValue(["16.7", "16."]);
  });

  it("extracts gameVersion from nested matchData.raw.info.gameVersion", () => {
    const result = mlPuzzleGenerationServiceTestables.resolveEffectivePatchLookup({
      matchData: { raw: { info: { gameVersion: "16.7.321.6840" } } },
    });

    expect(mocks.canonicalizePatch).toHaveBeenCalledWith("16.7.321.6840", undefined);
    expect(result.rawGameVersion).toBe("16.7.321.6840");
    expect(result.patchCanonical).toBe("16.7");
    expect(result.lookupCandidates).toEqual(["16.7", "16."]);
  });

  it("falls back to importedMatchPatch when matchData has no gameVersion", () => {
    const result = mlPuzzleGenerationServiceTestables.resolveEffectivePatchLookup({
      matchData: { raw: { info: {} } },
      importedMatchPatch: "16.6",
    });

    expect(mocks.canonicalizePatch).toHaveBeenCalledWith("16.6", undefined);
    expect(result.rawGameVersion).toBeNull();
  });

  it("falls back to snapshotFallbackPatch as last resort", () => {
    mlPuzzleGenerationServiceTestables.resolveEffectivePatchLookup({
      matchData: null,
      importedMatchPatch: null,
      snapshotFallbackPatch: "15.12",
    });

    expect(mocks.canonicalizePatch).toHaveBeenCalledWith("15.12", undefined);
  });

  it("passes gameCreationAt through to canonicalizePatch", () => {
    const gameCreationAt = new Date("2026-01-15");
    mlPuzzleGenerationServiceTestables.resolveEffectivePatchLookup({
      matchData: {},
      gameCreationAt,
    });

    expect(mocks.canonicalizePatch).toHaveBeenCalledWith(null, gameCreationAt);
  });

  it("handles completely missing input returning null rawGameVersion and empty candidates", () => {
    mocks.canonicalizePatch.mockReturnValue({ patchCanonical: null, patchFormat: "unknown" });
    mocks.buildPatchLookupCandidates.mockReturnValue([]);

    const result = mlPuzzleGenerationServiceTestables.resolveEffectivePatchLookup({});

    expect(result.rawGameVersion).toBeNull();
    expect(result.patchCanonical).toBeNull();
    expect(result.lookupCandidates).toEqual([]);
  });

  it("ignores non-object matchData (array, string)", () => {
    mlPuzzleGenerationServiceTestables.resolveEffectivePatchLookup({
      matchData: ["not", "an", "object"],
      importedMatchPatch: "16.5",
    });

    expect(mocks.canonicalizePatch).toHaveBeenCalledWith("16.5", undefined);
  });
});
