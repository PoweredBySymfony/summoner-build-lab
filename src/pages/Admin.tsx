import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  BookOpenCheck,
  Brain,
  Boxes,
  Flame,
  ImageIcon,
  PencilLine,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  useAdminAiGeneratedPuzzles,
  useAdminDeleteChampion,
  useAdminDeleteItem,
  useAdminDeletePuzzle,
  useAdminChampions,
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
import type { ChampionView, GameItem } from "@/types/domain";
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
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ChampionThumb,
  ItemThumb,
  SectionHeader,
  StatTile,
} from "./admin/shared";
import { ChampionEditDialog } from "./admin/ChampionEditDialog";
import { ItemEditDialog } from "./admin/ItemEditDialog";
import { PatchDialog } from "./admin/PatchDialog";
import { PuzzleEditDialog } from "./admin/PuzzleEditDialog";
import { type SectionKey } from "./admin/adminOptions";

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
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "champion"; id: string; label: string }
    | { type: "item"; id: string; label: string }
    | { type: "puzzle"; id: string; label: string }
    | null
  >(null);
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

  const filteredChampions = useMemo(() => {
    const query = championQuery.trim().toLowerCase();
    return (champions.data ?? []).filter((entry) =>
      [entry.name, entry.title ?? "", entry.patch, ...entry.roles].some((value) => value.toLowerCase().includes(query)),
    );
  }, [champions.data, championQuery]);

  const filteredItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    return (items.data ?? []).filter((entry) =>
      [entry.name, entry.category ?? "", entry.patch, ...entry.tags].some((value) => value.toLowerCase().includes(query)),
    );
  }, [items.data, itemQuery]);

  const filteredPuzzles = useMemo(() => {
    const query = puzzleQuery.trim().toLowerCase();
    return (puzzles.data ?? []).filter((entry) =>
      [entry.title, entry.mode, entry.difficulty, entry.patch, entry.champion?.name ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [puzzles.data, puzzleQuery]);

  const filteredAiGeneratedPuzzles = useMemo(() => {
    const query = puzzleQuery.trim().toLowerCase();
    return (aiGeneratedPuzzles.data ?? []).filter((entry) =>
      [entry.title, entry.mode, entry.difficulty, entry.patch, entry.champion?.name ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [aiGeneratedPuzzles.data, puzzleQuery]);

  if (!userLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (!userLoading && user && !user.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

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
                  {[
                    { key: "overview", label: "Vue d'ensemble", icon: Sparkles },
                    { key: "champions", label: "Champions", icon: Brain },
                    { key: "items", label: "Items", icon: Boxes },
                    { key: "puzzles", label: "Puzzles", icon: BookOpenCheck },
                  ].map((entry) => (
                    <SidebarMenuItem key={entry.key}>
                      <SidebarMenuButton
                        type="button"
                        isActive={section === entry.key}
                        onClick={() => setSection(entry.key as SectionKey)}
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
              <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
                Admin connecte : {user?.username}
              </div>
            </div>
          </header>

          <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {section === "overview" ? (
              <>
                <SectionHeader
                  title="Vue d'ensemble du backoffice"
                  description="Controle les champions, les items et les puzzles actuellement en base, avec un point de controle explicite sur la version de patch locale."
                  action={
                    <Button variant="gold" onClick={() => setPatchDialogOpen(true)}>
                      <RefreshCw className="h-4 w-4" />
                      Nouveau patch sorti, mettre a jour les donnees
                    </Button>
                  }
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatTile icon={Brain} label="Champions synchronises" value={overview.data?.stats.championCount ?? "..."} hint="Base consultable avec images et edition." />
                  <StatTile icon={Boxes} label="Items enregistres" value={overview.data?.stats.itemCount ?? "..."} hint="Le total actuel de la base d'items Riot." />
                  <StatTile icon={BookOpenCheck} label="Puzzles" value={overview.data?.stats.puzzleCount ?? "..."} hint="Inclut les puzzles publies et brouillons." />
                  <StatTile icon={Flame} label="Patch local" value={overview.data?.patch.localLatestPatch ?? "Inconnu"} hint={`Patch distant detecte : ${overview.data?.patch.remoteLatestPatch ?? "..."}`} />
                </div>
              </>
            ) : null}

            {section === "champions" ? (
              <div className="space-y-5">
                <SectionHeader title="Catalogue champions" description="Liste complete des champions enregistres avec leur image, leurs roles, leur patch et leur statut d'activation." />
                <div className="flex max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input value={championQuery} onChange={(event) => setChampionQuery(event.target.value)} placeholder="Filtrer par nom, role, patch..." className="border-0 bg-transparent p-0 focus-visible:ring-0" />
                </div>
                <div className="glass-surface overflow-hidden rounded-[28px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Champion</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Patch</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChampions.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <ChampionThumb src={entry.icon} alt={entry.name} />
                              <div>
                                <p className="font-medium text-foreground">{entry.name}</p>
                                <p className="text-xs text-muted-foreground">{entry.title || "Sans sous-titre"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{entry.roles.join(" / ") || "Non defini"}</TableCell>
                          <TableCell>{entry.patch}</TableCell>
                          <TableCell>{entry.isActive ? "Actif" : "Archive"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setChampionEditor(entry)}>
                                <PencilLine className="h-4 w-4" />
                                Modifier
                              </Button>
                              <Button variant="destructive" onClick={() => setDeleteTarget({ type: "champion", id: entry.databaseId, label: entry.name })}>
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {section === "items" ? (
              <div className="space-y-5">
                <SectionHeader title="Catalogue items" description="Inventaire complet des items actuellement sauvegardes, avec image, cout, categorie et patch." />
                <div className="flex max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Filtrer par nom, categorie, patch..." className="border-0 bg-transparent p-0 focus-visible:ring-0" />
                </div>
                <div className="glass-surface overflow-hidden rounded-[28px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Categorie</TableHead>
                        <TableHead>Cout total</TableHead>
                        <TableHead>Patch</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <ItemThumb src={entry.icon} alt={entry.name} />
                              <div>
                                <p className="font-medium text-foreground">{entry.name}</p>
                                <p className="text-xs text-muted-foreground">{entry.shortDescription || "Sans description courte"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{entry.category || "Non classe"}</TableCell>
                          <TableCell>{entry.cost}</TableCell>
                          <TableCell>{entry.patch}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setItemEditor(entry)}>
                                <PencilLine className="h-4 w-4" />
                                Modifier
                              </Button>
                              <Button variant="destructive" onClick={() => setDeleteTarget({ type: "item", id: entry.databaseId, label: entry.name })}>
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {section === "puzzles" ? (
              <div className="space-y-5">
                <SectionHeader title="Bibliotheque puzzles" description="Tous les puzzles, y compris les brouillons, avec acces au detail, au champion associe et aux contenus a corriger." />
                <div className="flex max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input value={puzzleQuery} onChange={(event) => setPuzzleQuery(event.target.value)} placeholder="Filtrer par titre, mode, difficulte..." className="border-0 bg-transparent p-0 focus-visible:ring-0" />
                </div>
                <div className="rounded-[28px] border border-primary/20 bg-primary/5 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Review queue ML</p>
                      <h2 className="mt-2 text-xl font-semibold text-foreground">Puzzles AI_GENERATED non publies</h2>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        Cette file sert de garde-fou avant publication. Les puzzles a faible confiance ne sont pas publies automatiquement.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-primary/20 bg-background/80 px-4 py-3 text-sm text-foreground">
                      En attente: <span className="font-semibold">{filteredAiGeneratedPuzzles.length}</span>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {filteredAiGeneratedPuzzles.length ? (
                      filteredAiGeneratedPuzzles.map((entry) => (
                        <div key={entry.id} className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{entry.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {entry.champion?.name ?? "Sans champion"} · patch {entry.patch} · source {entry.sourceType}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => setPuzzleEditorId(entry.id)}>
                              <PencilLine className="h-4 w-4" />
                              Ouvrir
                            </Button>
                            <Button
                              variant="gold"
                              disabled={publishPuzzle.isPending}
                              onClick={() =>
                                void publishPuzzle.mutateAsync(entry.id).then(() => {
                                  toast.success("Puzzle AI publie.");
                                }).catch((error: unknown) => {
                                  toast.error(error instanceof Error ? error.message : "Publication impossible.");
                                })
                              }
                            >
                              <Sparkles className="h-4 w-4" />
                              Publier
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                        Aucun puzzle AI_GENERATED non publie pour le filtre courant.
                      </div>
                    )}
                  </div>
                </div>
                <div className="glass-surface overflow-hidden rounded-[28px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Puzzle</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Difficulte</TableHead>
                        <TableHead>Patch</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPuzzles.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {entry.champion ? <ChampionThumb src={entry.champion.icon} alt={entry.champion.name} /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-card"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>}
                              <div>
                                <p className="font-medium text-foreground">{entry.title}</p>
                                <p className="text-xs text-muted-foreground">{entry.champion?.name ?? "Sans champion"} · {entry.choiceCount} choix</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{entry.mode}</TableCell>
                          <TableCell>{entry.difficulty}</TableCell>
                          <TableCell>{entry.patch}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setPuzzleEditorId(entry.id)}>
                                <PencilLine className="h-4 w-4" />
                                Consulter / modifier
                              </Button>
                              <Button variant="destructive" onClick={() => setDeleteTarget({ type: "puzzle", id: entry.id, label: entry.title })}>
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
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
