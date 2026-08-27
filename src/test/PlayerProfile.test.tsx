import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  usePlayerSearch: vi.fn(),
  useImportRecentMatches: vi.fn(),
  useGenerateMatchPuzzleSeries: vi.fn(),
  useNavigate: vi.fn(),
  useParams: vi.fn(),
  savePuzzleSeries: vi.fn(),
  buildRiotProfileIconUrl: vi.fn(),
  saveRecentRiotSearch: vi.fn(),
  RiotIdSearch: vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  useCurrentUser: mocks.useCurrentUser,
  usePlayerSearch: mocks.usePlayerSearch,
  useImportRecentMatches: mocks.useImportRecentMatches,
  useGenerateMatchPuzzleSeries: mocks.useGenerateMatchPuzzleSeries,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: mocks.useNavigate,
    useParams: mocks.useParams,
    Link: vi.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: String(to) }, children)),
  };
});

vi.mock("../lib/puzzleSeries", () => ({ savePuzzleSeries: mocks.savePuzzleSeries }));

vi.mock("../lib/riotSearch", () => ({
  buildRiotProfileIconUrl: mocks.buildRiotProfileIconUrl,
  saveRecentRiotSearch: mocks.saveRecentRiotSearch,
}));

vi.mock("../components/RiotIdSearch", () => ({
  RiotIdSearch: mocks.RiotIdSearch,
}));

import PlayerProfile from "../pages/PlayerProfile";

