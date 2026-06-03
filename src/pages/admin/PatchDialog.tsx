import { useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminPatchChampionEntry, AdminPatchEntryStatus, AdminPatchItemEntry, AdminPatchStatusPayload } from "@/types/domain";
import { ChampionThumb } from "./shared";

type PatchEntity = AdminPatchChampionEntry | AdminPatchItemEntry;
type PatchStatusFilter = AdminPatchEntryStatus | "all";

const patchStatusLabels: Record<PatchStatusFilter, string> = {
  changed: "Modifies",
  new: "Nouveaux",
  unchanged: "A aligner",
  removed: "Retires",
  all: "Tous",
};

const patchStatusToneClass: Record<AdminPatchEntryStatus, string> = {
  changed: "border-primary/30 bg-primary/10 text-primary",
  new: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  unchanged: "border-border/60 bg-muted/30 text-muted-foreground",
  removed: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function PatchDialog({
  open,
  onOpenChange,
  loading,
  status,
  syncing,
  onSync,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  status?: AdminPatchStatusPayload;
  syncing: boolean;
  onSync: () => Promise<void>;
}) {
  const [selectedEntity, setSelectedEntity] = useState<PatchEntity | null>(null);
  const [statusFilter, setStatusFilter] = useState<PatchStatusFilter>("changed");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle>Nouveau patch sorti, mettre a jour les donnees</DialogTitle>
            <DialogDescription>Cette fenetre montre les entites en retard et les changements detectes dans le patch cible.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">Analyse du patch en cours...</div>
          ) : status ? (
            <div className="space-y-6">
              <PatchStatusSummary status={status} />
              <Tabs defaultValue="items" onValueChange={() => setSelectedEntity(null)}>
                <TabsList className="bg-muted/60">
                  <TabsTrigger value="champions">Champions</TabsTrigger>
                  <TabsTrigger value="items">Items</TabsTrigger>
                </TabsList>
                <TabsContent value="champions">
                  <PatchStatusFilters
                    entries={status.champions}
                    value={statusFilter}
                    onChange={(nextStatus) => {
                      setSelectedEntity(null);
                      setStatusFilter(nextStatus);
                    }}
                  />
                  <PatchEntityGrid
                    entries={status.champions}
                    statusFilter={statusFilter}
                    emptyLabel="Aucun champion en retard."
                    onSelectDetails={setSelectedEntity}
                    renderThumb={(entry) => <ChampionPatchIcon champion={entry} size="md" />}
                  />
                </TabsContent>
                <TabsContent value="items">
                  <PatchStatusFilters
                    entries={status.items}
                    value={statusFilter}
                    onChange={(nextStatus) => {
                      setSelectedEntity(null);
                      setStatusFilter(nextStatus);
                    }}
                  />
                  <PatchEntityGrid
                    entries={status.items}
                    statusFilter={statusFilter}
                    emptyLabel="Aucun item en retard."
                    onSelectDetails={setSelectedEntity}
                    renderThumb={(entry) => <ItemIcon item={entry} size="md" showTooltip interactive={false} />}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
            <Button variant="gold" disabled={syncing} onClick={() => void onSync()}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Lancer la mise a jour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PatchEntityDetailDialog entry={selectedEntity} onOpenChange={(nextOpen) => !nextOpen && setSelectedEntity(null)} />
    </>
  );
}

