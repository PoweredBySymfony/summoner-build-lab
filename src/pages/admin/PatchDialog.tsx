import { useState } from "react";
import { Info, RefreshCw } from "lucide-react";
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
import { ChampionThumb, ItemThumb } from "./shared";

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
  const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PatchStatusFilter>("changed");

  return (
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
            <Tabs defaultValue="items" onValueChange={() => setExpandedEntityId(null)}>
              <TabsList className="bg-muted/60">
                <TabsTrigger value="champions">Champions</TabsTrigger>
                <TabsTrigger value="items">Items</TabsTrigger>
              </TabsList>
              <TabsContent value="champions">
                <PatchStatusFilters
                  entries={status.champions}
                  value={statusFilter}
                  onChange={(nextStatus) => {
                    setExpandedEntityId(null);
                    setStatusFilter(nextStatus);
                  }}
                />
                <PatchEntityGrid
                  entries={status.champions}
                  statusFilter={statusFilter}
                  emptyLabel="Aucun champion en retard."
                  expandedEntityId={expandedEntityId}
                  onToggleDetails={setExpandedEntityId}
                  renderThumb={(entry) => <ChampionThumb src={entry.icon} alt={entry.name} />}
                />
              </TabsContent>
              <TabsContent value="items">
                <PatchStatusFilters
                  entries={status.items}
                  value={statusFilter}
                  onChange={(nextStatus) => {
                    setExpandedEntityId(null);
                    setStatusFilter(nextStatus);
                  }}
                />
                <PatchEntityGrid
                  entries={status.items}
                  statusFilter={statusFilter}
                  emptyLabel="Aucun item en retard."
                  expandedEntityId={expandedEntityId}
                  onToggleDetails={setExpandedEntityId}
                  renderThumb={(entry) => <ItemThumb src={entry.icon} alt={entry.name} />}
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
        <p className="text-sm text-muted-foreground">Champions a rafraichir</p>
        <p className="mt-2 text-2xl font-bold text-foreground">{status.summary.championCount}</p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
        <p className="text-sm text-muted-foreground">Items a rafraichir</p>
        <p className="mt-2 text-2xl font-bold text-foreground">{status.summary.itemCount}</p>
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
  expandedEntityId,
  onToggleDetails,
  renderThumb,
}: {
  entries: TEntry[];
  statusFilter: PatchStatusFilter;
  emptyLabel: string;
  expandedEntityId: string | null;
  onToggleDetails: (entityId: string | null) => void;
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
      {filteredEntries.map((entry) => {
        const expanded = expandedEntityId === entry.id;
        return (
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onToggleDetails(expanded ? null : entry.id)}
                aria-expanded={expanded}
              >
                <Info className="h-4 w-4" />
                Details
              </Button>
            </div>
            {expanded ? <PatchChangeDetails entry={entry} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function PatchChangeDetails({ entry }: { entry: PatchEntity }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background/70 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Evolution detectee</p>
        <p className="mt-1 text-xs text-muted-foreground">Comparaison entre le catalogue stocke et les donnees Data Dragon du patch cible.</p>
      </div>
      {entry.changes.length ? (
        <div className="space-y-2">
          {entry.changes.map((change) => (
            <div key={change.field} className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-sm font-medium text-foreground">{change.label}</p>
              <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">Avant : </span>
                  {change.before}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Apres : </span>
                  {change.after}
                </div>
              </div>
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
