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
    return <div className="min-h-screen bg-background pt-24"><div className="container mx-auto px-6"><div className="glass-surface rounded-xl p-6">Loading progress dashboard...</div></div></div>;
  }

  const accuracy = data.progress.global.totalAttempts
    ? Math.round((data.progress.global.totalCorrect / data.progress.global.totalAttempts) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-6 space-y-6">
        <div className="glass-surface rounded-2xl p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Player progress</p>
          <h1 className="font-heading text-4xl font-bold text-foreground">Welcome back, {user?.username}.</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">Your learning path now persists attempts, OTP progress, daily completions and streak history.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="glass-surface rounded-2xl p-5"><TrendingUp className="w-5 h-5 text-primary mb-4" /><p className="text-3xl font-bold">{data.progress.global.totalAttempts}</p><p className="text-sm text-muted-foreground">Total attempts</p></div>
          <div className="glass-surface rounded-2xl p-5"><Target className="w-5 h-5 text-primary mb-4" /><p className="text-3xl font-bold">{accuracy}%</p><p className="text-sm text-muted-foreground">Accuracy</p></div>
          <div className="glass-surface rounded-2xl p-5"><Flame className="w-5 h-5 text-primary mb-4" /><p className="text-3xl font-bold">{data.progress.global.dailyStreak}</p><p className="text-sm text-muted-foreground">Current streak</p></div>
          <div className="glass-surface rounded-2xl p-5"><Swords className="w-5 h-5 text-primary mb-4" /><p className="text-3xl font-bold">{data.progress.dailyCompletedCount}</p><p className="text-sm text-muted-foreground">Daily wins</p></div>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="glass-surface rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold">Daily challenge</p>
                <h2 className="font-heading text-2xl font-bold text-foreground">{data.dailyChallenge.title}</h2>
              </div>
              <Link to={`/training/${data.dailyChallenge.slug}`}><Button variant="gold">Play now</Button></Link>
            </div>
            <p className="text-muted-foreground">{data.dailyChallenge.shortPrompt}</p>
          </div>

          <div className="glass-surface rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-4">Recent attempts</p>
            <div className="space-y-3">
              {data.progress.recentAttempts.map((attempt) => (
                <Link key={attempt.id} to={`/training/${attempt.puzzle.slug}`} className="block rounded-xl border border-border/60 p-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{attempt.puzzle.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(attempt.answeredAt).toLocaleString()}</p>
                    </div>
                    <span className={`text-xs font-semibold ${attempt.isCorrect ? "text-primary" : "text-destructive"}`}>{attempt.isCorrect ? "Correct" : "Retry"}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-surface rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-4">Best champions to study next</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.progress.championProgress.map((entry) => (
              <Link key={entry.champion.id} to={`/champions/${entry.champion.slug}`} className="rounded-xl border border-border/60 p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <ChampionPortrait champion={entry.champion} size="sm" />
                  <div>
                    <p className="font-medium text-foreground">{entry.champion.name}</p>
                    <p className="text-xs text-muted-foreground">Mastery {entry.masteryScore}</p>
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
