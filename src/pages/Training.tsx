import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemIcon } from "@/components/ItemIcon";
import ChampionPortrait from "@/components/ChampionPortrait";
import { ITEMS, type GameItem } from "@/data/items";
import { CHAMPIONS } from "@/data/champions";
import { useLanguage } from "@/i18n/context";
import { Target, Clock, Shield, Swords, Zap, ChevronRight, CheckCircle, XCircle, Star, Trophy, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Scenario {
  question: { fr: string; en: string };
  context: { fr: string; en: string };
  champion: string;
  gold: number;
  time: string;
  objective: { fr: string; en: string };
  allies: string[];
  enemies: string[];
  currentBuild: string[];
  options: string[];
  correctAnswer: string;
  explanation: { fr: string; en: string };
  commonMistake: { fr: string; en: string };
  alternative: { fr: string; en: string };
  difficulty: "beginner" | "intermediate" | "advanced";
}

const scenarios: Scenario[] = [
  {
    question: {
      fr: "Quel item achètes-tu en troisième pour maximiser tes dégâts contre cette compo ?",
      en: "What item do you buy third to maximize your damage against this comp?"
    },
    context: {
      fr: "La compo ennemie a 2 tanks (Malphite, Leona) qui stack armor. Tu as besoin de percer leur résistance tout en gardant ton DPS.",
      en: "The enemy comp has 2 tanks (Malphite, Leona) stacking armor. You need to pierce their resistance while keeping your DPS."
    },
    champion: "jinx",
    gold: 3400,
    time: "22:00",
    objective: { fr: "Drake Infernal (3ème)", en: "Infernal Drake (3rd)" },
    allies: ["jinx", "thresh", "ahri", "darius", "lux"],
    enemies: ["malphite", "leona", "yasuo", "kaisa", "zed"],
    currentBuild: ["kraken_slayer", "plated_steelcaps"],
    options: ["infinity_edge", "blade_of_the_ruined_king", "morellonomicon", "guardian_angel"],
    correctAnswer: "blade_of_the_ruined_king",
    explanation: {
      fr: "Contre 2 tanks qui stack armor, le BotRK est optimal car ses dégâts % PV actuels percent naturellement les tanks. L'Infinity Edge serait bon plus tard mais tu n'as pas encore assez de crit. Le BotRK te donne aussi du sustain pour les fights prolongés.",
      en: "Against 2 tanks stacking armor, BotRK is optimal because its % current HP damage naturally shreds tanks. Infinity Edge would be good later but you don't have enough crit yet. BotRK also gives sustain for extended fights."
    },
    commonMistake: {
      fr: "Acheter Infinity Edge trop tôt sans avoir assez de crit pour activer le passif à +60%.",
      en: "Buying Infinity Edge too early without enough crit to activate the 60%+ passive."
    },
    alternative: {
      fr: "Lord Dominik's Regards serait aussi viable si les tanks ont déjà beaucoup d'armor. Mais le BotRK offre plus de polyvalence ici.",
      en: "Lord Dominik's Regards would also be viable if the tanks already have a lot of armor. But BotRK offers more versatility here."
    },
    difficulty: "intermediate",
  },
  {
    question: {
      fr: "L'équipe ennemie a beaucoup de sustain. Quel item est prioritaire ?",
      en: "The enemy team has a lot of sustain. Which item is priority?"
    },
    context: {
      fr: "Soraka support ennemie soigne énormément. Aatrox top drain tank. Tu joues mid AP et tu dois réduire leurs soins.",
      en: "Enemy support Soraka heals massively. Aatrox top is drain tanking. You play mid AP and need to reduce their healing."
    },
    champion: "ahri",
    gold: 2800,
    time: "16:00",
    objective: { fr: "Rift Herald", en: "Rift Herald" },
    allies: ["ahri", "jinx", "leona", "lee_sin", "garen"],
    enemies: ["aatrox", "soraka", "yasuo", "caitlyn", "vi"],
    currentBuild: ["ludens", "sorc_shoes"],
    options: ["morellonomicon", "rabadons", "zhonyas", "void_staff"],
    correctAnswer: "morellonomicon",
    explanation: {
      fr: "Avec Soraka et Aatrox en face, l'anti-heal est absolument prioritaire. Le Morellonomicon applique Blessures Graves sur tous tes dégâts magiques. Sans anti-heal, tes dégâts sont annulés par les soins d'Aatrox et Soraka.",
      en: "With Soraka and Aatrox on the enemy team, anti-heal is absolutely priority. Morellonomicon applies Grievous Wounds on all your magic damage. Without anti-heal, your damage is negated by Aatrox and Soraka's healing."
    },
    commonMistake: {
      fr: "Rusher Rabadon's pour plus de dégâts bruts, en ignorant le sustain ennemi qui annule l'avantage.",
      en: "Rushing Rabadon's for raw damage while ignoring enemy sustain that negates the advantage."
    },
    alternative: {
      fr: "Zhonya's serait viable si tu te fais dive, mais l'anti-heal reste plus impactant à ce stade de la partie.",
      en: "Zhonya's would be viable if you're getting dove, but anti-heal remains more impactful at this point in the game."
    },
    difficulty: "beginner",
  },
  {
    question: {
      fr: "Tu es en avance sur ton lane, quel item maximise ton snowball ?",
      en: "You're ahead in lane, which item maximizes your snowball?"
    },
    context: {
      fr: "Tu as 4/0 sur Zed mid. L'ennemi mid est sous sa tour. Tu veux roamer et convertir ton avance en avantage d'équipe. L'ADC ennemi n'a pas encore de défense.",
      en: "You're 4/0 on Zed mid. The enemy mid is under tower. You want to roam and convert your lead into a team advantage. The enemy ADC has no defensive items yet."
    },
    champion: "zed",
    gold: 3200,
    time: "12:00",
    objective: { fr: "Tour mid / Roam bot", en: "Mid tower / Bot roam" },
    allies: ["zed", "jinx", "thresh", "garen", "lee_sin"],
    enemies: ["orianna", "caitlyn", "nautilus", "jax", "graves"],
    currentBuild: ["youmuus", "ionian_boots"],
    options: ["the_collector", "essence_reaver", "guardian_angel", "maw_of_malmortius"],
    correctAnswer: "the_collector",
    explanation: {
      fr: "The Collector est parfait ici : la lethality maximise tes dégâts sur des cibles sans armure, l'exécution à 5% PV sécurise les kills en roam, et le bonus d'or accélère ton snowball. Avec Youmuu's + Collector, ton burst one-shot l'ADC facilement.",
      en: "The Collector is perfect here: lethality maximizes damage on targets without armor, the 5% HP execute secures roam kills, and the bonus gold accelerates your snowball. With Youmuu's + Collector, you can easily one-shot the ADC."
    },
    commonMistake: {
      fr: "Acheter Guardian Angel en étant en avance. GA est un item défensif qui ne capitalise pas sur ton lead.",
      en: "Buying Guardian Angel while ahead. GA is a defensive item that doesn't capitalize on your lead."
    },
    alternative: {
      fr: "Serylda's Grudge serait bon si les ennemis commençaient à builder de l'armure, mais à 12 min c'est trop tôt.",
      en: "Serylda's Grudge would be good if enemies started building armor, but at 12 min it's too early."
    },
    difficulty: "intermediate",
  },
  {
    question: {
      fr: "Fight Nashor imminent. Quel item sécurise le mieux le teamfight pour ton équipe ?",
      en: "Nashor fight is imminent. Which item best secures the teamfight for your team?"
    },
    context: {
      fr: "Teamfight 5v5 autour du Nashor dans 1 minute. Tu joues Jinx avec un bon KDA. L'ennemi a Zed et Katarina qui cherchent à t'assassiner. Tu dois survivre pour DPS.",
      en: "5v5 teamfight around Nashor in 1 minute. You play Jinx with a good KDA. The enemy has Zed and Katarina looking to assassinate you. You must survive to DPS."
    },
    champion: "jinx",
    gold: 3400,
    time: "28:00",
    objective: { fr: "Nashor", en: "Nashor" },
    allies: ["jinx", "lulu", "orianna", "volibear", "lee_sin"],
    enemies: ["zed", "katarina", "malphite", "caitlyn", "nautilus"],
    currentBuild: ["kraken_slayer", "berserkers", "infinity_edge"],
    options: ["bloodthirster", "guardian_angel", "lord_dominiks", "blade_of_the_ruined_king"],
    correctAnswer: "guardian_angel",
    explanation: {
      fr: "Contre Zed + Katarina, le Guardian Angel est crucial. Même si tu meurs au début du fight, tu ressuscites et peux continuer à DPS. Avec Lulu et Orianna pour te peel, le GA te donne une deuxième chance. Le Bloodthirster est tentant mais ne te sauve pas d'un full combo assassin.",
      en: "Against Zed + Katarina, Guardian Angel is crucial. Even if you die at the start of the fight, you resurrect and can continue to DPS. With Lulu and Orianna peeling for you, GA gives you a second chance. Bloodthirster is tempting but won't save you from a full assassin combo."
    },
    commonMistake: {
      fr: "Continuer à empiler du DPS sans protection. Contre double assassin, tu ne DPS pas si tu es morte.",
      en: "Continuing to stack DPS without protection. Against double assassin, you can't DPS if you're dead."
    },
    alternative: {
      fr: "Bloodthirster + bouclier pourrait aider, mais le GA est plus fiable contre le burst one-shot des assassins.",
      en: "Bloodthirster + shield could help, but GA is more reliable against assassin one-shot burst."
    },
    difficulty: "advanced",
  },
];

const Training = () => {
  const [phase, setPhase] = useState<"scenario" | "result">("scenario");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [currentScenario] = useState(0);
  const { lang, t } = useLanguage();

  const scenario = scenarios[currentScenario];
  const isCorrect = selectedAnswer === scenario.correctAnswer;

  const handleSubmit = () => {
    if (selectedAnswer) setPhase("result");
  };

  const diffLabel = t(`training.difficulty.${scenario.difficulty}`);

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6">
        {/* Session header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs uppercase tracking-wider text-primary font-semibold">{t("training.module")}: {t("modules.fundamentals")}</span>
                <span className="text-xs text-muted-foreground">{t("training.patch")} 14.10</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{diffLabel}</span>
              </div>
              <h1 className="text-2xl font-heading font-bold text-foreground">{t("training.scenario")} {currentScenario + 1}/10</h1>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-primary" /> 120 XP</span>
              <span className="flex items-center gap-1.5"><Target className="w-4 h-4" /> 7/10</span>
            </div>
          </div>
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
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("training.matchContext")}</span>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground font-medium">{scenario.time}</span>
                      </div>
                      <span className="text-sm text-primary font-medium">{scenario.gold} {t("training.gold")}</span>
                    </div>
                  </div>

                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] uppercase tracking-wider text-accent font-semibold">{t("training.nextObjective")}</span>
                    </div>
                    <p className="text-sm text-foreground font-medium">{scenario.objective[lang]}</p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("training.youPlay")}</span>
                    <div className="flex items-center gap-3 mt-2">
                      {CHAMPIONS[scenario.champion] && (
                        <>
                          <ChampionPortrait champion={CHAMPIONS[scenario.champion]} size="lg" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{CHAMPIONS[scenario.champion].name}</p>
                            <p className="text-xs text-muted-foreground">{CHAMPIONS[scenario.champion].roles[0]}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("training.teams")}</span>
                    <div className="mt-2 space-y-3">
                      <div>
                        <span className="text-[9px] text-accent uppercase tracking-wider">{t("training.allies")}</span>
                        <div className="flex gap-2 mt-1">
                          {scenario.allies.map((c) => CHAMPIONS[c] && (
                            <ChampionPortrait key={c} champion={CHAMPIONS[c]} size="sm" showInfo />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-destructive uppercase tracking-wider">{t("training.enemies")}</span>
                        <div className="flex gap-2 mt-1">
                          {scenario.enemies.map((c) => CHAMPIONS[c] && (
                            <ChampionPortrait key={c} champion={CHAMPIONS[c]} size="sm" showInfo />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("training.currentBuild")}</span>
                    <div className="flex gap-2 mt-2">
                      {scenario.currentBuild.map((id) => ITEMS[id] && (
                        <ItemIcon key={id} item={ITEMS[id]} size="md" />
                      ))}
                      {Array.from({ length: Math.max(0, 4 - scenario.currentBuild.length) }).map((_, i) => (
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
                        <h2 className="font-heading text-xl font-bold text-foreground mb-2">{scenario.question[lang]}</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">{scenario.context[lang]}</p>
                      </div>
                    </div>
                  </div>

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
                            isSelected ? "border-primary/50 border-glow-gold" : "hover:border-border"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <ItemIcon item={item} size="lg" showTooltip={false} />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-heading text-base font-bold text-foreground">{item.name}</h4>
                              <p className="text-xs text-primary/80 mb-2">{item.cost} {t("training.gold")}</p>
                              <div className="space-y-0.5">
                                {item.stats.slice(0, 3).map((s) => (
                                  <p key={s.label} className="text-[11px] text-muted-foreground">
                                    <span className="text-accent">{s.value}</span> {s.label}
                                  </p>
                                ))}
                              </div>
                              {item.passiveName && (
                                <p className="text-[10px] text-primary/70 mt-1.5 italic">{t("training.passive")}: {item.passiveName}</p>
                              )}
                              {item.activeName && (
                                <p className="text-[10px] text-accent/70 mt-0.5 italic">{t("items.active")}: {item.activeName}</p>
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
                      {t("training.validateAnswer")}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="max-w-3xl mx-auto space-y-6">
                <div className={`rounded-xl p-6 border ${isCorrect ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                  <div className="flex items-center gap-4">
                    {isCorrect ? <CheckCircle className="w-10 h-10 text-success" /> : <XCircle className="w-10 h-10 text-destructive" />}
                    <div>
                      <h2 className="font-heading text-2xl font-bold text-foreground">
                        {isCorrect ? t("training.excellentChoice") : t("training.notQuite")}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {isCorrect ? `+25 XP — ${t("training.streakMaintained")}` : `+5 XP — ${t("training.analyzeExplanation")}`}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-3xl font-heading font-bold text-primary">{isCorrect ? "25" : "5"}</p>
                      <p className="text-xs text-muted-foreground">{t("training.xpGained")}</p>
                    </div>
                  </div>
                </div>

                {/* Your choice vs correct */}
                {selectedAnswer && selectedAnswer !== scenario.correctAnswer && (
                  <div className="glass-surface rounded-xl p-6">
                    <h3 className="font-heading text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">{t("training.yourChoice")}</h3>
                    <div className="flex items-start gap-4">
                      <ItemIcon item={ITEMS[selectedAnswer]} size="lg" showTooltip={false} />
                      <div>
                        <h4 className="font-heading text-base font-bold text-destructive/80">{ITEMS[selectedAnswer].name}</h4>
                      </div>
                    </div>
                  </div>
                )}

                <div className="glass-surface rounded-xl p-6">
                  <h3 className="font-heading text-lg font-bold text-foreground mb-3">{t("training.bestChoice")}</h3>
                  <div className="flex items-start gap-4 mb-4">
                    <ItemIcon item={ITEMS[scenario.correctAnswer]} size="lg" />
                    <div>
                      <h4 className="font-heading text-base font-bold text-primary">{ITEMS[scenario.correctAnswer].name}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1">{scenario.explanation[lang]}</p>
                    </div>
                  </div>
                </div>

                <div className="glass-surface rounded-xl p-6">
                  <h3 className="font-heading text-sm font-bold text-destructive/80 mb-2 uppercase tracking-wider">{t("training.commonMistake")}</h3>
                  <p className="text-sm text-muted-foreground">{scenario.commonMistake[lang]}</p>
                </div>

                <div className="glass-surface rounded-xl p-6">
                  <h3 className="font-heading text-sm font-bold text-accent/80 mb-2 uppercase tracking-wider">{t("training.viableAlternative")}</h3>
                  <p className="text-sm text-muted-foreground">{scenario.alternative[lang]}</p>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Link to="/results">
                    <Button variant="outline">{t("training.sessionResults")}</Button>
                  </Link>
                  <Button variant="gold" onClick={() => { setPhase("scenario"); setSelectedAnswer(null); }}>
                    {t("training.nextScenario")}
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
