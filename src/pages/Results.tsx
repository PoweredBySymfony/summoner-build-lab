import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";
import { Trophy, Target, Clock, TrendingUp, CheckCircle, XCircle, ArrowRight, Star, BookOpen } from "lucide-react";

const Results = () => {
  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-4">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Session terminée</h1>
          <p className="text-muted-foreground mt-1">Fondamentaux de l'itemisation — 10 scénarios</p>
        </motion.div>

        {/* Score banner */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <div className="glass-surface rounded-2xl p-8 border-glow-gold text-center mb-8 relative overflow-hidden">
            <div className="absolute inset-0 gradient-radial-gold opacity-30" />
            <div className="relative z-10">
              <p className="text-6xl font-heading font-bold text-primary mb-2">8/10</p>
              <p className="text-lg text-foreground font-medium">Score final</p>
              <p className="text-sm text-muted-foreground mt-1">+180 XP • Précision: 80% • Nouveau record personnel</p>
            </div>
          </div>
        </motion.div>

        {/* Detailed stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Target} label="Précision" value="80%" sub="8 correctes" accent="gold" />
          <StatCard icon={Clock} label="Temps moyen" value="18s" sub="par question" accent="default" />
          <StatCard icon={Star} label="XP gagnés" value="+180" sub="Niveau 12 → 13" accent="gold" />
          <StatCard icon={TrendingUp} label="Streak" value="7j" sub="Continue demain !" accent="cyan" />
        </div>

        {/* Breakdown */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="glass-surface rounded-xl p-6">
            <h3 className="font-heading text-lg font-bold text-foreground mb-4">Détail par question</h3>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => {
                const correct = i !== 2 && i !== 7;
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                    <div className="flex items-center gap-3">
                      {correct ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="text-sm text-foreground">Scénario {i + 1}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{12 + i * 2}s</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-surface rounded-xl p-6">
              <h3 className="font-heading text-lg font-bold text-foreground mb-4">Thèmes maîtrisés</h3>
              <div className="space-y-3">
                {[
                  { theme: "Items offensifs AD", score: 100 },
                  { theme: "Build path & composants", score: 85 },
                  { theme: "Anti-tank", score: 75 },
                  { theme: "Items défensifs", score: 50 },
                ].map((t) => (
                  <div key={t.theme}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{t.theme}</span>
                      <span className="text-foreground font-medium">{t.score}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${t.score >= 75 ? "bg-success" : t.score >= 50 ? "bg-primary" : "bg-destructive/70"}`}
                        style={{ width: `${t.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-surface rounded-xl p-6">
              <h3 className="font-heading text-lg font-bold text-foreground mb-3">Erreurs fréquentes</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                  Achat d'Infinity Edge sans assez de crit
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                  Oubli de l'anti-heal contre Soraka
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="glass-surface rounded-xl p-6 mb-8">
          <h3 className="font-heading text-lg font-bold text-foreground mb-3">Recommandations</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-secondary/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Module suggéré</span>
              </div>
              <p className="text-sm text-muted-foreground">Items défensifs sur carry — Pour améliorer tes choix de survie</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Focus recommandé</span>
              </div>
              <p className="text-sm text-muted-foreground">Anti-heal timing — Savoir quand l'anti-heal est prioritaire</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link to="/dashboard">
            <Button variant="outline" size="lg">Retour au dashboard</Button>
          </Link>
          <Link to="/training">
            <Button variant="gold" size="lg">
              Nouvelle session
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Results;
