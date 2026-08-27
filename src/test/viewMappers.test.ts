import { PuzzleDifficulty, PuzzleMode, Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  mapChampionView,
  mapItemView,
  mapPuzzleChoiceView,
  mapPuzzleDetailView,
  mapPuzzleListView,
  translateGeneratedCopy,
} from "../../server/src/services/viewMappers";

function champion(overrides: Record<string, unknown> = {}) {
  return {
    id: "champion-db-id",
    riotChampionId: 222,
    championKey: "Jinx",
    name: "Jinx",
    title: "Gachette folle",
    slug: "jinx",
    iconImage: "icon.png",
    splashImage: "splash.jpg",
    image: "image.png",
    rolePrimary: Role.ADC,
    roleSecondary: Role.MID,
    tags: ["Marksman"],
    stats: { attack: 9 },
    patch: "16.6",
    isActive: true,
    ...overrides,
  } as never;
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-db-id",
    riotItemId: 3031,
    name: "Infinity Edge",
    slug: "lame-dinfini",
    image: "item.png",
    goldTotal: 3400,
    goldBase: 625,
    goldSell: 2380,
    category: "crit",
    tags: ["Damage", "CriticalStrike"],
    stats: { attackDamage: 75 },
    shortDescription: "increases health",
    fullDescription: "<mainText>damage</mainText>",
    activeEffect: "slightly increases health regen",
    passiveEffect: "grants a bonus to next attack after spell cast",
    buildsFrom: ["1038"],
    buildsInto: ["3031"],
    mapAvailability: { summonersRift: true },
    isBoots: false,
    isLegendary: true,
    isConsumable: false,
    isTrinket: false,
    isStarter: false,
    isActive: true,
    patch: "16.6",
    ...overrides,
  } as never;
}

function choice(overrides: Record<string, unknown> = {}) {
  return {
    id: "choice-id",
    label: "A",
    choiceType: "ITEM",
    item: item(),
    textFallback: "Sheen is plausible, but it underperforms compared with the best adaptation for this exact board state.",
    explanation: "Infinity Edge best covers the immediate itemization problem while keeping your champion's win condition intact.",
    isCorrect: true,
    displayOrder: 1,
    ...overrides,
  } as never;
}

function puzzle(overrides: Record<string, unknown> = {}) {
  return {
    id: "puzzle-id",
    slug: "jinx-next-item",
    title: "Jinx OTP ITEMIZATION PUZZLE",
    description: "Jinx focused scenario generated from role and matchup heuristics.",
    shortPrompt: "What is the best next item purchase on Jinx in this situation?",
    situation: "You are playing Jinx in adc around minute 22. Enemy frontline is stacking armor while burst still threatens you.",
    question: "What is the best next item purchase on Jinx in this situation?",
    explanation: "Infinity Edge is the most coherent purchase here.",
    difficulty: PuzzleDifficulty.INTERMEDIATE,
    patch: "16.6",
    role: Role.ADC,
    mode: PuzzleMode.CHAMPION_SPECIFIC,
    sourceType: "GENERATED",
    isPublished: true,
    isDailyEligible: true,
    champion: champion(),
    choices: [choice()],
    tags: [{ tag: { slug: "adc", name: "ADC" } }],
    scenario: null,
    ...overrides,
  } as never;
}

describe("viewMappers", () => {
  it("translates generated copy and repairs known item names", () => {
    expect(translateGeneratedCopy("Jinx OTP ITEMIZATION PUZZLE")).toBe("Jinx : puzzle d'itemisation OTP");
    expect(
      translateGeneratedCopy(
        "Sheen is plausible, but it underperforms compared with the best adaptation for this exact board state.",
      ),
    ).toContain("Brillance est jouable");
  });

  it("maps champions and items to API-facing views", () => {
    expect(mapChampionView(champion())).toMatchObject({
      id: "jinx",
      riotChampionId: 222,
      roles: ["ADC", "Mid"],
      icon: "icon.png",
      tags: ["Marksman"],
    });

    expect(mapItemView(item())).toMatchObject({
      id: "lame-dinfini",
      name: "Infinity Edge",
      cost: 3400,
      shortDescription: "Augmente les points de vie",
      activeEffect: "Augmente legerement la regeneration de PV",
      passiveEffect: "Accorde un bonus a la prochaine attaque apres un sort",
      buildsFromIcons: [
        {
          riotItemId: 1038,
          icon: "https://ddragon.leagueoflegends.com/cdn/16.6/img/item/1038.png",
        },
      ],
    });
  });

  it("maps puzzle list and choices with translated labels", () => {
    expect(mapPuzzleChoiceView(choice())).toMatchObject({
      id: "choice-id",
      choiceType: "item",
      isCorrect: true,
      item: {
        id: "lame-dinfini",
      },
    });

    expect(mapPuzzleListView(puzzle())).toMatchObject({
      id: "puzzle-id",
      title: "Jinx : puzzle d'itemisation OTP",
      difficulty: "intermediaire",
      role: "ADC",
      mode: "otp",
      champion: {
        id: "jinx",
      },
      choiceCount: 1,
    });
  });

  it("maps detailed scenarios with indexed champion and item references", () => {
    const mappedChampion = mapChampionView(champion());
    const mappedItem = mapItemView(item());
    const detail = mapPuzzleDetailView(
      puzzle({
        scenario: {
          playerChampion: champion(),
          playerRole: Role.ADC,
          gameMinute: 22,
          playerGold: 3200,
          playerLevel: 12,
          kills: 5,
          deaths: 1,
          assists: 7,
          cs: 180,
          currentBuild: ["lame-dinfini"],
          allyTeam: [
            {
              championSlug: "jinx",
              championId: "jinx",
              role: Role.ADC,
              items: ["lame-dinfini"],
              note: "carry",
            },
          ],
          enemyTeam: ["unknown-enemy"],
          allyItems: [],
          enemyItems: ["lame-dinfini"],
          notableThreats: [],
          objectiveState: {
            nextObjective: "dragon",
            soulPointThreat: true,
          },
          damageProfile: {
            enemyPhysical: "contested",
          },
          mapState: {
            sideLanePriority: "secondary",
          },
          notes: "Generated from champion-focused OTP heuristics.",
        },
      }),
      new Map([
        ["jinx", mappedChampion],
        ["222", mappedChampion],
      ]),
      new Map([
        ["lame-dinfini", mappedItem],
        ["3031", mappedItem],
      ]),
    );

    expect(detail.scenario).toMatchObject({
      playerRole: "ADC",
      currentBuild: [{ id: "lame-dinfini" }],
      allyTeam: [
        {
          id: "jinx",
          champion: {
            id: "jinx",
          },
          role: "ADC",
          items: [{ id: "lame-dinfini" }],
          note: "carry",
        },
      ],
      enemyTeam: [{ id: "unknown-enemy", name: "unknown-enemy" }],
      objectiveState: {
        "Prochain objectif": "dragon",
        "Menace point d'ame": "Oui",
      },
      mapState: {
        "Priorite side": "secondaire",
      },
    });
    expect(detail.choices).toHaveLength(1);
  });
});
