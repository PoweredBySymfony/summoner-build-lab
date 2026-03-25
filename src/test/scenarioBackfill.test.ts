import { describe, expect, it } from "vitest";
import { classifyLegacyScenarioBackfill, isLegacyStringArray } from "../../server/src/lib/scenarioBackfill";

describe("scenarioBackfill", () => {
  it("detects legacy slug arrays only", () => {
    expect(isLegacyStringArray(["aatrox", "camille"])).toBe(true);
    expect(isLegacyStringArray([{ championSlug: "aatrox" }])).toBe(false);
    expect(isLegacyStringArray([])).toBe(true);
  });

  it("preserves rich teams when only the current build is legacy", () => {
    const richTeam = [
      {
        championSlug: "aatrox",
        role: "TOP",
        items: [{ itemSlug: "couperet-noir" }],
      },
    ];

    expect(
      classifyLegacyScenarioBackfill({
        allyTeam: richTeam,
        enemyTeam: richTeam,
        currentBuild: ["black-cleaver"],
      }),
    ).toEqual({
      rebuildAllyTeam: false,
      rebuildEnemyTeam: false,
      rebuildCurrentBuild: true,
      shouldUpdate: true,
    });
  });

  it("rebuilds legacy teams independently", () => {
    expect(
      classifyLegacyScenarioBackfill({
        allyTeam: ["aatrox", "vi", "ahri", "jinx", "nautilus"],
        enemyTeam: [{ championSlug: "camille", role: "TOP", items: [] }],
        currentBuild: [{ itemSlug: "couperet-noir" }],
      }),
    ).toEqual({
      rebuildAllyTeam: true,
      rebuildEnemyTeam: false,
      rebuildCurrentBuild: false,
      shouldUpdate: true,
    });
  });
});
