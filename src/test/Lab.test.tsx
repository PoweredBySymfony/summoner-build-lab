import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useCatalog: vi.fn(),
  ComparisonSummary: vi.fn(),
  SetupColumn: vi.fn(),
  analyzeSetup: vi.fn(),
  canSelectItem: vi.fn(),
  buildComparisonExport: vi.fn(),
  deleteSavedExperiment: vi.fn(),
  getSavedExperiments: vi.fn(),
  persistExperiment: vi.fn(),
  buildRoleAwareItemIds: vi.fn(),
  getDefaultChampionRole: vi.fn(),
  getRoleConfig: vi.fn(),
  normalizeSetupForRole: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../api/hooks", () => ({ useCatalog: mocks.useCatalog }));
vi.mock("../components/lab/ComparisonSummary", () => ({ default: mocks.ComparisonSummary }));
vi.mock("../components/lab/SetupColumn", () => ({ default: mocks.SetupColumn }));
vi.mock("../lib/item-lab/calculations", () => ({ analyzeSetup: mocks.analyzeSetup }));
vi.mock("../lib/item-lab/InventoryValidationService", () => ({
  InventoryValidationService: { canSelectItem: mocks.canSelectItem },
}));
vi.mock("../lib/item-lab/storage", () => ({
  buildComparisonExport: mocks.buildComparisonExport,
  deleteSavedExperiment: mocks.deleteSavedExperiment,
  getSavedExperiments: mocks.getSavedExperiments,
  persistExperiment: mocks.persistExperiment,
}));
vi.mock("../lib/item-lab/roleConfig", () => ({
  buildRoleAwareItemIds: mocks.buildRoleAwareItemIds,
  getDefaultChampionRole: mocks.getDefaultChampionRole,
  getRoleConfig: mocks.getRoleConfig,
  normalizeSetupForRole: mocks.normalizeSetupForRole,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import Lab from "../pages/Lab";

const catalogData = {
  champions: [
    { id: "c1", slug: "jinx", name: "Jinx", roles: ["ADC"], tags: ["Marksman"], patch: "16.7" },
    { id: "c2", slug: "lux", name: "Lux", roles: ["MID"], tags: ["Mage"], patch: "16.7" },
  ],
  items: [{ id: "i1", name: "Trinity Force", imageUrl: "/tri.png" }],
};

const fakeAnalysis = { stats: { attack_damage: 100, ability_power: 0 }, items: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useCatalog.mockReturnValue({ data: catalogData, isLoading: false });
  mocks.getRoleConfig.mockReturnValue({ maxLevel: 18, maxItems: 6 });
  mocks.buildRoleAwareItemIds.mockReturnValue([null, null, null, null, null, null]);
  mocks.getDefaultChampionRole.mockReturnValue("MID");
  mocks.normalizeSetupForRole.mockImplementation(({ setup }) => setup);
  mocks.analyzeSetup.mockReturnValue(fakeAnalysis);
  mocks.getSavedExperiments.mockReturnValue([]);
  mocks.buildComparisonExport.mockReturnValue("export content");
  mocks.canSelectItem.mockReturnValue({ allowed: true, reasons: [] });
  mocks.SetupColumn.mockImplementation(
    ({ title, side, disableChampionSelection }: { title: string; side: string; disableChampionSelection?: boolean }) =>
      React.createElement(
        "div",
        { "data-testid": `setup-column-${side}`, "data-disabled": String(disableChampionSelection ?? false) },
        title,
      ),
  );
  mocks.ComparisonSummary.mockReturnValue(
    React.createElement("div", { "data-testid": "comparison-summary" }),
  );
});

describe("Lab", () => {
  it("shows loading state while catalog is being fetched", () => {
    mocks.useCatalog.mockReturnValue({ data: null, isLoading: true });
    render(React.createElement(Lab));
    expect(screen.getByText((t) => t.includes("Lab d'Items"))).toBeInTheDocument();
  });

  it("shows loading state when catalog is null", () => {
    mocks.useCatalog.mockReturnValue({ data: null, isLoading: false });
    render(React.createElement(Lab));
    expect(screen.getByText((t) => t.includes("Lab d'Items"))).toBeInTheDocument();
  });

  it("renders the full lab UI when catalog and analyses are ready", () => {
    render(React.createElement(Lab));
    expect(screen.getByText((t) => t.includes("Comparer deux setups"))).toBeInTheDocument();
    expect(screen.getByTestId("setup-column-A")).toBeInTheDocument();
    expect(screen.getByTestId("setup-column-B")).toBeInTheDocument();
    expect(screen.getByTestId("comparison-summary")).toBeInTheDocument();
  });

  it("renders all archetype pills", () => {
    render(React.createElement(Lab));
    expect(screen.getByText("Frontline lourde")).toBeInTheDocument();
    expect(screen.getByText("Burst rapide")).toBeInTheDocument();
    expect(screen.getByText("Squishy")).toBeInTheDocument();
  });

  it("renders mirror and duel mode buttons", () => {
    render(React.createElement(Lab));
    expect(screen.getByText("Mode miroir")).toBeInTheDocument();
    expect(screen.getByText("Mode duel")).toBeInTheDocument();
  });

  it("disables champion selection on column B in mirror mode by default", () => {
    render(React.createElement(Lab));
    expect(screen.getByTestId("setup-column-B")).toHaveAttribute("data-disabled", "true");
  });

  it("enables champion selection on column B after switching to duel mode", () => {
    render(React.createElement(Lab));
    fireEvent.click(screen.getByText("Mode duel"));
    expect(screen.getByTestId("setup-column-B")).toHaveAttribute("data-disabled", "false");
  });

  it("renders the experiment name input with default value", () => {
    const { container } = render(React.createElement(Lab));
    const input = container.querySelector("input[placeholder]");
    expect(input).toHaveValue("Comparaison sans titre");
  });

  it("updates experiment name when user types in the input", () => {
    const { container } = render(React.createElement(Lab));
    const input = container.querySelector("input[placeholder]")!;
    fireEvent.change(input, { target: { value: "Jinx vs Lux" } });
    expect(input).toHaveValue("Jinx vs Lux");
  });

  it("saves experiment and shows success toast on save click", () => {
    render(React.createElement(Lab));
    fireEvent.click(screen.getByText("Sauvegarder").closest("button")!);
    expect(mocks.persistExperiment).toHaveBeenCalled();
    expect(mocks.getSavedExperiments).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Comparaison sauvegardée.");
  });

  it("resets the lab and shows success toast on reset click", () => {
    const { container } = render(React.createElement(Lab));
    const input = container.querySelector("input[placeholder]")!;
    fireEvent.change(input, { target: { value: "My custom name" } });
    fireEvent.click(screen.getByText("Reset").closest("button")!);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Le Lab a été réinitialisé.");
    expect(input).toHaveValue("Comparaison sans titre");
  });

  it("calls buildComparisonExport and shows toast on export click", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
    render(React.createElement(Lab));
    fireEvent.click(screen.getByText("Export").closest("button")!);
    await waitFor(() => expect(mocks.buildComparisonExport).toHaveBeenCalled());
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
  });

  it("shows empty saved experiments message when there are none", () => {
    render(React.createElement(Lab));
    expect(screen.getByText((t) => t.includes("Aucune"))).toBeInTheDocument();
  });

  it("renders saved experiments from storage", () => {
    const savedExp = {
      id: "exp1",
      name: "Jinx Build Test",
      mode: "mirror",
      setupA: { championId: "c1", role: "ADC", level: 11, itemIds: [] },
      setupB: { championId: "c1", role: "ADC", level: 11, itemIds: [] },
      createdAt: "2026-06-07T10:00:00.000Z",
      updatedAt: "2026-06-07T10:00:00.000Z",
    };
    mocks.getSavedExperiments.mockReturnValue([savedExp]);
    render(React.createElement(Lab));
    expect(screen.getByText("Jinx Build Test")).toBeInTheDocument();
    expect(screen.getByText("Charger cette expérience")).toBeInTheDocument();
  });

  it("loads an experiment when 'Charger cette expérience' is clicked", () => {
    const savedExp = {
      id: "exp1",
      name: "Jinx Build Test",
      mode: "duel",
      setupA: { championId: "c1", role: "ADC", level: 11, itemIds: [] },
      setupB: { championId: "c2", role: "MID", level: 11, itemIds: [] },
      createdAt: "2026-06-07T10:00:00.000Z",
      updatedAt: "2026-06-07T10:00:00.000Z",
    };
    mocks.getSavedExperiments.mockReturnValue([savedExp]);
    render(React.createElement(Lab));
    fireEvent.click(screen.getByText("Charger cette expérience"));
    expect(screen.getByTestId("setup-column-B")).toHaveAttribute("data-disabled", "false");
  });

  it("deletes an experiment and refreshes the list", () => {
    const savedExp = {
      id: "exp1",
      name: "Jinx Build Test",
      mode: "mirror",
      setupA: { championId: "c1", role: "ADC", level: 11, itemIds: [] },
      setupB: { championId: "c1", role: "ADC", level: 11, itemIds: [] },
      createdAt: "2026-06-07T10:00:00.000Z",
      updatedAt: "2026-06-07T10:00:00.000Z",
    };
    mocks.getSavedExperiments.mockReturnValue([savedExp]);
    render(React.createElement(Lab));
    const iconOnlyButtons = screen.getAllByRole("button").filter((b) => !b.textContent?.trim());
    expect(iconOnlyButtons).toHaveLength(1);
    fireEvent.click(iconOnlyButtons[0]);
    expect(mocks.deleteSavedExperiment).toHaveBeenCalledWith("exp1");
    expect(mocks.getSavedExperiments).toHaveBeenCalled();
  });
});
