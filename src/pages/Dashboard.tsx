import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";
import { ItemIcon } from "@/components/ItemIcon";
import { ITEMS } from "@/data/items";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/context";
import { Trophy, Target, Flame, TrendingUp, BookOpen, Swords, Star, Clock, ChevronRight, Zap, Link2, Lock, XCircle } from "lucide-react";

const items = Object.values(ITEMS);

const Dashboard = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("dashboard.welcome")}</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Star} label={t("dashboard.level")} value="12" sub="1,240 / 2,000 XP" accent="gold" />
          <StatCard icon={Target} label={t("dashboard.accuracy")} value="73%" sub={`+5% ${t("dashboard.thisWeek")}`} accent="cyan" />
          <StatCard icon={Flame} label={t("dashboard.streak")} value="7j" sub={`${t("dashboard.record")}: 14 ${t("dashboard.days")}`} accent="gold" />
          <StatCard icon={TrendingUp} label={t("dashboard.sessions")} value="34" sub={t("dashboard.thisSeason")} accent="default" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Daily Challenge */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="glass-surface rounded-xl p-6 border-glow-gold relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[60px]" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-4 h-4 text-primary" />
                    <span className="text-xs uppercase tracking-wider text-primary font-semibold">{t("dashboard.dailyChallenge")}</span>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground mb-2">{t("dashboard.dailyChallengeTitle")}</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-lg">{t("dashboard.dailyChallengeDesc")}</p>
                  <div className="flex items-center gap-3 mb-5">
                    {[items[3], items[4], items[7]].filter(Boolean).map((item) => (
                      <ItemIcon key={item.id} item={item} size="sm" />
                    ))}
                    <span className="text-xs text-muted-foreground">{t("dashboard.frequentItems")}</span>
                  </div>
                  <Link to="/training">
                    <Button variant="gold" size="default">
                      <Trophy className="w-4 h-4" />{t("dashboard.takeChallenge")}
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Resume + Recommendation */}
            <div className="grid md:grid-cols-2 gap-4">
              <Link to="/training" className="glass-surface rounded-xl p-5 hover:border-primary/20 transition-all cursor-pointer group block">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{t("dashboard.resume")}</span>
                </div>
                <h4 className="font-heading text-base font-bold text-foreground mb-1">{t("dashboard.fundamentalsADC")}</h4>
                <p className="text-xs text-muted-foreground mb-3">{t("dashboard.scenarioProgress")}</p>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full" style={{ width: "60%" }} />
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("dashboard.continue")} <ChevronRight className="w-3 h-3" />
                </div>
              </Link>

              <Link to="/modules" className="glass-surface rounded-xl p-5 hover:border-accent/20 transition-all cursor-pointer group block">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-accent" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{t("dashboard.recommended")}</span>
                </div>
                <h4 className="font-heading text-base font-bold text-foreground mb-1">{t("dashboard.antiTank")}</h4>
                <p className="text-xs text-muted-foreground mb-3">{t("dashboard.antiTankDesc")}</p>
                <div className="flex items-center gap-2">
                  {[items[1], items[6]].filter(Boolean).map((item) => (
                    <ItemIcon key={item.id} item={item} size="sm" />
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("dashboard.discover")} <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            </div>

            {/* Frequent errors */}
            <div className="glass-surface rounded-xl p-6">
              <h3 className="font-heading text-lg font-bold text-foreground mb-1">{t("dashboard.frequentErrors")}</h3>
              <p className="text-xs text-muted-foreground mb-4">{t("dashboard.frequentErrorsDesc")}</p>
              <div className="space-y-2">
                {[t("dashboard.errorIE"), t("dashboard.errorAntiHeal"), t("dashboard.errorBoots")].map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Accuracy chart */}
            <div className="glass-surface rounded-xl p-6">
              <h3 className="font-heading text-lg font-bold text-foreground mb-4">{t("dashboard.accuracyEvolution")}</h3>
              <div className="h-48 flex items-end gap-2">
                {[45, 52, 48, 60, 55, 68, 72, 65, 73, 78, 70, 82].map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-gradient-to-t from-primary/60 to-primary transition-all hover:from-primary/80" style={{ height: `${val * 1.8}px` }} />
                    <span className="text-[9px] text-muted-foreground">S{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* XP Progress */}
            <div className="glass-surface rounded-xl p-5">
              <h3 className="font-heading text-base font-bold text-foreground mb-4">{t("dashboard.progression")}</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-heading font-bold text-primary">12</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t("dashboard.level")} 12</p>
                  <p className="text-xs text-muted-foreground mb-2">1,240 / 2,000 {t("dashboard.xp")}</p>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full" style={{ width: "62%" }} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: t("dashboard.adcItemization"), pct: 85 },
                  { label: t("dashboard.defensiveItems"), pct: 60 },
                  { label: t("dashboard.antiHeal"), pct: 45 },
                  { label: t("dashboard.powerspikes"), pct: 20 },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="text-foreground font-medium">{s.pct}%</span>
                    </div>
                    <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-accent/70 rounded-full" style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Riot connect teaser */}
            <div className="glass-surface rounded-xl p-5 border-glow-cyan relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-[40px]" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-4 h-4 text-accent" />
                  <span className="text-xs uppercase tracking-wider text-accent font-semibold">{t("dashboard.riotAnalysis")}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{t("dashboard.riotAnalysisDesc")}</p>
                <Button variant="outline" size="sm" disabled className="opacity-60 w-full">
                  <Lock className="w-3 h-3" />{t("dashboard.comingSoon")}
                </Button>
              </div>
            </div>

            {/* Recent activity */}
            <div className="glass-surface rounded-xl p-5">
              <h3 className="font-heading text-base font-bold text-foreground mb-4">{t("dashboard.recentActivity")}</h3>
              <div className="space-y-3">
                {[
                  { title: t("dashboard.antiCompFinished"), score: "8/10", time: t("dashboard.ago2h") },
                  { title: t("dashboard.dailyChallengeActivity"), score: "5/5", time: t("dashboard.yesterday") },
                  { title: t("dashboard.fundamentals"), score: "7/10", time: t("dashboard.ago2d") },
                ].map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.time}</p>
                    </div>
                    <span className="text-sm font-heading font-bold text-primary">{a.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
