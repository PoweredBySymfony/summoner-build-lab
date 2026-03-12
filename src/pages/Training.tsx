import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemIcon } from "@/components/ItemIcon";
import ChampionPortrait from "@/components/ChampionPortrait";
import { ITEMS, CHAMPIONS, type GameItem } from "@/data/items";
import { Target, Clock, Shield, Swords, Zap, ChevronRight, CheckCircle, XCircle, Star, Trophy, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const items = Object.values(ITEMS);
const champs = Object.values(CHAMPIONS);

interface Scenario {
  question: string;
  context: string;
  champion: string;
  gold: number;
  time: string;
  objective: string;
  allies: string[];
  enemies: string[];
  currentBuild: string[];
  options: string[];
  correctAnswer: string;
  explanation: string;
  commonMistake: string;
  alternative: string;
}

const scenarios: Scenario[] = [
  {
    question: "Quel item achètes-tu en troisième pour maximiser tes dégâts contre cette compo ?",
    context: "La compo ennemie a 2 tanks (Malphite, Leona) qui stack armor. Tu as besoin de percer leur résistance tout en gardant ton DPS.",
    champion: "jinx",
    gold: 3400,
    time: "22:00",
    objective: "Drake Infernal (3ème)",
    allies: ["jinx", "thresh", "ahri", "darius", "lux"],
    enemies: ["malphite", "leona", "yasuo", "kaisa", "zed"],
    currentBuild: ["kraken_slayer", "plated_steelcaps"],
    options: ["infinity_edge", "blade_of_the_ruined_king", "morellonomicon", "guardian_angel"],
    correctAnswer: "blade_of_the_ruined_king",
    explanation: "Contre 2 tanks qui stack armor, le BotRK est optimal car ses dégâts % PV actuels percent naturellement les tanks. L'Infinity Edge serait bon plus tard mais tu n'as pas encore assez de crit. Le BotRK te donne aussi du sustain pour les fights prolongés.",
    commonMistake: "Acheter Infinity Edge trop tôt (pas assez de crit pour activer le passif).",
    alternative: "Lord Dominik's Regards serait aussi viable si les tanks ont déjà beaucoup d'armor.",
  },
];

const Training = () => {
  const [phase, setPhase] = useState<"scenario" | "result">("scenario");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [currentScenario] = useState(0);

  const scenario = scenarios[currentScenario];
  const isCorrect = selectedAnswer === scenario.correctAnswer;

  const handleSubmit = () => {
    if (selectedAnswer) setPhase("result");
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6">
        {/* Session header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs uppercase tracking-wider text-primary font-semibold">Module: Fondamentaux</span>
                <span className="text-xs text-muted-foreground">Patch 14.10</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">Intermédiaire</span>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-heading font-bold text-foreground">Scénario {currentScenario + 1}/10</h1>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-primary" /> 120 XP</span>
              <span className="flex items-center gap-1.5"><Target className="w-4 h-4" /> 7/10 précision</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-4">
            <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full transition-all" style={{ width: `${(currentScenario + 1) * 10}%` }} />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {phase === "scenario" ? (
            <motion.div key="scenario" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Context panel */}
                <div className="glass-surface rounded-xl p-6 space-y-5">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contexte de match</span>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground font-medium">{scenario.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-primary font-medium">{scenario.gold} gold</span>
                      </div>
                    </div>
                  </div>

                  {/* Objective */}
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] uppercase tracking-wider text-accent font-semibold">Prochain objectif</span>
                    </div>
                    <p className="text-sm text-foreground font-medium">{scenario.objective}</p>
                  </div>

                  {/* Champion */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tu joues</span>
                    <div className="flex items-center gap-3 mt-2">
                      <ChampionPortrait champion={CHAMPIONS[scenario.champion]} size="lg" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{CHAMPIONS[scenario.champion].name}</p>
                        <p className="text-xs text-muted-foreground">{CHAMPIONS[scenario.champion].role} — 2/1/3</p>
                      </div>
                    </div>
                  </div>

                  {/* Teams */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Équipes</span>
                    <div className="mt-2 space-y-3">
                      <div>
                        <span className="text-[9px] text-accent uppercase tracking-wider">Alliés</span>
                        <div className="flex gap-2 mt-1">
                          {scenario.allies.map((c) => CHAMPIONS[c] && (
                            <ChampionPortrait key={c} champion={CHAMPIONS[c]} size="sm" showInfo />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-destructive uppercase tracking-wider">Ennemis</span>
                        <div className="flex gap-2 mt-1">
                          {scenario.enemies.map((c) => CHAMPIONS[c] && (
                            <ChampionPortrait key={c} champion={CHAMPIONS[c]} size="sm" showInfo />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Current build */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Build actuel</span>
                    <div className="flex gap-2 mt-2">
                      {scenario.currentBuild.map((id) => ITEMS[id] && (
                        <ItemIcon key={id} item={ITEMS[id]} size="md" />
                      ))}
                      {Array.from({ length: 4 - scenario.currentBuild.length }).map((_, i) => (
                        <div key={i} className="item-slot opacity-30" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Question + Options */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="glass-surface rounded-xl p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Swords className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h2 className="font-heading text-xl font-bold text-foreground mb-2">{scenario.question}</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">{scenario.context}</p>
                      </div>
                    </div>
                  </div>

                  {/* Answer options */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {scenario.options.map((optId) => {
                      const item = ITEMS[optId];
                      if (!item) return null;
                      const isSelected = selectedAnswer === optId;
                      return (
                        <motion.button
                          key={optId}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setSelectedAnswer(optId)}
                          className={`glass-surface rounded-xl p-5 text-left transition-all duration-200 ${
                            isSelected
                              ? "border-primary/50 border-glow-gold"
                              : "hover:border-border"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <ItemIcon item={item} size="lg" showTooltip={false} />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-heading text-base font-bold text-foreground">{item.name}</h4>
                              <p className="text-xs text-primary/80 mb-2">{item.cost} gold</p>
                              <div className="space-y-0.5">
                                {item.stats.slice(0, 3).map((s) => (
                                  <p key={s.label} className="text-[11px] text-muted-foreground">
                                    <span className="text-accent">{s.value}</span> {s.label}
                                  </p>
                                ))}
                              </div>
                              {item.passiveName && (
                                <p className="text-[10px] text-primary/70 mt-1.5 italic">Passive: {item.passiveName}</p>
                              )}
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 mt-3">
                            {item.tags.map((tag) => (
                              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end">
                    <Button variant="gold" size="lg" onClick={handleSubmit} disabled={!selectedAnswer}>
                      Valider ma réponse
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Result */}
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Score banner */}
                <div className={`rounded-xl p-6 border ${isCorrect ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                  <div className="flex items-center gap-4">
                    {isCorrect ? (
                      <CheckCircle className="w-10 h-10 text-success" />
                    ) : (
                      <XCircle className="w-10 h-10 text-destructive" />
                    )}
                    <div>
                      <h2 className="font-heading text-2xl font-bold text-foreground">
                        {isCorrect ? "Excellent choix !" : "Pas tout à fait…"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {isCorrect ? "+25 XP — Streak maintenue" : "+5 XP — Analyse l'explication"}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-3xl font-heading font-bold text-primary">{isCorrect ? "25" : "5"}</p>
                      <p className="text-xs text-muted-foreground">XP gagnés</p>
                    </div>
                  </div>
                </div>

                {/* Correct answer */}
                <div className="glass-surface rounded-xl p-6">
                  <h3 className="font-heading text-lg font-bold text-foreground mb-3">Réponse correcte</h3>
                  <div className="flex items-start gap-4 mb-4">
                    <ItemIcon item={ITEMS[scenario.correctAnswer]} size="lg" />
                    <div>
                      <h4 className="font-heading text-base font-bold text-primary">{ITEMS[scenario.correctAnswer].name}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1">{scenario.explanation}</p>
                    </div>
                  </div>
                </div>

                {/* Common mistake */}
                <div className="glass-surface rounded-xl p-6">
                  <h3 className="font-heading text-sm font-bold text-destructive/80 mb-2 uppercase tracking-wider">Erreur fréquente</h3>
                  <p className="text-sm text-muted-foreground">{scenario.commonMistake}</p>
                </div>

                {/* Alternative */}
                <div className="glass-surface rounded-xl p-6">
                  <h3 className="font-heading text-sm font-bold text-accent/80 mb-2 uppercase tracking-wider">Alternative viable</h3>
                  <p className="text-sm text-muted-foreground">{scenario.alternative}</p>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Link to="/results">
                    <Button variant="outline">Voir les résultats de session</Button>
                  </Link>
                  <Button variant="gold" onClick={() => { setPhase("scenario"); setSelectedAnswer(null); }}>
                    Scénario suivant
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Training;
