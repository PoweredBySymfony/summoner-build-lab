export interface RecentRiotSearch {
  riotId: string;
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  searchedAt: string;
}

const STORAGE_KEY = "summoner-build-lab:riot-searches";
const HISTORY_LIMIT = 6;
const HISTORY_EVENT = "riot-search-history-updated";

const tagLikePattern = /^[A-Za-z0-9]{2,6}$/;

const canUseStorage = () => typeof window !== "undefined";

export const parseRiotIdInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hashIndex = trimmed.indexOf("#");
  if (hashIndex > 0 && hashIndex < trimmed.length - 1) {
    const gameName = trimmed.slice(0, hashIndex).trim();
    const tagLine = trimmed.slice(hashIndex + 1).trim().toUpperCase();
    if (gameName && tagLine) {
      return { gameName, tagLine, riotId: `${gameName}#${tagLine}` };
    }
  }

  const dashIndex = trimmed.lastIndexOf("-");
  if (dashIndex > 0 && dashIndex < trimmed.length - 1) {
    const gameName = trimmed.slice(0, dashIndex).trim();
    const tagLine = trimmed.slice(dashIndex + 1).trim().toUpperCase();
    if (gameName && tagLikePattern.test(tagLine)) {
      return { gameName, tagLine, riotId: `${gameName}#${tagLine}` };
    }
  }

  return null;
};

export const normalizeRiotIdInput = (value: string) => parseRiotIdInput(value)?.riotId ?? value.trim();

export const getRecentRiotSearches = (): RecentRiotSearch[] => {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as RecentRiotSearch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRecentRiotSearches = (entries: RecentRiotSearch[]) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(HISTORY_EVENT));
};

export const saveRecentRiotSearch = (entry: Omit<RecentRiotSearch, "searchedAt" | "riotId"> & { riotId?: string }) => {
  const parsed = parseRiotIdInput(entry.riotId ?? `${entry.gameName}#${entry.tagLine}`);
  if (!parsed) {
    return;
  }

  const nextEntry: RecentRiotSearch = {
    riotId: parsed.riotId,
    gameName: parsed.gameName,
    tagLine: parsed.tagLine,
    profileIconId: entry.profileIconId ?? null,
    searchedAt: new Date().toISOString(),
  };

  const deduped = getRecentRiotSearches().filter((item) => item.riotId.toLowerCase() !== nextEntry.riotId.toLowerCase());
  writeRecentRiotSearches([nextEntry, ...deduped].slice(0, HISTORY_LIMIT));
};

export const removeRecentRiotSearch = (riotId: string) => {
  const normalized = normalizeRiotIdInput(riotId).toLowerCase();
  writeRecentRiotSearches(getRecentRiotSearches().filter((item) => item.riotId.toLowerCase() !== normalized));
};

export const subscribeToRecentRiotSearches = (callback: () => void) => {
  if (!canUseStorage()) {
    return () => undefined;
  }

  const listener = () => callback();
  window.addEventListener(HISTORY_EVENT, listener);
  return () => window.removeEventListener(HISTORY_EVENT, listener);
};

export const buildRiotProfileIconUrl = (profileIconId: number | null | undefined) => {
  if (!profileIconId) {
    return null;
  }

  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${profileIconId}.jpg`;
};
