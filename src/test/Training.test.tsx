import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePuzzle: vi.fn(),
  usePuzzles: vi.fn(),
  useCurrentUser: vi.fn(),
  useNavigate: vi.fn(),
  useParams: vi.fn(),
  useMutation: vi.fn(),
  apiFetch: vi.fn(),
  getNextPuzzleSlug: vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  usePuzzle: mocks.usePuzzle,
  usePuzzles: mocks.usePuzzles,
  useCurrentUser: mocks.useCurrentUser,
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

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useMutation: mocks.useMutation };
});

vi.mock("../api/client", () => ({ apiFetch: mocks.apiFetch }));

vi.mock("../components/ItemIcon", () => ({
  ItemIcon: vi.fn(({ item }: { item: { name: string } }) => React.createElement("div", { "data-testid": "item-icon" }, item?.name)),
}));

vi.mock("../components/ChampionPortrait", () => ({
  default: vi.fn(({ champion }: { champion: { name: string } }) =>
    React.createElement("div", { "data-testid": "champion-portrait" }, champion?.name)),
}));

vi.mock("../components/PuzzleItemExplanationDialog", () => ({
  PuzzleItemExplanationDialog: vi.fn(() => React.createElement("div", { "data-testid": "explanation-dialog" })),
}));

vi.mock("../lib/puzzleSeries", () => ({
  getNextPuzzleSlug: mocks.getNextPuzzleSlug,
}));

import Training from "../pages/Training";

const champion = {
  id: "c1",
  databaseId: "c1",
  name: "Jinx",
  slug: "jinx",
  icon: "/jinx.png",
  image: "/jinx.png",
  roles: ["ADC"],
  tags: ["Marksman"],
  stats: { attackdamage: 59 },
  patch: "16.7",
  isActive: true,
};

const item = {
  id: "i1",
  databaseId: "i1",
  riotItemId: 3031,
  name: "Infinity Edge",
  slug: "infinity-edge",
  icon: "/ie.png",
  image: "/ie.png",
  cost: 3400,
  baseCost: 1000,
  sellPrice: 2380,
  category: "damage",
  tags: ["Damage"],
  itemGroups: [],
  stats: {},
  shortDescription: "Critical hit item",
  fullDescription: null,
  activeEffect: null,
  passiveEffect: null,
  buildsFrom: [],
  buildsInto: [],
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  patch: "16.7",
};

const puzzle = {
  id: "p1",
  slug: "jinx-next-item",
  title: "What to buy next?",
  description: "Choose the best item",
  shortPrompt: "Best item right now?",
  situation: "You are at 2000 gold after a kill.",
  question: "What do you buy?",
  explanation: "IE is the best choice here.",
  difficulty: "BEGINNER",
  difficultyKey: "BEGINNER",
  mode: "CHAMPION_SPECIFIC",
  modeKey: "CHAMPION_SPECIFIC",
  patch: "16.7",
  role: "ADC",
  roleKey: "ADC",
  sourceType: "MANUAL",
  isPublished: true,
  isDailyEligible: true,
  champion,
  tags: [],
  choiceCount: 2,
  scenario: {
    playerChampion: champion,
    playerRole: "ADC",
    gameMinute: 15,
    playerGold: 2000,
    kills: 2,
    deaths: 1,
    assists: 3,
    cs: 120,
    currentBuild: [item],
    allyTeam: [{ id: "ally-1", name: "Thresh", champion, role: "SUPPORT", items: [] }],
    enemyTeam: [{ id: "enemy-1", name: "Lux", champion, role: "MID", items: [item] }],
    objectiveState: { Dragon: "available" },
    damageProfile: { type: "physical" },
    mapState: { side: "blue" },
    notes: "Watch out for Lux ult.",
  },
  choices: [
    {
      id: "ch1",
      label: "Infinity Edge",
      choiceType: "item",
      item,
      textFallback: null,
      explanation: "Best crit item for Jinx.",
      isCorrect: true,
      displayOrder: 0,
    },
    {
      id: "ch2",
      label: "Kraken Slayer",
      choiceType: "item",
      item: { ...item, id: "i2", name: "Kraken Slayer", slug: "kraken-slayer" },
      textFallback: null,
      explanation: "Anti-tank item.",
      isCorrect: false,
      displayOrder: 1,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useNavigate.mockReturnValue(vi.fn());
  mocks.useParams.mockReturnValue({ slug: "jinx-next-item" });
  mocks.useCurrentUser.mockReturnValue({ data: null });
  mocks.usePuzzle.mockReturnValue({ data: puzzle, isLoading: false });
  mocks.usePuzzles.mockReturnValue({ data: [] });
  mocks.useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined });
  mocks.getNextPuzzleSlug.mockReturnValue(null);
});

