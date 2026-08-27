import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));

vi.mock("../components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement("div", { "data-testid": "dialog" }, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("h2", null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("p", null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("../components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  TabsList: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) =>
    React.createElement("button", { "data-value": value }, children),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) =>
    React.createElement("div", { "data-tab": value }, children),
}));

import { ChampionEditDialog } from "../pages/admin/ChampionEditDialog";
import { ItemEditDialog } from "../pages/admin/ItemEditDialog";
import { PuzzleEditDialog } from "../pages/admin/PuzzleEditDialog";

beforeEach(() => vi.clearAllMocks());

// ---------- ChampionEditDialog ----------

const sampleChampion = {
  id: "c1",
  databaseId: "db-c1",
  slug: "jinx",
  name: "Jinx",
  title: "The Loose Cannon",
  icon: "/jinx.png",
  image: "/jinx-full.png",
  splashImage: "/jinx-splash.png",
  roles: ["ADC", "SUPPORT"],
  tags: ["Marksman"],
  patch: "16.7",
  isActive: true,
  stats: { attack_damage: 100 },
};

describe("ChampionEditDialog", () => {
  it("renders nothing when open is false", () => {
    render(
      React.createElement(ChampionEditDialog, {
        champion: null,
        open: false,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("shows dialog title when open is true", () => {
    render(
      React.createElement(ChampionEditDialog, {
        champion: null,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByText("Modifier le champion")).toBeInTheDocument();
  });

  it("pre-populates form fields from the champion data", () => {
    render(
      React.createElement(ChampionEditDialog, {
        champion: sampleChampion,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByDisplayValue("Jinx")).toBeInTheDocument();
    expect(screen.getByDisplayValue("16.7")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ADC")).toBeInTheDocument();
  });

  it("calls onSave with the form payload when Enregistrer is clicked", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      React.createElement(ChampionEditDialog, {
        champion: sampleChampion,
        open: true,
        onOpenChange: vi.fn(),
        onSave,
      }),
    );
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Jinx", patch: "16.7" }));
  });

  it("shows toast error when JSON fields are invalid", () => {
    render(
      React.createElement(ChampionEditDialog, {
        champion: sampleChampion,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    const tagsSpan = screen.getByText("Tags JSON");
    const tagsTextarea = tagsSpan.closest("label")!.querySelector("textarea")!;
    fireEvent.change(tagsTextarea, { target: { value: "invalid json" } });
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(mocks.toastError).toHaveBeenCalledWith("Le JSON du champion est invalide.");
  });
});

// ---------- ItemEditDialog ----------

const sampleItem = {
  id: "i1",
  databaseId: "db-i1",
  name: "Trinity Force",
  icon: "/tri.png",
  image: "/tri-full.png",
  shortDescription: "Attack + speed",
  fullDescription: "Full description",
  category: "Offensive",
  cost: 3200,
  baseCost: 1200,
  sellPrice: 2240,
  patch: "16.7",
  isActive: true,
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  activeEffect: "Spellblade",
  passiveEffect: "Rage",
  tags: ["Fighter"],
  stats: { attack_damage: 30 },
  buildsFrom: [],
  buildsInto: [],
};

describe("ItemEditDialog", () => {
  it("renders nothing when open is false", () => {
    render(
      React.createElement(ItemEditDialog, {
        item: null,
        open: false,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("shows dialog title when open is true", () => {
    render(
      React.createElement(ItemEditDialog, {
        item: null,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("pre-populates form fields from the item data", () => {
    render(
      React.createElement(ItemEditDialog, {
        item: sampleItem,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByDisplayValue("Trinity Force")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3200")).toBeInTheDocument();
  });

  it("calls onSave with the form payload when Enregistrer is clicked", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      React.createElement(ItemEditDialog, {
        item: sampleItem,
        open: true,
        onOpenChange: vi.fn(),
        onSave,
      }),
    );
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Trinity Force", patch: "16.7" }),
    );
  });

  it("shows toast error when JSON fields are invalid", () => {
    render(
      React.createElement(ItemEditDialog, {
        item: sampleItem,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    const tagsSpan = screen.getByText("Tags JSON");
    const tagsTextarea = tagsSpan.closest("label")!.querySelector("textarea")!;
    fireEvent.change(tagsTextarea, { target: { value: "invalid json" } });
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(mocks.toastError).toHaveBeenCalledWith("Le JSON de l'item est invalide.");
  });
});

// ---------- PuzzleEditDialog ----------

const samplePuzzle = {
  id: "p1",
  databaseId: "db-p1",
  slug: "jinx-puzzle-1",
  title: "Jinx Item Choice",
  modeKey: "CHAMPION_SPECIFIC",
  mode: "CHAMPION_SPECIFIC",
  difficultyKey: "INTERMEDIATE",
  difficulty: "INTERMEDIATE",
  roleKey: "ADC",
  patch: "16.7",
  description: "Choose the right item",
  shortPrompt: "Pick for Jinx",
  situation: "You are at 14 minutes",
  question: "What do you build?",
  explanation: "Trinity Force is best",
  isPublished: false,
  isDailyEligible: true,
  champion: { id: "c1", databaseId: "db-c1", slug: "jinx", name: "Jinx", icon: "/jinx.png" },
  choices: [
    { id: "ch1", label: "Trinity Force", choiceType: "ITEM", isCorrect: true, explanation: "Best item" },
    { id: "ch2", label: "Essence Reaver", choiceType: "ITEM", isCorrect: false, explanation: "Wrong item" },
  ],
  scenario: {
    playerChampion: { name: "Jinx" },
    playerRole: "ADC",
    gameMinute: 14,
    playerGold: 2800,
  },
};

describe("PuzzleEditDialog", () => {
  it("renders nothing when open is false", () => {
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: null,
        champions: [],
        loading: false,
        open: false,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("shows loading message when loading is true", () => {
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: null,
        champions: [],
        loading: true,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByText((t) => t.includes("Chargement"))).toBeInTheDocument();
  });

  it("shows loading message when puzzle is null and not loading", () => {
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: null,
        champions: [],
        loading: false,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByText((t) => t.includes("Chargement"))).toBeInTheDocument();
  });

  it("pre-populates form fields from the puzzle data", () => {
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: samplePuzzle,
        champions: [],
        loading: false,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByDisplayValue("Jinx Item Choice")).toBeInTheDocument();
    expect(screen.getByDisplayValue("16.7")).toBeInTheDocument();
  });

  it("renders puzzle choices in the choices tab", () => {
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: samplePuzzle,
        champions: [],
        loading: false,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByText("Trinity Force")).toBeInTheDocument();
    expect(screen.getByText("Bonne reponse")).toBeInTheDocument();
    expect(screen.getByText("Distracteur")).toBeInTheDocument();
  });

  it("renders scenario data in the scenario tab", () => {
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: samplePuzzle,
        champions: [],
        loading: false,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("2800")).toBeInTheDocument();
  });

  it("shows 'no scenario' message when scenario is null", () => {
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: { ...samplePuzzle, scenario: null },
        champions: [],
        loading: false,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByText((t) => t.includes("Aucun scenario"))).toBeInTheDocument();
  });

  it("calls onSave with form payload when Enregistrer is clicked", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: samplePuzzle,
        champions: [],
        loading: false,
        open: true,
        onOpenChange: vi.fn(),
        onSave,
      }),
    );
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Jinx Item Choice" }));
  });

  it("disables Enregistrer button when puzzle is null", () => {
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: null,
        champions: [],
        loading: false,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByText("Enregistrer").closest("button")).toBeDisabled();
  });

  it("renders champion options in the select when champions are provided", () => {
    render(
      React.createElement(PuzzleEditDialog, {
        puzzle: samplePuzzle,
        champions: [
          { id: "c1", databaseId: "db-c1", slug: "jinx", name: "Jinx", roles: ["ADC"], tags: [], patch: "16.7", isActive: true },
        ],
        loading: false,
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(screen.getByRole("option", { name: "Jinx" })).toBeInTheDocument();
  });
});
