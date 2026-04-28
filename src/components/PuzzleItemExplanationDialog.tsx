import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CheckCircle2, Download, RefreshCw, ShieldAlert } from "lucide-react";
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

type ItemExplanationRequest = {
  puzzleSlug: string;
  selectedChoiceId?: string;
  comparedItemSlug?: string;
};

const itemExplanationCache = new Map<string, GeneratedPuzzleItemExplanation>();
const itemExplanationInFlight = new Map<string, Promise<GeneratedPuzzleItemExplanation>>();

function buildRequestKey(payload: ItemExplanationRequest) {
  return JSON.stringify(payload);
}

async function fetchItemExplanation(payload: ItemExplanationRequest) {
  const key = buildRequestKey(payload);
  const cached = itemExplanationCache.get(key);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const inFlight = itemExplanationInFlight.get(key);
  if (inFlight) {
    return inFlight;
  }

  const request = apiFetch<GeneratedPuzzleItemExplanation>("/generated-puzzles/item-explanation", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((response) => {
    itemExplanationCache.set(key, response);
    return response;
  }).finally(() => {
    itemExplanationInFlight.delete(key);
  });

  itemExplanationInFlight.set(key, request);
  return request;
}

function toCsv(rows: GeneratedPuzzleItemExplanation["exportPayload"]["rows"]) {
  const header = ["type", "label", "recommended", "compared", "delta", "unit", "note"];
  const lines = rows.map((row) =>
    [row.type, row.label, row.recommended, row.compared, row.delta, row.unit ?? "", row.note ?? ""]
      .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
      .join(","));
  return [header.join(","), ...lines].join("\n");
}

function signed(value: number, unit = "") {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}${unit ? ` ${unit}` : ""}`;
}

function rowTone(delta: number) {
  if (delta > 0) return "text-emerald-300";
  if (delta < 0) return "text-rose-300";
  return "text-muted-foreground";
}

export function PuzzleItemExplanationDialog({
  open,
  onOpenChange,
  puzzle,
  selectedChoiceId,
  result,
}: PuzzleItemExplanationDialogProps) {
  const [comparedItemSlug, setComparedItemSlug] = useState<string | undefined>(undefined);
  const lastAutoRequestKeyRef = useRef<string | null>(null);

  const loadExplanation = useMutation({
    mutationFn: fetchItemExplanation,
  });
  const { data: explanation, error: loadError, isPending, mutate, reset } = loadExplanation;

  useEffect(() => {
    if (!open || !result) {
      return;
    }
    const payload = {
      puzzleSlug: puzzle.slug,
      selectedChoiceId: selectedChoiceId ?? undefined,
      comparedItemSlug,
    };
    const requestKey = buildRequestKey(payload);
    if (lastAutoRequestKeyRef.current === requestKey) {
      return;
    }
    lastAutoRequestKeyRef.current = requestKey;
    mutate(payload);
  }, [open, result, puzzle.slug, selectedChoiceId, comparedItemSlug, mutate]);

  useEffect(() => {
    if (!open) {
      setComparedItemSlug(undefined);
      lastAutoRequestKeyRef.current = null;
      reset();
    }
  }, [open, reset]);

  const selectableAlternatives = useMemo(
    () => explanation?.budgetEligibleAlternatives.filter((entry) => (entry.blockedReasons?.length ?? 0) === 0) ?? [],
    [explanation],
  );
  const spreadsheetRows = useMemo(() => {
    if (!explanation) {
      return [];
    }

    return [
      ...explanation.damageRows.map((row) => ({ ...row, section: "Degats reels", note: row.interpretation })),
      ...explanation.efficiencyRows.map((row) => ({ ...row, section: "Efficacite", note: "normalise par cout" })),
      ...explanation.profileDeltaRows.map((row) => ({ ...row, unit: "pts", section: "Strategie", note: "profil heuristique" })),
      ...explanation.statRows.slice(0, 8).map((row) => ({ ...row, unit: "", section: "Stats item", note: "" })),
    ];
  }, [explanation]);

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
      <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto rounded-2xl border-border/60 bg-background p-0">
        <div className="border-b border-border/60 bg-background px-5 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-heading text-2xl text-foreground">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </span>
              Preuve item
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-sm text-muted-foreground">
              Tableau de decision: degats estimes, rendement en or, contraintes d'achat et profil strategique.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[260px] flex-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-primary">Item compare</span>
              <select
                value={comparedItemSlug ?? explanation?.comparedItem.slug ?? ""}
                onChange={(event) => setComparedItemSlug(event.target.value || undefined)}
                className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground"
              >
                <option value="">Selection automatique</option>
                {selectableAlternatives.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.name} ({entry.goldTotal} or)
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const payload = {
                  puzzleSlug: puzzle.slug,
                  selectedChoiceId: selectedChoiceId ?? undefined,
                  comparedItemSlug,
                };
                lastAutoRequestKeyRef.current = buildRequestKey(payload);
                mutate(payload);
              }}
              disabled={isPending}
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
            <Button variant="gold" size="sm" onClick={handleExport} disabled={!explanation}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {isPending ? (
            <div className="rounded-lg border border-border/60 bg-background/50 px-4 py-5 text-sm text-muted-foreground">
              Calcul de la preuve item...
            </div>
          ) : null}

          {loadError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError instanceof Error ? loadError.message : "Impossible de calculer la preuve item."}
            </div>
          ) : null}

          {explanation ? (
            <>
              <div className="grid gap-3 lg:grid-cols-[0.58fr_0.42fr]">
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Verdict</p>
                      <h3 className="mt-2 text-lg font-semibold text-foreground">{explanation.strategicVerdict.summary}</h3>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        explanation.strategicVerdict.winner === "recommended"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : explanation.strategicVerdict.winner === "compared"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      confiance {explanation.strategicVerdict.confidence}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Bonne reponse</p>
                      <p className="mt-1 font-semibold text-foreground">{explanation.recommendedItem.name}</p>
                      <p className="text-xs text-muted-foreground">{explanation.recommendedItem.goldTotal} or</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-primary">Choix compare</p>
                      <p className="mt-1 font-semibold text-foreground">{explanation.comparedItem.name}</p>
                      <p className="text-xs text-muted-foreground">{explanation.comparedItem.goldTotal} or</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {explanation.strategicVerdict.reasons.map((reason) => (
                      <div key={reason} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Contraintes</p>
                  {explanation.blockedReasons.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {explanation.blockedReasons.map((reason) => (
                        <div key={`${reason.code}-${reason.message}`} className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                          {reason.message}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                      Aucun blocage budget/famille detecte pour l'item compare.
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-lg border border-border/50 px-3 py-2">
                      Patch <span className="font-semibold text-foreground">{explanation.puzzleContext.patch}</span>
                    </div>
                    <div className="rounded-lg border border-border/50 px-3 py-2">
                      Or <span className="font-semibold text-foreground">{explanation.puzzleContext.goldAvailable}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-lg border border-border/60 bg-background/60">
                  <div className="border-b border-border/60 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tableau de preuve</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-border/60 bg-secondary/20 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          <th className="px-3 py-2">Section</th>
                          <th className="px-3 py-2">Mesure</th>
                          <th className="px-3 py-2 text-right">Bonne</th>
                          <th className="px-3 py-2 text-right">Compare</th>
                          <th className="px-3 py-2 text-right">Delta</th>
                          <th className="px-3 py-2">Lecture</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spreadsheetRows.map((row) => (
                          <tr key={`${row.section}-${row.key}`} className="border-b border-border/30 last:border-b-0">
                            <td className="px-3 py-2 text-xs text-muted-foreground">{row.section}</td>
                            <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                            <td className="px-3 py-2 text-right text-foreground">{row.recommendedValue}</td>
                            <td className="px-3 py-2 text-right text-foreground">{row.comparedValue}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${rowTone(row.delta)}`}>
                              {signed(row.delta, row.unit)}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{row.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                  <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Alternatives</p>
                  <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
                    {explanation.budgetEligibleAlternatives.slice(0, 12).map((entry) => (
                      <button
                        key={entry.slug}
                        type="button"
                        disabled={(entry.blockedReasons?.length ?? 0) > 0}
                        onClick={() => setComparedItemSlug(entry.slug)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          (entry.blockedReasons?.length ?? 0) > 0
                            ? "border-border/40 bg-background/40 text-muted-foreground"
                            : "border-border/60 bg-background/70 text-foreground hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{entry.name}</p>
                          <p className="text-xs">{entry.goldTotal} or</p>
                        </div>
                        {(entry.blockedReasons?.length ?? 0) > 0 ? (
                          <p className="mt-2 text-[11px]">{entry.blockedReasons?.[0]?.message}</p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
