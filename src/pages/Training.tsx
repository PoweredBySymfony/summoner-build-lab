import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle, ChevronRight, Clock, Target, Trophy, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ItemIcon } from "@/components/ItemIcon";
import ChampionPortrait from "@/components/ChampionPortrait";
import { useLanguage } from "@/i18n/context";
import { usePuzzle, usePuzzles } from "@/api/hooks";
import { getLocalized } from "@/lib/formatters/localized";
import { apiFetch } from "@/api/client";

const Training = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { data: puzzles = [] } = usePuzzles();
  const activeSlug = slug ?? puzzles[0]?.slug;
  const { data: puzzle } = usePuzzle(activeSlug);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [result, setResult] = useState<null | { isCorrect: boolean; correctChoiceId: string | null }>(null);

  const nextPuzzle = useMemo(() => {
    if (!activeSlug) {
      return null;
    }

    const index = puzzles.findIndex((entry) => entry.slug === activeSlug);
    return index >= 0 ? puzzles[index + 1] ?? null : null;
  }, [activeSlug, puzzles]);

  const submitAttempt = useMutation({
    mutationFn: (choiceId: string) =>
      apiFetch<{ isCorrect: boolean; correctChoiceId: string | null }>(`/puzzles/${activeSlug}/attempts`, {
        method: "POST",
        body: JSON.stringify({ selectedChoiceId: choiceId }),
      }),
    onSuccess: (payload) => setResult(payload),
  });

  if (!puzzle) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-12">
        <div className="container mx-auto px-6">
          <div className="glass-surface rounded-xl p-6">Loading puzzle...</div>
        </div>
      </div>
    );
  }

  const correctChoice = puzzle.choices.find((choice) => choice.isCorrect);

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs uppercase tracking-wider text-primary font-semibold">{puzzle.moduleKey}</span>
                <span className="text-xs text-muted-foreground">{t("training.patch")} {puzzle.patch}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{puzzle.difficulty}</span>
              </div>
              <h1 className="text-2xl font-heading font-bold text-foreground">{getLocalized(puzzle.title, lang)}</h1>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Trophy className="w-4 h-4 text-primary" /> {puzzle.role}</span>
              <span className="flex items-center gap-1.5"><Target className="w-4 h-4" /> {puzzle.choiceCount} {t("modules.scenarios")}</span>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass-surface rounded-xl p-6 space-y-5">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("training.matchContext")}</span>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground font-medium">{puzzle.gameContext.minute ?? "?"}:00</span>
                </div>
                <span className="text-sm text-primary font-medium">{puzzle.gameContext.gold ?? 0} {t("training.gold")}</span>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] uppercase tracking-wider text-accent font-semibold">{t("training.nextObjective")}</span>
              </div>
              <p className="text-sm text-foreground font-medium">{String(puzzle.gameContext.objective ?? "teamfight")}</p>
            </div>

            {puzzle.champion && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("training.youPlay")}</span>
                <div className="flex items-center gap-3 mt-2">
                  <ChampionPortrait champion={puzzle.champion} size="lg" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{puzzle.champion.name}</p>
                    <p className="text-xs text-muted-foreground">{puzzle.champion.roles[0]}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("training.teams")}</span>
              <div className="mt-2 space-y-3">
                <div>
                  <span className="text-[9px] text-accent uppercase tracking-wider">{t("training.allies")}</span>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {puzzle.allyTeam.map((champion) => (
                      <ChampionPortrait key={champion.id} champion={champion} size="sm" showInfo />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-destructive uppercase tracking-wider">{t("training.enemies")}</span>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {puzzle.enemyTeam.map((champion) => (
                      <ChampionPortrait key={champion.id} champion={champion} size="sm" showInfo />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("training.currentBuild")}</span>
              <div className="flex gap-2 mt-2 flex-wrap">
                {(puzzle.gameContext.currentBuild ?? []).map((itemSlug) => {
                  const matched = puzzle.choices.find((choice) => choice.item?.id === itemSlug)?.item;
                  return matched ? <ItemIcon key={matched.id} item={matched} size="md" /> : null;
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="glass-surface rounded-xl p-6">
              <h2 className="font-heading text-xl font-bold text-foreground mb-2">{getLocalized(puzzle.question, lang)}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{getLocalized(puzzle.situation, lang)}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {puzzle.choices.map((choice) => {
                const isSelected = selectedChoiceId === choice.id;
                const item = choice.item;

                return (
                  <button
                    key={choice.id}
                    onClick={() => setSelectedChoiceId(choice.id)}
                    className={`glass-surface rounded-xl p-5 text-left transition-all duration-200 ${
                      isSelected ? "border-primary/50 border-glow-gold" : "hover:border-border"
                    }`}
                  >
                    {item ? (
                      <div className="flex items-start gap-4">
                        <ItemIcon item={item} size="lg" showTooltip={false} />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-heading text-base font-bold text-foreground">{item.name}</h4>
                          <p className="text-xs text-primary/80 mb-2">{item.cost} {t("training.gold")}</p>
                          <div className="space-y-0.5">
                            {item.stats.slice(0, 3).map((stat) => (
                              <p key={stat.label} className="text-[11px] text-muted-foreground">
                                <span className="text-accent">{stat.value}</span> {stat.label}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-heading text-base font-bold text-foreground">{getLocalized(choice.label, lang)}</h4>
                        <p className="text-xs text-muted-foreground mt-2">{getLocalized(choice.textFallback, lang)}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {!result ? (
              <div className="flex justify-end">
                <Button variant="gold" size="lg" onClick={() => selectedChoiceId && submitAttempt.mutate(selectedChoiceId)} disabled={!selectedChoiceId || submitAttempt.isPending}>
                  {t("training.validateAnswer")}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-xl p-6 border ${result.isCorrect ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                  <div className="flex items-center gap-4">
                    {result.isCorrect ? <CheckCircle className="w-10 h-10 text-success" /> : <XCircle className="w-10 h-10 text-destructive" />}
                    <div>
                      <h2 className="font-heading text-2xl font-bold text-foreground">
                        {result.isCorrect ? t("training.excellentChoice") : t("training.notQuite")}
                      </h2>
                      <p className="text-sm text-muted-foreground">{getLocalized(puzzle.explanation, lang)}</p>
                    </div>
                  </div>
                </div>

                {correctChoice?.item && (
                  <div className="glass-surface rounded-xl p-6">
                    <h3 className="font-heading text-lg font-bold text-foreground mb-3">{t("training.bestChoice")}</h3>
                    <div className="flex items-start gap-4 mb-4">
                      <ItemIcon item={correctChoice.item} size="lg" />
                      <div>
                        <h4 className="font-heading text-base font-bold text-primary">{correctChoice.item.name}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-1">{getLocalized(correctChoice.explanation, lang)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4">
                  <Link to="/results">
                    <Button variant="outline">{t("training.sessionResults")}</Button>
                  </Link>
                  {nextPuzzle ? (
                    <Button
                      variant="gold"
                      onClick={() => {
                        setSelectedChoiceId(null);
                        setResult(null);
                        navigate(`/training/${nextPuzzle.slug}`);
                      }}
                    >
                      {t("training.nextScenario")}
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Link to="/modules">
                      <Button variant="gold">{t("results.backToDashboard")}</Button>
                    </Link>
                  )}
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
