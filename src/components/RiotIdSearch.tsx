import { FormEvent, KeyboardEvent, useDeferredValue, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayerSuggestions } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlayerAutocompleteSuggestion } from "@/types/domain";
import {
  buildRiotProfileIconUrl,
  getRecentRiotSearches,
  normalizeRiotIdInput,
  parseRiotIdInput,
  removeRecentRiotSearch,
  subscribeToRecentRiotSearches,
  type RecentRiotSearch,
} from "@/lib/riotSearch";

type RiotIdSearchProps = {
  defaultValue?: string;
  compact?: boolean;
};

type Suggestion =
  | { type: "current"; riotId: string; gameName: string; tagLine: string }
  | ({ type: "recent" } & RecentRiotSearch)
  | ({ type: "remote" } & PlayerAutocompleteSuggestion);

const RiotIdAvatar = ({ entry }: { entry: Pick<RecentRiotSearch, "gameName" | "profileIconId"> }) => {
  const iconUrl = buildRiotProfileIconUrl(entry.profileIconId);

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={entry.gameName}
        className="h-11 w-11 rounded-xl border border-border/60 object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-secondary text-sm font-bold text-foreground">
      {entry.gameName.slice(0, 2).toUpperCase()}
    </div>
  );
};

export const RiotIdSearch = ({ defaultValue = "", compact = false }: RiotIdSearchProps) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [riotId, setRiotId] = useState(() => normalizeRiotIdInput(defaultValue));
  const [recentSearches, setRecentSearches] = useState<RecentRiotSearch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelStyle, setPanelStyle] = useState<{ left: number; top: number; width: number }>({
    left: 0,
    top: 0,
    width: 0,
  });
  const [panelMaxHeight, setPanelMaxHeight] = useState(360);
  const deferredRiotId = useDeferredValue(riotId);
  const trimmedDeferredRiotId = deferredRiotId.trim();
  const remoteSuggestions = usePlayerSuggestions(trimmedDeferredRiotId || undefined, 8);

  useEffect(() => {
    setRiotId(normalizeRiotIdInput(defaultValue));
  }, [defaultValue]);

  useEffect(() => {
    const syncRecentSearches = () => setRecentSearches(getRecentRiotSearches());

    syncRecentSearches();
    return subscribeToRecentRiotSearches(syncRecentSearches);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePanelPosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gutter = 16;
      const preferredGap = 10;
      const desiredWidth = rect.width;
      const width = Math.min(desiredWidth, viewportWidth - gutter * 2);
      const left = Math.min(Math.max(rect.left, gutter), viewportWidth - gutter - width);
      const spaceBelow = viewportHeight - rect.bottom - gutter;
      const spaceAbove = rect.top - gutter;
      const shouldOpenAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(160, (shouldOpenAbove ? spaceAbove : spaceBelow) - preferredGap);
      const top = shouldOpenAbove
        ? Math.max(gutter, rect.top - preferredGap - Math.min(availableHeight, 420))
        : rect.bottom + preferredGap;

      setPanelStyle({
        left,
        top,
        width,
      });
      setPanelMaxHeight(Math.min(availableHeight, 420));
    };

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen]);

  const parsedCurrentInput = parseRiotIdInput(trimmedDeferredRiotId);
  const normalizedQuery = normalizeRiotIdInput(trimmedDeferredRiotId).toLowerCase();
  const showRecentSearches = !trimmedDeferredRiotId;
  const filteredRecentSearches = recentSearches.filter((entry) => {
    if (!normalizedQuery) {
      return true;
    }

    return [
      entry.riotId,
      entry.gameName,
      entry.tagLine,
      `${entry.gameName}-${entry.tagLine}`,
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  const dedupe = new Set<string>();
  const suggestions: Suggestion[] = [];

  if (parsedCurrentInput) {
    const currentRiotId = parsedCurrentInput.riotId.toLowerCase();
    dedupe.add(currentRiotId);
    suggestions.push({ type: "current", ...parsedCurrentInput });
  }

  if (showRecentSearches) {
    for (const entry of filteredRecentSearches) {
      const key = entry.riotId.toLowerCase();
      if (dedupe.has(key)) {
        continue;
      }

      dedupe.add(key);
      suggestions.push({ type: "recent", ...entry });
    }
  } else {
    for (const entry of remoteSuggestions.data ?? []) {
      const key = entry.riotId.toLowerCase();
      if (dedupe.has(key)) {
        continue;
      }

      dedupe.add(key);
      suggestions.push({ type: "remote", ...entry });
    }

    for (const entry of filteredRecentSearches) {
      const key = entry.riotId.toLowerCase();
      if (dedupe.has(key)) {
        continue;
      }

      dedupe.add(key);
      suggestions.push({ type: "recent", ...entry });
    }
  }

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedDeferredRiotId, isOpen, remoteSuggestions.data]);

  const goToProfile = (value: string) => {
    const parsed = parseRiotIdInput(value);
    if (!parsed) {
      return;
    }

    setRiotId(parsed.riotId);
    setIsOpen(false);
    navigate(`/players/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    goToProfile(riotId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
      return;
    }

    if (event.key === "Enter") {
      const activeSuggestion = suggestions[activeIndex];
      if (activeSuggestion) {
        event.preventDefault();
        goToProfile(activeSuggestion.riotId);
      }
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  const hintLabel = showRecentSearches
    ? "Dernieres recherches"
    : "Suggestions joueurs";

  const isLoadingSuggestions = !showRecentSearches && remoteSuggestions.isLoading;

  const emptyState = showRecentSearches
    ? "Commence par rechercher un Riot ID comme `Hide on bush#KR1`. Les recherches valides apparaitront ici."
    : "Aucune suggestion distante connue pour cette saisie pour l'instant. Essaie un Riot ID complet.";

  const suggestionPanel = isOpen
    ? createPortal(
      <div
        ref={panelRef}
        className="fixed z-[2147483647] overflow-hidden rounded-[28px] border border-border/60 bg-[#11161f] shadow-2xl shadow-black/50"
        style={{
          left: panelStyle.left,
          top: panelStyle.top,
          width: panelStyle.width,
        }}
      >
        <div className="border-b border-border/60 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{hintLabel}</p>
        </div>

        {isLoadingSuggestions ? (
          <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <p>Recherche de comptes connus en cours...</p>
          </div>
        ) : suggestions.length > 0 ? (
          <div className="overflow-y-auto p-3" style={{ maxHeight: panelMaxHeight }}>
            {suggestions.map((suggestion, index) => {
              const isActive = index === activeIndex;

              if (suggestion.type === "current") {
                return (
                  <button
                    key={suggestion.riotId}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${isActive ? "bg-white/8" : "hover:bg-white/5"}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => goToProfile(suggestion.riotId)}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                      <Search className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">{suggestion.gameName}</p>
                      <p className="text-sm text-muted-foreground">#{suggestion.tagLine}</p>
                    </div>
                    <div className="rounded-xl bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Recherche exacte
                    </div>
                  </button>
                );
              }

              const regionBadge = suggestion.type === "remote"
                ? suggestion.platform?.toUpperCase() ?? suggestion.region?.toUpperCase() ?? suggestion.tagLine
                : suggestion.tagLine;

              return (
                <div
                  key={`${suggestion.type}-${suggestion.riotId}`}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${isActive ? "bg-white/8" : "hover:bg-white/5"}`}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => goToProfile(suggestion.riotId)}
                  >
                    <RiotIdAvatar entry={suggestion} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">{suggestion.gameName}</p>
                      <p className="text-sm text-muted-foreground">#{suggestion.tagLine}</p>
                    </div>
                    <div className="rounded-xl bg-indigo-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      {regionBadge}
                    </div>
                  </button>
                  {suggestion.type === "recent" ? (
                    <button
                      type="button"
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-white/8 hover:text-foreground"
                      aria-label={`Remove ${suggestion.riotId} from recent searches`}
                      onClick={() => removeRecentRiotSearch(suggestion.riotId)}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <p>{emptyState}</p>
          </div>
        )}
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={containerRef} className="relative z-[70]">
      <form onSubmit={submit} className={`rounded-[28px] border border-border/60 bg-background/80 shadow-sm ${compact ? "p-4" : "p-6"}`}>
        <div className={`flex ${compact ? "flex-col gap-3" : "flex-col gap-4 lg:flex-row lg:items-center"}`}>
          <div className="flex-1 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">Recherche joueur</p>
            <label className="sr-only" htmlFor="riot-id-search">Riot ID</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="riot-id-search"
                className={`rounded-2xl pl-11 ${compact ? "h-11" : "h-14 text-base"}`}
                placeholder="Rechercher un Riot ID, ex : Hide on bush#KR1"
                value={riotId}
                autoComplete="off"
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                onChange={(event) => {
                  setRiotId(event.target.value);
                  setIsOpen(true);
                }}
              />
            </div>
            {!compact ? (
              <p className="text-sm text-muted-foreground">
                Au focus: dernieres recherches. Pendant la saisie: suggestions de comptes connus et recherche exacte sur Riot ID complet.
              </p>
            ) : null}
          </div>
          <Button type="submit" variant="gold" className={`${compact ? "h-11 w-full" : "h-14 min-w-44"} rounded-2xl text-base`}>
            Rechercher
          </Button>
        </div>
      </form>
      {suggestionPanel}
    </div>
  );
};
