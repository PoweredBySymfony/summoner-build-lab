import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { BootstrapPayload, DashboardPayload, ModuleView, PuzzleDetail, PuzzleListItem } from "@/types/domain";

export const useBootstrap = () =>
  useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => apiFetch<BootstrapPayload>("/bootstrap"),
  });

export const useModules = () =>
  useQuery({
    queryKey: ["modules"],
    queryFn: () => apiFetch<ModuleView[]>("/modules"),
  });

export const usePuzzles = () =>
  useQuery({
    queryKey: ["puzzles"],
    queryFn: () => apiFetch<PuzzleListItem[]>("/puzzles"),
  });

export const usePuzzle = (slug: string | undefined) =>
  useQuery({
    queryKey: ["puzzle", slug],
    queryFn: () => apiFetch<PuzzleDetail>(`/puzzles/${slug}`),
    enabled: Boolean(slug),
  });

export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardPayload>("/dashboard"),
  });
