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
import type { GameItem } from "@/types/domain";
import { AdminSearchField, ItemThumb, SectionHeader } from "./shared";

export function ItemAdminSection({
  items,
  query,
  onQueryChange,
  onEdit,
  onDelete,
}: {
  items: GameItem[];
  query: string;
  onQueryChange: (value: string) => void;
  onEdit: (item: GameItem) => void;
  onDelete: (item: GameItem) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader title="Catalogue items" description="Inventaire complet des items actuellement sauvegardes, avec image, cout, categorie et patch." />
      <AdminSearchField value={query} onChange={onQueryChange} placeholder="Filtrer par nom, categorie, patch..." />
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
            {items.map((entry) => (
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
