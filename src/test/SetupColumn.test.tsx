import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ChampionPortrait: vi.fn(),
  ItemIcon: vi.fn(),
  StatTable: vi.fn(),
  getSlotItemValidation: vi.fn(),
  validateSetupInventory: vi.fn(),
  getChampionRoleOptions: vi.fn(),
}));

vi.mock("../components/ChampionPortrait", () => ({ default: mocks.ChampionPortrait }));
vi.mock("../components/ItemIcon", () => ({ default: mocks.ItemIcon, ItemIcon: mocks.ItemIcon }));
vi.mock("../components/lab/StatTable", () => ({ default: mocks.StatTable }));
vi.mock("../components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));
vi.mock("../components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  CommandInput: ({ placeholder }: { placeholder?: string }) =>
    React.createElement("input", { placeholder }),
  CommandList: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  CommandEmpty: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  CommandItem: ({
    children,
    onSelect,
    value,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    value?: string;
  }) => React.createElement("div", { onClick: onSelect, "data-value": value }, children),
}));
vi.mock("../lib/item-lab/calculations", () => ({
  formatStatValue: (_key: string, value: number) => String(value),
  getStatLabel: (key: string) => key,
}));
vi.mock("../lib/item-lab/InventoryValidationService", () => ({
  InventoryValidationService: {
    getSlotItemValidation: mocks.getSlotItemValidation,
    validateSetupInventory: mocks.validateSetupInventory,
  },
}));
vi.mock("../lib/item-lab/roleConfig", () => ({
  getChampionRoleOptions: mocks.getChampionRoleOptions,
}));

import SetupColumn from "../components/lab/SetupColumn";

const champion = {
  id: "c1",
  databaseId: "db-c1",
  slug: "jinx",
  name: "Jinx",
  roles: ["ADC"],
  tags: ["Marksman"],
  patch: "16.7",
  isActive: true,
};

const fakeAnalysis = {
  champion,
  stats: {},
  bonusStats: { attack_damage: 30 },
  changedStats: [{ key: "attack_damage", previous: 70, current: 100, delta: 30 }],
  whyItChanges: [
    { title: "Attack Damage", body: "Grants bonus attack damage" },
    { title: "Attack Speed", body: "Improves attack speed" },
    { title: "Crit", body: "No crit chance in this build" },
  ],
  profileScores: [{ key: "damage", label: "Dommages", value: 75, emphasis: "High damage output" }],
  context: {
    isUnlocked: true,
    tags: ["Engage", "Frontline"],
    summary: "Engage-focused build",
    reasons: ["Tanky items", "Good engage"],
    confidence: "high",
  },
  totalGold: 3200,
  scalingScore: 75,
  role: "ADC",
  roleConfig: { maxLevel: 18, maxItems: 6 },
  summaryLine: "Damage-focused setup at level 11",
  items: [],
};

const fakeSetup = {
  championId: "c1",
  role: "ADC" as const,
  level: 11,
  itemIds: [null, null, null, null, null, null],
};

const defaultProps = {
  side: "A" as const,
  accent: "gold" as const,
  title: "Colonne A",
  setup: fakeSetup,
  analysis: fakeAnalysis,
  champions: [champion],
  items: [],
  onChampionChange: vi.fn(),
  onRoleChange: vi.fn(),
  onLevelChange: vi.fn(),
  onItemChange: vi.fn(),
  onItemRemove: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ChampionPortrait.mockImplementation(({ champion: champ }: { champion: { name: string } }) =>
    React.createElement("div", { "data-testid": `portrait-${champ.name}` }),
  );
  mocks.ItemIcon.mockImplementation(({ item }: { item: { id: string } }) =>
    React.createElement("div", { "data-testid": `item-icon-${item.id}` }),
  );
  mocks.StatTable.mockReturnValue(
    React.createElement("div", { "data-testid": "stat-table" }),
  );
  mocks.getChampionRoleOptions.mockReturnValue(["ADC", "SUPPORT"]);
  mocks.getSlotItemValidation.mockReturnValue({ allowedItems: [], hints: [] });
  mocks.validateSetupInventory.mockReturnValue({ isValid: true, issues: [] });
});

