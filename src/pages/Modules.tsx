import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star, Shield, Zap, Swords, BookOpen, Target, Flame, Clock, ChevronRight, Filter } from "lucide-react";
import { useState } from "react";

const modules = [
  { id: "fundamentals", title: "Fondamentaux de l'itemisation", desc: "Comprendre les stats, les composants et les synergies de base entre les items.", diff: "Débutant", duration: "~20 min", patch: "14.10", theme: "Bases", icon: Star, progress: 75, scenarios: 10, color: "primary" as const },
  { id: "anti-comp", title: "Adapter son build à la compo", desc: "Apprends à lire la compo ennemie et choisir les bons items défensifs et offensifs.", diff: "Intermédiaire", duration: "~25 min", patch: "14.10", theme: "Adaptation", icon: Shield, progress: 40, scenarios: 12, color: "accent" as const },
  { id: "powerspikes", title: "Powerspikes & timing", desc: "Comprendre quand un item te donne un avantage décisif et comment l'exploiter.", diff: "Avancé", duration: "~30 min", patch: "14.10", theme: "Timing", icon: Zap, progress: 10, scenarios: 8, color: "primary" as const },
  { id: "adc-builds", title: "Itemisation ADC", desc: "Builds optimaux pour les tireurs: crit, on-hit, lethality selon la game.", diff: "Intermédiaire", duration: "~25 min", patch: "14.10", theme: "Rôle: ADC", icon: Target, progress: 55, scenarios: 15, color: "accent" as const },
  { id: "anti-heal", title: "Anti-heal & Grievous Wounds", desc: "Quand acheter anti-heal, quel item choisir, et pourquoi c'est souvent mal utilisé.", diff: "Débutant", duration: "~15 min", patch: "14.10", theme: "Utilitaire", icon: Flame, progress: 30, scenarios: 6, color: "primary" as const },
  { id: "defensive", title: "Items défensifs sur carry", desc: "Zhonya's, GA, Maw... Savoir quand sacrifier du dégât pour survivre.", diff: "Avancé", duration: "~20 min", patch: "14.10", theme: "Survie", icon: Shield, progress: 0, scenarios: 10, color: "accent" as const },
];

const filters = ["Tous", "Débutant", "Intermédiaire", "Avancé"];

const Modules = () => {
  const [activeFilter, setActiveFilter] = useState("Tous");

  const filtered = activeFilter === "Tous" ? modules : modules.filter((m) => m.diff === activeFilter);

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground">Modules d'entraînement</h1>
          <p className="text-muted-foreground mt-1">Choisis un module et commence à progresser.</p>
        </motion.div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-8">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === f
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Module grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((mod, i) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to="/training" className="block h-full">
                <div className="glass-surface rounded-xl p-6 h-full hover:border-primary/20 transition-all duration-300 group cursor-pointer flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${mod.color === "primary" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      <mod.icon className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded ${
                        mod.diff === "Débutant" ? "bg-success/10 text-success" :
                        mod.diff === "Intermédiaire" ? "bg-primary/10 text-primary" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {mod.diff}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-heading text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{mod.desc}</p>

                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {mod.duration}</span>
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {mod.scenarios} scénarios</span>
                    <span>Patch {mod.patch}</span>
                  </div>

                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full transition-all" style={{ width: `${mod.progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">{mod.progress}% complété</p>
                    <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {mod.progress > 0 ? "Continuer" : "Commencer"} <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Modules;
