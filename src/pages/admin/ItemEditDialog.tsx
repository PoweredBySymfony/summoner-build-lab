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
import type { AdminItemUpdatePayload, GameItem } from "@/types/domain";
import { InputField, TextareaField, ToggleField } from "./shared";
import { parseJsonField } from "./parseJsonField";

export function ItemEditDialog({
  item,
  open,
  onOpenChange,
  onSave,
}: Readonly<{
  item: GameItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: AdminItemUpdatePayload) => Promise<void>;
}>) {
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
      goldBase: item.baseCost == null ? "" : String(item.baseCost),
      goldSell: item.sellPrice == null ? "" : String(item.sellPrice),
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
