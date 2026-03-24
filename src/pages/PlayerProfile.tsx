import { AlertCircle, BarChart3, Crosshair, Swords, Trophy } from "lucide-react";
import { useParams } from "react-router-dom";
import { RiotIdSearch } from "@/components/RiotIdSearch";
import { usePlayerSearch } from "@/api/hooks";

const PlayerProfile = () => {
  const params = useParams();
  const riotId = params.gameName && params.tagLine ? `${params.gameName}#${params.tagLine}` : undefined;
  const { data, isLoading, error } = usePlayerSearch(riotId);

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto max-w-6xl space-y-6 px-6">
        <section className="glass-surface rounded-[32px] p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">Player Profile</p>
              <h1 className="mt-3 font-heading text-4xl font-bold text-foreground">
                {data?.profile.riotId ?? riotId ?? "Search a Riot ID"}
              </h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Base profile stats inspired by DPM.LOL: recent performance, main champions, and a clean search flow ready for future personalized quiz generation.
              </p>
            </div>
            <RiotIdSearch defaultValue={riotId} compact />
          </div>
        </section>

        {isLoading ? (
          <section className="glass-surface rounded-[32px] p-8 text-muted-foreground">Loading Riot profile and recent games...</section>
        ) : null}

        {error ? (
          <section className="glass-surface rounded-[32px] border border-destructive/30 p-8 text-destructive">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">Unable to load this player.</p>
                <p className="mt-2 text-sm">{(error as Error).message}</p>
              </div>
            </div>
          </section>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="glass-surface rounded-3xl p-6">
                <Trophy className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Win rate</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.winRate}%</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.summary.wins}W / {data.summary.losses}L</p>
              </div>
              <div className="glass-surface rounded-3xl p-6">
                <Swords className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Average KDA</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.averageKda}</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.summary.matchesAnalyzed} recent matches</p>
              </div>
              <div className="glass-surface rounded-3xl p-6">
                <Crosshair className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Average damage</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.averageDamageToChampions.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">Damage to champions</p>
              </div>
              <div className="glass-surface rounded-3xl p-6">
                <BarChart3 className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Kill participation</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.averageKillParticipation}%</p>
                <p className="mt-1 text-sm text-muted-foreground">Average over recent games</p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="glass-surface rounded-[32px] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Account Snapshot</p>
                <div className="mt-5 space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3">
                    <span className="text-muted-foreground">Riot ID</span>
                    <span className="font-medium text-foreground">{data.profile.riotId}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3">
                    <span className="text-muted-foreground">Region</span>
                    <span className="font-medium uppercase text-foreground">{data.profile.region}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3">
                    <span className="text-muted-foreground">Summoner level</span>
                    <span className="font-medium text-foreground">{data.profile.summonerLevel ?? "Unknown"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Profile icon</span>
                    <span className="font-medium text-foreground">{data.profile.profileIconId ?? "Unknown"}</span>
                  </div>
                </div>

                <div className="mt-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Most played recently</p>
                  <div className="mt-4 space-y-3">
                    {data.summary.mostPlayedChampions.map((champion) => (
                      <div key={champion.championName} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-foreground">{champion.championName}</span>
                          <span className="text-sm text-muted-foreground">{champion.games} games</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{champion.wins} wins, {champion.kda} KDA</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-surface rounded-[32px] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Recent Matches</p>
                <div className="mt-5 space-y-3">
                  {data.recentMatches.map((match) => (
                    <div key={match.matchId} className="grid gap-3 rounded-3xl border border-border/60 bg-background/60 p-5 md:grid-cols-[0.9fr_0.65fr_0.75fr_0.7fr] md:items-center">
                      <div>
                        <p className="font-semibold text-foreground">{match.championName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{match.gameCreation ? new Date(match.gameCreation).toLocaleString() : "Recent game"}</p>
                      </div>
                      <div>
                        <p className={`font-semibold ${match.result === "Win" ? "text-emerald-400" : "text-rose-400"}`}>{match.result}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{match.kills}/{match.deaths}/{match.assists}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{match.damageToChampions.toLocaleString()} dmg</p>
                        <p className="mt-1 text-sm text-muted-foreground">{match.killParticipation}% KP</p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{match.cs} CS</p>
                        <p className="mt-1 text-sm text-muted-foreground">KDA {match.kda}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PlayerProfile;
