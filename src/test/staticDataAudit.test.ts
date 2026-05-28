import { describe, expect, it } from "vitest";
import { buildStaticDataAuditMarkdown, runStaticDataAudit } from "@/lib/staticDataAudit";
import type { ChampionView, GameItem } from "@/types/domain";

function createItem(overrides: Partial<GameItem>): GameItem {
  return {
    id: "test-item",
    databaseId: "db-test-item",
    riotItemId: 9999,
    name: "Test Item",
    slug: "test-item",
    icon: "https://example.com/item.png",
    image: "https://example.com/item.png",
    cost: 3000,
    tags: [],
    itemGroups: [],
    stats: {},
    shortDescription: null,
    fullDescription: null,
    activeEffect: null,
    passiveEffect: null,
    buildsFrom: [],
    buildsInto: [],
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isTrinket: false,
    isStarter: false,
    isActive: true,
    patch: "16.6.1",
    ...overrides,
  };
}

function createChampion(overrides: Partial<ChampionView>): ChampionView {
  return {
    id: "ahri",
    databaseId: "db-ahri",
    riotChampionId: 103,
    championKey: "Ahri",
    name: "Ahri",
    title: "the Nine-Tailed Fox",
    slug: "ahri",
    icon: "https://example.com/ahri.png",
    splashImage: "https://example.com/ahri-splash.png",
    image: "https://example.com/ahri.png",
    roles: ["Mid"],
    tags: ["Mage", "Assassin"],
    stats: { hp: 590, hpperlevel: 96, mp: 418, mpperlevel: 25 },
    patch: "16.6.1",
    isActive: true,
    ...overrides,
  };
}

describe("staticDataAudit", () => {
  it("detects Infinity Edge style crit parsing anomalies automatically", () => {
    const brokenInfinityEdge = createItem({
      riotItemId: 3031,
      name: "Lame d'infini",
      slug: "lame-dinfini",
      patch: "16.6.1",
      stats: {
        FlatCritChanceMod: 0.25,
      },
      fullDescription: ["+30% Chances de coup critique", "Perfection", "+30% degats de coup critique"].join("\n"),
    });

    const report = runStaticDataAudit({
      items: [brokenInfinityEdge],
      champions: [createChampion()],
    });

    expect(report.issues.some((issue) => issue.code === "crit-damage-mislabeled-as-crit-chance" || issue.code === "base-stat-leaked-into-effects")).toBe(true);
  });

  it("flags missing champion fields and non numeric stats", () => {
    const report = runStaticDataAudit({
      items: [createItem()],
      champions: [
        createChampion({
          riotChampionId: null,
          championKey: null,
          image: "",
          patch: "bad-patch",
          stats: { hp: "590", mp: null } as unknown as Record<string, unknown>,
        }),
      ],
    });

    expect(report.issues.some((issue) => issue.entityType === "champion" && issue.code === "missing-riot-identity")).toBe(true);
    expect(report.issues.some((issue) => issue.entityType === "champion" && issue.code === "non-numeric-stat-value")).toBe(true);
    expect(report.issues.some((issue) => issue.entityType === "champion" && issue.code === "invalid-patch-format")).toBe(true);
  });

  it("builds a readable markdown summary", () => {
    const report = runStaticDataAudit({
      items: [createItem({ patch: "16.5.1" })],
      champions: [createChampion()],
    });

    const markdown = buildStaticDataAuditMarkdown(report);

    expect(markdown).toContain("# Static Data Audit");
    expect(markdown).toContain("## Item Summary");
    expect(markdown).toContain("## Champion Summary");
  });
});
