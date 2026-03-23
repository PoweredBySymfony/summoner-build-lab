import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Filter, Clock, BookOpen, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useModules } from "@/api/hooks";
import { useLanguage } from "@/i18n/context";

const Modules = () => {
  const { t } = useLanguage();
  const { data: modules = [] } = useModules();
  const [activeFilter, setActiveFilter] = useState("all");

  const filters = [
    { key: "all", label: t("modules.all") },
    { key: "beginner", label: t("modules.beginner") },
    { key: "intermediate", label: t("modules.intermediate") },
    { key: "advanced", label: t("modules.advanced") },
  ];

  const filtered = activeFilter === "all" ? modules : modules.filter((module) => module.difficulty === activeFilter);

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground">{t("modules.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("modules.subtitle")}</p>
        </motion.div>

        <div className="flex items-center gap-2 mb-8">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === filter.key
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((module, index) => {
            const leadPuzzle = module.puzzles[0];
            return (
              <motion.div key={module.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <Link to={leadPuzzle ? `/training/${leadPuzzle.slug}` : "/training"} className="block h-full">
                  <div className="glass-surface rounded-xl p-6 h-full hover:border-primary/20 transition-all duration-300 group cursor-pointer flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded bg-secondary text-muted-foreground">
                        {module.difficulty}
                      </span>
                    </div>

                    <h3 className="font-heading text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{module.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">{leadPuzzle?.description.fr ?? "Puzzle pack"}</p>

                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-4">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~20 min</span>
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {module.scenarios} {t("modules.scenarios")}</span>
                      <span>{t("training.patch")} {module.patch}</span>
                    </div>

                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full transition-all" style={{ width: `${module.progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">{module.progress}% {t("modules.completed")}</p>
                      <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {t("modules.start")} <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Modules;
