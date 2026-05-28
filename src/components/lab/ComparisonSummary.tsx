import { Trophy } from "lucide-react";
import { buildComparisonSummary, formatStatValue, getStatDefinition } from "@/lib/item-lab/calculations";
import type { SetupAnalysis } from "@/lib/item-lab/types";

interface ComparisonSummaryProps {
  analysisA: SetupAnalysis;
  analysisB: SetupAnalysis;
}

const ComparisonSummary = ({ analysisA, analysisB }: ComparisonSummaryProps) => {
  const comparison = buildComparisonSummary(analysisA, analysisB);

  return (
    <section className="glass-surface rounded-[28px] p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Synthèse comparative</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">Qui gagne quoi, et pourquoi.</h2>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Trophy className="h-5 w-5" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="surface-elevated rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Insights clés</p>
          <div className="mt-3 space-y-2">
            {comparison.narrative.map((line) => (
              <div key={line} className="rounded-xl border border-border/60 bg-card/70 px-3 py-3 text-sm text-foreground">
                {line}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {comparison.cards.map((card) => (
            <div key={card.label} className="surface-elevated rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{card.label}</p>
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${card.leader === "tie" ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                  {card.leader === "tie" ? "Égalité" : `Avantage ${card.leader}`}
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span>A</span>
                    <span>{Math.round(card.ratioA)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div className="h-2 rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${card.ratioA}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span>B</span>
                    <span>{Math.round(card.ratioB)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500/70 to-cyan-300" style={{ width: `${card.ratioB}%` }} />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{card.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 surface-elevated rounded-2xl p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Écarts de stats</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {comparison.standoutStats.slice(0, 3).map((entry) => {
            const definition = getStatDefinition(entry.key);
            return (
              <div key={entry.key} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                <span className="text-sm text-foreground">{definition.label}</span>
                <span className={`text-sm font-medium ${entry.delta >= 0 ? "text-primary" : "text-cyan-300"}`}>
                  {entry.delta >= 0 ? "A" : "B"} +{formatStatValue(entry.key, Math.abs(entry.delta))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ComparisonSummary;
