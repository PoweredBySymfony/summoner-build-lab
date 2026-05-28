import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  BootstrapPayload,
  AdminChampionUpdatePayload,
  AdminItemUpdatePayload,
  AdminOverviewPayload,
  AdminPatchStatusPayload,
  AdminPuzzleUpdatePayload,
  CatalogPayload,
  ChampionView,
  ChampionLearningPayload,
  CurrentUser,
  DailyChallengePayload,
  DashboardPayload,
  GameItem,
  GeneratedMatchPuzzleResponse,
  GeneratedPuzzleSeriesPayload,
  PlayerAutocompleteSuggestion,
  PlayerSearchPayload,
  ProgressOverview,
  PuzzleDetail,
  PuzzleListItem,
} from "@/types/domain";

export const useBootstrap = () =>
  useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => apiFetch<BootstrapPayload>("/bootstrap"),
  });

export const useCatalog = () =>
  useQuery({
    queryKey: ["catalog"],
    queryFn: () => apiFetch<CatalogPayload>("/catalog"),
  });

export const usePuzzles = (params?: { championSlug?: string; mode?: string; limit?: number }) =>
  useQuery({
    queryKey: ["puzzles", params],
    queryFn: () => {
      const query = new URLSearchParams();
      if (params?.championSlug) query.set("championSlug", params.championSlug);
      if (params?.mode) query.set("mode", params.mode);
      if (params?.limit) query.set("limit", String(params.limit));
      return apiFetch<PuzzleListItem[]>(`/puzzles${query.toString() ? `?${query.toString()}` : ""}`);
    },
  });

export const usePuzzle = (slug: string | undefined) =>
  useQuery({
    queryKey: ["puzzle", slug],
    queryFn: () => apiFetch<PuzzleDetail>(`/puzzles/${slug}`),
    enabled: Boolean(slug),
  });

export const useCurrentUser = () =>
  useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await apiFetch<{ user: CurrentUser | null }>("/auth/me")).user,
  });

export const useGoogleAuthUrl = () =>
  useQuery({
    queryKey: ["auth", "google-url"],
    queryFn: async () => (await apiFetch<{ url: string }>("/auth/google/url")).url,
    retry: false,
  });

export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardPayload>("/dashboard"),
  });

export const useProgress = () =>
  useQuery({
    queryKey: ["progress"],
    queryFn: () => apiFetch<ProgressOverview>("/progress"),
  });

export const useDailyChallenge = () =>
  useQuery({
    queryKey: ["daily-challenge"],
    queryFn: () => apiFetch<DailyChallengePayload>("/daily-challenge"),
  });

export const useChampionLearning = (slug: string | undefined) =>
  useQuery({
    queryKey: ["champion-learning", slug],
    queryFn: () => apiFetch<ChampionLearningPayload>(`/champions/${slug}`),
    enabled: Boolean(slug),
  });

export const useRegister = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; username: string; password: string }) => apiFetch<{ user: CurrentUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; password: string }) => apiFetch<{ user: CurrentUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
};

export const useGenerateChampionPuzzle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { championId: string }) => apiFetch<GeneratedPuzzleSeriesPayload>("/generated-puzzles/champion", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["puzzles"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useImportRecentMatches = () =>
  useMutation({
    mutationFn: (payload: { puuid: string; count?: number }) => apiFetch<Array<{ id: string; riotMatchId: string }>>("/riot/import-matches", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  });

export const useGenerateMatchPuzzleSeries = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { importedMatchId: string }) => apiFetch<GeneratedMatchPuzzleResponse>("/generated-puzzles/match", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["puzzles"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const usePlayerSearch = (riotId: string | undefined, count = 5) =>
  useQuery({
    queryKey: ["players", riotId, count],
    queryFn: () => apiFetch<PlayerSearchPayload>(`/players/search?riotId=${encodeURIComponent(riotId ?? "")}&count=${count}`),
    enabled: Boolean(riotId),
    retry: false,
  });

export const usePlayerSuggestions = (query: string | undefined, count = 8) =>
  useQuery({
    queryKey: ["players", "suggestions", query, count],
    queryFn: () => apiFetch<PlayerAutocompleteSuggestion[]>(`/players/suggestions?q=${encodeURIComponent(query ?? "")}&count=${count}`),
    enabled: Boolean(query?.trim()),
    retry: false,
  });

export const useAdminOverview = (enabled = true) =>
  useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch<AdminOverviewPayload>("/admin/overview"),
    enabled,
  });

export const useAdminChampions = (enabled = true) =>
  useQuery({
    queryKey: ["admin", "champions"],
    queryFn: () => apiFetch<ChampionView[]>("/admin/champions"),
    enabled,
  });

export const useAdminItems = (enabled = true) =>
  useQuery({
    queryKey: ["admin", "items"],
    queryFn: () => apiFetch<GameItem[]>("/admin/items"),
    enabled,
  });

export const useAdminPuzzles = (enabled = true) =>
  useQuery({
    queryKey: ["admin", "puzzles"],
    queryFn: () => apiFetch<PuzzleListItem[]>("/admin/puzzles"),
    enabled,
  });

export const useAdminAiGeneratedPuzzles = (enabled = true) =>
  useQuery({
    queryKey: ["admin", "puzzles", "ai-generated"],
    queryFn: () => apiFetch<PuzzleListItem[]>("/admin/puzzles/ai-generated"),
    enabled,
  });

export const useAdminPuzzleDetail = (id: string | null, enabled = true) =>
  useQuery({
    queryKey: ["admin", "puzzle", id],
    queryFn: () => apiFetch<PuzzleDetail>(`/admin/puzzles/${id}`),
    enabled: Boolean(id) && enabled,
  });

export const useAdminPatchStatus = (enabled = true) =>
  useQuery({
    queryKey: ["admin", "patch-status"],
    queryFn: () => apiFetch<AdminPatchStatusPayload>("/admin/patch-status"),
    enabled,
  });

export const useAdminUpdateChampion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; data: AdminChampionUpdatePayload }) =>
      apiFetch<ChampionView>(`/admin/champions/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload.data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "champions"] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
};

export const useAdminUpdateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; data: AdminItemUpdatePayload }) =>
      apiFetch<GameItem>(`/admin/items/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload.data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "items"] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
};

export const useAdminUpdatePuzzle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; data: AdminPuzzleUpdatePayload }) =>
      apiFetch<PuzzleDetail>(`/admin/puzzles/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload.data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "puzzles"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "puzzles", "ai-generated"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "puzzle", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["puzzles"] });
      queryClient.invalidateQueries({ queryKey: ["daily-challenge"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useAdminPublishPuzzle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<PuzzleDetail>(`/admin/puzzles/${id}/publish`, { method: "POST" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "puzzles"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "puzzles", "ai-generated"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "puzzle", id] });
      queryClient.invalidateQueries({ queryKey: ["puzzles"] });
      queryClient.invalidateQueries({ queryKey: ["daily-challenge"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useAdminSyncPatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: { version?: string }) =>
      apiFetch<{ result: unknown; status: AdminPatchStatusPayload }>("/admin/patch-sync", {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["puzzles"] });
    },
  });
};

export const useAdminDeleteChampion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: boolean }>(`/admin/champions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "champions"] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
};

export const useAdminDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: boolean }>(`/admin/items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "items"] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
};

export const useAdminDeletePuzzle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: boolean }>(`/admin/puzzles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "puzzles"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "puzzles", "ai-generated"] });
      queryClient.invalidateQueries({ queryKey: ["puzzles"] });
      queryClient.invalidateQueries({ queryKey: ["daily-challenge"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};
