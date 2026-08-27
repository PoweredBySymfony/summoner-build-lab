import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useCatalog: vi.fn(),
  usePuzzles: vi.fn(),
  ChampionPortrait: vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  useCatalog: mocks.useCatalog,
  usePuzzles: mocks.usePuzzles,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Link: vi.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: String(to) }, children)),
  };
});

vi.mock("../components/ChampionPortrait", () => ({ default: mocks.ChampionPortrait }));

import Modules from "../pages/Modules";

const catalogData = {
  champions: [
    { id: "c1", slug: "jinx", name: "Jinx" },
    { id: "c2", slug: "lux", name: "Lux" },
    { id: "c3", slug: "thresh", name: "Thresh" },
  ],
};

const puzzlesData = [
  {
    id: "p1",
    slug: "adc-itemization",
    title: "ADC Itemization Basics",
    shortPrompt: "What to buy on Jinx?",
    difficulty: "BEGINNER",
    patch: "16.7",
    tags: [{ slug: "adc", name: "ADC" }, { slug: "crit", name: "Crit" }],
  },
  {
    id: "p2",
    slug: "mid-itemization",
    title: "Mid Lane Choices",
    shortPrompt: "Burst vs sustained?",
    difficulty: "ADVANCED",
    patch: "16.7",
    tags: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useCatalog.mockReturnValue({ data: catalogData });
  mocks.usePuzzles.mockReturnValue({ data: puzzlesData });
  mocks.ChampionPortrait.mockImplementation(() =>
    React.createElement("div", { "data-testid": "champion-portrait" }),
  );
});

describe("Modules", () => {
  it("renders the general mode and OTP mode section headings", () => {
    render(React.createElement(Modules));
    expect(screen.getByText(/travaille les grands principes/i)).toBeInTheDocument();
    expect(screen.getByText(/approfondis un champion/i)).toBeInTheDocument();
  });

  it("renders puzzles from the API", () => {
    render(React.createElement(Modules));
    expect(screen.getByText("ADC Itemization Basics")).toBeInTheDocument();
    expect(screen.getByText("Mid Lane Choices")).toBeInTheDocument();
  });

  it("renders puzzle difficulty and patch", () => {
    render(React.createElement(Modules));
    expect(screen.getByText("BEGINNER")).toBeInTheDocument();
    expect(screen.getAllByText("16.7").length).toBeGreaterThan(0);
  });

  it("renders puzzle tags", () => {
    render(React.createElement(Modules));
    expect(screen.getByText("ADC")).toBeInTheDocument();
    expect(screen.getByText("Crit")).toBeInTheDocument();
  });

  it("renders champions in the OTP search section", () => {
    render(React.createElement(Modules));
    expect(screen.getAllByTestId("champion-portrait").length).toBeGreaterThan(0);
  });

  it("renders empty state gracefully when catalog and puzzles are undefined", () => {
    mocks.useCatalog.mockReturnValue({ data: undefined });
    mocks.usePuzzles.mockReturnValue({ data: undefined });
    render(React.createElement(Modules));
    expect(screen.getByText(/travaille les grands principes/i)).toBeInTheDocument();
  });

  it("filters champions by query when typing in search input", () => {
    render(React.createElement(Modules));
    const input = screen.getByPlaceholderText(/recherche ton champion/i);
    fireEvent.change(input, { target: { value: "lux" } });
    expect(mocks.ChampionPortrait).toHaveBeenCalledWith(
      expect.objectContaining({ champion: expect.objectContaining({ name: "Lux" }) }),
      {},
    );
  });

  it("shows all champions when query is cleared after filtering", () => {
    render(React.createElement(Modules));
    const input = screen.getByPlaceholderText(/recherche ton champion/i);
    fireEvent.change(input, { target: { value: "lux" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(mocks.ChampionPortrait).toHaveBeenCalledWith(
      expect.objectContaining({ champion: expect.objectContaining({ name: "Jinx" }) }),
      {},
    );
  });
});
