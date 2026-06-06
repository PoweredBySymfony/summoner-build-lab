import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminChampionUpdatePayload, ChampionView } from "@/types/domain";
import { InputField, TextareaField, ToggleField } from "./shared";
import { parseJsonField } from "./parseJsonField";

export function ChampionEditDialog({
  champion,
  open,
  onOpenChange,
  onSave,
}: {
  champion: ChampionView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: AdminChampionUpdatePayload) => Promise<void>;
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
                  rolePrimary: (form.rolePrimary || null) as AdminChampionUpdatePayload["rolePrimary"],
                  roleSecondary: (form.roleSecondary || null) as AdminChampionUpdatePayload["roleSecondary"],
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
