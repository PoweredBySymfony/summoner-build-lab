import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("../api/client", () => ({
  apiFetch: mocks.apiFetch,
}));

import {
  useAdminAiGeneratedPuzzles,
  useAdminChampions,
  useAdminDeleteChampion,
  useAdminDeleteItem,
  useAdminDeletePuzzle,
  useAdminItems,
  useAdminOverview,
  useAdminPatchStatus,
  useAdminPublishPuzzle,
  useAdminPuzzleDetail,
  useAdminPuzzles,
  useAdminSyncPatch,
  useAdminUpdateChampion,
  useAdminUpdateItem,
  useAdminUpdatePuzzle,
  useBootstrap,
  useCatalog,
  useChampionLearning,
  useDailyChallenge,
  useDashboard,
  useGenerateChampionPuzzle,
  useGenerateMatchPuzzleSeries,
  useGoogleAuthUrl,
  useImportRecentMatches,
  useLogin,
  useLogout,
  usePlayerSearch,
  usePlayerSuggestions,
  useProgress,
  usePuzzle,
  usePuzzles,
  useRegister,
  useCurrentUser,
} from "../api/hooks";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, Wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiFetch.mockResolvedValue({});
});

// ------- Query hooks -------

describe("useBootstrap", () => {
  it("calls apiFetch /bootstrap", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useBootstrap(), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith("/bootstrap"));
  });
});

describe("useCatalog", () => {
  it("calls apiFetch /catalog", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useCatalog(), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith("/catalog"));
  });
});

describe("usePuzzles", () => {
  it("calls /puzzles without params when none provided", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePuzzles(), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith("/puzzles"));
  });

  it("builds query string with championSlug", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePuzzles({ championSlug: "jinx" }), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/puzzles?championSlug=jinx"),
    );
  });

  it("builds query string with mode and limit", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePuzzles({ mode: "CHAMPION_SPECIFIC", limit: 20 }), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("mode=CHAMPION_SPECIFIC"),
      ),
    );
  });

  it("builds full query string with all params", async () => {
    const { Wrapper } = createWrapper();
    renderHook(
      () => usePuzzles({ championSlug: "lux", mode: "DAILY", limit: 5 }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      const url = mocks.apiFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain("championSlug=lux");
      expect(url).toContain("mode=DAILY");
      expect(url).toContain("limit=5");
    });
  });
});

describe("usePuzzle", () => {
  it("calls /puzzles/:slug when slug provided", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePuzzle("my-puzzle-slug"), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/puzzles/my-puzzle-slug"),
    );
  });

  it("does not call apiFetch when slug is undefined", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePuzzle(undefined), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});

describe("useCurrentUser", () => {
  it("calls /auth/me and extracts .user from response", async () => {
    const user = { id: "user-1", email: "test@test.com" };
    mocks.apiFetch.mockResolvedValue({ user });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCurrentUser(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toEqual(user));
    expect(mocks.apiFetch).toHaveBeenCalledWith("/auth/me");
  });

  it("returns null when .user is null", async () => {
    mocks.apiFetch.mockResolvedValue({ user: null });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCurrentUser(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe("useGoogleAuthUrl", () => {
  it("calls /auth/google/url and extracts .url from response", async () => {
    mocks.apiFetch.mockResolvedValue({ url: "https://accounts.google.com/oauth" });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGoogleAuthUrl(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toBe("https://accounts.google.com/oauth"));
    expect(mocks.apiFetch).toHaveBeenCalledWith("/auth/google/url");
  });
});

describe("useDashboard", () => {
  it("calls /dashboard", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useDashboard(), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith("/dashboard"));
  });
});

describe("useProgress", () => {
  it("calls /progress", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useProgress(), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith("/progress"));
  });
});

describe("useDailyChallenge", () => {
  it("calls /daily-challenge", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useDailyChallenge(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/daily-challenge"),
    );
  });
});

describe("useChampionLearning", () => {
  it("calls /champions/:slug when slug provided", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useChampionLearning("jinx"), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/champions/jinx"),
    );
  });

  it("does not fetch when slug is undefined", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useChampionLearning(undefined), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});

describe("usePlayerSearch", () => {
  it("calls /players/search when riotId provided", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePlayerSearch("Faker#KR1"), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/players/search?riotId="),
      ),
    );
  });

  it("encodes riotId in URL", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePlayerSearch("Faker#KR1", 3), { wrapper: Wrapper });
    await waitFor(() => {
      const url = mocks.apiFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain("count=3");
      expect(url).toContain(encodeURIComponent("Faker#KR1"));
    });
  });

  it("does not fetch when riotId is undefined", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePlayerSearch(undefined), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});

describe("usePlayerSuggestions", () => {
  it("calls /players/suggestions when query provided", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePlayerSuggestions("fak"), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/players/suggestions?q="),
      ),
    );
  });

  it("does not fetch when query is empty", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePlayerSuggestions("   "), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("does not fetch when query is undefined", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePlayerSuggestions(undefined), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});

describe("admin query hooks", () => {
  it("useAdminOverview calls /admin/overview when enabled", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminOverview(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/admin/overview"),
    );
  });

  it("useAdminOverview does not fetch when enabled=false", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminOverview(false), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("useAdminChampions calls /admin/champions", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminChampions(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/admin/champions"),
    );
  });

  it("useAdminChampions does not fetch when disabled", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminChampions(false), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("useAdminItems calls /admin/items", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminItems(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/admin/items"),
    );
  });

  it("useAdminPuzzles calls /admin/puzzles", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminPuzzles(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/admin/puzzles"),
    );
  });

  it("useAdminAiGeneratedPuzzles calls /admin/puzzles/ai-generated", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminAiGeneratedPuzzles(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/admin/puzzles/ai-generated"),
    );
  });

  it("useAdminPuzzleDetail calls /admin/puzzles/:id when id provided", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminPuzzleDetail("puzzle-123"), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/admin/puzzles/puzzle-123"),
    );
  });

  it("useAdminPuzzleDetail does not fetch when id is null", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminPuzzleDetail(null), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("useAdminPatchStatus calls /admin/patch-status", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useAdminPatchStatus(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/admin/patch-status"),
    );
  });
});