describe("Training", () => {
  it("shows loading state while puzzle is fetched", () => {
    mocks.usePuzzle.mockReturnValue({ data: undefined, isLoading: true });
    render(React.createElement(Training));
    expect(screen.getByText(/chargement du puzzle/i)).toBeInTheDocument();
  });

  it("shows loading state when data is null", () => {
    mocks.usePuzzle.mockReturnValue({ data: null, isLoading: false });
    render(React.createElement(Training));
    expect(screen.getByText(/chargement du puzzle/i)).toBeInTheDocument();
  });

  it("shows no puzzle selected when slug is absent", () => {
    mocks.useParams.mockReturnValue({ slug: undefined });
    render(React.createElement(Training));
    expect(screen.getByText(/aucun puzzle selectionne/i)).toBeInTheDocument();
    expect(screen.getByText(/ouvrir les modules/i)).toBeInTheDocument();
  });

  it("renders puzzle title, situation and choices", () => {
    render(React.createElement(Training));
    expect(screen.getByText("What to buy next?")).toBeInTheDocument();
    expect(screen.getByText(/You are at 2000 gold/)).toBeInTheDocument();
    expect(screen.getAllByText("Infinity Edge").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kraken Slayer").length).toBeGreaterThan(0);
  });

  it("renders puzzle scenario with player stats and team info", () => {
    render(React.createElement(Training));
    expect(screen.getByText("15:00")).toBeInTheDocument();
    expect(screen.getByText("2000 or")).toBeInTheDocument();
    expect(screen.getByText("2/1/3")).toBeInTheDocument();
    expect(screen.getByText("120 cs")).toBeInTheDocument();
    expect(screen.getByText("Watch out for Lux ult.")).toBeInTheDocument();
  });

  it("renders tactical entries from objectiveState, damageProfile, mapState", () => {
    render(React.createElement(Training));
    expect(screen.getByText("Dragon")).toBeInTheDocument();
    expect(screen.getByText("available")).toBeInTheDocument();
    expect(screen.getByText("type")).toBeInTheDocument();
    expect(screen.getByText("physical")).toBeInTheDocument();
  });

  it("shows ally and enemy team rows", () => {
    render(React.createElement(Training));
    expect(screen.getByText(/equipe alliee/i)).toBeInTheDocument();
    expect(screen.getByText(/equipe ennemie/i)).toBeInTheDocument();
  });

  it("disables submit button before a choice is selected", () => {
    render(React.createElement(Training));
    const submitBtn = screen.getByText(/valider/i);
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button after selecting a choice", () => {
    render(React.createElement(Training));
    const choiceButtons = screen.getAllByRole("button");
    const infinityBtn = choiceButtons.find((btn) => btn.textContent?.includes("Infinity Edge"));
    expect(infinityBtn).toBeDefined();
    fireEvent.click(infinityBtn!);
    expect(screen.getByText(/valider/i)).not.toBeDisabled();
  });

  it("calls mutate when submit is clicked after selecting a choice", () => {
    const mutate = vi.fn();
    mocks.useMutation.mockReturnValue({ mutate, isPending: false, data: undefined });
    render(React.createElement(Training));

    const choiceButtons = screen.getAllByRole("button");
    const infinityBtn = choiceButtons.find((btn) => btn.textContent?.includes("Infinity Edge"));
    fireEvent.click(infinityBtn!);
    fireEvent.click(screen.getByText(/valider/i));
    expect(mutate).toHaveBeenCalledWith("ch1");
  });

  function withOnSuccessMutation(resultOverrides: Record<string, unknown> = {}) {
    const resultPayload = {
      isCorrect: true,
      correctChoiceId: "ch1",
      explanation: "IE is great here.",
      globalExplanation: "Crit scaling is optimal.",
      saved: true,
      requiresAuth: false,
      ...resultOverrides,
    };
    mocks.useMutation.mockImplementation((config: { onSuccess?: (d: unknown) => void }) => ({
      mutate: vi.fn((choiceId: unknown) => { config.onSuccess?.(resultPayload); }),
      isPending: false,
    }));
    return resultPayload;
  }

  function selectAndSubmit() {
    const buttons = screen.getAllByRole("button");
    const choiceBtn = buttons.find((b) => b.textContent?.includes("Infinity Edge"));
    fireEvent.click(choiceBtn!);
    fireEvent.click(screen.getByText(/valider/i));
  }

  it("shows correct result panel on correct answer", () => {
    withOnSuccessMutation({ isCorrect: true });
    render(React.createElement(Training));
    selectAndSubmit();
    expect(screen.getByText(/bonne lecture/i)).toBeInTheDocument();
    expect(screen.getByText("IE is great here.")).toBeInTheDocument();
    expect(screen.getByText("Crit scaling is optimal.")).toBeInTheDocument();
  });

  it("shows wrong result panel on incorrect answer", () => {
    withOnSuccessMutation({ isCorrect: false, correctChoiceId: "ch1", explanation: "Kraken is situational.", globalExplanation: "You need crit first." });
    render(React.createElement(Training));
    selectAndSubmit();
    expect(screen.getByText(/achat moins coherent/i)).toBeInTheDocument();
    expect(screen.getByText("Kraken is situational.")).toBeInTheDocument();
  });

  it("shows auth notice when answer was not saved", () => {
    withOnSuccessMutation({ requiresAuth: true, saved: false });
    render(React.createElement(Training));
    selectAndSubmit();
    expect(screen.getByText(/cree un compte/i)).toBeInTheDocument();
  });

  it("shows next puzzle navigation when getNextPuzzleSlug returns a slug", () => {
    mocks.getNextPuzzleSlug.mockReturnValue("jinx-next-item-2");
    withOnSuccessMutation();
    render(React.createElement(Training));
    selectAndSubmit();
    expect(screen.getByText(/question suivante/i)).toBeInTheDocument();
  });

  it("finds next puzzle from same champion when no series slug exists", () => {
    mocks.getNextPuzzleSlug.mockReturnValue(null);
    mocks.usePuzzles.mockReturnValue({
      data: [{ id: "p2", slug: "jinx-second-puzzle", champion: { slug: "jinx" } }],
    });
    withOnSuccessMutation({ isCorrect: false });
    render(React.createElement(Training));
    selectAndSubmit();
    expect(screen.getByText(/autre puzzle du meme champion/i)).toBeInTheDocument();
  });

  it("renders puzzle without a scenario gracefully", () => {
    const puzzleNoScenario = { ...puzzle, scenario: null };
    mocks.usePuzzle.mockReturnValue({ data: puzzleNoScenario, isLoading: false });
    render(React.createElement(Training));
    expect(screen.getByText("What to buy next?")).toBeInTheDocument();
  });

  it("shows logged-in user message in result panel", () => {
    mocks.useCurrentUser.mockReturnValue({ data: { id: "u1", email: "user@test.com" } });
    render(React.createElement(Training));
    expect(screen.getByText(/ta reponse sera enregistree/i)).toBeInTheDocument();
  });

  it("renders empty ally and enemy teams with placeholder text", () => {
    const puzzleNoTeams = {
      ...puzzle,
      scenario: { ...puzzle.scenario, allyTeam: [], enemyTeam: [] },
    };
    mocks.usePuzzle.mockReturnValue({ data: puzzleNoTeams, isLoading: false });
    render(React.createElement(Training));
    expect(screen.getAllByText(/donnees d'equipe indisponibles/i).length).toBeGreaterThan(0);
  });

  it("renders build items in the current build section", () => {
    render(React.createElement(Training));
    expect(screen.getAllByTestId("item-icon").length).toBeGreaterThan(0);
  });
});
