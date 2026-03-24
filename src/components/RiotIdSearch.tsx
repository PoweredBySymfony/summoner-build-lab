import { FormEvent, KeyboardEvent, useDeferredValue, useEffect, useRef, useState } from "react";
import { Clock3, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  | ({ type: "recent" } & RecentRiotSearch);

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
  const [riotId, setRiotId] = useState(() => normalizeRiotIdInput(defaultValue));
  const [recentSearches, setRecentSearches] = useState<RecentRiotSearch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredRiotId = useDeferredValue(riotId);

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
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const parsedCurrentInput = parseRiotIdInput(deferredRiotId);
  const normalizedQuery = normalizeRiotIdInput(deferredRiotId).toLowerCase();
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

  const suggestions: Suggestion[] = [
    ...(parsedCurrentInput &&
    !filteredRecentSearches.some((entry) => entry.riotId.toLowerCase() === parsedCurrentInput.riotId.toLowerCase())
      ? [{ type: "current" as const, ...parsedCurrentInput }]
      : []),
    ...filteredRecentSearches.map((entry) => ({ type: "recent" as const, ...entry })),
  ];

  useEffect(() => {
    setActiveIndex(0);
  }, [deferredRiotId, isOpen]);

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

  const hintLabel = filteredRecentSearches.length > 0 || !riotId.trim()
    ? "Dernières recherches"
    : "Recherche rapide";

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
                placeholder="Rechercher un Riot ID, ex : QuoiCouBehhhhh#EUW"
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
                Utilise `GameName#TAG` ou `GameName-TAG`. Les recherches réussies restent disponibles dans ce navigateur.
              </p>
            ) : null}
          </div>
          <Button type="submit" variant="gold" className={`${compact ? "h-11 w-full" : "h-14 min-w-44"} rounded-2xl text-base`}>
            Rechercher
          </Button>
        </div>
      </form>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-[90] overflow-hidden rounded-[28px] border border-border/60 bg-[#11161f] shadow-2xl shadow-black/50">
          <div className="border-b border-border/60 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{hintLabel}</p>
          </div>

          {suggestions.length > 0 ? (
            <div className="max-h-[360px] overflow-y-auto p-3">
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
                        Ouvrir
                      </div>
                    </button>
                  );
                }

                return (
                  <div
                    key={suggestion.riotId}
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
                        {suggestion.tagLine}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-white/8 hover:text-foreground"
                      aria-label={`Remove ${suggestion.riotId} from recent searches`}
                      onClick={() => removeRecentRiotSearch(suggestion.riotId)}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              <p>Commence par rechercher un Riot ID comme `QuoiCouBehhhhh#EUW`. Les recherches valides apparaîtront ici.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
