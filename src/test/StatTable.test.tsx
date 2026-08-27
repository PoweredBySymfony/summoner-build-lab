import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import StatTable from "../components/lab/StatTable";

const fakeStats = {
  health: 600,
  mana: 300,
  attackDamage: 100,
  abilityPower: 0,
  attackSpeed: 0.65,
  critChance: 0.2,
  armorPen: 0,
  lethality: 18,
  magicPen: 0,
  abilityHaste: 20,
  armor: 45,
  magicResist: 32,
  moveSpeed: 345,
  healthRegen: 8,
  manaRegen: 6,
};

const fakeAnalysis = { stats: fakeStats } as never;

describe("StatTable", () => {
  it("renders all three group titles by default", () => {
    render(React.createElement(StatTable, { analysis: fakeAnalysis }));
    expect(screen.getByText("Offensif")).toBeInTheDocument();
    expect(screen.getByText("Défensif")).toBeInTheDocument();
    expect(screen.getByText("Utilitaire")).toBeInTheDocument();
  });

  it("renders only the specified groups when groups prop is passed", () => {
    render(React.createElement(StatTable, { analysis: fakeAnalysis, groups: ["offense"] }));
    expect(screen.getByText("Offensif")).toBeInTheDocument();
    expect(screen.queryByText("Défensif")).not.toBeInTheDocument();
    expect(screen.queryByText("Utilitaire")).not.toBeInTheDocument();
  });

  it("shows 'Lecture principale' label in normal mode", () => {
    render(React.createElement(StatTable, { analysis: fakeAnalysis, groups: ["offense"] }));
    expect(screen.getByText("Lecture principale")).toBeInTheDocument();
  });

  it("shows 'Détails' label in subdued mode", () => {
    render(React.createElement(StatTable, { analysis: fakeAnalysis, groups: ["offense"], subdued: true }));
    expect(screen.getByText("Détails")).toBeInTheDocument();
  });

  it("renders defense group only", () => {
    render(React.createElement(StatTable, { analysis: fakeAnalysis, groups: ["defense"] }));
    expect(screen.getByText("Défensif")).toBeInTheDocument();
    expect(screen.queryByText("Offensif")).not.toBeInTheDocument();
  });

  it("renders utility group only", () => {
    render(React.createElement(StatTable, { analysis: fakeAnalysis, groups: ["utility"] }));
    expect(screen.getByText("Utilitaire")).toBeInTheDocument();
  });

  it("renders multiple group entries (more than one stat card)", () => {
    render(React.createElement(StatTable, { analysis: fakeAnalysis, groups: ["offense"] }));
    const cards = screen.getAllByRole("paragraph");
    expect(cards.length).toBeGreaterThan(1);
  });
});
