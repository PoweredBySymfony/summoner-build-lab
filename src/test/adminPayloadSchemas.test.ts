import { describe, expect, it } from "vitest";
import {
  adminChampionUpdateSchema,
  adminItemUpdateSchema,
  adminPuzzleUpdateSchema,
} from "../../server/src/lib/admin/adminPayloadSchemas";

const championPayload = {
  name: "Ahri",
  title: "the Nine-Tailed Fox",
  rolePrimary: "MID",
  roleSecondary: null,
  patch: "16.1",
  isActive: true,
  image: "https://example.com/ahri.jpg",
  iconImage: "https://example.com/ahri-icon.jpg",
  splashImage: null,
  tags: ["Mage", "Assassin"],
  stats: { attack: 3, magic: 8 },
};

const itemPayload = {
  name: "Rabadon's Deathcap",
  shortDescription: "Large AP spike.",
  fullDescription: "Increases ability power.",
  image: "https://example.com/deathcap.jpg",
  patch: "16.1",
  category: "Mage",
  goldTotal: 3600,
  goldBase: 1100,
  goldSell: 2520,
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  activeEffect: null,
  passiveEffect: "Magical Opus",
  tags: ["Ability Power"],
  stats: { FlatMagicDamageMod: 130 },
  buildsFrom: ["1058"],
  buildsInto: [],
};

const puzzlePayload = {
  title: "First recall choice",
  slug: "first-recall-choice",
  mode: "GENERAL",
  difficulty: "BEGINNER",
  role: "MID",
  championId: null,
  patch: "16.1",
  description: "Pick the best item.",
  shortPrompt: "Best buy?",
  situation: "You recalled with 1300 gold.",
  question: "What should you buy?",
  explanation: "The item fits the situation.",
  isPublished: false,
  isDailyEligible: true,
};

describe("adminPayloadSchemas", () => {
  it("accepts typed champion, item, and puzzle update DTOs", () => {
    expect(adminChampionUpdateSchema.parse(championPayload).stats).toEqual({ attack: 3, magic: 8 });
    expect(adminItemUpdateSchema.parse(itemPayload).buildsFrom).toEqual(["1058"]);
    expect(adminPuzzleUpdateSchema.parse(puzzlePayload).slug).toBe("first-recall-choice");
  });

  it("rejects unknown fields at admin write boundaries", () => {
    expect(() => adminChampionUpdateSchema.parse({ ...championPayload, unexpected: true })).toThrow();
    expect(() => adminItemUpdateSchema.parse({ ...itemPayload, unexpected: true })).toThrow();
    expect(() => adminPuzzleUpdateSchema.parse({ ...puzzlePayload, unexpected: true })).toThrow();
  });

  it("rejects invalid collection fields before the service layer", () => {
    expect(() => adminChampionUpdateSchema.parse({ ...championPayload, tags: "Mage" })).toThrow();
    expect(() => adminItemUpdateSchema.parse({ ...itemPayload, buildsFrom: [1058] })).toThrow();
  });
});
