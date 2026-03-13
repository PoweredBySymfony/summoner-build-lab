import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/context";
import { Star, Shield, Zap, Swords, BookOpen, Target, Flame, Clock, ChevronRight, Filter, Heart } from "lucide-react";
import { useState } from "react";

const Modules = () => {
  const { t } = useLanguage();

  const modules = [
    { id: "fundamentals", title: t("modules.fundamentals"), desc: t("modules.fundamentalsDesc"), diff: t("modules.beginner"), diffKey: "beginner", duration: "~20 min", patch: "14.10", theme: t("modules.themeBase"), icon: Star, progress: 75, scenarios: 10, color: "primary" as const },
    { id: "anti-comp", title: t("modules.antiComp"), desc: t("modules.antiCompDesc"), diff: t("modules.intermediate"), diffKey: "intermediate", duration: "~25 min", patch: "14.10", theme: t("modules.themeAdaptation"), icon: Shield, progress: 40, scenarios: 12, color: "accent" as const },
    { id: "powerspikes", title: t("modules.powerspikes"), desc: t("modules.powerspikesDesc"), diff: t("modules.advanced"), diffKey: "advanced", duration: "~30 min", patch: "14.10", theme: t("modules.themeTiming"), icon: Zap, progress: 10, scenarios: 8, color: "primary" as const },
    { id: "adc-builds", title: t("modules.adcBuilds"), desc: t("modules.adcBuildsDesc"), diff: t("modules.intermediate"), diffKey: "intermediate", duration: "~25 min", patch: "14.10", theme: t("modules.themeADC"), icon: Target, progress: 55, scenarios: 15, color: "accent" as const },
    { id: "anti-heal", title: t("modules.antiHeal"), desc: t("modules.antiHealDesc"), diff: t("modules.beginner"), diffKey: "beginner", duration: "~15 min", patch: "14.10", theme: t("modules.themeUtility"), icon: Flame, progress: 30, scenarios: 6, color: "primary" as const },
    { id: "defensive", title: t("modules.defensiveCarry"), desc: t("modules.defensiveCarryDesc"), diff: t("modules.advanced"), diffKey: "advanced", duration: "~20 min", patch: "14.10", theme: t("modules.themeSurvival"), icon: Shield, progress: 0, scenarios: 10, color: "accent" as const },
    { id: "bruiser", title: t("modules.bruiserItems"), desc: t("modules.bruiserItemsDesc"), diff: t("modules.intermediate"), diffKey: "intermediate", duration: "~25 min", patch: "14.10", theme: t("modules.themeBruiser"), icon: Swords, progress: 0, scenarios: 10, color: "primary" as const },
    { id: "support", title: t("modules.supportItems"), desc: t("modules.supportItemsDesc"), diff: t("modules.beginner"), diffKey: "beginner", duration: "~20 min", patch: "14.10", theme: t("modules.themeSupport"), icon: Heart, progress: 0, scenarios: 8, color: "accent" as const },
  ];

  const filters = [
    { key: "all", label: t("modules.all") },
    { key: "beginner", label: t("modules.beginner") },
    { key: "intermediate", label: t("modules.intermediate") },
    { key: "advanced", label: t("modules.advanced") },
  ];

  const [activeFilter, setActiveFilter] = useState("all");
  const filtered = activeFilter === "all" ? modules : modules.filter((m) => m.diffKey === activeFilter);

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground">{t("modules.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("modules.subtitle")}</p>
        </motion.div>

        <div className="flex items-center gap-2 mb-8">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === f.key
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((mod, i) => (
            <motion.div key={mod.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to="/training" className="block h-full">
                <div className="glass-surface rounded-xl p-6 h-full hover:border-primary/20 transition-all duration-300 group cursor-pointer flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${mod.color === "primary" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      <mod.icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded ${
                      mod.diffKey === "beginner" ? "bg-success/10 text-success" :
                      mod.diffKey === "intermediate" ? "bg-primary/10 text-primary" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {mod.diff}
                    </span>
                  </div>

                  <h3 className="font-heading text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{mod.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{mod.desc}</p>

                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {mod.duration}</span>
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {mod.scenarios} {t("modules.scenarios")}</span>
                    <span>{t("training.patch")} {mod.patch}</span>
                  </div>

                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full transition-all" style={{ width: `${mod.progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">{mod.progress}% {t("modules.completed")}</p>
                    <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {mod.progress > 0 ? t("modules.continue") : t("modules.start")} <ChevronRight className="w-3 h-3" />
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
