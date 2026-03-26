import { Activity, Heart, Shield, Sparkles, Sword, Timer, WandSparkles, Wind, Zap } from "lucide-react";
import { formatStatValue, statDefinitionsByGroup } from "@/lib/item-lab/calculations";
import type { SetupAnalysis, StatKey } from "@/lib/item-lab/types";
import StatDeltaBadge from "@/components/lab/StatDeltaBadge";

const statIcons: Record<StatKey, typeof Sword> = {
  health: Heart,
  mana: Sparkles,
  attackDamage: Sword,
  abilityPower: WandSparkles,
  attackSpeed: Zap,
  critChance: Activity,
  armorPen: Sword,
  lethality: Sword,
  magicPen: WandSparkles,
  abilityHaste: Timer,
  armor: Shield,
  magicResist: Shield,
  moveSpeed: Wind,
  healthRegen: Heart,
  manaRegen: Sparkles,
};

const groupTitles = {
  offense: "Offensif",
  defense: "Défensif",
  utility: "Utilitaire",
};

interface StatTableProps {
  analysis: SetupAnalysis;
}

const StatTable = ({ analysis }: StatTableProps) => {
  const deltaMap = new Map(analysis.changedStats.map((entry) => [entry.key, entry]));

  return (
    <div className="space-y-4">
      {(Object.keys(statDefinitionsByGroup) as Array<keyof typeof statDefinitionsByGroup>).map((groupKey) => (
        <div key={groupKey} className="surface-elevated rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{groupTitles[groupKey as keyof typeof groupTitles]}</h3>
            <span className="text-[11px] text-muted-foreground">Lecture instantanée</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {statDefinitionsByGroup[groupKey].map((definition) => {
              const Icon = statIcons[definition.key];
              const delta = deltaMap.get(definition.key);
              const deltaLabel = delta ? `${delta.delta > 0 ? "+" : ""}${formatStatValue(definition.key, delta.delta)}` : "";

              return (
                <div key={definition.key} className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{definition.shortLabel}</p>
                        <p className="text-lg font-semibold text-foreground">{formatStatValue(definition.key, analysis.stats[definition.key])}</p>
                      </div>
                    </div>
                    {delta ? <StatDeltaBadge value={delta.delta} formatted={deltaLabel} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatTable;
