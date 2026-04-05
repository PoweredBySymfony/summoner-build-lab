import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GeneratedPuzzleItemExplanation, PuzzleDetail } from "@/types/domain";

interface PuzzleItemExplanationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puzzle: PuzzleDetail;
  selectedChoiceId: string | null;
  result: {
    isCorrect: boolean;
    correctChoiceId: string | null;
  } | null;
}

function toCsv(rows: GeneratedPuzzleItemExplanation["exportPayload"]["rows"]) {
  const header = ["type", "label", "recommended", "compared", "delta"];
  const lines = rows.map((row) =>
    [row.type, row.label, row.recommended, row.compared, row.delta]
      .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
      .join(","));
  return [header.join(","), ...lines].join("\n");
}

export function PuzzleItemExplanationDialog({
  open,
  onOpenChange,
  puzzle,
  selectedChoiceId,
  result,
}: PuzzleItemExplanationDialogProps) {
  const [comparedItemSlug, setComparedItemSlug] = useState<string | undefined>(undefined);

  const loadExplanation = useMutation({
    mutationFn: (payload: { comparedItemSlug?: string }) =>
      apiFetch<GeneratedPuzzleItemExplanation>("/generated-puzzles/item-explanation", {
        method: "POST",
        body: JSON.stringify({
          puzzleSlug: puzzle.slug,
          selectedChoiceId: selectedChoiceId ?? undefined,
          comparedItemSlug: payload.comparedItemSlug,
        }),
      }),
  });

  useEffect(() => {
    if (!open || !result) {
      return;
    }
    loadExplanation.mutate({ comparedItemSlug });
  }, [open, result, comparedItemSlug, loadExplanation]);

  useEffect(() => {
    if (!open) {
      setComparedItemSlug(undefined);
    }
  }, [open]);

  const explanation = loadExplanation.data;
  const selectableAlternatives = useMemo(
    () =>
      explanation?.budgetEligibleAlternatives.filter((entry) => (entry.blockedReasons?.length ?? 0) === 0) ?? [],
    [explanation],
  );

  const handleExport = () => {
    if (!explanation) {
      return;
    }
    const blob = new Blob([toCsv(explanation.exportPayload.rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = explanation.exportPayload.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto rounded-3xl border-border/60 bg-background p-0">
        <div className="bg-gradient-to-r from-primary/10 via-background to-background p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-heading text-3xl text-foreground">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </span>
              Preuve item
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Comparaison chiffrée entre la bonne réponse et une autre option, avec filtre budget/famille et export CSV.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[280px] flex-1">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-primary">Item comparé</span>
              <select
                value={comparedItemSlug ?? explanation?.comparedItem.slug ?? ""}
                onChange={(event) => setComparedItemSlug(event.target.value || undefined)}
                className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground"
              >
                <option value="">Selection automatique</option>
                {selectableAlternatives.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.name} ({entry.goldTotal} or)
                  </option>
                ))}
              </select>
            </label>
            <Button variant="outline" onClick={() => loadExplanation.mutate({ comparedItemSlug })} disabled={loadExplanation.isPending}>
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
            <Button variant="gold" onClick={handleExport} disabled={!explanation}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {loadExplanation.isPending ? (
            <div className="rounded-3xl border border-border/60 bg-background/50 px-5 py-6 text-sm text-muted-foreground">
              Calcul de la preuve item...
            </div>
          ) : null}

          {explanation ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Bonne réponse</p>
                  <h3 className="mt-2 text-2xl font-bold text-foreground">{explanation.recommendedItem.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{explanation.recommendedItem.goldTotal} or</p>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/60 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Comparaison</p>
                  <h3 className="mt-2 text-2xl font-bold text-foreground">{explanation.comparedItem.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{explanation.comparedItem.goldTotal} or</p>
                  {explanation.blockedReasons.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {explanation.blockedReasons.map((reason) => (
                        <div key={`${reason.code}-${reason.message}`} className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                          {reason.message}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-border/60 bg-background/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Delta de stats</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <th className="pb-3">Stat</th>
                        <th className="pb-3">Bonne réponse</th>
                        <th className="pb-3">Comparée</th>
                        <th className="pb-3">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {explanation.statRows.map((row) => (
                        <tr key={row.key} className="border-b border-border/40 last:border-b-0">
                          <td className="py-3 font-medium text-foreground">{row.label}</td>
                          <td className="py-3 text-foreground">{row.recommendedValue}</td>
                          <td className="py-3 text-foreground">{row.comparedValue}</td>
                          <td className={`py-3 font-semibold ${row.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {row.delta >= 0 ? "+" : ""}{row.delta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-3xl border border-border/60 bg-background/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Delta de profils</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {explanation.profileDeltaRows.map((row) => (
                    <div key={row.key} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{row.label}</p>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {row.recommendedValue} vs {row.comparedValue}
                      </p>
                      <p className={`mt-2 text-lg font-bold ${row.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {row.delta >= 0 ? "+" : ""}{row.delta}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border/60 bg-background/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Alternatives filtrées</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {explanation.budgetEligibleAlternatives.slice(0, 12).map((entry) => (
                    <button
                      key={entry.slug}
                      type="button"
                      disabled={(entry.blockedReasons?.length ?? 0) > 0}
                      onClick={() => setComparedItemSlug(entry.slug)}
                      className={`rounded-2xl border px-4 py-3 text-left ${
                        (entry.blockedReasons?.length ?? 0) > 0
                          ? "border-border/40 bg-background/40 text-muted-foreground"
                          : "border-border/60 bg-background/70 text-foreground hover:border-primary/40"
                      }`}
                    >
                      <p className="font-semibold">{entry.name}</p>
                      <p className="mt-1 text-xs">{entry.goldTotal} or</p>
                      {(entry.blockedReasons?.length ?? 0) > 0 ? (
                        <p className="mt-2 text-[11px]">{entry.blockedReasons?.[0]?.message}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
