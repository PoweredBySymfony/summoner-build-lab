import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  usePlayerSuggestions: vi.fn(),
  getRecentRiotSearches: vi.fn(),
  normalizeRiotIdInput: vi.fn((v: string) => v.replace(/\s+/g, " ").trim()),
  parseRiotIdInput: vi.fn(),
  removeRecentRiotSearch: vi.fn(),
  subscribeToRecentRiotSearches: vi.fn(),
  buildRiotProfileIconUrl: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/api/hooks", () => ({ usePlayerSuggestions: mocks.usePlayerSuggestions }));
vi.mock("@/lib/riotSearch", () => ({
  getRecentRiotSearches: mocks.getRecentRiotSearches,
  normalizeRiotIdInput: mocks.normalizeRiotIdInput,
  parseRiotIdInput: mocks.parseRiotIdInput,
  removeRecentRiotSearch: mocks.removeRecentRiotSearch,
  subscribeToRecentRiotSearches: mocks.subscribeToRecentRiotSearches,
  buildRiotProfileIconUrl: mocks.buildRiotProfileIconUrl,
}));

vi.mock("lucide-react", () => ({
  Search: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "icon-search", className }),
  X: () => React.createElement("span", { "data-testid": "icon-x" }),
  Clock3: () => React.createElement("span", { "data-testid": "icon-clock" }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, type }: { children: React.ReactNode; type?: string }) =>
    React.createElement("button", { type, "data-testid": "submit-btn" }, children),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement("input", { ...props, "data-testid": "riot-id-input" }),
}));

import { RiotIdSearch } from "../components/RiotIdSearch";

const setup = (props: { defaultValue?: string; compact?: boolean } = {}) =>
  render(React.createElement(RiotIdSearch, props));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.normalizeRiotIdInput.mockImplementation((v: string) => v.replace(/\s+/g, " ").trim());
  mocks.getRecentRiotSearches.mockReturnValue([]);
  mocks.subscribeToRecentRiotSearches.mockReturnValue(() => undefined);
  mocks.usePlayerSuggestions.mockReturnValue({ data: [], isLoading: false });
  mocks.parseRiotIdInput.mockReturnValue(null);
  mocks.buildRiotProfileIconUrl.mockReturnValue(null);
});

