import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildRiotProfileIconUrl,
  getRecentRiotSearches,
  normalizeRiotIdInput,
  parseRiotIdInput,
  removeRecentRiotSearch,
  saveRecentRiotSearch,
  subscribeToRecentRiotSearches,
} from "@/lib/riotSearch";
import { getNextPuzzleSlug, getPuzzleSeries, savePuzzleSeries } from "@/lib/puzzleSeries";
import {
  buildRoleAwareItemIds,
  getChampionRoleOptions,
  getDefaultChampionRole,
  normalizeLabRole,
  normalizeSetupForRole,
} from "@/lib/item-lab/roleConfig";
import { buildComparisonExport, deleteSavedExperiment, getSavedExperiments, persistExperiment } from "@/lib/item-lab/storage";
import { filterAdminChampions, filterAdminItems, filterAdminPuzzles } from "@/pages/admin/adminFilters";
import type { ChampionView, GameItem } from "@/types/domain";
import type { ComparisonSummary, SavedLabExperiment, SetupAnalysis } from "@/lib/item-lab/types";

const champion: ChampionView = {
  id: "jinx",
  databaseId: "db-jinx",
  riotChampionId: 222,
  championKey: "Jinx",
  name: "Jinx",
  title: "Loose Cannon",
  slug: "jinx",
  icon: "jinx.png",
  image: "jinx.png",
  roles: ["ADC", "MID"],
  tags: ["Marksman"],
  stats: {},
  patch: "16.6",
  isActive: true,
};

const item: GameItem = {
  id: "infinity-edge",
  databaseId: "db-ie",
  riotItemId: 3031,
  name: "Infinity Edge",
  slug: "infinity-edge",
  icon: "ie.png",
  image: "ie.png",
  cost: 3400,
  category: "crit",
  tags: ["Damage", "CriticalStrike"],
  itemGroups: [],
  stats: {},
  buildsFrom: [],
  buildsInto: [],
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  patch: "16.6",
};

function savedExperiment(overrides: Partial<SavedLabExperiment> = {}): SavedLabExperiment {
  return {
    id: "experiment-1",
    name: "Jinx duel",
    mode: "duel",
    setupA: { championId: "jinx", role: "ADC", level: 12, itemIds: ["infinity-edge", null] },
    setupB: { championId: "jinx", role: "ADC", level: 12, itemIds: [null, null] },
    createdAt: "2026-06-06T10:00:00.000Z",
    updatedAt: "2026-06-06T10:00:00.000Z",
    ...overrides,
  };
}

function analysis(overrides: Partial<SetupAnalysis> = {}): SetupAnalysis {
  return {
    champion,
    role: "ADC",
    roleConfig: { maxLevel: 18, maxItems: 7 },
    level: 12,
    items: [item],
    itemCount: 1,
    stats: {
      health: 1600,
      mana: 650,
      attackDamage: 140,
      abilityPower: 0,
      attackSpeed: 1.2,
      critChance: 25,
      armorPen: 0,
      lethality: 0,
      magicPen: 0,
      abilityHaste: 0,
      armor: 70,
      magicResist: 40,
      moveSpeed: 325,
      healthRegen: 8,
      manaRegen: 10,
    },
    bonusStats: {} as SetupAnalysis["bonusStats"],
    changedStats: [],
    profileScores: [],
    buildSignals: {} as SetupAnalysis["buildSignals"],
    whyItChanges: [],
    context: {
      strengths: [],
      weaknesses: [],
      confidence: "high",
      summary: "Strong spike.",
      reasons: [],
      tags: ["crit"],
      isUnlocked: true,
      isComplete: true,
    },
    summaryLine: "Crit spike",
    scalingScore: 80,
    totalGold: 3400,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"));
});

