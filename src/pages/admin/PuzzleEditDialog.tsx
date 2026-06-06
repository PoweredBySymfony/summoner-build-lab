import { useEffect, useState } from "react";
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
import type { AdminPuzzleUpdatePayload, ChampionView, PuzzleDetail } from "@/types/domain";
import { puzzleDifficulties, puzzleModes, roleOptions } from "./adminOptions";
import { InputField, TextareaField, ToggleField } from "./shared";

export function PuzzleEditDialog({
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
  onSave: (payload: AdminPuzzleUpdatePayload) => Promise<void>;
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
                mode: (puzzleModes.includes(form.mode as (typeof puzzleModes)[number]) ? form.mode : "GENERAL") as AdminPuzzleUpdatePayload["mode"],
                difficulty: (puzzleDifficulties.includes(form.difficulty as (typeof puzzleDifficulties)[number]) ? form.difficulty : "BEGINNER") as AdminPuzzleUpdatePayload["difficulty"],
                role: (roleOptions.includes(form.role as (typeof roleOptions)[number]) ? form.role : null) as AdminPuzzleUpdatePayload["role"],
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
