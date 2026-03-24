import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Coins, Flame, ShieldAlert, Swords, Timer, Trophy, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import ChampionPortrait from "@/components/ChampionPortrait";
import { ItemIcon } from "@/components/ItemIcon";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/api/client";
import { useCurrentUser, usePuzzle, usePuzzles } from "@/api/hooks";
import { getNextPuzzleSlug } from "@/lib/puzzleSeries";
import type { ChampionView, GameItem } from "@/types/domain";

type TeamEntry =
  | ChampionView
  | {
      id: string;
      name: string;
      champion?: ChampionView | { id: string; name: string };
      role?: string;
      items?: Array<GameItem | { id: string; name: string }>;
      note?: string;
    };

const isChampionView = (entry: TeamEntry): entry is ChampionView => "slug" in entry;

const renderItem = (item: GameItem | { id: string; name: string }, size: "sm" | "md" = "sm") =>
  "slug" in item ? (
    <ItemIcon key={item.id} item={item} size={size} showTooltip={false} />
  ) : (
    <div key={item.id} className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-border/60 bg-secondary px-2 text-[11px] text-foreground">
      {item.name.slice(0, 3).toUpperCase()}
    </div>
  );

const TeamRow = ({ entry }: { entry: TeamEntry }) => {
  const champion = isChampionView(entry) ? entry : entry.champion;
  const role = isChampionView(entry) ? undefined : entry.role;
  const items = isChampionView(entry) ? [] : entry.items ?? [];

  return (
    <div className="grid grid-cols-[170px_1fr] items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        {champion && "slug" in champion ? <ChampionPortrait champion={champion} size="sm" /> : <div className="h-10 w-10 rounded-lg bg-secondary" />}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {champion && "name" in champion ? champion.name : isChampionView(entry) ? entry.name : entry.name}
          </p>
          <p className="text-xs text-muted-foreground">{role ?? "Rôle inconnu"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length > 0 ? items.map((item) => renderItem(item)) : <span className="text-xs text-muted-foreground">Pas de snapshot d'items.</span>}
      </div>
    </div>
  );
};

const Training = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { data: user } = useCurrentUser();
  const { data: puzzle, isLoading } = usePuzzle(slug);
  const { data: allPuzzles = [] } = usePuzzles({ limit: 120 });
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    saved: boolean;
    isCorrect: boolean;
    correctChoiceId: string | null;
    explanation: string;
    globalExplanation: string;
    requiresAuth: boolean;
  }>(null);

  const submitAttempt = useMutation({
    mutationFn: (choiceId: string) =>
      apiFetch<{
        saved: boolean;
        isCorrect: boolean;
        correctChoiceId: string | null;
        explanation: string;
        globalExplanation: string;
        requiresAuth: boolean;
      }>(`/puzzles/${slug}/attempts`, {
        method: "POST",
        body: JSON.stringify({ selectedChoiceId: choiceId, responseTimeMs: 12000 }),
      }),
    onSuccess: (payload) => setResult(payload),
  });

  const nextPuzzle = useMemo(() => {
    if (!puzzle?.slug) {
      return null;
    }

    const nextSeriesSlug = getNextPuzzleSlug(puzzle.slug);
    if (nextSeriesSlug) {
      return { slug: nextSeriesSlug, label: "Question suivante de la série OTP" };
    }

    const sameChampion = allPuzzles.find((entry) => entry.slug !== puzzle.slug && entry.champion?.slug === puzzle.champion?.slug);
    if (sameChampion) {
      return { slug: sameChampion.slug, label: "Autre puzzle du même champion" };
    }

    return null;
  }, [allPuzzles, puzzle]);

  if (!slug) {
    return (
      <div className="min-h-screen bg-background pt-24">
        <div className="container mx-auto px-6">
          <div className="glass-surface rounded-3xl p-8">
            <p className="text-sm text-muted-foreground">Aucun puzzle sélectionné.</p>
            <div className="mt-4 flex gap-3">
              <Link to="/modules"><Button variant="gold">Ouvrir les modules</Button></Link>
              <Link to="/dashboard"><Button variant="outline">Ouvrir le dashboard</Button></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !puzzle) {
    return <div className="min-h-screen bg-background pt-24"><div className="container mx-auto px-6"><div className="glass-surface rounded-xl p-6">Chargement du puzzle...</div></div></div>;
  }

  const allies = (puzzle.scenario?.allyTeam ?? []) as TeamEntry[];
  const enemies = (puzzle.scenario?.enemyTeam ?? []) as TeamEntry[];

  return (
    <div className="min-h-screen bg-background pt-20 pb-8">
      <div className="container mx-auto max-w-[1800px] px-4">
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-4">
            <div className="glass-surface rounded-3xl p-6">
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.22em]">
                <span className="font-semibold text-primary">{puzzle.mode.replaceAll("_", " ")}</span>
                <span className="text-muted-foreground">Patch {puzzle.patch}</span>
                <span className="text-muted-foreground">{puzzle.difficulty}</span>
                {puzzle.role ? <span className="text-muted-foreground">{puzzle.role}</span> : null}
              </div>
              <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">{puzzle.title}</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">{puzzle.situation}</p>
            </div>

            {puzzle.scenario ? (
              <>
                <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                  <div className="glass-surface rounded-3xl p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">État du joueur</p>
                        <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">{puzzle.scenario.playerChampion.name}</h2>
                        <p className="text-sm text-muted-foreground">{puzzle.scenario.playerRole}</p>
                      </div>
                      <ChampionPortrait champion={puzzle.scenario.playerChampion} size="lg" />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-secondary/60 p-4"><Timer className="mb-2 h-4 w-4 text-primary" />{puzzle.scenario.gameMinute}:00</div>
                      <div className="rounded-2xl bg-secondary/60 p-4"><Coins className="mb-2 h-4 w-4 text-primary" />{puzzle.scenario.playerGold} or</div>
                      <div className="rounded-2xl bg-secondary/60 p-4"><Swords className="mb-2 h-4 w-4 text-primary" />{puzzle.scenario.kills}/{puzzle.scenario.deaths}/{puzzle.scenario.assists}</div>
                      <div className="rounded-2xl bg-secondary/60 p-4"><Flame className="mb-2 h-4 w-4 text-primary" />{puzzle.scenario.cs} cs</div>
                    </div>
                    <div className="mt-5">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Build actuel</p>
                      <div className="flex flex-wrap gap-2">
                        {puzzle.scenario.currentBuild.length > 0 ? puzzle.scenario.currentBuild.map((item) => renderItem(item)) : <span className="text-sm text-muted-foreground">Build non renseigné.</span>}
                      </div>
                    </div>
                  </div>

                  <div className="glass-surface rounded-3xl p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Lecture tactique</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Objectif</p>
                        {Object.entries((puzzle.scenario.objectiveState ?? {}) as Record<string, unknown>).map(([key, value]) => (
                          <p key={key} className="mt-2 text-sm text-foreground">{key}: <span className="text-muted-foreground">{String(value)}</span></p>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Profil de dégâts</p>
                        {Object.entries((puzzle.scenario.damageProfile ?? {}) as Record<string, unknown>).map(([key, value]) => (
                          <p key={key} className="mt-2 text-sm text-foreground">{key}: <span className="text-muted-foreground">{String(value)}</span></p>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">État de carte</p>
                        {Object.entries((puzzle.scenario.mapState ?? {}) as Record<string, unknown>).map(([key, value]) => (
                          <p key={key} className="mt-2 text-sm text-foreground">{key}: <span className="text-muted-foreground">{String(value)}</span></p>
                        ))}
                      </div>
                    </div>
                    {puzzle.scenario.notes ? (
                      <div className="mt-4 flex gap-3 rounded-2xl border border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p>{puzzle.scenario.notes}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="glass-surface rounded-3xl p-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Équipe alliée</p>
                    <div className="space-y-3">{allies.map((entry) => <TeamRow key={entry.id} entry={entry} />)}</div>
                  </div>
                  <div className="glass-surface rounded-3xl p-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Équipe ennemie et items visibles</p>
                    <div className="space-y-3">{enemies.map((entry) => <TeamRow key={entry.id} entry={entry} />)}</div>
                  </div>
                </div>
              </>
            ) : null}
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="glass-surface rounded-3xl p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Question</p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-foreground">{puzzle.question}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{puzzle.shortPrompt}</p>
            </div>

            <div className="grid gap-3">
              {puzzle.choices.map((choice) => {
                const selected = selectedChoiceId === choice.id;
                const correct = result && choice.id === result.correctChoiceId;
                const wrongSelected = result && selected && !choice.isCorrect;

                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => !result && setSelectedChoiceId(choice.id)}
                    className={`rounded-3xl border p-4 text-left transition-all ${
                      correct
                        ? "border-emerald-400/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                        : wrongSelected
                          ? "border-destructive/60 bg-destructive/10"
                          : selected
                            ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                            : "border-border/60 bg-background/70 hover:border-primary/40"
                    } ${result ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <div className="grid grid-cols-[56px_1fr_auto] items-center gap-4">
                      <div className="relative">
                        {choice.item ? <ItemIcon item={choice.item} size="md" showTooltip={false} /> : <div className="h-12 w-12 rounded-xl bg-secondary" />}
                        <div className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                          correct ? "border-emerald-400 bg-emerald-500 text-white" : selected ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-background text-muted-foreground"
                        }`}>
                          {correct ? "✓" : selected ? "•" : ""}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{choice.item?.name ?? choice.label}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{choice.textFallback ?? choice.item?.shortDescription ?? "Décision d'achat situationnelle."}</p>
                      </div>
                      {correct ? <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">Bonne réponse</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {!result ? (
              <div className="glass-surface rounded-3xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    {user ? "Ta réponse sera enregistrée dans ton profil." : "Tu peux répondre maintenant, mais il faut être connecté pour sauvegarder la progression."}
                  </p>
                  <Button variant="gold" disabled={!selectedChoiceId || submitAttempt.isPending} onClick={() => selectedChoiceId && submitAttempt.mutate(selectedChoiceId)}>
                    Valider
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`rounded-3xl border p-5 ${result.isCorrect ? "border-emerald-400/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"}`}>
                <div className="flex items-start gap-4">
                  {result.isCorrect ? <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-300" /> : <XCircle className="h-7 w-7 shrink-0 text-destructive" />}
                  <div className="space-y-3">
                    <h3 className="font-heading text-2xl font-bold text-foreground">{result.isCorrect ? "Bonne lecture" : "Achat moins cohérent"}</h3>
                    <p className="text-sm text-muted-foreground">{result.explanation}</p>
                    <p className="text-sm text-muted-foreground">{result.globalExplanation}</p>
                    {result.requiresAuth ? (
                      <div className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-sm text-foreground">
                        Cette réponse a été évaluée mais pas sauvegardée. <Link className="font-semibold text-primary" to="/auth">Crée un compte</Link> pour enregistrer tes tentatives, ta progression OTP et tes streaks.
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {nextPuzzle ? <Button variant="gold" onClick={() => navigate(`/training/${nextPuzzle.slug}`)}><Trophy className="h-4 w-4" />{nextPuzzle.label}</Button> : null}
                      <Link to="/dashboard"><Button variant="outline">Retour au dashboard</Button></Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Training;