describe("RiotIdSearch", () => {
  describe("basic rendering", () => {
    it("renders the search input", () => {
      setup();
      expect(screen.getByTestId("riot-id-input")).toBeInTheDocument();
    });

    it("renders the submit button", () => {
      setup();
      expect(screen.getByTestId("submit-btn")).toBeInTheDocument();
    });

    it("renders with default value normalized", () => {
      mocks.normalizeRiotIdInput.mockReturnValue("Hide on bush#KR1");
      setup({ defaultValue: "Hide on bush#KR1" });
      expect(screen.getByTestId("riot-id-input")).toHaveValue("Hide on bush#KR1");
    });

    it("renders the label text", () => {
      setup();
      expect(screen.getByText("Recherche joueur")).toBeInTheDocument();
    });

    it("renders description text when not compact", () => {
      setup({ compact: false });
      expect(screen.getByText(/Au focus/)).toBeInTheDocument();
    });

    it("does not render description text in compact mode", () => {
      setup({ compact: true });
      expect(screen.queryByText(/Au focus/)).not.toBeInTheDocument();
    });

    it("does not show panel initially", () => {
      setup();
      expect(screen.queryByTestId("icon-clock")).not.toBeInTheDocument();
    });
  });

  describe("panel opening", () => {
    it("opens panel on input focus — shows clock icon", () => {
      setup();
      fireEvent.focus(screen.getByTestId("riot-id-input"));
      expect(screen.getByTestId("icon-clock")).toBeInTheDocument();
    });

    it("shows empty recent searches hint when no text", () => {
      setup();
      fireEvent.focus(screen.getByTestId("riot-id-input"));
      expect(screen.getByText(/Commence par rechercher/)).toBeInTheDocument();
    });

    it("shows 'Dernieres recherches' header when focused with no input", () => {
      setup();
      fireEvent.focus(screen.getByTestId("riot-id-input"));
      expect(screen.getByText("Dernieres recherches")).toBeInTheDocument();
    });

    it("shows 'Suggestions joueurs' header when typing", () => {
      setup();
      fireEvent.change(screen.getByTestId("riot-id-input"), { target: { value: "F" } });
      expect(screen.queryByText(/Suggestions joueurs/i)).toBeInTheDocument();
    });
  });

  describe("typing in the input", () => {
    it("updates input value on change", () => {
      setup();
      const input = screen.getByTestId("riot-id-input");
      fireEvent.change(input, { target: { value: "Faker" } });
      expect(input).toHaveValue("Faker");
    });

    it("opens panel on input change", () => {
      setup();
      fireEvent.change(screen.getByTestId("riot-id-input"), { target: { value: "F" } });
      expect(screen.getByTestId("icon-clock")).toBeInTheDocument();
    });

    it("shows loading state while fetching suggestions", () => {
      mocks.usePlayerSuggestions.mockReturnValue({ data: undefined, isLoading: true });
      setup();
      fireEvent.change(screen.getByTestId("riot-id-input"), { target: { value: "Faker" } });
      expect(screen.getByText(/Recherche de comptes connus en cours/)).toBeInTheDocument();
    });

    it("shows no remote suggestions message when empty results", () => {
      setup();
      fireEvent.change(screen.getByTestId("riot-id-input"), { target: { value: "Faker" } });
      expect(screen.getByText(/Aucune suggestion distante/)).toBeInTheDocument();
    });
  });

  describe("recent searches display", () => {
    it("displays recent searches when panel opens without input", () => {
      mocks.getRecentRiotSearches.mockReturnValue([
        { riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1", profileIconId: null },
      ]);
      setup();
      fireEvent.focus(screen.getByTestId("riot-id-input"));
      expect(screen.getByText("Faker")).toBeInTheDocument();
    });

    it("shows profile icon img when URL is available", () => {
      mocks.getRecentRiotSearches.mockReturnValue([
        { riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1", profileIconId: 1234 },
      ]);
      mocks.buildRiotProfileIconUrl.mockReturnValue("https://example.com/icon.png");
      setup();
      fireEvent.focus(screen.getByTestId("riot-id-input"));
      expect(screen.getByRole("img")).toBeInTheDocument();
    });

    it("shows initials when no profile icon URL", () => {
      mocks.getRecentRiotSearches.mockReturnValue([
        { riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1", profileIconId: null },
      ]);
      mocks.buildRiotProfileIconUrl.mockReturnValue(null);
      setup();
      fireEvent.focus(screen.getByTestId("riot-id-input"));
      expect(screen.getByText("FA")).toBeInTheDocument();
    });

    it("shows remove button for recent searches", () => {
      mocks.getRecentRiotSearches.mockReturnValue([
        { riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1", profileIconId: null },
      ]);
      mocks.buildRiotProfileIconUrl.mockReturnValue(null);
      setup();
      fireEvent.focus(screen.getByTestId("riot-id-input"));
      expect(screen.getByTestId("icon-x")).toBeInTheDocument();
    });

    it("calls removeRecentRiotSearch when X button clicked", () => {
      mocks.getRecentRiotSearches.mockReturnValue([
        { riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1", profileIconId: null },
      ]);
      mocks.buildRiotProfileIconUrl.mockReturnValue(null);
      setup();
      fireEvent.focus(screen.getByTestId("riot-id-input"));
      const removeBtn = screen.getByLabelText("Remove Faker#KR1 from recent searches");
      fireEvent.click(removeBtn);
      expect(mocks.removeRecentRiotSearch).toHaveBeenCalledWith("Faker#KR1");
    });
  });

  describe("remote suggestions", () => {
    it("displays remote suggestion when typing a riot ID", () => {
      mocks.usePlayerSuggestions.mockReturnValue({
        data: [{ riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1", platform: "KR" }],
        isLoading: false,
      });
      setup();
      fireEvent.change(screen.getByTestId("riot-id-input"), { target: { value: "Faker" } });
      expect(screen.getByText("Faker")).toBeInTheDocument();
    });

    it("shows current input as exact search suggestion", () => {
      mocks.parseRiotIdInput.mockReturnValue({ riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1" });
      setup();
      fireEvent.change(screen.getByTestId("riot-id-input"), { target: { value: "Faker#KR1" } });
      expect(screen.getByText("Recherche exacte")).toBeInTheDocument();
    });

    it("deduplicates same riotId from current and remote", () => {
      mocks.parseRiotIdInput.mockReturnValue({ riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1" });
      mocks.usePlayerSuggestions.mockReturnValue({
        data: [{ riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1", platform: "KR" }],
        isLoading: false,
      });
      setup();
      fireEvent.change(screen.getByTestId("riot-id-input"), { target: { value: "Faker#KR1" } });
      const matches = screen.getAllByText("Faker");
      expect(matches.length).toBe(1);
    });
  });

  describe("form submission", () => {
    it("navigates to player profile on valid submit", () => {
      mocks.parseRiotIdInput.mockReturnValue({ riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1" });
      setup();
      const input = screen.getByTestId("riot-id-input");
      fireEvent.change(input, { target: { value: "Faker#KR1" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
      expect(mocks.navigate).toHaveBeenCalledWith("/players/Faker/KR1");
    });

    it("does not navigate when riot ID is invalid", () => {
      setup();
      const input = screen.getByTestId("riot-id-input");
      fireEvent.change(input, { target: { value: "invalid" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
      expect(mocks.navigate).not.toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    it("Escape closes the panel", () => {
      mocks.usePlayerSuggestions.mockReturnValue({
        data: [{ riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1", platform: "KR" }],
        isLoading: false,
      });
      setup();
      const input = screen.getByTestId("riot-id-input");
      fireEvent.change(input, { target: { value: "Faker" } });
      expect(screen.getByText("Faker")).toBeInTheDocument();
      fireEvent.keyDown(input, { key: "Escape" });
      expect(screen.queryByText("Faker")).not.toBeInTheDocument();
    });

    it("ArrowDown cycles through suggestions without crashing", () => {
      mocks.parseRiotIdInput.mockReturnValue({ riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1" });
      setup();
      const input = screen.getByTestId("riot-id-input");
      fireEvent.change(input, { target: { value: "Faker#KR1" } });
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });

    it("ArrowUp cycles through suggestions without crashing", () => {
      mocks.parseRiotIdInput.mockReturnValue({ riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1" });
      setup();
      const input = screen.getByTestId("riot-id-input");
      fireEvent.change(input, { target: { value: "Faker#KR1" } });
      fireEvent.keyDown(input, { key: "ArrowUp" });
    });

    it("Enter with active suggestion navigates to profile", () => {
      mocks.parseRiotIdInput.mockReturnValue({ riotId: "Faker#KR1", gameName: "Faker", tagLine: "KR1" });
      setup();
      const input = screen.getByTestId("riot-id-input");
      fireEvent.change(input, { target: { value: "Faker#KR1" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(mocks.navigate).toHaveBeenCalledWith("/players/Faker/KR1");
    });

    it("key events do nothing when panel is closed", () => {
      setup();
      const input = screen.getByTestId("riot-id-input");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowUp" });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(mocks.navigate).not.toHaveBeenCalled();
    });
  });

  describe("pointer down outside panel closes it", () => {
    it("closes panel when clicking outside", async () => {
      setup();
      const input = screen.getByTestId("riot-id-input");
      fireEvent.focus(input);
      expect(screen.getByTestId("icon-clock")).toBeInTheDocument();

      await act(async () => {
        fireEvent.pointerDown(document);
      });

      await waitFor(() => {
        expect(screen.queryByTestId("icon-clock")).not.toBeInTheDocument();
      });
    });
  });

  describe("subscribeToRecentRiotSearches", () => {
    it("subscribes to recent search updates on mount", () => {
      setup();
      expect(mocks.subscribeToRecentRiotSearches).toHaveBeenCalled();
    });

    it("unsubscribes on unmount", () => {
      const unsubscribe = vi.fn();
      mocks.subscribeToRecentRiotSearches.mockReturnValue(unsubscribe);
      const { unmount } = setup();
      unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe("defaultValue prop", () => {
    it("updates riotId when defaultValue prop changes", () => {
      mocks.normalizeRiotIdInput.mockImplementation((v: string) => v);
      const { rerender } = setup({ defaultValue: "Faker#KR1" });
      rerender(React.createElement(RiotIdSearch, { defaultValue: "T1#T1" }));
      expect(screen.getByTestId("riot-id-input")).toHaveValue("T1#T1");
    });
  });
});