function PatchStatusSummary({ status }: { status: AdminPatchStatusPayload }) {
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
        <p className="text-sm text-muted-foreground">Patch cible</p>
        <p className="mt-2 text-2xl font-bold text-primary">{status.remoteLatestPatch}</p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
        <p className="text-sm text-muted-foreground">Champions modifies</p>
        <p className="mt-2 text-2xl font-bold text-foreground">{status.summary.changedChampionCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">{status.summary.championCount} a aligner au patch</p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
        <p className="text-sm text-muted-foreground">Items modifies</p>
        <p className="mt-2 text-2xl font-bold text-foreground">{status.summary.changedItemCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">{status.summary.itemCount} a aligner au patch</p>
      </div>
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
        <p className="text-sm text-muted-foreground">Vrais changements</p>
        <p className="mt-2 text-2xl font-bold text-primary">{status.summary.changedChampionCount + status.summary.changedItemCount}</p>
      </div>
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <p className="text-sm text-muted-foreground">Nouveaux</p>
        <p className="mt-2 text-2xl font-bold text-emerald-300">{status.summary.newChampionCount + status.summary.newItemCount}</p>
      </div>
    </div>
  );
}

function PatchStatusFilters<TEntry extends PatchEntity>({
  entries,
  value,
  onChange,
}: {
  entries: TEntry[];
  value: PatchStatusFilter;
  onChange: (value: PatchStatusFilter) => void;
}) {
  const countByStatus = (status: PatchStatusFilter) =>
    status === "all" ? entries.length : entries.filter((entry) => entry.patchStatus === status).length;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {(["changed", "new", "unchanged", "removed", "all"] as const).map((status) => (
        <Button
          key={status}
          type="button"
          variant={value === status ? "gold" : "outline"}
          size="sm"
          onClick={() => onChange(status)}
        >
          {patchStatusLabels[status]}
          <span className="ml-1 rounded-full bg-background/50 px-1.5 py-0.5 text-[11px]">{countByStatus(status)}</span>
        </Button>
      ))}
    </div>
  );
}

