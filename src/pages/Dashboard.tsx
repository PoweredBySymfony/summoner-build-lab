import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Trophy, Target, Flame, TrendingUp, ChevronRight, Clock, Zap } from "lucide-react";
import StatCard from "@/components/StatCard";
import { ItemIcon } from "@/components/ItemIcon";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/context";
import { useDashboard, usePuzzles } from "@/api/hooks";
import { getLocalized } from "@/lib/formatters/localized";

const Dashboard = () => {
  const { t, lang } = useLanguage();
  const { data: dashboard } = useDashboard();
  const { data: puzzles = [] } = usePuzzles();

  const nextPuzzle = puzzles[0];
  const recommendedPuzzle = puzzles.find((puzzle) => puzzle.difficulty !== "beginner") ?? puzzles[1];

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("dashboard.welcome")}</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Trophy} label={t("dashboard.level")} value={`${dashboard?.user.level ?? 0}`} sub={`${dashboard?.user.xp ?? 0} / ${dashboard?.user.xpToNextLevel ?? 0} XP`} accent="gold" />
          <StatCard icon={Target} label={t("dashboard.accuracy")} value={`${dashboard?.stats.accuracy ?? 0}%`} sub={`${dashboard?.stats.totalPuzzles ?? 0} puzzles`} accent="cyan" />
          <StatCard icon={Flame} label={t("dashboard.streak")} value={`${dashboard?.user.streak ?? 0}j`} sub={t("dashboard.thisWeek")} accent="gold" />
          <StatCard icon={TrendingUp} label={t("dashboard.sessions")} value={`${dashboard?.stats.sessions ?? 0}`} sub={t("dashboard.thisSeason")} accent="default" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-surface rounded-xl p-6 border-glow-gold relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[60px]" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-primary" />
                  <span className="text-xs uppercase tracking-wider text-primary font-semibold">{t("dashboard.dailyChallenge")}</span>
                </div>
                <h3 className="font-heading text-xl font-bold text-foreground mb-2">
                  {nextPuzzle ? getLocalized(nextPuzzle.title, lang) : t("dashboard.dailyChallengeTitle")}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-lg">
                  {nextPuzzle ? getLocalized(nextPuzzle.description, lang) : t("dashboard.dailyChallengeDesc")}
                </p>
                <div className="flex items-center gap-3 mb-5">
                  {(dashboard?.featuredItems ?? []).slice(0, 3).map((item) => (
                    <ItemIcon key={item.id} item={item} size="sm" />
                  ))}
                  <span className="text-xs text-muted-foreground">{t("dashboard.frequentItems")}</span>
                </div>
                <Link to={nextPuzzle ? `/training/${nextPuzzle.slug}` : "/training"}>
                  <Button variant="gold" size="default">
                    <Trophy className="w-4 h-4" />
                    {t("dashboard.takeChallenge")}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Link to={nextPuzzle ? `/training/${nextPuzzle.slug}` : "/training"} className="glass-surface rounded-xl p-5 hover:border-primary/20 transition-all cursor-pointer group block">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{t("dashboard.resume")}</span>
                </div>
                <h4 className="font-heading text-base font-bold text-foreground mb-1">
                  {nextPuzzle ? getLocalized(nextPuzzle.title, lang) : t("dashboard.fundamentalsADC")}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  {nextPuzzle ? getLocalized(nextPuzzle.description, lang) : t("dashboard.scenarioProgress")}
                </p>
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
                <h4 className="font-heading text-base font-bold text-foreground mb-1">
                  {recommendedPuzzle ? getLocalized(recommendedPuzzle.title, lang) : t("dashboard.antiTank")}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  {recommendedPuzzle ? getLocalized(recommendedPuzzle.description, lang) : t("dashboard.antiTankDesc")}
                </p>
                <div className="flex items-center gap-2">
                  {(dashboard?.featuredItems ?? []).slice(0, 2).map((item) => (
                    <ItemIcon key={item.id} item={item} size="sm" />
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("dashboard.discover")} <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-surface rounded-xl p-5">
              <h3 className="font-heading text-base font-bold text-foreground mb-4">{t("dashboard.progression")}</h3>
              <div className="space-y-3">
                {(dashboard?.recentAttempts ?? []).map((attempt) => (
                  <Link key={attempt.id} to={`/training/${attempt.puzzleSlug}`} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{getLocalized(attempt.puzzleTitle, lang)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(attempt.answeredAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs font-medium ${attempt.isCorrect ? "text-primary" : "text-destructive"}`}>
                      {attempt.isCorrect ? "Correct" : "Retry"}
                    </span>
                  </Link>
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
