import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Coins, Flame, ShieldAlert, Swords, Timer, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import ChampionPortrait from "@/components/ChampionPortrait";
import { ItemIcon } from "@/components/ItemIcon";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/api/client";
import { useCurrentUser, usePuzzle, usePuzzles } from "@/api/hooks";

const Training = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { data: user } = useCurrentUser();
  const { data: puzzle, isLoading } = usePuzzle(slug);
  const { data: allPuzzles = [] } = usePuzzles({ limit: 80 });
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

  if (isLoading || !puzzle) {
    return <div className="min-h-screen bg-background pt-24"><div className="container mx-auto px-6"><div className="glass-surface rounded-xl p-6">Loading puzzle...</div></div></div>;
  }

  const currentIndex = allPuzzles.findIndex((entry) => entry.slug === puzzle.slug);
  const nextPuzzle = currentIndex >= 0 ? allPuzzles[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-6 space-y-6">
        <div className="glass-surface rounded-2xl p-8">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.25em]">
            <span className="text-primary font-semibold">{puzzle.mode}</span>
            <span className="text-muted-foreground">Patch {puzzle.patch}</span>
            <span className="text-muted-foreground">{puzzle.difficulty}</span>
            {puzzle.role && <span className="text-muted-foreground">{puzzle.role}</span>}
          </div>
          <h1 className="font-heading text-4xl font-bold text-foreground mt-4">{puzzle.title}</h1>
          <p className="text-muted-foreground mt-4 max-w-4xl">{puzzle.situation}</p>
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="space-y-6">
            {puzzle.scenario && (
              <>
                <div className="glass-surface rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold">Player state</p>
                      <h2 className="font-heading text-2xl font-bold text-foreground mt-2">{puzzle.scenario.playerChampion.name}</h2>
                    </div>
                    <ChampionPortrait champion={puzzle.scenario.playerChampion} size="lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-secondary/60 p-4"><Timer className="w-4 h-4 text-primary mb-2" />{puzzle.scenario.gameMinute}:00</div>
                    <div className="rounded-xl bg-secondary/60 p-4"><Coins className="w-4 h-4 text-primary mb-2" />{puzzle.scenario.playerGold} gold</div>
                    <div className="rounded-xl bg-secondary/60 p-4"><Swords className="w-4 h-4 text-primary mb-2" />{puzzle.scenario.kills}/{puzzle.scenario.deaths}/{puzzle.scenario.assists}</div>
                    <div className="rounded-xl bg-secondary/60 p-4"><Flame className="w-4 h-4 text-primary mb-2" />{puzzle.scenario.cs} cs</div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Current build</p>
                    <div className="flex flex-wrap gap-2">
                      {puzzle.scenario.currentBuild.map((item) =>
                        "slug" in item ? <ItemIcon key={item.id} item={item} size="sm" /> : <div key={item.id} className="px-3 py-2 rounded-lg bg-secondary text-sm">{item.name}</div>,
                      )}
                    </div>
                  </div>
                </div>

                <div className="glass-surface rounded-2xl p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Teams in view</p>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Allies</p>
                      <div className="flex flex-wrap gap-3">
                        {puzzle.scenario.allyTeam.map((champion) =>
                          "slug" in champion ? <ChampionPortrait key={champion.id} champion={champion} size="sm" showInfo /> : <div key={champion.id} className="px-3 py-2 rounded-lg bg-secondary text-sm">{champion.name}</div>,
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Enemies</p>
                      <div className="flex flex-wrap gap-3">
                        {puzzle.scenario.enemyTeam.map((champion) =>
                          "slug" in champion ? <ChampionPortrait key={champion.id} champion={champion} size="sm" showInfo /> : <div key={champion.id} className="px-3 py-2 rounded-lg bg-secondary text-sm">{champion.name}</div>,
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-surface rounded-2xl p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Visible enemy items and threats</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(puzzle.scenario.enemyItems) && puzzle.scenario.enemyItems.length > 0 ? (
                      puzzle.scenario.enemyItems.map((entry, index) =>
                        "slug" in entry ? <ItemIcon key={`${entry.id}-${index}`} item={entry} size="sm" /> : <div key={`${entry.id}-${index}`} className="px-3 py-2 rounded-lg bg-secondary text-sm">{entry.name}</div>,
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">No enemy item snapshot recorded.</span>
                    )}
                  </div>
                  <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-secondary/60 p-4">
                      <p className="font-semibold text-foreground mb-2">Objective state</p>
                      <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(puzzle.scenario.objectiveState, null, 2)}</pre>
                    </div>
                    <div className="rounded-xl bg-secondary/60 p-4">
                      <p className="font-semibold text-foreground mb-2">Damage profile</p>
                      <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(puzzle.scenario.damageProfile, null, 2)}</pre>
                    </div>
                  </div>
                  {puzzle.scenario.notes && (
                    <div className="mt-4 rounded-xl border border-border/60 px-4 py-3 text-sm text-muted-foreground flex gap-2">
                      <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {puzzle.scenario.notes}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-6">
            <div className="glass-surface rounded-2xl p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Question</p>
              <h2 className="font-heading text-2xl font-bold text-foreground">{puzzle.question}</h2>
              <p className="text-muted-foreground mt-3">{puzzle.shortPrompt}</p>
            </div>

            <div className="grid gap-4">
              {puzzle.choices.map((choice) => {
                const selected = selectedChoiceId === choice.id;
                const revealed = result && choice.id === result.correctChoiceId;
                return (
                  <button
                    key={choice.id}
                    onClick={() => setSelectedChoiceId(choice.id)}
                    className={`glass-surface rounded-2xl p-5 text-left transition-all border ${
                      revealed ? "border-primary/50" : selected ? "border-primary/30" : "border-transparent hover:border-border/60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {choice.item ? <ItemIcon item={choice.item} size="md" showTooltip={false} /> : <div className="w-12 h-12 rounded-lg bg-secondary" />}
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{choice.item?.name ?? choice.label}</h3>
                        <p className="text-sm text-muted-foreground mt-2">{choice.textFallback ?? choice.item?.shortDescription ?? "Situational purchase decision."}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {!result ? (
              <div className="glass-surface rounded-2xl p-6 flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">{user ? "Your answer will be saved to your profile." : "You can answer now, but login is required to save progression and streaks."}</p>
                <Button variant="gold" disabled={!selectedChoiceId || submitAttempt.isPending} onClick={() => selectedChoiceId && submitAttempt.mutate(selectedChoiceId)}>
                  Validate
                </Button>
              </div>
            ) : (
              <div className={`rounded-2xl p-6 border ${result.isCorrect ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"}`}>
                <div className="flex items-start gap-4">
                  {result.isCorrect ? <CheckCircle2 className="w-8 h-8 text-primary shrink-0" /> : <XCircle className="w-8 h-8 text-destructive shrink-0" />}
                  <div className="space-y-3">
                    <h3 className="font-heading text-2xl font-bold text-foreground">{result.isCorrect ? "Correct read" : "Not the best pivot"}</h3>
                    <p className="text-sm text-muted-foreground">{result.explanation}</p>
                    <p className="text-sm text-muted-foreground">{result.globalExplanation}</p>
                    {result.requiresAuth && (
                      <div className="rounded-xl bg-secondary/60 px-4 py-3 text-sm text-foreground">
                        This answer was evaluated but not saved. <Link className="text-primary font-semibold" to="/auth">Create an account</Link> to store attempts, OTP progress and daily streaks.
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {nextPuzzle && <Button variant="gold" onClick={() => navigate(`/training/${nextPuzzle.slug}`)}>Next puzzle</Button>}
                      <Link to="/dashboard"><Button variant="outline">Open dashboard</Button></Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;