const playerData = {
  profile: {
    riotId: "JinxMain#EUW",
    gameName: "JinxMain",
    tagLine: "EUW",
    puuid: "puuid-jinx",
    summonerLevel: 100,
    profileIconId: 4640,
    region: "europe",
    platform: "euw1",
  },
  summary: {
    wins: 110,
    losses: 90,
    winRate: 55,
    averageKda: 3.5,
    matchesAnalyzed: 200,
    averageDamageToChampions: 25000,
    averageKillParticipation: 65,
    averageCsPerMinute: 8.5,
    averageCs: 210,
    averageVisionScore: 18,
    averageGoldEarned: 12000,
    mostPlayedChampions: [{ championName: "Jinx", games: 50, wins: 28, kda: 4.2 }],
  },
  recentMatches: [
    {
      matchId: "EUW1_1",
      championName: "Jinx",
      result: "Win",
      kills: 10,
      deaths: 2,
      assists: 5,
      kda: 7.5,
      cs: 250,
      damageToChampions: 30000,
      killParticipation: 70,
      queueId: 420,
      queueLabel: "Ranked",
      gameCreation: "2026-06-07T10:00:00Z",
      gameDurationSeconds: 1800,
      goldEarned: 14000,
      visionScore: 20,
      items: [{ riotItemId: 3031, name: "Infinity Edge", icon: "/ie.png" }],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useNavigate.mockReturnValue(vi.fn());
  mocks.useParams.mockReturnValue({ gameName: "JinxMain", tagLine: "EUW" });
  mocks.useCurrentUser.mockReturnValue({ data: null });
  mocks.usePlayerSearch.mockReturnValue({ data: undefined, isLoading: false, error: null, isFetching: false });
  mocks.useImportRecentMatches.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  mocks.useGenerateMatchPuzzleSeries.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  mocks.buildRiotProfileIconUrl.mockReturnValue("/icon/4640.png");
  mocks.RiotIdSearch.mockImplementation(() =>
    React.createElement("div", { "data-testid": "riot-id-search" }),
  );
});

describe("PlayerProfile", () => {
  it("shows 'Recherche de Riot ID' when no gameName/tagLine params are provided", () => {
    mocks.useParams.mockReturnValue({});
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("Recherche de Riot ID")).toBeInTheDocument();
  });

  it("shows riotId from params in the hero before data loads", () => {
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("JinxMain#EUW")).toBeInTheDocument();
  });

  it("shows loaded player riotId in the hero section", () => {
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getAllByText("JinxMain#EUW").length).toBeGreaterThan(0);
  });

  it("shows loading panel when isLoading is true", () => {
    mocks.usePlayerSearch.mockReturnValue({ data: undefined, isLoading: true, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText(/chargement du profil riot/i)).toBeInTheDocument();
  });

  it("shows error panel with message when player search fails", () => {
    mocks.usePlayerSearch.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Joueur introuvable"),
      isFetching: false,
    });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText(/impossible de charger ce joueur/i)).toBeInTheDocument();
    expect(screen.getByText("Joueur introuvable")).toBeInTheDocument();
  });

  it("renders profile icon img when buildRiotProfileIconUrl returns a URL", () => {
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    const img = screen.getByAltText("JinxMain#EUW");
    expect(img).toHaveAttribute("src", "/icon/4640.png");
  });

  it("renders initials fallback when buildRiotProfileIconUrl returns null", () => {
    mocks.buildRiotProfileIconUrl.mockReturnValue(null);
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("JI")).toBeInTheDocument();
  });

  it("renders account overview (riotId, region, level) when data is present", () => {
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("europe")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("4640")).toBeInTheDocument();
  });

  it("renders most played champions section", () => {
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("50 parties")).toBeInTheDocument();
    expect(screen.getByText(/28 victoires.*4.2 KDA/i)).toBeInTheDocument();
  });

  it("renders compact stats grid from summary data", () => {
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
  });

  it("renders recent match row with Win result", () => {
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("Victoire")).toBeInTheDocument();
    expect(screen.getByText("Ranked")).toBeInTheDocument();
    expect(screen.getByText("10/2/5")).toBeInTheDocument();
  });

  it("renders match with Defaite for Loss result", () => {
    const lossData = {
      ...playerData,
      recentMatches: [{ ...playerData.recentMatches[0], result: "Loss" }],
    };
    mocks.usePlayerSearch.mockReturnValue({ data: lossData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("Defaite")).toBeInTheDocument();
  });

  it("renders 'Partie recente' when gameCreation is null", () => {
    const noDateData = {
      ...playerData,
      recentMatches: [{ ...playerData.recentMatches[0], gameCreation: null }],
    };
    mocks.usePlayerSearch.mockReturnValue({ data: noDateData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("Partie recente")).toBeInTheDocument();
  });

  it("renders item icon initials fallback when item icon is null", () => {
    const noIconData = {
      ...playerData,
      recentMatches: [{ ...playerData.recentMatches[0], items: [{ riotItemId: 3031, name: "Infinity Edge", icon: null }] }],
    };
    mocks.usePlayerSearch.mockReturnValue({ data: noIconData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("IN")).toBeInTheDocument();
  });

  it("shows Analyser button in match row when user is logged in", () => {
    mocks.useCurrentUser.mockReturnValue({ data: { id: "u1" } });
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText("Analyser")).toBeInTheDocument();
  });

  it("hides Analyser button when user is not logged in", () => {
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(screen.queryByText("Analyser")).not.toBeInTheDocument();
  });

  it("shows 'Charger plus de parties' when match list is at fetch limit", () => {
    const manyMatches = Array.from({ length: 5 }, (_, i) => ({
      ...playerData.recentMatches[0],
      matchId: `EUW1_${i}`,
    }));
    mocks.usePlayerSearch.mockReturnValue({
      data: { ...playerData, recentMatches: manyMatches },
      isLoading: false,
      error: null,
      isFetching: false,
    });
    render(React.createElement(PlayerProfile));
    expect(screen.getByText(/charger plus de parties/i)).toBeInTheDocument();
  });

  it("calls saveRecentRiotSearch with profile data when player loads", () => {
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    render(React.createElement(PlayerProfile));
    expect(mocks.saveRecentRiotSearch).toHaveBeenCalledWith({
      gameName: "JinxMain",
      tagLine: "EUW",
      profileIconId: 4640,
    });
  });

  it("navigates to training when match series is generated successfully via Analyser button", async () => {
    const navigate = vi.fn();
    mocks.useNavigate.mockReturnValue(navigate);
    mocks.useCurrentUser.mockReturnValue({ data: { id: "u1" } });
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    mocks.useImportRecentMatches.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue([{ riotMatchId: "EUW1_1", id: "imported-1" }]),
      isPending: false,
    });
    mocks.useGenerateMatchPuzzleSeries.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ generationStatus: "completed", slug: "series-slug", slugs: ["s1"] }),
      isPending: false,
    });
    render(React.createElement(PlayerProfile));
    fireEvent.click(screen.getByText("Analyser"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/training/series-slug"));
    expect(mocks.savePuzzleSeries).toHaveBeenCalledWith(["s1"]);
  });

  it("navigates to training when hero 'Generer depuis la derniere partie' button is clicked", async () => {
    const navigate = vi.fn();
    mocks.useNavigate.mockReturnValue(navigate);
    mocks.useCurrentUser.mockReturnValue({ data: { id: "u1" } });
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    mocks.useImportRecentMatches.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue([{ riotMatchId: "EUW1_1", id: "imported-1" }]),
      isPending: false,
    });
    mocks.useGenerateMatchPuzzleSeries.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ generationStatus: "completed", slug: "hero-series", slugs: [] }),
      isPending: false,
    });
    render(React.createElement(PlayerProfile));
    fireEvent.click(screen.getByText(/generer une serie depuis la derniere partie/i));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/training/hero-series"));
  });

  it("shows no_viable_snapshot_found failure notice with rejection reasons", async () => {
    mocks.useCurrentUser.mockReturnValue({ data: { id: "u1" } });
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    mocks.useImportRecentMatches.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue([{ riotMatchId: "EUW1_1", id: "imported-1" }]),
      isPending: false,
    });
    mocks.useGenerateMatchPuzzleSeries.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        generationStatus: "no_viable_snapshot_found",
        message: "Aucun snapshot viable dans cette partie.",
        failureCode: "no_viable_snapshot_found",
        snapshotsEvaluated: 5,
        viableSnapshots: 0,
        publishableSnapshots: 0,
        nonPublishableButViableSnapshots: 0,
        dominantRejectionReasons: ["low_gold"],
      }),
      isPending: false,
    });
    render(React.createElement(PlayerProfile));
    fireEvent.click(screen.getByText("Analyser"));
    await waitFor(() => expect(screen.getByText("Aucun snapshot viable dans cette partie.")).toBeInTheDocument());
    expect(screen.getByText(/rejets dominants.*low_gold/i)).toBeInTheDocument();
  });

  it("shows no_publishable_snapshot_found message with viable-but-refused count", async () => {
    mocks.useCurrentUser.mockReturnValue({ data: { id: "u1" } });
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    mocks.useImportRecentMatches.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue([{ riotMatchId: "EUW1_1", id: "imported-1" }]),
      isPending: false,
    });
    mocks.useGenerateMatchPuzzleSeries.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        generationStatus: "no_publishable_snapshot_found",
        failureCode: "no_publishable_snapshot_found",
        snapshotsEvaluated: 3,
        viableSnapshots: 2,
        publishableSnapshots: 0,
        nonPublishableButViableSnapshots: 2,
        dominantRejectionReasons: [],
      }),
      isPending: false,
    });
    render(React.createElement(PlayerProfile));
    fireEvent.click(screen.getByText("Analyser"));
    await waitFor(() =>
      expect(screen.getByText(/aucun moment n'a encore passe la gate/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/snapshots viables mais refuses/i)).toBeInTheDocument();
  });

  it("shows generation error text when import mutateAsync rejects", async () => {
    mocks.useCurrentUser.mockReturnValue({ data: { id: "u1" } });
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    mocks.useImportRecentMatches.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error("Erreur reseau")),
      isPending: false,
    });
    mocks.useGenerateMatchPuzzleSeries.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    render(React.createElement(PlayerProfile));
    fireEvent.click(screen.getByText("Analyser"));
    await waitFor(() => expect(screen.getByText("Erreur reseau")).toBeInTheDocument());
  });

  it("shows fallback error when imported match is not found in import result", async () => {
    mocks.useCurrentUser.mockReturnValue({ data: { id: "u1" } });
    mocks.usePlayerSearch.mockReturnValue({ data: playerData, isLoading: false, error: null, isFetching: false });
    mocks.useImportRecentMatches.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue([{ riotMatchId: "WRONG_MATCH", id: "imported-1" }]),
      isPending: false,
    });
    mocks.useGenerateMatchPuzzleSeries.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    render(React.createElement(PlayerProfile));
    fireEvent.click(screen.getByText("Analyser"));
    await waitFor(() =>
      expect(screen.getByText(/cette partie n'a pas pu etre importee/i)).toBeInTheDocument(),
    );
  });

  it("renders the RiotIdSearch component inside the hero section", () => {
    render(React.createElement(PlayerProfile));
    expect(screen.getByTestId("riot-id-search")).toBeInTheDocument();
  });
});
