import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  useDashboard: vi.fn(),
  Navigate: vi.fn(),
  ChampionPortrait: vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  useCurrentUser: mocks.useCurrentUser,
  useDashboard: mocks.useDashboard,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Navigate: mocks.Navigate,
    Link: vi.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: String(to) }, children)),
  };
});

vi.mock("../components/ChampionPortrait", () => ({ default: mocks.ChampionPortrait }));

import Dashboard from "../pages/Dashboard";

const loggedInUser = { id: "u1", username: "JinxMain", isAdmin: false };

const dashboardData = {
  progress: {
    global: {
      totalAttempts: 100,
      totalCorrect: 75,
      dailyStreak: 5,
      dailyCompletedCount: 3,
      streakDeadlineAt: "2026-06-08T12:00:00Z",
    },
    recentAttempts: [
      {
        id: "a1",
        isCorrect: true,
        answeredAt: "2026-06-07T10:00:00Z",
        puzzle: { slug: "puzzle-1", title: "Best Item for Jinx" },
      },
      {
        id: "a2",
        isCorrect: false,
        answeredAt: "2026-06-06T09:00:00Z",
        puzzle: { slug: "puzzle-2", title: "Teamfight Strategy" },
      },
    ],
    championProgress: [
      { champion: { id: "c1", slug: "jinx", name: "Jinx" }, masteryScore: 72 },
    ],
  },
  dailyChallenge: {
    title: "Daily Puzzle 1",
    slug: "daily-slug-1",
    shortPrompt: "Choose the right item for Jinx",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.Navigate.mockReturnValue(null);
  mocks.useCurrentUser.mockReturnValue({ data: loggedInUser, isLoading: false });
  mocks.useDashboard.mockReturnValue({ data: dashboardData, isLoading: false });
  mocks.ChampionPortrait.mockImplementation(() =>
    React.createElement("div", { "data-testid": "champion-portrait" }),
  );
});

describe("Dashboard", () => {
  it("redirects to /auth when user is not logged in", () => {
    mocks.useCurrentUser.mockReturnValue({ data: null, isLoading: false });
    render(React.createElement(Dashboard));
    expect(mocks.Navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/auth" }), {});
  });

  it("shows loading message while dashboard data is loading", () => {
    mocks.useDashboard.mockReturnValue({ data: undefined, isLoading: true });
    render(React.createElement(Dashboard));
    expect(screen.getByText(/chargement du dashboard/i)).toBeInTheDocument();
  });

  it("shows loading message when data is null", () => {
    mocks.useDashboard.mockReturnValue({ data: null, isLoading: false });
    render(React.createElement(Dashboard));
    expect(screen.getByText(/chargement du dashboard/i)).toBeInTheDocument();
  });

  it("greets user with username", () => {
    render(React.createElement(Dashboard));
    expect(screen.getByText(/bon retour.*JinxMain/i)).toBeInTheDocument();
  });

  it("renders total attempts stat", () => {
    render(React.createElement(Dashboard));
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText(/tentatives totales/i)).toBeInTheDocument();
  });

  it("renders accuracy percentage correctly", () => {
    render(React.createElement(Dashboard));
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/precision/i)).toBeInTheDocument();
  });

  it("renders accuracy as 0% when totalAttempts is zero", () => {
    mocks.useDashboard.mockReturnValue({
      data: {
        ...dashboardData,
        progress: {
          ...dashboardData.progress,
          global: { ...dashboardData.progress.global, totalAttempts: 0, totalCorrect: 0 },
        },
      },
      isLoading: false,
    });
    render(React.createElement(Dashboard));
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders streak count and deadline notice", () => {
    render(React.createElement(Dashboard));
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/a conserver avant le/i)).toBeInTheDocument();
  });

  it("shows 'Aucune streak active' when streakDeadlineAt is null", () => {
    mocks.useDashboard.mockReturnValue({
      data: {
        ...dashboardData,
        progress: {
          ...dashboardData.progress,
          global: { ...dashboardData.progress.global, streakDeadlineAt: null },
        },
      },
      isLoading: false,
    });
    render(React.createElement(Dashboard));
    expect(screen.getByText(/aucune streak active/i)).toBeInTheDocument();
  });

  it("renders daily challenge title and short prompt", () => {
    render(React.createElement(Dashboard));
    expect(screen.getByText("Daily Puzzle 1")).toBeInTheDocument();
    expect(screen.getByText("Choose the right item for Jinx")).toBeInTheDocument();
  });

  it("renders recent attempts with correct/incorrect labels", () => {
    render(React.createElement(Dashboard));
    expect(screen.getByText("Best Item for Jinx")).toBeInTheDocument();
    expect(screen.getByText("Teamfight Strategy")).toBeInTheDocument();
    expect(screen.getByText("Bonne reponse")).toBeInTheDocument();
    expect(screen.getByText("A retravailler")).toBeInTheDocument();
  });

  it("renders champion progress with ChampionPortrait and mastery score", () => {
    render(React.createElement(Dashboard));
    expect(screen.getByTestId("champion-portrait")).toBeInTheDocument();
    expect(screen.getByText("Jinx")).toBeInTheDocument();
    expect(screen.getByText("Maitrise 72")).toBeInTheDocument();
  });
});