describe("SetupColumn", () => {
  it("renders the section title and champion name", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getByText("Colonne A")).toBeInTheDocument();
    expect(screen.getAllByText("Jinx").length).toBeGreaterThan(0);
  });

  it("renders ChampionPortrait for the setup champion", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getAllByTestId("portrait-Jinx").length).toBeGreaterThan(0);
  });

  it("renders champion role badges", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getAllByText("ADC").length).toBeGreaterThan(0);
  });

  it("renders role selector buttons from getChampionRoleOptions", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getByText("SUPPORT")).toBeInTheDocument();
  });

  it("calls onRoleChange when a role button is clicked", () => {
    render(React.createElement(SetupColumn, defaultProps));
    fireEvent.click(screen.getByText("SUPPORT"));
    expect(defaultProps.onRoleChange).toHaveBeenCalledWith("SUPPORT");
  });

  it("renders the current level", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("calls onLevelChange with decremented value when minus button is clicked", () => {
    render(React.createElement(SetupColumn, defaultProps));
    fireEvent.click(screen.getByLabelText("Baisser le niveau"));
    expect(defaultProps.onLevelChange).toHaveBeenCalledWith(10);
  });

  it("calls onLevelChange with incremented value when plus button is clicked", () => {
    render(React.createElement(SetupColumn, defaultProps));
    fireEvent.click(screen.getByLabelText("Monter le niveau"));
    expect(defaultProps.onLevelChange).toHaveBeenCalledWith(12);
  });

  it("calls onLevelChange with max level when max level button is clicked", () => {
    render(React.createElement(SetupColumn, defaultProps));
    fireEvent.click(screen.getByText("Max 18"));
    expect(defaultProps.onLevelChange).toHaveBeenCalledWith(18);
  });

  it("calls onLevelChange when the range input is changed", () => {
    render(React.createElement(SetupColumn, defaultProps));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "15" } });
    expect(defaultProps.onLevelChange).toHaveBeenCalledWith(15);
  });

  it("shows changed stats section", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getAllByText("attack_damage").length).toBeGreaterThan(0);
    expect(screen.getByText("70")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("shows 'no changes' message when changedStats is empty", () => {
    const analysis = { ...fakeAnalysis, changedStats: [], bonusStats: {} };
    render(React.createElement(SetupColumn, { ...defaultProps, analysis }));
    expect(screen.getByText((t) => t.includes("Change un niveau"))).toBeInTheDocument();
  });

  it("shows 'no impact' message when bonusStats has no large values", () => {
    const analysis = { ...fakeAnalysis, bonusStats: { attack_damage: 0 } };
    render(React.createElement(SetupColumn, { ...defaultProps, analysis }));
    expect(screen.getByText((t) => t.includes("gros impacts"))).toBeInTheDocument();
  });

  it("shows up to 2 'why it changes' notes by default", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getByText("Attack Damage")).toBeInTheDocument();
    expect(screen.getByText("Attack Speed")).toBeInTheDocument();
    expect(screen.queryByText("Crit")).not.toBeInTheDocument();
  });

  it("shows 'Voir plus' button when there are more than 2 whyItChanges", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getByText("Voir plus")).toBeInTheDocument();
  });

  it("shows all notes after clicking 'Voir plus'", () => {
    render(React.createElement(SetupColumn, defaultProps));
    fireEvent.click(screen.getByText("Voir plus"));
    expect(screen.getByText("Crit")).toBeInTheDocument();
    expect(screen.getByText((t) => t.includes("réduire") || t.toLowerCase().includes("réduire"))).toBeInTheDocument();
  });

  it("shows profile scores", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getByText("Dommages")).toBeInTheDocument();
    expect(screen.getByText("High damage output")).toBeInTheDocument();
  });

  it("shows context section with tags and summary when isUnlocked is true", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getByText("Engage-focused build")).toBeInTheDocument();
    expect(screen.getByText("Engage")).toBeInTheDocument();
  });

  it("shows only summary when context is locked", () => {
    const analysis = {
      ...fakeAnalysis,
      context: { ...fakeAnalysis.context, isUnlocked: false, summary: "Locked summary" },
    };
    render(React.createElement(SetupColumn, { ...defaultProps, analysis }));
    expect(screen.getByText("Locked summary")).toBeInTheDocument();
  });

  it("shows summary line", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getByText("Damage-focused setup at level 11")).toBeInTheDocument();
  });

  it("shows invalid build warning when build is not valid", () => {
    mocks.validateSetupInventory.mockReturnValue({
      isValid: false,
      issues: [{ itemName: "Trinity Force", reason: "Not valid" }],
    });
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getByText((t) => t.includes("Trinity Force"))).toBeInTheDocument();
  });

  it("disables champion picker button when disableChampionSelection is true", () => {
    render(React.createElement(SetupColumn, { ...defaultProps, disableChampionSelection: true }));
    const championBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Jinx") && !b.dataset["value"]);
    expect(championBtn).toBeDisabled();
  });

  it("calls onChampionChange when a champion is selected in the picker", () => {
    render(React.createElement(SetupColumn, defaultProps));
    const jinxOption = screen.getAllByText("Jinx").find(
      (el) => el.closest("[data-value]"),
    );
    if (jinxOption) {
      const target = jinxOption.closest("[data-value]");
      if (target) fireEvent.click(target);
    }
    expect(defaultProps.onChampionChange).toHaveBeenCalledWith("c1");
  });

  it("renders item slot icons for filled item slots", () => {
    const itemsData = [{ id: "i1", name: "Trinity Force", icon: "/tri.png", cost: 3200, tags: [] }];
    const setup = { ...fakeSetup, itemIds: ["i1", null, null, null, null, null] };
    mocks.getSlotItemValidation.mockReturnValue({
      allowedItems: itemsData,
      hints: [],
    });
    render(
      React.createElement(SetupColumn, { ...defaultProps, setup, items: itemsData }),
    );
    expect(screen.getByTestId("item-icon-i1")).toBeInTheDocument();
  });

  it("renders StatTable twice (offense/defense and utility groups)", () => {
    render(React.createElement(SetupColumn, defaultProps));
    expect(screen.getAllByTestId("stat-table")).toHaveLength(2);
  });
});
