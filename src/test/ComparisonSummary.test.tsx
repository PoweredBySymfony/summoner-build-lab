import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildComparisonSummary: vi.fn(),
  formatStatValue: vi.fn(),
  getStatDefinition: vi.fn(),
}));

vi.mock("@/lib/item-lab/calculations", () => ({
  buildComparisonSummary: mocks.buildComparisonSummary,
  formatStatValue: mocks.formatStatValue,
  getStatDefinition: mocks.getStatDefinition,
}));

import ComparisonSummary from "../components/lab/ComparisonSummary";

const fakeComparison = {
  narrative: ["A a plus de DPS soutenu.", "B scale mieux."],
  cards: [
    { label: "Burst", leader: "A" as const, ratioA: 70, ratioB: 40, detail: "A burst plus fort" },
    {
      label: "DPS soutenu",
      leader: "tie" as const,
      ratioA: 50,
      ratioB: 50,
      detail: "DPS équivalent",
    },
  ],
  standoutStats: [
    { key: "attackDamage" as const, delta: 30, previous: 100, current: 130 },
    { key: "health" as const, delta: -50, previous: 600, current: 550 },
    { key: "lethality" as const, delta: 10, previous: 18, current: 28 },
  ],
};

const fakeAnalysis = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buildComparisonSummary.mockReturnValue(fakeComparison);
  mocks.formatStatValue.mockImplementation((_key: string, value: number) => `${value}`);
  mocks.getStatDefinition.mockImplementation((key: string) => ({
    label: key,
    shortLabel: key,
    group: "offense",
  }));
});

describe("ComparisonSummary", () => {
  it("renders the section heading", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("Synthèse comparative")).toBeInTheDocument();
    expect(screen.getByText("Qui gagne quoi, et pourquoi.")).toBeInTheDocument();
  });

  it("renders narrative insight lines", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("A a plus de DPS soutenu.")).toBeInTheDocument();
    expect(screen.getByText("B scale mieux.")).toBeInTheDocument();
  });

  it("renders the 'Insights clés' section label", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("Insights clés")).toBeInTheDocument();
  });

  it("renders comparison card labels", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("Burst")).toBeInTheDocument();
    expect(screen.getByText("DPS soutenu")).toBeInTheDocument();
  });

  it("renders 'Avantage A' for non-tie leader", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("Avantage A")).toBeInTheDocument();
  });

  it("renders 'Égalité' for tie leader", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("Égalité")).toBeInTheDocument();
  });

  it("renders card detail text", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("A burst plus fort")).toBeInTheDocument();
    expect(screen.getByText("DPS équivalent")).toBeInTheDocument();
  });

  it("renders standout stat labels via getStatDefinition", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("attackDamage")).toBeInTheDocument();
    expect(screen.getByText("health")).toBeInTheDocument();
    expect(screen.getByText("lethality")).toBeInTheDocument();
  });

  it("renders 'Écarts de stats' section label", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("Écarts de stats")).toBeInTheDocument();
  });

  it("shows 'A +...' for positive delta and 'B +...' for negative delta", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(screen.getByText("A +30")).toBeInTheDocument();
    expect(screen.getByText("B +50")).toBeInTheDocument();
  });

  it("calls buildComparisonSummary with the provided analyses", () => {
    render(React.createElement(ComparisonSummary, { analysisA: fakeAnalysis, analysisB: fakeAnalysis }));
    expect(mocks.buildComparisonSummary).toHaveBeenCalledWith(fakeAnalysis, fakeAnalysis);
  });
});
