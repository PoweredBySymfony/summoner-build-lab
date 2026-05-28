import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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
import type { ChampionView, GameItem, PuzzleDetail } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type SectionKey = "overview" | "champions" | "items" | "puzzles";

const roleOptions = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FLEX"] as const;
const puzzleModes = ["GENERAL", "CHAMPION_SPECIFIC", "PERSONALIZED", "DAILY"] as const;
const puzzleDifficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

function parseJsonField<T>(value: string, fallback: T) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return JSON.parse(trimmed) as T;
}

function ChampionThumb({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="h-12 w-12 rounded-xl border border-border/60 object-cover shadow-md shadow-black/20" />;
}

function ItemThumb({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="h-12 w-12 rounded-xl border border-border/60 object-cover shadow-md shadow-black/20" />;
}

function StatTile({ icon: Icon, label, value, hint }: { icon: typeof Brain; label: string; value: string | number; hint: string }) {
  return (
    <div className="surface-elevated rounded-2xl p-5">
      <Icon className="mb-4 h-5 w-5 text-primary" />
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">Backoffice</p>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      <Textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

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

function ChampionEditDialog({
  champion,
  open,
  onOpenChange,
  onSave,
}: {
  champion: ChampionView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    title: "",
    rolePrimary: "",
    roleSecondary: "",
    patch: "",
    image: "",
    iconImage: "",
    splashImage: "",
    isActive: true,
    tags: "[]",
    stats: "{}",
  });

  useEffect(() => {
    if (!champion) return;
    setForm({
      name: champion.name,
      title: champion.title ?? "",
      rolePrimary: champion.roles[0]?.toUpperCase() ?? "",
      roleSecondary: champion.roles[1]?.toUpperCase() ?? "",
      patch: champion.patch,
      image: champion.image,
      iconImage: champion.icon,
      splashImage: champion.splashImage ?? "",
      isActive: champion.isActive,
      tags: JSON.stringify(champion.tags, null, 2),
      stats: JSON.stringify(champion.stats, null, 2),
    });
  }, [champion]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle>Modifier le champion</DialogTitle>
          <DialogDescription>Controle rapide des roles, des images et des donnees exposees a l'application.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            {champion ? <img src={form.iconImage || champion.icon} alt={champion.name} className="h-48 w-48 rounded-3xl border border-border/60 object-cover" /> : null}
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              Si une image casse, tu peux la corriger ici directement avant un resync plus global.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Nom" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
            <InputField label="Patch" value={form.patch} onChange={(value) => setForm((current) => ({ ...current, patch: value }))} />
            <InputField label="Titre" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
            <ToggleField label="Actif" checked={form.isActive} onCheckedChange={(value) => setForm((current) => ({ ...current, isActive: value }))} />
            <InputField label="Role principal" value={form.rolePrimary} onChange={(value) => setForm((current) => ({ ...current, rolePrimary: value }))} />
            <InputField label="Role secondaire" value={form.roleSecondary} onChange={(value) => setForm((current) => ({ ...current, roleSecondary: value }))} />
            <div className="md:col-span-2">
              <InputField label="Image" value={form.image} onChange={(value) => setForm((current) => ({ ...current, image: value }))} />
            </div>
            <div className="md:col-span-2">
              <InputField label="Icone" value={form.iconImage} onChange={(value) => setForm((current) => ({ ...current, iconImage: value }))} />
            </div>
            <div className="md:col-span-2">
              <InputField label="Splash" value={form.splashImage} onChange={(value) => setForm((current) => ({ ...current, splashImage: value }))} />
            </div>
            <div className="md:col-span-2">
              <TextareaField label="Tags JSON" value={form.tags} onChange={(value) => setForm((current) => ({ ...current, tags: value }))} rows={4} />
            </div>
            <div className="md:col-span-2">
              <TextareaField label="Stats JSON" value={form.stats} onChange={(value) => setForm((current) => ({ ...current, stats: value }))} rows={7} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="gold"
            onClick={() => {
              try {
                void onSave({
                  name: form.name,
                  title: form.title || null,
                  rolePrimary: form.rolePrimary || null,
                  roleSecondary: form.roleSecondary || null,
                  patch: form.patch,
                  isActive: form.isActive,
                  image: form.image,
                  iconImage: form.iconImage || null,
                  splashImage: form.splashImage || null,
                  tags: parseJsonField<string[]>(form.tags, []),
                  stats: parseJsonField<Record<string, unknown>>(form.stats, {}),
                });
              } catch {
                toast.error("Le JSON du champion est invalide.");
              }
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemEditDialog({
  item,
  open,
  onOpenChange,
  onSave,
}: {
  item: GameItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    shortDescription: "",
    fullDescription: "",
    image: "",
    patch: "",
    category: "",
    goldTotal: "0",
    goldBase: "",
    goldSell: "",
    isBoots: false,
    isLegendary: false,
    isConsumable: false,
    isTrinket: false,
    isStarter: false,
    isActive: true,
    activeEffect: "",
    passiveEffect: "",
    tags: "[]",
    stats: "{}",
    buildsFrom: "[]",
    buildsInto: "[]",
  });

  useEffect(() => {
    if (!item) return;
    setForm({
      name: item.name,
      shortDescription: item.shortDescription ?? "",
      fullDescription: item.fullDescription ?? "",
      image: item.image,
      patch: item.patch,
      category: item.category ?? "",
      goldTotal: String(item.cost),
      goldBase: item.baseCost != null ? String(item.baseCost) : "",
      goldSell: item.sellPrice != null ? String(item.sellPrice) : "",
      isBoots: item.isBoots,
      isLegendary: item.isLegendary,
      isConsumable: item.isConsumable,
      isTrinket: item.isTrinket,
      isStarter: item.isStarter,
      isActive: item.isActive,
      activeEffect: item.activeEffect ?? "",
      passiveEffect: item.passiveEffect ?? "",
      tags: JSON.stringify(item.tags, null, 2),
      stats: JSON.stringify(item.stats, null, 2),
      buildsFrom: JSON.stringify(item.buildsFrom, null, 2),
      buildsInto: JSON.stringify(item.buildsInto, null, 2),
    });
  }, [item]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle>Modifier l'item</DialogTitle>
          <DialogDescription>Verification du visuel, des couts et des textes enregistres pour l'item selectionne.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            {item ? <img src={form.image || item.image} alt={item.name} className="h-48 w-48 rounded-3xl border border-border/60 object-cover" /> : null}
            <div className="grid gap-3">
              <ToggleField label="Actif" checked={form.isActive} onCheckedChange={(value) => setForm((current) => ({ ...current, isActive: value }))} />
              <ToggleField label="Boots" checked={form.isBoots} onCheckedChange={(value) => setForm((current) => ({ ...current, isBoots: value }))} />
              <ToggleField label="Legendaire" checked={form.isLegendary} onCheckedChange={(value) => setForm((current) => ({ ...current, isLegendary: value }))} />
              <ToggleField label="Consommable" checked={form.isConsumable} onCheckedChange={(value) => setForm((current) => ({ ...current, isConsumable: value }))} />
              <ToggleField label="Trinket" checked={form.isTrinket} onCheckedChange={(value) => setForm((current) => ({ ...current, isTrinket: value }))} />
              <ToggleField label="Starter" checked={form.isStarter} onCheckedChange={(value) => setForm((current) => ({ ...current, isStarter: value }))} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <InputField label="Nom" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
            <InputField label="Patch" value={form.patch} onChange={(value) => setForm((current) => ({ ...current, patch: value }))} />
            <InputField label="Categorie" value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value }))} />
            <InputField label="Image" value={form.image} onChange={(value) => setForm((current) => ({ ...current, image: value }))} />
            <InputField label="Cout total" type="number" value={form.goldTotal} onChange={(value) => setForm((current) => ({ ...current, goldTotal: value }))} />
            <InputField label="Cout de base" type="number" value={form.goldBase} onChange={(value) => setForm((current) => ({ ...current, goldBase: value }))} />
            <InputField label="Prix de revente" type="number" value={form.goldSell} onChange={(value) => setForm((current) => ({ ...current, goldSell: value }))} />
            <InputField label="Effet actif" value={form.activeEffect} onChange={(value) => setForm((current) => ({ ...current, activeEffect: value }))} />
            <div className="md:col-span-2">
              <TextareaField label="Description courte" value={form.shortDescription} onChange={(value) => setForm((current) => ({ ...current, shortDescription: value }))} rows={3} />
            </div>
            <div className="md:col-span-2">
              <TextareaField label="Description complete" value={form.fullDescription} onChange={(value) => setForm((current) => ({ ...current, fullDescription: value }))} rows={4} />
            </div>
            <div className="md:col-span-2">
              <TextareaField label="Effet passif" value={form.passiveEffect} onChange={(value) => setForm((current) => ({ ...current, passiveEffect: value }))} rows={3} />
            </div>
            <div className="md:col-span-2">
              <TextareaField label="Tags JSON" value={form.tags} onChange={(value) => setForm((current) => ({ ...current, tags: value }))} rows={4} />
            </div>
            <div className="md:col-span-2">
              <TextareaField label="Stats JSON" value={form.stats} onChange={(value) => setForm((current) => ({ ...current, stats: value }))} rows={5} />
            </div>
            <div className="md:col-span-2">
              <TextareaField label="Builds from JSON" value={form.buildsFrom} onChange={(value) => setForm((current) => ({ ...current, buildsFrom: value }))} rows={4} />
            </div>
            <div className="md:col-span-2">
              <TextareaField label="Builds into JSON" value={form.buildsInto} onChange={(value) => setForm((current) => ({ ...current, buildsInto: value }))} rows={4} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="gold"
            onClick={() => {
              try {
                void onSave({
                  name: form.name,
                  shortDescription: form.shortDescription || null,
                  fullDescription: form.fullDescription || null,
                  image: form.image,
                  patch: form.patch,
                  category: form.category || null,
                  goldTotal: Number(form.goldTotal || 0),
                  goldBase: form.goldBase ? Number(form.goldBase) : null,
                  goldSell: form.goldSell ? Number(form.goldSell) : null,
                  isBoots: form.isBoots,
                  isLegendary: form.isLegendary,
                  isConsumable: form.isConsumable,
                  isTrinket: form.isTrinket,
                  isStarter: form.isStarter,
                  isActive: form.isActive,
                  activeEffect: form.activeEffect || null,
                  passiveEffect: form.passiveEffect || null,
                  tags: parseJsonField<string[]>(form.tags, []),
                  stats: parseJsonField<Record<string, unknown>>(form.stats, {}),
                  buildsFrom: parseJsonField<string[]>(form.buildsFrom, []),
                  buildsInto: parseJsonField<string[]>(form.buildsInto, []),
                });
              } catch {
                toast.error("Le JSON de l'item est invalide.");
              }
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PuzzleEditDialog({
  puzzle,
  champions,
  loading,
  open,
  onOpenChange,
  onSave,
}: {
  puzzle: PuzzleDetail | null;
  champions: ChampionView[];
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: "",
    slug: "",
    mode: "GENERAL",
    difficulty: "BEGINNER",
    role: "",
    championId: "",
    patch: "",
    description: "",
    shortPrompt: "",
    situation: "",
    question: "",
    explanation: "",
    isPublished: false,
    isDailyEligible: false,
  });

  useEffect(() => {
    if (!puzzle) return;
    setForm({
      title: puzzle.title,
      slug: puzzle.slug,
      mode: puzzle.modeKey,
      difficulty: puzzle.difficultyKey,
      role: puzzle.roleKey ?? "",
      championId: puzzle.champion?.databaseId ?? "",
      patch: puzzle.patch,
      description: puzzle.description,
      shortPrompt: puzzle.shortPrompt,
      situation: puzzle.situation,
      question: puzzle.question,
      explanation: puzzle.explanation,
      isPublished: puzzle.isPublished,
      isDailyEligible: puzzle.isDailyEligible,
    });
  }, [puzzle]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle>Consulter / modifier le puzzle</DialogTitle>
          <DialogDescription>Correction du contenu, de la publication et verification rapide du scenario et des choix.</DialogDescription>
        </DialogHeader>
        {loading || !puzzle ? (
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">Chargement du puzzle...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InputField label="Titre" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
              <InputField label="Slug" value={form.slug} onChange={(value) => setForm((current) => ({ ...current, slug: value }))} />
              <InputField label="Mode" value={form.mode} onChange={(value) => setForm((current) => ({ ...current, mode: value }))} />
              <InputField label="Difficulte" value={form.difficulty} onChange={(value) => setForm((current) => ({ ...current, difficulty: value }))} />
              <InputField label="Role" value={form.role} onChange={(value) => setForm((current) => ({ ...current, role: value }))} />
              <InputField label="Patch" value={form.patch} onChange={(value) => setForm((current) => ({ ...current, patch: value }))} />
              <div className="md:col-span-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">Champion associe</span>
                  <select
                    value={form.championId}
                    onChange={(event) => setForm((current) => ({ ...current, championId: event.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sans champion</option>
                    {champions.map((entry) => (
                      <option key={entry.databaseId} value={entry.databaseId}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ToggleField label="Publie" checked={form.isPublished} onCheckedChange={(value) => setForm((current) => ({ ...current, isPublished: value }))} />
              <ToggleField label="Eligible daily" checked={form.isDailyEligible} onCheckedChange={(value) => setForm((current) => ({ ...current, isDailyEligible: value }))} />
            </div>
            <div className="grid gap-4">
              <TextareaField label="Description" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} rows={3} />
              <TextareaField label="Prompt court" value={form.shortPrompt} onChange={(value) => setForm((current) => ({ ...current, shortPrompt: value }))} rows={3} />
              <TextareaField label="Situation" value={form.situation} onChange={(value) => setForm((current) => ({ ...current, situation: value }))} rows={4} />
              <TextareaField label="Question" value={form.question} onChange={(value) => setForm((current) => ({ ...current, question: value }))} rows={3} />
              <TextareaField label="Explication globale" value={form.explanation} onChange={(value) => setForm((current) => ({ ...current, explanation: value }))} rows={4} />
            </div>
            <Tabs defaultValue="choices">
              <TabsList className="bg-muted/60">
                <TabsTrigger value="choices">Choix</TabsTrigger>
                <TabsTrigger value="scenario">Scenario</TabsTrigger>
              </TabsList>
              <TabsContent value="choices">
                <div className="space-y-3">
                  {puzzle.choices.map((choice) => (
                    <div key={choice.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{choice.label}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{choice.choiceType}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${choice.isCorrect ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {choice.isCorrect ? "Bonne reponse" : "Distracteur"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{choice.explanation}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="scenario">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  {puzzle.scenario ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div><p className="text-xs uppercase tracking-[0.2em] text-primary">Champion</p><p className="mt-2 text-foreground">{puzzle.scenario.playerChampion.name}</p></div>
                      <div><p className="text-xs uppercase tracking-[0.2em] text-primary">Role</p><p className="mt-2 text-foreground">{puzzle.scenario.playerRole}</p></div>
                      <div><p className="text-xs uppercase tracking-[0.2em] text-primary">Minute</p><p className="mt-2 text-foreground">{puzzle.scenario.gameMinute}</p></div>
                      <div><p className="text-xs uppercase tracking-[0.2em] text-primary">Gold</p><p className="mt-2 text-foreground">{puzzle.scenario.playerGold}</p></div>
                    </div>
                  ) : (
                    "Aucun scenario detaille n'est attache a ce puzzle."
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="gold"
            disabled={!puzzle}
            onClick={() =>
              void onSave({
                title: form.title,
                slug: form.slug,
                mode: puzzleModes.includes(form.mode as (typeof puzzleModes)[number]) ? form.mode : "GENERAL",
                difficulty: puzzleDifficulties.includes(form.difficulty as (typeof puzzleDifficulties)[number]) ? form.difficulty : "BEGINNER",
                role: roleOptions.includes(form.role as (typeof roleOptions)[number]) ? form.role : null,
                championId: form.championId || null,
                patch: form.patch,
                description: form.description,
                shortPrompt: form.shortPrompt,
                situation: form.situation,
                question: form.question,
                explanation: form.explanation,
                isPublished: form.isPublished,
                isDailyEligible: form.isDailyEligible,
              })
            }
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatchDialog({
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

export default Admin;
