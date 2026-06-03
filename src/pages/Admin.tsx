import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BookOpenCheck, Boxes, Brain, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import {
  useAdminAiGeneratedPuzzles,
  useAdminChampions,
  useAdminDeleteChampion,
  useAdminDeleteItem,
  useAdminDeletePuzzle,
  useAdminItems,
  useAdminOverview,
  useAdminPatchStatus,
  useAdminPublishPuzzle,
  useAdminPuzzleDetail,
  useAdminPuzzles,
  useAdminSyncPatch,
  useAdminUpdateChampion,
  useAdminUpdateItem,
  useAdminUpdatePuzzle,
  useCurrentUser,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { ChampionView, GameItem } from "@/types/domain";
import { toast } from "sonner";
import { ChampionAdminSection } from "./admin/ChampionAdminSection";
import { ChampionEditDialog } from "./admin/ChampionEditDialog";
import { ItemAdminSection } from "./admin/ItemAdminSection";
import { ItemEditDialog } from "./admin/ItemEditDialog";
import { OverviewAdminSection } from "./admin/OverviewAdminSection";
import { PatchDialog } from "./admin/PatchDialog";
import { PuzzleAdminSection } from "./admin/PuzzleAdminSection";
import { PuzzleEditDialog } from "./admin/PuzzleEditDialog";
import { filterAdminChampions, filterAdminItems, filterAdminPuzzles } from "./admin/adminFilters";
import type { SectionKey } from "./admin/adminOptions";

type DeleteTarget =
  | { type: "champion"; id: string; label: string }
  | { type: "item"; id: string; label: string }
  | { type: "puzzle"; id: string; label: string };

const adminNavigationItems: Array<{ key: SectionKey; label: string; icon: typeof Sparkles }> = [
  { key: "overview", label: "Vue d'ensemble", icon: Sparkles },
  { key: "champions", label: "Champions", icon: Brain },
  { key: "items", label: "Items", icon: Boxes },
  { key: "puzzles", label: "Puzzles", icon: BookOpenCheck },
];

const Admin = () => {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [section, setSection] = useState<SectionKey>("overview");
  const [championQuery, setChampionQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [puzzleQuery, setPuzzleQuery] = useState("");
  const [championEditor, setChampionEditor] = useState<ChampionView | null>(null);
  const [itemEditor, setItemEditor] = useState<GameItem | null>(null);
  const [puzzleEditorId, setPuzzleEditorId] = useState<string | null>(null);
  const [patchDialogOpen, setPatchDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const adminEnabled = Boolean(user?.isAdmin);

  const overview = useAdminOverview(adminEnabled);
  const champions = useAdminChampions(adminEnabled);
  const items = useAdminItems(adminEnabled);
  const puzzles = useAdminPuzzles(adminEnabled);
  const aiGeneratedPuzzles = useAdminAiGeneratedPuzzles(adminEnabled && section === "puzzles");
  const puzzleDetail = useAdminPuzzleDetail(puzzleEditorId, adminEnabled);
  const patchStatus = useAdminPatchStatus(patchDialogOpen && adminEnabled);

  const updateChampion = useAdminUpdateChampion();
  const updateItem = useAdminUpdateItem();
  const updatePuzzle = useAdminUpdatePuzzle();
  const publishPuzzle = useAdminPublishPuzzle();
  const deleteChampion = useAdminDeleteChampion();
  const deleteItem = useAdminDeleteItem();
  const deletePuzzle = useAdminDeletePuzzle();
  const syncPatch = useAdminSyncPatch();

  const filteredChampions = useMemo(() => filterAdminChampions(champions.data, championQuery), [champions.data, championQuery]);
  const filteredItems = useMemo(() => filterAdminItems(items.data, itemQuery), [items.data, itemQuery]);
  const filteredPuzzles = useMemo(() => filterAdminPuzzles(puzzles.data, puzzleQuery), [puzzles.data, puzzleQuery]);
  const filteredAiGeneratedPuzzles = useMemo(
    () => filterAdminPuzzles(aiGeneratedPuzzles.data, puzzleQuery),
    [aiGeneratedPuzzles.data, puzzleQuery],
  );

  if (!userLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (!userLoading && user && !user.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const publishAiPuzzle = (puzzleId: string) => {
    void publishPuzzle.mutateAsync(puzzleId).then(() => {
      toast.success("Puzzle AI publie.");
    }).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Publication impossible.");
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <SidebarProvider defaultOpen>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
            <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-yellow-600 text-primary-foreground shadow-lg shadow-primary/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Console admin</p>
                <p className="truncate text-xs uppercase tracking-[0.2em] text-muted-foreground">Summoner Build Lab</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNavigationItems.map((entry) => (
                    <SidebarMenuItem key={entry.key}>
                      <SidebarMenuButton
                        type="button"
                        isActive={section === entry.key}
                        onClick={() => setSection(entry.key)}
                        tooltip={entry.label}
                        className="h-11"
                      >
                        <entry.icon className="h-4 w-4" />
                        <span>{entry.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-3">
            <Button variant="outline" className="w-full justify-center" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Retour au site
              </Link>
            </Button>
            <Button variant="gold" className="w-full justify-center" onClick={() => setPatchDialogOpen(true)}>
              <RefreshCw className="h-4 w-4" />
              Nouveau patch
            </Button>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="bg-background">
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="h-10 w-10 rounded-xl border border-border/60 bg-card text-foreground hover:bg-card" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Administration</p>
                  <p className="text-sm text-muted-foreground">Catalogue, puzzles et synchronisation de patch</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4" />
                    Retour au site
                  </Link>
                </Button>
                <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
                  Admin connecte : {user?.username}
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {section === "overview" ? (
              <OverviewAdminSection overview={overview.data} onOpenPatchDialog={() => setPatchDialogOpen(true)} />
            ) : null}

            {section === "champions" ? (
              <ChampionAdminSection
                champions={filteredChampions}
                query={championQuery}
                onQueryChange={setChampionQuery}
                onEdit={setChampionEditor}
                onDelete={(entry) => setDeleteTarget({ type: "champion", id: entry.databaseId, label: entry.name })}
              />
            ) : null}

            {section === "items" ? (
              <ItemAdminSection
                items={filteredItems}
                query={itemQuery}
                onQueryChange={setItemQuery}
                onEdit={setItemEditor}
                onDelete={(entry) => setDeleteTarget({ type: "item", id: entry.databaseId, label: entry.name })}
              />
            ) : null}

            {section === "puzzles" ? (
              <PuzzleAdminSection
                puzzles={filteredPuzzles}
                aiGeneratedPuzzles={filteredAiGeneratedPuzzles}
                query={puzzleQuery}
                publishing={publishPuzzle.isPending}
                onQueryChange={setPuzzleQuery}
                onEdit={setPuzzleEditorId}
                onPublish={publishAiPuzzle}
                onDelete={(entry) => setDeleteTarget({ type: "puzzle", id: entry.id, label: entry.title })}
              />
            ) : null}
          </div>
        </SidebarInset>
      </SidebarProvider>

      <ChampionEditDialog
        champion={championEditor}
        open={Boolean(championEditor)}
        onOpenChange={(open) => {
          if (!open) setChampionEditor(null);
        }}
        onSave={async (payload) => {
          if (!championEditor) return;
          try {
            await updateChampion.mutateAsync({ id: championEditor.databaseId, data: payload });
            toast.success("Champion mis a jour.");
            setChampionEditor(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Impossible de mettre a jour le champion.");
          }
        }}
      />

      <ItemEditDialog
        item={itemEditor}
        open={Boolean(itemEditor)}
        onOpenChange={(open) => {
          if (!open) setItemEditor(null);
        }}
        onSave={async (payload) => {
          if (!itemEditor) return;
          try {
            await updateItem.mutateAsync({ id: itemEditor.databaseId, data: payload });
            toast.success("Item mis a jour.");
            setItemEditor(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Impossible de mettre a jour l'item.");
          }
        }}
      />

      <PuzzleEditDialog
        puzzle={puzzleDetail.data ?? null}
        champions={champions.data ?? []}
        loading={puzzleDetail.isLoading}
        open={Boolean(puzzleEditorId)}
        onOpenChange={(open) => {
          if (!open) setPuzzleEditorId(null);
        }}
        onSave={async (payload) => {
          if (!puzzleEditorId) return;
          try {
            await updatePuzzle.mutateAsync({ id: puzzleEditorId, data: payload });
            toast.success("Puzzle mis a jour.");
            setPuzzleEditorId(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Impossible de mettre a jour le puzzle.");
          }
        }}
      />

      <PatchDialog
        open={patchDialogOpen}
        onOpenChange={setPatchDialogOpen}
        loading={patchStatus.isLoading}
        status={patchStatus.data}
        syncing={syncPatch.isPending}
        onSync={async () => {
          try {
            await syncPatch.mutateAsync();
            toast.success("Synchronisation terminee.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "La synchronisation du patch a echoue.");
          }
        }}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open) {
          setDeleteTarget(null);
        }
      }}>
        <AlertDialogContent className="border-border/60 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Tu vas supprimer ${deleteTarget.type === "puzzle" ? "le puzzle" : deleteTarget.type === "item" ? "l'item" : "le champion"} "${deleteTarget.label}".`
                : ""}
              {" "}Cette action est irreversible. Si l'entite est encore referencee, la suppression sera refusee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  if (deleteTarget.type === "champion") {
                    await deleteChampion.mutateAsync(deleteTarget.id);
                  } else if (deleteTarget.type === "item") {
                    await deleteItem.mutateAsync(deleteTarget.id);
                  } else {
                    await deletePuzzle.mutateAsync(deleteTarget.id);
                  }
                  toast.success("Suppression terminee.");
                  setDeleteTarget(null);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Suppression impossible.");
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
