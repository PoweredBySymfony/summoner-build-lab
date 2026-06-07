import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useChampionLearning: vi.fn(),
  useGenerateChampionPuzzle: vi.fn(),
  useNavigate: vi.fn(),
  useParams: vi.fn(),
  savePuzzleSeries: vi.fn(),
  ChampionPortrait: vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  useChampionLearning: mocks.useChampionLearning,
  useGenerateChampionPuzzle: mocks.useGenerateChampionPuzzle,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: mocks.useNavigate, useParams: mocks.useParams };
});

vi.mock("../lib/puzzleSeries", () => ({ savePuzzleSeries: mocks.savePuzzleSeries }));
vi.mock("../components/ChampionPortrait", () => ({ default: mocks.ChampionPortrait }));

import Champion from "../pages/Champion";

const championData = {
  champion: {
    id: "c1",
    databaseId: "db-c1",
    slug: "jinx",
    name: "Jinx",
    title: "The Loose Cannon",
    roles: ["ADC"],
    tags: ["Marksman", "Carry"],
    patch: "16.7",
  },
  progress: {
    masteryScore: 85,
    totalAttempts: 50,
    correctAttempts: 42,
  },
  puzzles: [
    {
      id: "p1",
      slug: "jinx-puzzle-1",
      title: "Jinx Item Choice",
      shortPrompt: "Pick the right item for Jinx",
      mode: "OTP",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useNavigate.mockReturnValue(vi.fn());
  mocks.useParams.mockReturnValue({ slug: "jinx" });
  mocks.useChampionLearning.mockReturnValue({ data: championData, isLoading: false });
  mocks.useGenerateChampionPuzzle.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ slug: "series-slug", slugs: ["s1"] }),
    isPending: false,
  });
  mocks.ChampionPortrait.mockImplementation(() =>
    React.createElement("div", { "data-testid": "champion-portrait" }),
  );
});

describe("Champion", () => {
  it("shows loading state while data is being fetched", () => {
    mocks.useChampionLearning.mockReturnValue({ data: undefined, isLoading: true });
    render(React.createElement(Champion));
    expect(screen.getByText(/chargement de l'espace OTP/i)).toBeInTheDocument();
  });

  it("shows loading state when data is null", () => {
    mocks.useChampionLearning.mockReturnValue({ data: null, isLoading: false });
    render(React.createElement(Champion));
    expect(screen.getByText(/chargement de l'espace OTP/i)).toBeInTheDocument();
  });

  it("renders champion name, title, and role badges", () => {
    render(React.createElement(Champion));
    expect(screen.getByText("Jinx")).toBeInTheDocument();
    expect(screen.getByText("The Loose Cannon")).toBeInTheDocument();
    expect(screen.getByText("ADC")).toBeInTheDocument();
    expect(screen.getByText("Marksman")).toBeInTheDocument();
  });

  it("renders ChampionPortrait", () => {
    render(React.createElement(Champion));
    expect(screen.getByTestId("champion-portrait")).toBeInTheDocument();
  });

  it("renders mastery score and statistics", () => {
    render(React.createElement(Champion));
    expect(screen.getByText((t) => t.includes("85"))).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders 'no progress' message when progress is null", () => {
    mocks.useChampionLearning.mockReturnValue({
      data: { ...championData, progress: null },
      isLoading: false,
    });
    render(React.createElement(Champion));
    expect(screen.getByText((t) => t.toLowerCase().includes("aucune progression"))).toBeInTheDocument();
  });

  it("renders linked puzzles list", () => {
    render(React.createElement(Champion));
    expect(screen.getByText("Jinx Item Choice")).toBeInTheDocument();
    expect(screen.getByText("Pick the right item for Jinx")).toBeInTheDocument();
  });

  it("navigates to puzzle when a puzzle button is clicked", () => {
    const navigate = vi.fn();
    mocks.useNavigate.mockReturnValue(navigate);
    render(React.createElement(Champion));
    fireEvent.click(screen.getByText("Jinx Item Choice"));
    expect(navigate).toHaveBeenCalledWith("/training/jinx-puzzle-1");
  });

  it("generates a series and navigates when the generate button is clicked", async () => {
    const navigate = vi.fn();
    mocks.useNavigate.mockReturnValue(navigate);
    const mutateAsync = vi.fn().mockResolvedValue({ slug: "series-slug", slugs: ["s1", "s2"] });
    mocks.useGenerateChampionPuzzle.mockReturnValue({ mutateAsync, isPending: false });
    render(React.createElement(Champion));
    const btn = screen.getByText((t) => t.includes("5 questions"));
    fireEvent.click(btn);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/training/series-slug"));
    expect(mocks.savePuzzleSeries).toHaveBeenCalledWith(["s1", "s2"]);
  });

  it("disables generate button while generation is pending", () => {
    mocks.useGenerateChampionPuzzle.mockReturnValue({ mutateAsync: vi.fn(), isPending: true });
    render(React.createElement(Champion));
    const btn = screen.getByText((t) => t.includes("5 questions")).closest("button");
    expect(btn).toBeDisabled();
  });
});
