import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";
import { useLanguage } from "@/i18n/context";
import { Trophy, Target, Clock, TrendingUp, CheckCircle, XCircle, ArrowRight, Star, BookOpen } from "lucide-react";

const Results = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-4">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground">{t("results.sessionComplete")}</h1>
          <p className="text-muted-foreground mt-1">{t("results.sessionDesc")}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <div className="glass-surface rounded-2xl p-8 border-glow-gold text-center mb-8 relative overflow-hidden">
            <div className="absolute inset-0 gradient-radial-gold opacity-30" />
            <div className="relative z-10">
              <p className="text-6xl font-heading font-bold text-primary mb-2">8/10</p>
              <p className="text-lg text-foreground font-medium">{t("results.finalScore")}</p>
              <p className="text-sm text-muted-foreground mt-1">+180 XP • {t("results.accuracy")}: 80% • {t("results.newRecord")}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Target} label={t("results.accuracy")} value="80%" sub={`8 ${t("results.correct")}`} accent="gold" />
          <StatCard icon={Clock} label={t("results.avgTime")} value="18s" sub={t("results.perQuestion")} accent="default" />
          <StatCard icon={Star} label={t("results.xpGained")} value="+180" sub={t("results.levelUp")} accent="gold" />
          <StatCard icon={TrendingUp} label={t("results.streak")} value="7j" sub={t("results.continueTomorrow")} accent="cyan" />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="glass-surface rounded-xl p-6">
            <h3 className="font-heading text-lg font-bold text-foreground mb-4">{t("results.questionDetail")}</h3>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => {
                const correct = i !== 2 && i !== 7;
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                    <div className="flex items-center gap-3">
                      {correct ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                      <span className="text-sm text-foreground">{t("results.scenario")} {i + 1}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{12 + i * 2}s</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-surface rounded-xl p-6">
              <h3 className="font-heading text-lg font-bold text-foreground mb-4">{t("results.masteredThemes")}</h3>
              <div className="space-y-3">
                {[
                  { theme: t("results.offensiveAD"), score: 100 },
                  { theme: t("results.buildPath"), score: 85 },
                  { theme: t("results.antiTank"), score: 75 },
                  { theme: t("results.defensiveItems"), score: 50 },
                ].map((te) => (
                  <div key={te.theme}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{te.theme}</span>
                      <span className="text-foreground font-medium">{te.score}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${te.score >= 75 ? "bg-success" : te.score >= 50 ? "bg-primary" : "bg-destructive/70"}`} style={{ width: `${te.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-surface rounded-xl p-6">
              <h3 className="font-heading text-lg font-bold text-foreground mb-3">{t("results.frequentErrors")}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                  {t("results.errorIE")}
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                  {t("results.errorSoraka")}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="glass-surface rounded-xl p-6 mb-8">
          <h3 className="font-heading text-lg font-bold text-foreground mb-3">{t("results.recommendations")}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-secondary/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-foreground">{t("results.suggestedModule")}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t("results.suggestedModuleDesc")}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{t("results.focusRecommended")}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t("results.focusRecommendedDesc")}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link to="/dashboard">
            <Button variant="outline" size="lg">{t("results.backToDashboard")}</Button>
          </Link>
          <Link to="/training">
            <Button variant="gold" size="lg">
              {t("results.newSession")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Results;
