import { AlertCircle, BarChart3, Crosshair, Eye, Loader2, Plus, Sparkles, Swords, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RiotIdSearch } from "@/components/RiotIdSearch";
import { useCurrentUser, useGenerateMatchPuzzleSeries, useImportRecentMatches, usePlayerSearch } from "@/api/hooks";
import { savePuzzleSeries } from "@/lib/puzzleSeries";
import { buildRiotProfileIconUrl, saveRecentRiotSearch } from "@/lib/riotSearch";
import type { GeneratedMatchPuzzleResponse } from "@/types/domain";

const PlayerProfile = () => {
  const navigate = useNavigate();
  const params = useParams();
  const riotId = params.gameName && params.tagLine ? `${params.gameName}#${params.tagLine}` : undefined;
  const { data: user } = useCurrentUser();
  const [matchFetchCount, setMatchFetchCount] = useState(5);
  const { data, isLoading, error, isFetching } = usePlayerSearch(riotId, matchFetchCount);
  const importRecentMatches = useImportRecentMatches();
  const generateMatchSeries = useGenerateMatchPuzzleSeries();
  const [generationResult, setGenerationResult] = useState<GeneratedMatchPuzzleResponse | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

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
  const canLoadMoreMatches = matchFetchCount < 20 && data ? data.recentMatches.length >= matchFetchCount : false;
  const compactStats = data
    ? [
      { label: "WR", value: `${data.summary.winRate}%`, detail: `${data.summary.wins}V/${data.summary.losses}D`, icon: Trophy },
      { label: "KDA", value: String(data.summary.averageKda), detail: `${data.summary.matchesAnalyzed} parties`, icon: Swords },
      { label: "Degats", value: data.summary.averageDamageToChampions.toLocaleString(), detail: "moyenne", icon: Crosshair },
      { label: "KP", value: `${data.summary.averageKillParticipation}%`, detail: "participation", icon: BarChart3 },
      { label: "CS/min", value: String(data.summary.averageCsPerMinute), detail: `${data.summary.averageCs} CS`, icon: BarChart3 },
      { label: "Vision", value: String(data.summary.averageVisionScore), detail: `${data.summary.averageGoldEarned.toLocaleString()} or`, icon: Eye },
    ]
    : [];

  const generateSeriesFromMatch = async (matchId: string, matchIndex: number) => {
    if (!data) {
      return;
    }

    setGenerationResult(null);
    setGenerationError(null);
    setSelectedMatchId(matchId);

    try {
      const importCount = Math.max(1, Math.min(20, matchIndex + 1));
      const importedMatches = await importRecentMatches.mutateAsync({
        puuid: data.profile.puuid,
        count: importCount,
      });
      const importedMatch = importedMatches.find((match) => match.riotMatchId === matchId);

      if (!importedMatch) {
        throw new Error("Cette partie n'a pas pu etre importee pour l'analyse.");
      }

      const series = await generateMatchSeries.mutateAsync({ importedMatchId: importedMatch.id });
      if (series.generationStatus === "completed") {
        savePuzzleSeries(series.slugs);
        navigate(`/training/${series.slug}`);
        return;
      }

      setGenerationResult(series);
    } catch (generationError) {
      setGenerationError(generationError instanceof Error ? generationError.message : "Generation impossible pour cette partie.");
    } finally {
      setSelectedMatchId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10 pt-20">
      <div className="container mx-auto max-w-[1700px] space-y-5 px-4">
        <section className="glass-surface relative z-20 rounded-2xl p-4 lg:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              {profileIconUrl ? (
                <img
                  src={profileIconUrl}
                  alt={data?.profile.riotId ?? riotId ?? "Profil"}
                  className="h-20 w-20 rounded-2xl border border-border/60 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-secondary text-2xl font-bold text-foreground">
                  {(data?.profile.gameName ?? riotId ?? "RI").slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">Profil joueur</p>
                <h1 className="mt-2 break-words font-heading text-2xl font-bold text-foreground sm:text-3xl">
                  {data?.profile.riotId ?? riotId ?? "Recherche de Riot ID"}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Poste de controle joueur: selection rapide d'une partie, lecture des tendances et generation d'exercice.
                </p>

                {user && data ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                      onClick={() => {
                        const latestMatch = data.recentMatches[0];
                        if (latestMatch) {
                          void generateSeriesFromMatch(latestMatch.matchId, 0);
                        }
                      }}
                      disabled={!data.recentMatches[0] || importRecentMatches.isPending || generateMatchSeries.isPending}
                    >
                      <Sparkles className="h-4 w-4" />
                      Generer une serie depuis la derniere partie
                    </button>
                  </div>
                ) : null}
                {generationResult
                && (
                  generationResult.generationStatus === "no_viable_snapshot_found"
                  || generationResult.generationStatus === "no_publishable_snapshot_found"
                ) ? (
                  <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                    <p>
                      {generationResult.failureCode === "no_publishable_snapshot_found"
                        ? "La partie est exploitable, mais aucun moment n'a encore passe la gate de publishability."
                        : generationResult.message}
                    </p>
                    <p className="mt-2">
                      Snapshots evalues: {generationResult.snapshotsEvaluated}
                      {" | "}
                      Snapshots techniquement viables: {generationResult.viableSnapshots}
                      {" | "}
                      Snapshots publiables: {generationResult.publishableSnapshots}
                    </p>
                    {generationResult.nonPublishableButViableSnapshots > 0 ? (
                      <p className="mt-2">
                        Snapshots viables mais refuses a la publication: {generationResult.nonPublishableButViableSnapshots}
                      </p>
                    ) : null}
                    {generationResult.dominantRejectionReasons.length > 0 ? (
                      <p className="mt-2">
                        Rejets dominants: {generationResult.dominantRejectionReasons.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {generationError ? (
                  <div className="mt-4 rounded-2xl border border-destructive/30 bg-background/60 px-4 py-3 text-sm text-destructive">
                    {generationError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="relative z-50 min-w-0">
              <RiotIdSearch defaultValue={riotId} compact />
            </div>
          </div>
        </section>

        {isLoading ? (
          <section className="glass-surface rounded-2xl p-8 text-muted-foreground">
            Chargement du profil Riot et des parties recentes...
          </section>
        ) : null}

        {error ? (
          <section className="glass-surface rounded-2xl border border-destructive/30 p-8 text-destructive">
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
            <section className="glass-surface rounded-2xl p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {compactStats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/45 px-3 py-2">
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                        <p className="truncate text-lg font-bold text-foreground">{stat.value}</p>
                        <p className="truncate text-xs text-muted-foreground">{stat.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="glass-surface rounded-2xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Apercu du compte</p>
                  <div className="mt-5 space-y-4 text-sm">
                    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-3">
                      <span className="text-muted-foreground">Riot ID</span>
                      <span className="max-w-[60%] break-all text-right font-medium text-foreground">{data.profile.riotId}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-3">
                      <span className="text-muted-foreground">Region</span>
                      <span className="font-medium uppercase text-foreground">{data.profile.region}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-3">
                      <span className="text-muted-foreground">Niveau invocateur</span>
                      <span className="font-medium text-foreground">{data.profile.summonerLevel ?? "Inconnu"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Icone de profil</span>
                      <span className="font-medium text-foreground">{data.profile.profileIconId ?? "Inconnue"}</span>
                    </div>
                  </div>
                </div>

                <div className="glass-surface rounded-2xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Champions les plus joues</p>
                  <div className="mt-4 space-y-3">
                    {data.summary.mostPlayedChampions.map((champion) => (
                      <div key={champion.championName} className="rounded-lg border border-border/60 bg-background/60 p-3">
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

              <div className="glass-surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Parties recentes</p>
                  <p className="text-sm text-muted-foreground">{data.recentMatches.length} parties chargees</p>
                </div>
                <div className="mt-4 space-y-2">
                  {data.recentMatches.map((match, matchIndex) => (
                    <div key={match.matchId} className="rounded-xl border border-border/60 bg-background/55 px-3 py-3">
                      <div className="grid gap-4 xl:grid-cols-[0.18fr_0.11fr_0.16fr_0.12fr_0.14fr_0.17fr_0.12fr] xl:items-center">
                        <div>
                          <p className="font-semibold text-foreground">{match.championName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{match.queueLabel}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {match.gameCreation ? new Date(match.gameCreation).toLocaleString("fr-FR") : "Partie recente"}
                          </p>
                        </div>
                        <div>
                          <p className={`font-semibold ${match.result === "Win" ? "text-emerald-400" : "text-rose-400"}`}>
                            {match.result === "Win" ? "Victoire" : "Defaite"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{match.kills}/{match.deaths}/{match.assists}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{match.damageToChampions.toLocaleString()}</p>
                          <p className="mt-1 text-xs text-muted-foreground">degats - {match.killParticipation}% KP</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{match.cs} CS</p>
                          <p className="mt-1 text-xs text-muted-foreground">KDA {match.kda}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{match.goldEarned.toLocaleString()} or</p>
                          <p className="mt-1 text-xs text-muted-foreground">Vision {match.visionScore}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {match.items.map((item) => (
                            item.icon ? (
                              <img
                                key={`${match.matchId}-${item.riotItemId}`}
                                src={item.icon}
                                alt={item.name}
                                title={item.name}
                                className="h-9 w-9 rounded-md border border-border/60 bg-secondary object-cover"
                              />
                            ) : (
                              <div
                                key={`${match.matchId}-${item.riotItemId}`}
                                title={item.name}
                                className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-secondary text-[10px] font-bold text-foreground"
                              >
                                {item.name.slice(0, 2).toUpperCase()}
                              </div>
                            )
                          ))}
                        </div>
                        <div className="flex xl:justify-end">
                          {user ? (
                            <button
                              type="button"
                              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => generateSeriesFromMatch(match.matchId, matchIndex)}
                              disabled={
                                selectedMatchId === match.matchId
                                || importRecentMatches.isPending
                                || generateMatchSeries.isPending
                              }
                            >
                              {selectedMatchId === match.matchId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                              Analyser
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {canLoadMoreMatches ? (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => setMatchFetchCount((current) => Math.min(20, current + 5))}
                      disabled={isFetching}
                    >
                      {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Charger plus de parties
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PlayerProfile;