// ------- Mutation hooks -------

describe("useRegister", () => {
  it("posts to /auth/register with payload", async () => {
    mocks.apiFetch.mockResolvedValue({ user: { id: "new-user" } });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRegister(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ email: "a@b.com", username: "testuser", password: "secret" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith("/auth/register", expect.objectContaining({ method: "POST" }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "me"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bootstrap"] });
  });
});

describe("useLogin", () => {
  it("posts to /auth/login with credentials", async () => {
    mocks.apiFetch.mockResolvedValue({ user: { id: "user-1" } });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ email: "user@test.com", password: "pass" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith("/auth/login", expect.objectContaining({ method: "POST" }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "me"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bootstrap"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});

describe("useLogout", () => {
  it("posts to /auth/logout and invalidates auth", async () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "me"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bootstrap"] });
  });
});

describe("useGenerateChampionPuzzle", () => {
  it("posts to /generated-puzzles/champion and invalidates puzzles+dashboard", async () => {
    mocks.apiFetch.mockResolvedValue({ slug: "jinx-puzzle", slugs: ["jinx-puzzle"] });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useGenerateChampionPuzzle(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate({ championId: "champ-123" }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/generated-puzzles/champion",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("champ-123") }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["puzzles"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});

describe("useImportRecentMatches", () => {
  it("posts to /riot/import-matches with puuid and count", async () => {
    mocks.apiFetch.mockResolvedValue([{ id: "match-1", riotMatchId: "EUW1_123" }]);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useImportRecentMatches(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate({ puuid: "puuid-abc", count: 5 }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/riot/import-matches",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("puuid-abc") }),
    );
  });
});

describe("useGenerateMatchPuzzleSeries", () => {
  it("posts to /generated-puzzles/match and invalidates puzzles+dashboard", async () => {
    mocks.apiFetch.mockResolvedValue({ slug: "match-puzzle", slugs: ["match-puzzle"] });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useGenerateMatchPuzzleSeries(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate({ importedMatchId: "match-id-1" }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/generated-puzzles/match",
      expect.objectContaining({ method: "POST" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["puzzles"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});

describe("useAdminUpdateChampion", () => {
  it("patches /admin/champions/:id and invalidates admin+catalog+bootstrap", async () => {
    mocks.apiFetch.mockResolvedValue({ id: "champ-1", slug: "jinx" });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAdminUpdateChampion(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ id: "champ-1", data: { isActive: true } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/champions/champ-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "champions"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["catalog"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bootstrap"] });
  });
});

describe("useAdminUpdateItem", () => {
  it("patches /admin/items/:id", async () => {
    mocks.apiFetch.mockResolvedValue({ id: "item-1" });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAdminUpdateItem(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ id: "item-1", data: { isActive: false } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/items/item-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "items"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["catalog"] });
  });
});

describe("useAdminUpdatePuzzle", () => {
  it("patches /admin/puzzles/:id and invalidates all puzzle-related keys", async () => {
    mocks.apiFetch.mockResolvedValue({ id: "puzzle-1" });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAdminUpdatePuzzle(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({ id: "puzzle-1", data: { published: true } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/puzzles/puzzle-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "puzzles"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "puzzles", "ai-generated"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "puzzle", "puzzle-1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["puzzles"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-challenge"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});

describe("useAdminPublishPuzzle", () => {
  it("posts to /admin/puzzles/:id/publish and invalidates puzzle keys", async () => {
    mocks.apiFetch.mockResolvedValue({ id: "puzzle-2" });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAdminPublishPuzzle(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate("puzzle-2"); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/puzzles/puzzle-2/publish",
      expect.objectContaining({ method: "POST" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "puzzle", "puzzle-2"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["puzzles"] });
  });
});

describe("useAdminSyncPatch", () => {
  it("posts to /admin/patch-sync and invalidates admin+catalog+bootstrap+puzzles", async () => {
    mocks.apiFetch.mockResolvedValue({ result: {}, status: {} });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAdminSyncPatch(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate({ version: "16.8" }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/patch-sync",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("16.8") }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["catalog"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bootstrap"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["puzzles"] });
  });

  it("sends empty body when no version provided", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAdminSyncPatch(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/patch-sync",
      expect.objectContaining({ body: "{}" }),
    );
  });
});

describe("useAdminDeleteChampion", () => {
  it("deletes /admin/champions/:id and invalidates catalog", async () => {
    mocks.apiFetch.mockResolvedValue({ deleted: true });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAdminDeleteChampion(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate("champ-99"); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/champions/champ-99",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "champions"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["catalog"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bootstrap"] });
  });
});

describe("useAdminDeleteItem", () => {
  it("deletes /admin/items/:id and invalidates catalog", async () => {
    mocks.apiFetch.mockResolvedValue({ deleted: true });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAdminDeleteItem(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate("item-99"); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/items/item-99",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "items"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["catalog"] });
  });
});

describe("useAdminDeletePuzzle", () => {
  it("deletes /admin/puzzles/:id and invalidates puzzle-related keys", async () => {
    mocks.apiFetch.mockResolvedValue({ deleted: true });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAdminDeletePuzzle(), { wrapper: Wrapper });

    await act(async () => { result.current.mutate("puzzle-del-1"); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/admin/puzzles/puzzle-del-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "puzzles"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "puzzles", "ai-generated"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["puzzles"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-challenge"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});
