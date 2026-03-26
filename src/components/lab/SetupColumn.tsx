import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  CircleX,
  Plus,
  RefreshCcw,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";
import type { ChampionView, GameItem } from "@/types/domain";
import type { ItemLabSetup, SetupAnalysis } from "@/lib/item-lab/types";
import { formatStatValue } from "@/lib/item-lab/calculations";
import ChampionPortrait from "@/components/ChampionPortrait";
import ItemIcon from "@/components/ItemIcon";
import StatTable from "@/components/lab/StatTable";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface SetupColumnProps {
  side: "A" | "B";
  accent: "gold" | "cyan";
  title: string;
  setup: ItemLabSetup;
  analysis: SetupAnalysis;
  champions: ChampionView[];
  items: GameItem[];
  disableChampionSelection?: boolean;
  onChampionChange: (championId: string) => void;
  onLevelChange: (level: number) => void;
  onItemChange: (slotIndex: number, itemId: string) => void;
  onItemRemove: (slotIndex: number) => void;
}

const accentClass = {
  gold: "from-primary/15 via-primary/5 to-transparent border-primary/20",
  cyan: "from-cyan-500/15 via-cyan-500/5 to-transparent border-cyan-400/20",
};

const SetupColumn = ({
  side,
  accent,
  title,
  setup,
  analysis,
  champions,
  items,
  disableChampionSelection = false,
  onChampionChange,
  onLevelChange,
  onItemChange,
  onItemRemove,
}: SetupColumnProps) => {
  const [openChampionPicker, setOpenChampionPicker] = useState(false);
  const [activeItemSlot, setActiveItemSlot] = useState<number | null>(null);
  const [itemSearch, setItemSearch] = useState("");

  const selectedItemIds = useMemo(() => new Set(setup.itemIds.filter((itemId): itemId is string => Boolean(itemId))), [setup.itemIds]);
  const itemOptions = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    return items.filter((item) => !query || item.name.toLowerCase().includes(query) || item.tags.some((tag) => tag.toLowerCase().includes(query)));
  }, [items, itemSearch]);

  return (
    <section className="glass-surface rounded-[28px] p-5">
      <div className={`rounded-[24px] border bg-gradient-to-br p-5 ${accentClass[accent]}`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{title}</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">{analysis.champion.name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(analysis.champion.roles.length > 0 ? analysis.champion.roles : ["Flex"]).map((role) => (
                <Badge key={`${side}-${role}`} variant="secondary" className="bg-secondary/80 text-foreground">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          <ChampionPortrait champion={analysis.champion} size="lg" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
          <div className="space-y-4">
            <div className="surface-elevated rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Champion</p>
                  <p className="text-sm text-foreground">Base du setup et scaling par niveau.</p>
                </div>
                <Popover open={openChampionPicker} onOpenChange={setOpenChampionPicker}>
                  <PopoverTrigger asChild>
                    <Button variant={accent === "gold" ? "premium" : "secondary"} className="min-w-[180px] justify-between" disabled={disableChampionSelection}>
                      {analysis.champion.name}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] border-border/60 bg-card/95 p-0">
                    <Command className="bg-transparent">
                      <CommandInput placeholder="Chercher un champion" />
                      <CommandList className="max-h-[320px]">
                        <CommandEmpty>Aucun champion.</CommandEmpty>
                        {champions.map((champion) => (
                          <CommandItem
                            key={champion.id}
                            value={`${champion.name} ${champion.roles.join(" ")}`}
                            onSelect={() => {
                              onChampionChange(champion.id);
                              setOpenChampionPicker(false);
                            }}
                            className="gap-3 px-3 py-3"
                          >
                            <ChampionPortrait champion={champion} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{champion.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{champion.roles.join(" / ") || "Flex"}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Niveau</p>
                    <p className="text-2xl font-semibold text-foreground">{setup.level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Power curve</p>
                    <p className="text-sm text-foreground">{analysis.scalingScore}/100</p>
                  </div>
                </div>
                <Input type="range" min={1} max={18} value={setup.level} onChange={(event) => onLevelChange(Number(event.target.value))} className="h-3 cursor-pointer px-0" />
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>1</span>
                  <span>18</span>
                </div>
              </div>
            </div>

            <div className="surface-elevated rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Level up / Last change</p>
                  <p className="text-sm text-foreground">Lecture avant → après des stats impactées.</p>
                </div>
                <RefreshCcw className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                {analysis.changedStats.slice(0, 5).map((entry) => (
                  <div key={`${side}-${entry.key}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                    <span className="text-sm text-foreground">{entry.key === "attackSpeed" ? "AS" : entry.key === "attackDamage" ? "AD" : entry.key === "abilityPower" ? "AP" : entry.key === "health" ? "PV" : entry.key === "armor" ? "Armure" : entry.key === "magicResist" ? "RM" : entry.key}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{formatStatValue(entry.key, entry.previous)}</span>
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <span className={entry.delta > 0 ? "text-primary" : "text-cyan-300"}>{formatStatValue(entry.key, entry.current)}</span>
                    </div>
                  </div>
                ))}
                {analysis.changedStats.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-card/50 px-3 py-3 text-sm text-muted-foreground">
                    Change un niveau, un champion ou un item pour afficher le delta.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="surface-elevated rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Inventaire</p>
                <p className="text-sm text-foreground">{analysis.totalGold} or investis</p>
              </div>
              <Swords className="h-4 w-4 text-primary" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {setup.itemIds.map((itemId, slotIndex) => {
                const currentItem = itemId ? items.find((item) => item.id === itemId) ?? null : null;
                return (
                  <Popover key={`${side}-slot-${slotIndex}`} open={activeItemSlot === slotIndex} onOpenChange={(open) => setActiveItemSlot(open ? slotIndex : null)}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="group item-slot-lg relative w-full rounded-xl border border-border/60 bg-card/80 transition-colors hover:border-primary/40"
                      >
                        {currentItem ? (
                          <>
                            <ItemIcon item={currentItem} size="lg" showTooltip className="h-full w-full border-0" interactive={false} />
                            <button
                              type="button"
                              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(event) => {
                                event.stopPropagation();
                                onItemRemove(slotIndex);
                              }}
                            >
                              <CircleX className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Plus className="h-5 w-5" />
                          </div>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[360px] border-border/60 bg-card/95 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Slot {slotIndex + 1}</p>
                          <p className="text-sm text-foreground">{currentItem ? "Remplacer l'item" : "Ajouter un item"}</p>
                        </div>
                        {currentItem ? (
                          <Button variant="ghost" size="sm" onClick={() => onItemRemove(slotIndex)}>
                            Retirer
                          </Button>
                        ) : null}
                      </div>
                      <Input
                        value={itemSearch}
                        onChange={(event) => setItemSearch(event.target.value)}
                        placeholder="Chercher un item"
                        className="mb-3"
                      />
                      <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                        {itemOptions.map((item) => {
                          const duplicateBlocked = selectedItemIds.has(item.id) && item.id !== currentItem?.id;
                          return (
                            <button
                              key={`${side}-${slotIndex}-${item.id}`}
                              type="button"
                              disabled={duplicateBlocked}
                              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                                duplicateBlocked
                                  ? "cursor-not-allowed border-border/40 bg-secondary/30 opacity-50"
                                  : "border-border/60 bg-card/70 hover:border-primary/40"
                              }`}
                              onClick={() => {
                                onItemChange(slotIndex, item.id);
                                setActiveItemSlot(null);
                                setItemSearch("");
                              }}
                            >
                              <ItemIcon item={item} size="sm" showTooltip={false} interactive={false} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{item.cost} or · {item.tags.slice(0, 3).join(" · ")}</p>
                              </div>
                              {duplicateBlocked ? <span className="text-[11px] text-muted-foreground">Déjà pris</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              {analysis.changedStats
                .filter((entry) => Math.abs(analysis.bonusStats[entry.key]) > 0.009)
                .slice(0, 4)
                .map((entry) => (
                  <div key={`${side}-bonus-${entry.key}`} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Impact item</span>
                    <span className={analysis.bonusStats[entry.key] > 0 ? "text-primary" : "text-cyan-300"}>
                      {entry.key === "attackSpeed" || entry.key === "critChance" || entry.key === "armorPen"
                        ? `${entry.key === "attackSpeed" ? "AS" : entry.key === "critChance" ? "Crit" : "Pen"} +${Math.round(analysis.bonusStats[entry.key])}%`
                        : `${entry.key === "attackDamage" ? "AD" : entry.key === "abilityPower" ? "AP" : entry.key === "health" ? "PV" : entry.key === "abilityHaste" ? "Hâte" : entry.key} +${Math.round(analysis.bonusStats[entry.key])}`}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <StatTable analysis={analysis} />

          <div className="space-y-4">
            <div className="surface-elevated rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Profil de force</p>
                  <p className="text-sm text-foreground">Lecture heuristique produit, pas simulation Riot exacte.</p>
                </div>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-3">
                {analysis.profileScores.map((score) => (
                  <div key={`${side}-profile-${score.key}`} className="rounded-xl border border-border/60 bg-card/70 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{score.label}</span>
                      <span className="text-primary">{score.value}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${score.value}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{score.emphasis}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-elevated rounded-2xl p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Shield className="h-4 w-4 text-primary" />
                Pourquoi ça change
              </div>
              <div className="space-y-2">
                {analysis.whyItChanges.map((note) => (
                  <div key={`${side}-${note.title}`} className="rounded-xl border border-border/60 bg-card/70 p-3">
                    <p className="text-sm font-medium text-foreground">{note.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{note.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-elevated rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Contexte conseillé</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.contextNotes.length > 0 ? analysis.contextNotes.map((note) => (
                  <span key={`${side}-${note}`} className="rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs text-foreground">
                    {note}
                  </span>
                )) : <span className="text-sm text-muted-foreground">Aucun angle dominant pour l'instant.</span>}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{analysis.summaryLine}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SetupColumn;
