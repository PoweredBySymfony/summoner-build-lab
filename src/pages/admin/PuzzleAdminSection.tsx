import { ImageIcon, PencilLine, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PuzzleListItem } from "@/types/domain";
import { AdminSearchField, ChampionThumb, SectionHeader } from "./shared";

export function PuzzleAdminSection({
  puzzles,
  aiGeneratedPuzzles,
  query,
  publishing,
  onQueryChange,
  onEdit,
  onPublish,
  onDelete,
}: Readonly<{
  puzzles: PuzzleListItem[];
  aiGeneratedPuzzles: PuzzleListItem[];
  query: string;
  publishing: boolean;
  onQueryChange: (value: string) => void;
  onEdit: (puzzleId: string) => void;
  onPublish: (puzzleId: string) => void;
  onDelete: (puzzle: PuzzleListItem) => void;
}>) {
  return (
    <div className="space-y-5">
      <SectionHeader title="Bibliotheque puzzles" description="Tous les puzzles, y compris les brouillons, avec acces au detail, au champion associe et aux contenus a corriger." />
      <AdminSearchField value={query} onChange={onQueryChange} placeholder="Filtrer par titre, mode, difficulte..." />
      <AiGeneratedPuzzleQueue
        puzzles={aiGeneratedPuzzles}
        publishing={publishing}
        onEdit={onEdit}
        onPublish={onPublish}
      />
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
            {puzzles.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {entry.champion ? <ChampionThumb src={entry.champion.icon} alt={entry.champion.name} /> : <PuzzleFallbackThumb />}
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
                    <Button variant="outline" onClick={() => onEdit(entry.id)}>
                      <PencilLine className="h-4 w-4" />
                      Consulter / modifier
                    </Button>
                    <Button variant="destructive" onClick={() => onDelete(entry)}>
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
  );
}

function AiGeneratedPuzzleQueue({
  puzzles,
  publishing,
  onEdit,
  onPublish,
}: Readonly<{
  puzzles: PuzzleListItem[];
  publishing: boolean;
  onEdit: (puzzleId: string) => void;
  onPublish: (puzzleId: string) => void;
}>) {
  return (
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
          En attente: <span className="font-semibold">{puzzles.length}</span>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {puzzles.length ? (
          puzzles.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/80 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{entry.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.champion?.name ?? "Sans champion"} · patch {entry.patch} · source {entry.sourceType}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => onEdit(entry.id)}>
                  <PencilLine className="h-4 w-4" />
                  Ouvrir
                </Button>
                <Button variant="gold" disabled={publishing} onClick={() => onPublish(entry.id)}>
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
  );
}

function PuzzleFallbackThumb() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-card">
      <ImageIcon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
