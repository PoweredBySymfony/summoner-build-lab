import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildBackendPuzzleSeed,
  canAccessGeneratedDraft,
  isMlGenerationConfigured,
  isLowConfidenceDraftAllowed,
  mapSnapshotToMlPayload,
} from "../../server/src/lib/ml/mlPuzzle";

describe("mlPuzzle", () => {
  it("falls back to template generation when ML_API_URL is absent", () => {
    expect(
      isMlGenerationConfigured({
        enabled: true,
        apiUrl: undefined,
      }),
    ).toBe(false);
  });

  it("maps a snapshot to the ML API payload shape", () => {
    expect(
      mapSnapshotToMlPayload({
        patch: "15.6",
        championSlug: "ahri",
        role: Role.MID,
        goldAvailable: 1450,
        level: 11,
        kills: 4,
        deaths: 2,
        assists: 6,
        cs: 118,
        timestampMinutes: 17.5,
        currentItems: ["echo-de-luden", "sablier-de-zhonya"],
        allyFrontlineCount: 2,
        allyMagicDamageCount: 2,
        allyPhysicalDamageCount: 2,
        allySupportCount: 1,
        enemyFrontlineCount: 1,
        enemyMagicDamageCount: 3,
        enemyPhysicalDamageCount: 2,
        enemySupportCount: 1,
      }),
    ).toEqual({
      patch: "15.6",
      champion_slug: "ahri",
      role: Role.MID,
      gold_available: 1450,
      level: 11,
      kills: 4,
      deaths: 2,
      assists: 6,
      cs: 118,
      timestamp_minutes: 17.5,
      current_items: ["echo-de-luden", "sablier-de-zhonya"],
      ally_frontline_count: 2,
      ally_magic_damage_count: 2,
      ally_physical_damage_count: 2,
      ally_support_count: 1,
      enemy_frontline_count: 1,
      enemy_magic_damage_count: 3,
      enemy_physical_damage_count: 2,
      enemy_support_count: 1,
    });
  });

  it("refuses publication when the ML ranking response is low confidence", () => {
    const seed = buildBackendPuzzleSeed({
      model_ready: true,
      predicted_item_slug: "coiffe-de-rabadon",
      confidence: 0.42,
      candidate_pool_size: 3,
      top_k_predictions: [
        { item_slug: "coiffe-de-rabadon", score: 0.42 },
        { item_slug: "void-staff", score: 0.39 },
        { item_slug: "morellonomicon", score: 0.37 },
      ],
      model_version: "ranking-v1",
      message: "ok",
    });

    expect(seed.lowConfidence).toBe(true);
    expect(seed.goodAnswer).toBe("coiffe-de-rabadon");
    expect(seed.candidatePoolSize).toBe(3);
    expect(seed.confidenceGap).toBeCloseTo(0.03);
  });

  it("keeps low-confidence rejection in normal mode", () => {
    expect(
      isLowConfidenceDraftAllowed({
        isAdmin: false,
        envEnabled: true,
        forceDraftOnLowConfidence: true,
      }),
    ).toBe(false);
  });

  it("allows low-confidence drafts only for admins in explicit test mode", () => {
    expect(
      isLowConfidenceDraftAllowed({
        isAdmin: true,
        envEnabled: false,
        forceDraftOnLowConfidence: true,
      }),
    ).toBe(true);
    expect(
      isLowConfidenceDraftAllowed({
        isAdmin: true,
        envEnabled: true,
        forceDraftOnLowConfidence: false,
      }),
    ).toBe(true);
  });

  it("allows the owner or an admin to consult a generated draft", () => {
    expect(
      canAccessGeneratedDraft({
        ownerId: "owner-1",
        viewerId: "owner-1",
        viewerIsAdmin: false,
      }),
    ).toBe(true);
    expect(
      canAccessGeneratedDraft({
        ownerId: "owner-1",
        viewerId: "admin-1",
        viewerIsAdmin: true,
      }),
    ).toBe(true);
    expect(
      canAccessGeneratedDraft({
        ownerId: "owner-1",
        viewerId: "other-1",
        viewerIsAdmin: false,
      }),
    ).toBe(false);
  });
});
