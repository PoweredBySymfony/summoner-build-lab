import { Link, Navigate } from "react-router-dom";
import { Flame, Swords, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChampionPortrait from "@/components/ChampionPortrait";
import { useCurrentUser, useDashboard } from "@/api/hooks";

const Dashboard = () => {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data, isLoading } = useDashboard();

  if (!userLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (isLoading || !data) {
    return <div className="min-h-screen bg-background pt-24"><div className="container mx-auto px-6"><div className="glass-surface rounded-xl p-6">Chargement du dashboard...</div></div></div>;
  }

  const accuracy = data.progress.global.totalAttempts
    ? Math.round((data.progress.global.totalCorrect / data.progress.global.totalAttempts) * 100)
    : 0;
  const streakDeadline = data.progress.global.streakDeadlineAt
    ? new Date(data.progress.global.streakDeadlineAt).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto space-y-6 px-6">
        <div className="glass-surface rounded-2xl p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-primary">Progression joueur</p>
          <h1 className="font-heading text-4xl font-bold text-foreground">Bon retour, {user?.username}.</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Ta progression sauvegarde maintenant les tentatives, l'OTP, les defis quotidiens et l'historique de streak.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="glass-surface rounded-2xl p-5"><TrendingUp className="mb-4 h-5 w-5 text-primary" /><p className="text-3xl font-bold">{data.progress.global.totalAttempts}</p><p className="text-sm text-muted-foreground">Tentatives totales</p></div>
          <div className="glass-surface rounded-2xl p-5"><Target className="mb-4 h-5 w-5 text-primary" /><p className="text-3xl font-bold">{accuracy}%</p><p className="text-sm text-muted-foreground">Precision</p></div>
          <div className="glass-surface rounded-2xl p-5"><Flame className="mb-4 h-5 w-5 text-primary" /><p className="text-3xl font-bold">{data.progress.global.dailyStreak}</p><p className="text-sm text-muted-foreground">Streak actuelle</p><p className="mt-2 text-xs text-muted-foreground">{streakDeadline ? `A conserver avant le ${streakDeadline}` : "Aucune streak active"}</p></div>
          <div className="glass-surface rounded-2xl p-5"><Swords className="mb-4 h-5 w-5 text-primary" /><p className="text-3xl font-bold">{data.progress.dailyCompletedCount}</p><p className="text-sm text-muted-foreground">Succes quotidiens</p></div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="glass-surface rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Defi quotidien</p>
                <h2 className="font-heading text-2xl font-bold text-foreground">{data.dailyChallenge.title}</h2>
              </div>
              <Link to={`/training/${data.dailyChallenge.slug}`}><Button variant="gold">Jouer</Button></Link>
            </div>
            <p className="text-muted-foreground">{data.dailyChallenge.shortPrompt}</p>
          </div>

          <div className="glass-surface rounded-2xl p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">Tentatives recentes</p>
            <div className="space-y-3">
              {data.progress.recentAttempts.map((attempt) => (
                <Link key={attempt.id} to={`/training/${attempt.puzzle.slug}`} className="block rounded-xl border border-border/60 p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{attempt.puzzle.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(attempt.answeredAt).toLocaleString()}</p>
                    </div>
                    <span className={`text-xs font-semibold ${attempt.isCorrect ? "text-primary" : "text-destructive"}`}>
                      {attempt.isCorrect ? "Bonne reponse" : "A retravailler"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-surface rounded-2xl p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">Champions a retravailler</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.progress.championProgress.map((entry) => (
              <Link key={entry.champion.id} to={`/champions/${entry.champion.slug}`} className="rounded-xl border border-border/60 p-4 transition-colors hover:border-primary/40">
                <div className="flex items-center gap-3">
                  <ChampionPortrait champion={entry.champion} size="sm" />
                  <div>
                    <p className="font-medium text-foreground">{entry.champion.name}</p>
                    <p className="text-xs text-muted-foreground">Maitrise {entry.masteryScore}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