describe("front-end helper coverage", () => {
  it("parses, normalizes, stores and removes recent Riot searches", () => {
    expect(parseRiotIdInput("  faker#kr1 ")).toEqual({
      gameName: "faker",
      tagLine: "KR1",
      riotId: "faker#KR1",
    });
    expect(parseRiotIdInput("Hide on bush-KR1")).toEqual({
      gameName: "Hide on bush",
      tagLine: "KR1",
      riotId: "Hide on bush#KR1",
    });
    expect(normalizeRiotIdInput("bad input")).toBe("bad input");
    expect(buildRiotProfileIconUrl(29)).toContain("/29.jpg");
    expect(buildRiotProfileIconUrl(null)).toBeNull();

    const callback = vi.fn();
    const unsubscribe = subscribeToRecentRiotSearches(callback);
    saveRecentRiotSearch({ gameName: "Faker", tagLine: "kr1", profileIconId: 29 });
    saveRecentRiotSearch({ riotId: "faker#KR1", gameName: "ignored", tagLine: "ignored", profileIconId: null });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(getRecentRiotSearches()).toHaveLength(1);
    expect(getRecentRiotSearches()[0]).toMatchObject({
      riotId: "faker#KR1",
      gameName: "faker",
      tagLine: "KR1",
    });

    removeRecentRiotSearch("Faker#kr1");
    expect(getRecentRiotSearches()).toEqual([]);
    unsubscribe();
  });

  it("stores puzzle series and resolves the next slug", () => {
    expect(getPuzzleSeries()).toEqual([]);

    savePuzzleSeries(["first", "second", "third"]);

    expect(getPuzzleSeries()).toEqual(["first", "second", "third"]);
    expect(getNextPuzzleSlug("first")).toBe("second");
    expect(getNextPuzzleSlug("third")).toBeNull();
    expect(getNextPuzzleSlug("missing")).toBeNull();
  });

  it("filters admin collections by searchable fields", () => {
    expect(filterAdminChampions([champion], "loose")).toEqual([champion]);
    expect(filterAdminChampions([champion], "support")).toEqual([]);
    expect(filterAdminChampions(undefined, "")).toEqual([]);

    expect(filterAdminItems([item], "critical")).toEqual([item]);
    expect(filterAdminItems([item], "tank")).toEqual([]);
    expect(filterAdminItems(undefined, "")).toEqual([]);

    const puzzle = {
      title: "Jinx spike",
      mode: "otp",
      difficulty: "advanced",
      patch: "16.6",
      champion: { name: "Jinx" },
    };
    expect(filterAdminPuzzles([puzzle], "advanced")).toEqual([puzzle]);
    expect(filterAdminPuzzles([puzzle], "ahri")).toEqual([]);
  });

  it("normalizes item lab roles and clamps setups to champion constraints", () => {
    expect(normalizeLabRole("bottom")).toBe("ADC");
    expect(normalizeLabRole("supp")).toBe("SUPPORT");
    expect(normalizeLabRole("unknown")).toBe("MID");
    expect(getChampionRoleOptions(champion)).toEqual(["ADC", "MID"]);
    expect(getDefaultChampionRole(null)).toBe("MID");
    expect(buildRoleAwareItemIds(3, ["a", undefined as never, "c", "d"])).toEqual(["a", null, "c"]);

    expect(
      normalizeSetupForRole({
        champion,
        setup: {
          championId: "jinx",
          role: "SUPPORT",
          level: 99,
          itemIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
        },
      }),
    ).toMatchObject({
      role: "ADC",
      level: 18,
      itemIds: ["a", "b", "c", "d", "e", "f", "g"],
    });
  });

  it("persists item lab experiments and formats comparison exports", () => {
    persistExperiment(savedExperiment());
    persistExperiment(savedExperiment({ name: "Updated duel" }));
    persistExperiment(savedExperiment({ id: "experiment-2", name: "Second duel" }));

    expect(getSavedExperiments().map((entry) => entry.name)).toEqual(["Second duel", "Updated duel"]);

    deleteSavedExperiment("experiment-1");
    expect(getSavedExperiments()).toHaveLength(1);

    localStorage.setItem("summoner-build-lab:item-lab-experiments", "{bad json");
    expect(getSavedExperiments()).toEqual([]);

    const comparison: ComparisonSummary = {
      cards: [],
      narrative: ["A keeps a sharper spike."],
      standoutStats: [{ key: "attackDamage", previous: 90, current: 140, delta: 50 }],
    };

    expect(
      buildComparisonExport({
        name: "Jinx test",
        mode: "duel",
        analysisA: analysis(),
        analysisB: analysis({ items: [], summaryLine: "Baseline", totalGold: 0 }),
        comparison,
      }),
    ).toContain("Analyse Lab d'Items: Jinx test");
  });
});
