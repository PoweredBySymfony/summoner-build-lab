import { PencilLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChampionView } from "@/types/domain";
import { AdminSearchField, ChampionThumb, SectionHeader } from "./shared";

export function ChampionAdminSection({
  champions,
  query,
  onQueryChange,
  onEdit,
  onDelete,
}: {
  champions: ChampionView[];
  query: string;
  onQueryChange: (value: string) => void;
  onEdit: (champion: ChampionView) => void;
  onDelete: (champion: ChampionView) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader title="Catalogue champions" description="Liste complete des champions enregistres avec leur image, leurs roles, leur patch et leur statut d'activation." />
      <AdminSearchField value={query} onChange={onQueryChange} placeholder="Filtrer par nom, role, patch..." />
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
            {champions.map((entry) => (
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
                    <Button variant="outline" onClick={() => onEdit(entry)}>
                      <PencilLine className="h-4 w-4" />
                      Modifier
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
