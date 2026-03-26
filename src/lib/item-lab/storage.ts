import type { ComparisonSummary, SavedLabExperiment, SetupAnalysis } from "@/lib/item-lab/types";
import { formatStatValue, getStatDefinition } from "@/lib/item-lab/calculations";

const STORAGE_KEY = "summoner-build-lab:item-lab-experiments";

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const getSavedExperiments = (): SavedLabExperiment[] => {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as SavedLabExperiment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const persistExperiment = (experiment: SavedLabExperiment) => {
  if (!canUseStorage()) {
    return;
  }

  const entries = getSavedExperiments();
  const existingIndex = entries.findIndex((entry) => entry.id === experiment.id);
  if (existingIndex >= 0) {
    entries[existingIndex] = experiment;
  } else {
    entries.unshift(experiment);
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 20)));
};

export const deleteSavedExperiment = (id: string) => {
  if (!canUseStorage()) {
    return;
  }

  const entries = getSavedExperiments().filter((entry) => entry.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

const formatItemList = (items: SetupAnalysis["items"]) => (items.length > 0 ? items.map((item) => item.name).join(", ") : "Aucun item");

export const buildComparisonExport = ({
  name,
  mode,
  analysisA,
  analysisB,
  comparison,
}: {
  name: string;
  mode: "mirror" | "duel";
  analysisA: SetupAnalysis;
  analysisB: SetupAnalysis;
  comparison: ComparisonSummary;
}) => {
  const statLines = comparison.standoutStats.slice(0, 5).map((entry) => {
    const definition = getStatDefinition(entry.key);
    return `- ${definition.label}: A ${formatStatValue(entry.key, analysisA.stats[entry.key])} | B ${formatStatValue(entry.key, analysisB.stats[entry.key])}`;
  });

  return [
    `Analyse Lab d'Items: ${name}`,
    `Mode: ${mode === "mirror" ? "Miroir" : "Duel"}`,
    "",
    `Setup A: ${analysisA.champion.name} niv. ${analysisA.level}`,
    `Items A: ${formatItemList(analysisA.items)}`,
    `Résumé A: ${analysisA.summaryLine}`,
    "",
    `Setup B: ${analysisB.champion.name} niv. ${analysisB.level}`,
    `Items B: ${formatItemList(analysisB.items)}`,
    `Résumé B: ${analysisB.summaryLine}`,
    "",
    "Principales différences",
    ...statLines,
    "",
    "Lecture synthétique",
    ...comparison.narrative.map((line) => `- ${line}`),
  ].join("\n");
};