function PatchEntityGrid<TEntry extends PatchEntity>({
  entries,
  statusFilter,
  emptyLabel,
  onSelectDetails,
  renderThumb,
}: {
  entries: TEntry[];
  statusFilter: PatchStatusFilter;
  emptyLabel: string;
  onSelectDetails: (entry: TEntry) => void;
  renderThumb: (entry: TEntry) => JSX.Element;
}) {
  const filteredEntries = entries
    .filter((entry) => statusFilter === "all" || entry.patchStatus === statusFilter)
    .sort((left, right) => left.name.localeCompare(right.name));

  if (!filteredEntries.length) {
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        {entries.length ? `Aucune entree "${patchStatusLabels[statusFilter].toLowerCase()}" pour ce type.` : emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid max-h-[430px] gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
      {filteredEntries.map((entry) => (
        <div key={entry.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            {renderThumb(entry)}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{entry.name}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${patchStatusToneClass[entry.patchStatus]}`}>
                  {patchStatusLabels[entry.patchStatus]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Patch stocke : {entry.patch}</p>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{entry.changeSummary.join(" / ")}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onSelectDetails(entry)}>
              <Info className="h-4 w-4" />
              Details
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PatchEntityDetailDialog({ entry, onOpenChange }: { entry: PatchEntity | null; onOpenChange: (open: boolean) => void }) {
  const isItemEntry = entry ? isPatchItem(entry) : false;

  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-3xl overflow-y-auto border-border/60 bg-card">
        {entry ? (
          <>
            <DialogHeader>
              <div className="flex items-start gap-4">
                {isItemEntry ? <ItemIcon item={entry} size="lg" showTooltip interactive={false} /> : <ChampionPatchIcon champion={entry} size="lg" />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle>{entry.name}</DialogTitle>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${patchStatusToneClass[entry.patchStatus]}`}>
                      {patchStatusLabels[entry.patchStatus]}
                    </span>
                  </div>
                  <DialogDescription>
                    Patch stocke : {entry.patch}. Comparaison avec les donnees Data Dragon du patch cible.
                  </DialogDescription>
                  {isItemEntry ? <p className="mt-1 text-xs text-muted-foreground">Survole l'icone pour voir les statistiques actuelles de l'item.</p> : null}
                </div>
              </div>
            </DialogHeader>
            {!isItemEntry && entry.patchPreview ? <ChampionPreviewPanel champion={entry} /> : null}
            <PatchChangeDetails entry={entry} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function isPatchItem(entry: PatchEntity): entry is AdminPatchItemEntry {
  return "riotItemId" in entry;
}

function PatchChangeDetails({ entry }: { entry: PatchEntity }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Evolution detectee</p>
        <p className="mt-1 text-xs text-muted-foreground">Comparaison entre le catalogue stocke et les donnees Data Dragon du patch cible.</p>
      </div>
      {entry.changes.length ? (
        <div className="space-y-2">
          {entry.changes.map((change) => (
            <div key={change.field} className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-sm font-medium text-foreground">{change.label}</p>
              <PatchChangeComparison change={change} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
          Aucun changement de fiche detecte : seule la version de patch locale sera alignee.
        </div>
      )}
    </div>
  );
}

function PatchChangeComparison({ change }: { change: PatchEntity["changes"][number] }) {
  const hasStructuredLines = Boolean(change.beforeLines?.length || change.afterLines?.length);

  if (change.field === "abilities") {
    return (
      <div className="mt-3 grid gap-3">
        <PatchLongTextLines title="Avant" lines={change.beforeLines ?? []} fallback={change.before} />
        <PatchLongTextLines title="Apres" lines={change.afterLines ?? []} fallback={change.after} />
      </div>
    );
  }

  if (!hasStructuredLines) {
    return (
      <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
        <PatchRawValue title="Avant" value={change.before} />
        <PatchRawValue title="Apres" value={change.after} />
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <PatchValueLines title="Avant" lines={change.beforeLines ?? []} fallback={change.before} />
      <PatchValueLines title="Apres" lines={change.afterLines ?? []} fallback={change.after} />
    </div>
  );
}

function ChampionPatchIcon({ champion, size }: { champion: AdminPatchChampionEntry; size: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-16 w-16" : "h-12 w-12";

  return (
    <div className="shrink-0">
      <div className={`${sizeClass} overflow-hidden rounded-lg border border-border/60 bg-muted/50`}>
        <img src={champion.icon} alt={champion.name} className="h-full w-full object-cover" loading="lazy" />
      </div>
    </div>
  );
}

function ChampionPreviewPanel({ champion }: { champion: AdminPatchChampionEntry }) {
  if (!champion.patchPreview) {
    return null;
  }

  return (
    <section className="rounded-xl border border-primary/25 bg-background/70 p-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">{champion.patchPreview.name}</p>
      <p className="text-xs text-muted-foreground">{champion.patchPreview.title}</p>
      {champion.patchPreview.blurb ? <p className="mt-3 text-sm leading-relaxed text-foreground/90">{champion.patchPreview.blurb}</p> : null}
      <div className="mt-4 grid max-h-[42vh] gap-3 overflow-y-auto pr-2 md:grid-cols-2">
        {champion.patchPreview.passive ? <ChampionAbilityPreview ability={champion.patchPreview.passive} /> : null}
        {champion.patchPreview.spells.map((spell) => <ChampionAbilityPreview key={spell.id} ability={spell} />)}
      </div>
    </section>
  );
}

function ChampionAbilityPreview({
  ability,
}: {
  ability: NonNullable<AdminPatchChampionEntry["patchPreview"]>["spells"][number];
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
      <img src={ability.icon} alt="" className="h-9 w-9 shrink-0 rounded-md border border-border/60 object-cover" loading="lazy" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">
          <span className="text-primary">{ability.key}</span> - {ability.name}
        </p>
        <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-muted-foreground">{stripHtml(ability.description)}</p>
      </div>
    </div>
  );
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function PatchRawValue({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <p className="mt-1 break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

function PatchLongTextLines({ title, lines, fallback }: { title: string; lines: Array<{ key: string; label: string; value: string }>; fallback: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {lines.length ? (
        <div className="mt-3 space-y-3">
          {lines.map((line) => (
            <article key={line.key} className="rounded-md bg-muted/30 px-3 py-2">
              <p className="text-sm font-semibold text-foreground">{line.label}</p>
              <p className="mt-1 whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">{line.value}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{fallback}</p>
      )}
    </div>
  );
}

function PatchValueLines({ title, lines, fallback }: { title: string; lines: Array<{ key: string; label: string; value: string; delta?: string }>; fallback: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {lines.length ? (
        <dl className="mt-3 grid gap-2">
          {lines.map((line) => (
            <div key={line.key} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
              <dt className="min-w-0 text-sm text-muted-foreground">
                {line.item ? (
                  <span className="flex min-w-0 items-center gap-3">
                    <ItemIcon item={line.item} size="sm" showTooltip interactive={false} />
                    <span className="truncate">{line.label}</span>
                  </span>
                ) : (
                  line.label
                )}
              </dt>
              <dd className="flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground">
                <span>{line.value}</span>
                {line.delta ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${line.delta.startsWith("-") ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-300"}`}>
                    {line.delta}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{fallback}</p>
      )}
    </div>
  );
}
