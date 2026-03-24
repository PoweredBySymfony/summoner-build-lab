import { AlertCircle, BarChart3, Crosshair, Eye, Sparkles, Swords, Trophy } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { RiotIdSearch } from "@/components/RiotIdSearch";
import { useCurrentUser, useGenerateMatchPuzzleSeries, useImportRecentMatches, usePlayerSearch } from "@/api/hooks";
import { savePuzzleSeries } from "@/lib/puzzleSeries";
import { buildRiotProfileIconUrl, saveRecentRiotSearch } from "@/lib/riotSearch";

const PlayerProfile = () => {
  const navigate = useNavigate();
  const params = useParams();
  const riotId = params.gameName && params.tagLine ? `${params.gameName}#${params.tagLine}` : undefined;
  const { data: user } = useCurrentUser();
  const { data, isLoading, error } = usePlayerSearch(riotId);
  const importRecentMatches = useImportRecentMatches();
  const generateMatchSeries = useGenerateMatchPuzzleSeries();

  useEffect(() => {
    if (!data) {
      return;
    }

    saveRecentRiotSearch({
      gameName: data.profile.gameName,
      tagLine: data.profile.tagLine,
      profileIconId: data.profile.profileIconId,
    });
  }, [data]);

  const profileIconUrl = buildRiotProfileIconUrl(data?.profile.profileIconId);

  return (
    <div className="min-h-screen bg-background pt-20 pb-10">
      <div className="container mx-auto max-w-[1700px] space-y-5 px-4">
        <section className="glass-surface relative z-20 rounded-[32px] p-6 lg:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
            <div className="flex items-start gap-5">
              {profileIconUrl ? (
                <img src={profileIconUrl} alt={data?.profile.riotId ?? riotId ?? "Profil"} className="h-24 w-24 rounded-3xl border border-border/60 object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-border/60 bg-secondary text-2xl font-bold text-foreground">
                  {(data?.profile.gameName ?? riotId ?? "RI").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">Profil joueur</p>
                <h1 className="mt-3 font-heading text-4xl font-bold text-foreground">{data?.profile.riotId ?? riotId ?? "Recherche de Riot ID"}</h1>
                <p className="mt-3 max-w-3xl text-muted-foreground">
                  Vue compacte inspirée de DPM.LOL : performance récente, champion pool, builds récents et lecture rapide des tendances sur les dernières parties.
                </p>
                {user && data ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                      onClick={async () => {
                        const imported = await importRecentMatches.mutateAsync({ puuid: data.profile.puuid, count: 1 });
                        if (!imported[0]) {
                          return;
                        }

                        const series = await generateMatchSeries.mutateAsync({ importedMatchId: imported[0].id });
                        savePuzzleSeries(series.slugs);
                        navigate(`/training/${series.slug}`);
                      }}
                      disabled={importRecentMatches.isPending || generateMatchSeries.isPending}
                    >
                      <Sparkles className="h-4 w-4" />
                      Générer une série depuis la dernière game
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="relative z-50">
              <RiotIdSearch defaultValue={riotId} compact />
            </div>
          </div>
        </section>

        {isLoading ? (
          <section className="glass-surface rounded-[32px] p-8 text-muted-foreground">Chargement du profil Riot et des parties récentes...</section>
        ) : null}

        {error ? (
          <section className="glass-surface rounded-[32px] border border-destructive/30 p-8 text-destructive">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">Impossible de charger ce joueur.</p>
                <p className="mt-2 text-sm">{(error as Error).message}</p>
              </div>
            </div>
          </section>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="glass-surface rounded-3xl p-5">
                <Trophy className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Winrate</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.winRate}%</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.summary.wins}V / {data.summary.losses}D</p>
              </div>
              <div className="glass-surface rounded-3xl p-5">
                <Swords className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">KDA moyen</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.averageKda}</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.summary.matchesAnalyzed} parties</p>
              </div>
              <div className="glass-surface rounded-3xl p-5">
                <Crosshair className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Dégâts moyens</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.averageDamageToChampions.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">aux champions</p>
              </div>
              <div className="glass-surface rounded-3xl p-5">
                <BarChart3 className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Participation kills</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.averageKillParticipation}%</p>
                <p className="mt-1 text-sm text-muted-foreground">moyenne récente</p>
              </div>
              <div className="glass-surface rounded-3xl p-5">
                <BarChart3 className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">CS / min</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.averageCsPerMinute}</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.summary.averageCs} CS moyens</p>
              </div>
              <div className="glass-surface rounded-3xl p-5">
                <Eye className="mb-4 h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Vision / or</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.averageVisionScore}</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.summary.averageGoldEarned.toLocaleString()} gold moyens</p>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.33fr_0.67fr]">
              <div className="space-y-5">
                <div className="glass-surface rounded-[32px] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Snapshot compte</p>
                  <div className="mt-5 space-y-4 text-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3"><span className="text-muted-foreground">Riot ID</span><span className="font-medium text-foreground">{data.profile.riotId}</span></div>
                    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3"><span className="text-muted-foreground">Région</span><span className="font-medium uppercase text-foreground">{data.profile.region}</span></div>
                    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3"><span className="text-muted-foreground">Niveau invocateur</span><span className="font-medium text-foreground">{data.profile.summonerLevel ?? "Inconnu"}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Icône de profil</span><span className="font-medium text-foreground">{data.profile.profileIconId ?? "Inconnue"}</span></div>
                  </div>
                </div>

                <div className="glass-surface rounded-[32px] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Champions les plus joués</p>
                  <div className="mt-4 space-y-3">
                    {data.summary.mostPlayedChampions.map((champion) => (
                      <div key={champion.championName} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-foreground">{champion.championName}</span>
                          <span className="text-sm text-muted-foreground">{champion.games} parties</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{champion.wins} victoires, {champion.kda} KDA</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-surface rounded-[32px] p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Parties récentes</p>
                  <p className="text-sm text-muted-foreground">{data.summary.matchesAnalyzed} dernières games</p>
                </div>
                <div className="mt-5 space-y-3">
                  {data.recentMatches.map((match) => (
                    <div key={match.matchId} className="rounded-3xl border border-border/60 bg-background/60 p-5">
                      <div className="grid gap-4 xl:grid-cols-[0.2fr_0.12fr_0.18fr_0.14fr_0.18fr_0.18fr] xl:items-center">
                        <div>
                          <p className="font-semibold text-foreground">{match.championName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{match.queueLabel}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{match.gameCreation ? new Date(match.gameCreation).toLocaleString("fr-FR") : "Game récente"}</p>
                        </div>
                        <div>
                          <p className={`font-semibold ${match.result === "Win" ? "text-emerald-400" : "text-rose-400"}`}>{match.result === "Win" ? "Victoire" : "Défaite"}</p>
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
                        <div>
                          <p className="font-semibold text-foreground">{match.goldEarned.toLocaleString()} gold</p>
                          <p className="mt-1 text-sm text-muted-foreground">Vision {match.visionScore}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {match.items.map((item) => (
                            item.icon ? (
                              <img key={`${match.matchId}-${item.riotItemId}`} src={item.icon} alt={item.name} title={item.name} className="h-10 w-10 rounded-lg border border-border/60 bg-secondary object-cover" />
                            ) : (
                              <div key={`${match.matchId}-${item.riotItemId}`} title={item.name} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-secondary text-[10px] font-bold text-foreground">
                                {item.name.slice(0, 2).toUpperCase()}
                              </div>
                            )
                          ))}
                        </div>
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
