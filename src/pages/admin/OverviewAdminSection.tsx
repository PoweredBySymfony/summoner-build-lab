import { BookOpenCheck, Boxes, Brain, Flame, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminOverviewPayload } from "@/types/domain";
import { SectionHeader, StatTile } from "./shared";

export function OverviewAdminSection({
  overview,
  onOpenPatchDialog,
}: Readonly<{
  overview: AdminOverviewPayload | undefined;
  onOpenPatchDialog: () => void;
}>) {
  return (
    <>
      <SectionHeader
        title="Vue d'ensemble du backoffice"
        description="Controle les champions, les items et les puzzles actuellement en base, avec un point de controle explicite sur la version de patch locale."
        action={
          <Button variant="gold" onClick={onOpenPatchDialog}>
            <RefreshCw className="h-4 w-4" />
            Nouveau patch sorti, mettre a jour les donnees
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Brain} label="Champions synchronises" value={overview?.stats.championCount ?? "..."} hint="Base consultable avec images et edition." />
        <StatTile icon={Boxes} label="Items enregistres" value={overview?.stats.itemCount ?? "..."} hint="Le total actuel de la base d'items Riot." />
        <StatTile icon={BookOpenCheck} label="Puzzles" value={overview?.stats.puzzleCount ?? "..."} hint="Inclut les puzzles publies et brouillons." />
        <StatTile icon={Flame} label="Patch local" value={overview?.patch.localLatestPatch ?? "Inconnu"} hint={`Patch distant detecte : ${overview?.patch.remoteLatestPatch ?? "..."}`} />
      </div>
    </>
  );
}
