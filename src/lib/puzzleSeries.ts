const STORAGE_KEY = "summoner-build-lab:puzzle-series";

type StoredPuzzleSeries = {
  slugs: string[];
  updatedAt: string;
};

const hasStorage = () => typeof window !== "undefined";

export const savePuzzleSeries = (slugs: string[]) => {
  if (!hasStorage()) {
    return;
  }

  const payload: StoredPuzzleSeries = {
    slugs,
    updatedAt: new Date().toISOString(),
  };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const getPuzzleSeries = (): string[] => {
  if (!hasStorage()) {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredPuzzleSeries;
    return Array.isArray(parsed?.slugs) ? parsed.slugs : [];
  } catch {
    return [];
  }
};

export const getNextPuzzleSlug = (currentSlug: string) => {
  const series = getPuzzleSeries();
  const currentIndex = series.findIndex((slug) => slug === currentSlug);
  if (currentIndex < 0) {
    return null;
  }

  return series[currentIndex + 1] ?? null;
};
