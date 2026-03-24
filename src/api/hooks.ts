import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  BootstrapPayload,
  CatalogPayload,
  ChampionLearningPayload,
  CurrentUser,
  DailyChallengePayload,
  DashboardPayload,
  GeneratedPuzzleSeriesPayload,
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
    mutationFn: (payload: { importedMatchId: string }) => apiFetch<GeneratedPuzzleSeriesPayload>("/generated-puzzles/match", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["puzzles"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const usePlayerSearch = (riotId: string | undefined) =>
  useQuery({
    queryKey: ["players", riotId],
    queryFn: () => apiFetch<PlayerSearchPayload>(`/players/search?riotId=${encodeURIComponent(riotId ?? "")}`),
    enabled: Boolean(riotId),
    retry: false,
  });
