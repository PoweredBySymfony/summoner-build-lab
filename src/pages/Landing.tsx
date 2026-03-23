import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Swords, Target, Brain, TrendingUp, Shield, Trophy, ChevronRight, Star, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemIcon } from "@/components/ItemIcon";
import ChampionPortrait from "@/components/ChampionPortrait";
import { useLanguage } from "@/i18n/context";
import { useBootstrap } from "@/api/hooks";

const Landing = () => {
  const { t } = useLanguage();
  const { data } = useBootstrap();

  return (
    <div className="min-h-screen bg-background">
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 gradient-radial-gold opacity-40" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[120px]" />

        <div className="container mx-auto px-6 pt-24 pb-16 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-6">
                <Flame className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">{t("landing.badge")}</span>
              </div>

              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-heading font-bold leading-[0.95] mb-6">
                <span className="text-foreground">{t("landing.heroTitle1")}</span><br />
                <span className="text-glow-gold text-primary">{t("landing.heroTitle2")}</span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed font-light">
                {t("landing.heroDesc")} <span className="text-foreground font-medium">{t("landing.heroDescBold")}</span>{t("landing.heroDescEnd")}
              </p>

              <div className="flex items-center gap-4 mb-12">
                <Link to="/training">
                  <Button variant="gold" size="xl"><Swords className="w-5 h-5" />{t("landing.startTraining")}</Button>
                </Link>
                <Link to="/modules">
                  <Button variant="outline" size="lg">{t("landing.viewModules")}<ChevronRight className="w-4 h-4" /></Button>
                </Link>
              </div>

              <div className="flex items-center gap-8">
                <div>
                  <p className="text-2xl font-heading font-bold text-foreground">{data?.stats.puzzleCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t("landing.scenarios")}</p>
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-foreground">{data?.stats.moduleCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t("landing.modules")}</p>
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-foreground">{data?.stats.latestPatch ?? "14.10"}</p>
                  <p className="text-xs text-muted-foreground">{t("landing.patch")}</p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="hidden lg:block">
              <div className="glass-surface rounded-2xl p-8 border-glow-gold">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-4">{t("landing.scenarioExample")}</div>
                <div className="bg-secondary/50 rounded-xl p-5 mb-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Target className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-foreground">{t("landing.youPlay")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("landing.scenarioDesc")}</p>
                </div>

                <div className="flex items-center gap-4 mb-5">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("landing.allies")}</span>
                    <div className="flex gap-1.5 mt-1.5">
                      {(data?.featuredChampions ?? []).slice(0, 4).map((champion) => (
                        <ChampionPortrait key={champion.id} champion={champion} size="sm" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{t("landing.proposedChoices")}</div>
                <div className="flex items-center gap-3">
                  {(data?.featuredItems ?? []).slice(0, 4).map((item) => (
                    <ItemIcon key={item.id} item={item} size="lg" />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 relative">
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Brain, title: t("landing.featureReasoning"), desc: t("landing.featureReasoningDesc"), color: "primary" },
              { icon: Target, title: t("landing.featureScenarios"), desc: t("landing.featureScenariosDesc"), color: "accent" },
              { icon: TrendingUp, title: t("landing.featureProgress"), desc: t("landing.featureProgressDesc"), color: "primary" },
              { icon: Shield, title: t("landing.featurePatch"), desc: t("landing.featurePatchDesc"), color: "accent" },
            ].map((feature, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-surface rounded-xl p-6">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 ${feature.color === "primary" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-heading text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 relative border-t border-border/20">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
              {t("landing.itemsTitle")} <span className="text-accent">{t("landing.itemsTitle2")}</span>
            </h2>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-4">
            {(data?.featuredItems ?? []).slice(0, 16).map((item) => (
              <div key={item.id} className="glass-surface rounded-xl p-3 flex flex-col items-center gap-2 w-24">
                <ItemIcon item={item} size="lg" />
                <span className="text-[10px] text-center text-muted-foreground font-medium leading-tight">{item.name}</span>
                <span className="text-[9px] text-primary/80">{item.cost}g</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-border/20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-heading font-bold text-foreground mb-4">{t("landing.ctaTitle")}</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">{t("landing.ctaDesc")}</p>
          <Link to="/training">
            <Button variant="gold" size="xl"><Trophy className="w-5 h-5" />{t("landing.ctaButton")}</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/20 py-8">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" />
            <span className="font-heading text-sm font-bold text-foreground">ITEMFORGE</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("landing.footer")}</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
