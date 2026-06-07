import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useDailyChallenge: vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  useDailyChallenge: mocks.useDailyChallenge,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Link: vi.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: String(to) }, children)),
  };
});

import Daily from "../pages/Daily";

const dailyData = {
  puzzle: {
    title: "Defi du 7 juin",
    description: "Choisissez le bon item pour Jinx au niveau 14.",
    patch: "16.7",
    difficulty: "INTERMEDIATE",
    mode: "CHAMPION_SPECIFIC",
    slug: "defi-7-juin",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useDailyChallenge.mockReturnValue({ data: dailyData, isLoading: false });
});

describe("Daily", () => {
  it("shows loading message while challenge is being fetched", () => {
    mocks.useDailyChallenge.mockReturnValue({ data: undefined, isLoading: true });
    render(React.createElement(Daily));
    expect(screen.getByText((t) => t.includes("quotidien"))).toBeInTheDocument();
  });

  it("renders the daily puzzle title", () => {
    render(React.createElement(Daily));
    expect(screen.getByText("Defi du 7 juin")).toBeInTheDocument();
  });

  it("renders puzzle description", () => {
    render(React.createElement(Daily));
    expect(screen.getByText("Choisissez le bon item pour Jinx au niveau 14.")).toBeInTheDocument();
  });

  it("renders patch, difficulty and mode badges", () => {
    render(React.createElement(Daily));
    expect(screen.getByText("Patch 16.7")).toBeInTheDocument();
    expect(screen.getByText("INTERMEDIATE")).toBeInTheDocument();
    expect(screen.getByText("CHAMPION_SPECIFIC")).toBeInTheDocument();
  });

  it("renders link to the training page for the puzzle slug", () => {
    render(React.createElement(Daily));
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/training/defi-7-juin");
  });

  it("renders gracefully when data is null", () => {
    mocks.useDailyChallenge.mockReturnValue({ data: null, isLoading: false });
    render(React.createElement(Daily));
    expect(screen.getByText((t) => t.includes("quotidien"))).toBeInTheDocument();
  });
});
