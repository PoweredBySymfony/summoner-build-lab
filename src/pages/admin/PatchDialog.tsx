import { RefreshCw } from "lucide-react";
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
import type { ChampionView, GameItem } from "@/types/domain";
import { ChampionThumb, ItemThumb } from "./shared";

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
  status?: {
    remoteLatestPatch: string;
    hasUpdate: boolean;
    summary: { championCount: number; itemCount: number };
    champions: ChampionView[];
    items: GameItem[];
  };
  syncing: boolean;
  onSync: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle>Nouveau patch sorti, mettre a jour les donnees</DialogTitle>
          <DialogDescription>Cette fenetre te montre les entites qui ne sont pas encore au patch cible et seront rafraichies.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">Analyse du patch en cours...</div>
        ) : status ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
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
            </div>
            <Tabs defaultValue="champions">
              <TabsList className="bg-muted/60">
                <TabsTrigger value="champions">Champions</TabsTrigger>
                <TabsTrigger value="items">Items</TabsTrigger>
              </TabsList>
              <TabsContent value="champions">
                <div className="grid max-h-[420px] gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
                  {status.champions.length ? status.champions.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <ChampionThumb src={entry.icon} alt={entry.name} />
                      <div>
                        <p className="font-medium text-foreground">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">Patch stocke : {entry.patch}</p>
                      </div>
                    </div>
                  )) : <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">Aucun champion en retard.</div>}
                </div>
              </TabsContent>
              <TabsContent value="items">
                <div className="grid max-h-[420px] gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
                  {status.items.length ? status.items.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <ItemThumb src={entry.icon} alt={entry.name} />
                      <div>
                        <p className="font-medium text-foreground">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">Patch stocke : {entry.patch}</p>
                      </div>
                    </div>
                  )) : <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">Aucun item en retard.</div>}
                </div>
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
