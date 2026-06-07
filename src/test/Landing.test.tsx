import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useBootstrap: vi.fn(),
  ChampionPortrait: vi.fn(),
  ItemIcon: vi.fn(),
  RiotIdSearch: vi.fn(),
}));

vi.mock("../api/hooks", () => ({ useBootstrap: mocks.useBootstrap }));
vi.mock("../components/ChampionPortrait", () => ({ default: mocks.ChampionPortrait }));
vi.mock("../components/ItemIcon", () => ({ ItemIcon: mocks.ItemIcon }));
vi.mock("../components/RiotIdSearch", () => ({ RiotIdSearch: mocks.RiotIdSearch }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Link: vi.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: String(to) }, children)),
  };
});

import Landing from "../pages/Landing";

const bootstrapData = {
  stats: { championCount: 165, itemCount: 200, puzzleCount: 42 },
  featuredChampions: [
    { id: "c1", slug: "jinx", name: "Jinx", roles: [], tags: [], patch: "16.7" },
    { id: "c2", slug: "lux", name: "Lux", roles: [], tags: [], patch: "16.7" },
  ],
  featuredItems: [{ id: "i1", name: "Trinity Force", imageUrl: "/tri.png" }],
  dailyChallenge: {
    title: "Jinx au niveau 14",
    shortPrompt: "Pick the right item for Jinx",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useBootstrap.mockReturnValue({ data: bootstrapData });
  mocks.ChampionPortrait.mockImplementation(({ champion }: { champion: { slug: string } }) =>
    React.createElement("div", { "data-testid": `portrait-${champion.slug}` }),
  );
  mocks.ItemIcon.mockImplementation(({ item }: { item: { id: string } }) =>
    React.createElement("div", { "data-testid": `item-${item.id}` }),
  );
  mocks.RiotIdSearch.mockReturnValue(
    React.createElement("div", { "data-testid": "riot-id-search" }),
  );
});

describe("Landing", () => {
  it("renders champion, item and puzzle counts from data", () => {
    render(React.createElement(Landing));
    expect(screen.getByText("165")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows zero counts when data is not loaded", () => {
    mocks.useBootstrap.mockReturnValue({ data: null });
    render(React.createElement(Landing));
    expect(screen.getAllByText("0")).toHaveLength(3);
  });

  it("renders the daily challenge title and short prompt", () => {
    render(React.createElement(Landing));
    expect(screen.getByText("Jinx au niveau 14")).toBeInTheDocument();
    expect(screen.getByText("Pick the right item for Jinx")).toBeInTheDocument();
  });

  it("renders ChampionPortrait for each featured champion", () => {
    render(React.createElement(Landing));
    expect(screen.getByTestId("portrait-jinx")).toBeInTheDocument();
    expect(screen.getByTestId("portrait-lux")).toBeInTheDocument();
  });

  it("renders champion portraits as links to their champion pages", () => {
    const { container } = render(React.createElement(Landing));
    expect(container.querySelector('a[href="/champions/jinx"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/champions/lux"]')).toBeInTheDocument();
  });

  it("renders ItemIcon for featured items", () => {
    render(React.createElement(Landing));
    expect(screen.getByTestId("item-i1")).toBeInTheDocument();
  });

  it("renders the RiotIdSearch component", () => {
    render(React.createElement(Landing));
    expect(screen.getByTestId("riot-id-search")).toBeInTheDocument();
  });

  it("has navigation links to /modules and /daily", () => {
    const { container } = render(React.createElement(Landing));
    expect(container.querySelector('a[href="/modules"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/daily"]')).toBeInTheDocument();
  });

  it("renders the three feature mode cards", () => {
    render(React.createElement(Landing));
    expect(screen.getByText("Mode OTP")).toBeInTheDocument();
    expect(screen.getByText("Mode général")).toBeInTheDocument();
    expect(screen.getByText("Streak quotidien")).toBeInTheDocument();
  });

  it("renders no featured champions when data is null", () => {
    mocks.useBootstrap.mockReturnValue({ data: null });
    render(React.createElement(Landing));
    expect(screen.queryByTestId("portrait-jinx")).not.toBeInTheDocument();
  });
});
