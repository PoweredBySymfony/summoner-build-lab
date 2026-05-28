import { Activity, Heart, Shield, Sparkles, Sword, Timer, WandSparkles, Wind, Zap } from "lucide-react";
import { formatStatValue, statDefinitionsByGroup } from "@/lib/item-lab/calculations";
import type { SetupAnalysis, StatGroupKey, StatKey } from "@/lib/item-lab/types";

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

const groupTitles: Record<StatGroupKey, string> = {
  offense: "Offensif",
  defense: "Défensif",
  utility: "Utilitaire",
};

interface StatTableProps {
  analysis: SetupAnalysis;
  groups?: StatGroupKey[];
  subdued?: boolean;
}

const StatTable = ({ analysis, groups = ["offense", "defense", "utility"], subdued = false }: StatTableProps) => {
  return (
    <div className="space-y-4">
      {groups.map((groupKey) => (
        <div key={groupKey} className="surface-elevated rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{groupTitles[groupKey]}</h3>
            <span className="text-[11px] text-muted-foreground">{subdued ? "Détails" : "Lecture principale"}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {statDefinitionsByGroup[groupKey].map((definition) => {
              const Icon = statIcons[definition.key];

              return (
                <div
                  key={definition.key}
                  className={`rounded-xl border border-border/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] ${
                    subdued ? "bg-card/55" : "bg-card/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        subdued ? "border-border/60 bg-background/40 text-muted-foreground" : "border-primary/20 bg-primary/10 text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{definition.shortLabel}</p>
                      <p className="text-lg font-semibold text-foreground">{formatStatValue(definition.key, analysis.stats[definition.key])}</p>
                    </div>
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
