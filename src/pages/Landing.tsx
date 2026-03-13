import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ItemIcon } from "@/components/ItemIcon";
import { ITEMS } from "@/data/items";
import { CHAMPIONS } from "@/data/champions";
import ChampionPortrait from "@/components/ChampionPortrait";
import { useLanguage } from "@/i18n/context";
import { Swords, Target, Brain, TrendingUp, Zap, Shield, Trophy, ChevronRight, Star, Flame, Link2, Lock } from "lucide-react";

const items = Object.values(ITEMS);
const champs = Object.values(CHAMPIONS);

const Landing = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 gradient-radial-gold opacity-40" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

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
                {[
                  { value: "200+", label: t("landing.scenarios") },
                  { value: "8", label: t("landing.modules") },
                  { value: "14.10", label: t("landing.patch") },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-heading font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="hidden lg:block">
              <div className="relative">
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
                        {champs.slice(0, 4).map((c) => (
                          <ChampionPortrait key={c.id} champion={c} size="sm" />
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">{t("common.vs")}</div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("landing.enemies")}</span>
                      <div className="flex gap-1.5 mt-1.5">
                        {champs.slice(4, 8).map((c) => (
                          <ChampionPortrait key={c.id} champion={c} size="sm" />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{t("landing.proposedChoices")}</div>
                  <div className="flex items-center gap-3">
                    {items.slice(0, 4).map((item) => (
                      <ItemIcon key={item.id} item={item} size="lg" />
                    ))}
                  </div>
                </div>
                <div className="absolute -top-8 -right-8 w-40 h-40 bg-primary/8 rounded-full blur-[60px]" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-accent/6 rounded-full blur-[50px]" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 relative">
        <div className="absolute inset-0 gradient-radial-cyan opacity-30" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
              {t("landing.whyTitle")} <span className="text-primary">ItemForge</span> ?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("landing.whySubtitle")}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Brain, title: t("landing.featureReasoning"), desc: t("landing.featureReasoningDesc"), color: "primary" },
              { icon: Target, title: t("landing.featureScenarios"), desc: t("landing.featureScenariosDesc"), color: "accent" },
              { icon: TrendingUp, title: t("landing.featureProgress"), desc: t("landing.featureProgressDesc"), color: "primary" },
              { icon: Shield, title: t("landing.featurePatch"), desc: t("landing.featurePatchDesc"), color: "accent" },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-surface rounded-xl p-6 hover:border-primary/20 transition-all duration-300 group">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 ${f.color === "primary" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-heading text-lg font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Item Demo */}
      <section className="py-24 relative border-t border-border/20">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
              {t("landing.itemsTitle")} <span className="text-accent">{t("landing.itemsTitle2")}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("landing.itemsSubtitle")}</p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-4">
            {items.slice(0, 16).map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }}>
                <div className="glass-surface rounded-xl p-3 flex flex-col items-center gap-2 w-24 hover:border-primary/30 transition-all">
                  <ItemIcon item={item} size="lg" />
                  <span className="text-[10px] text-center text-muted-foreground font-medium leading-tight">{item.name}</span>
                  <span className="text-[9px] text-primary/80">{item.cost}g</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Riot Connect teaser */}
      <section className="py-24 relative border-t border-border/20">
        <div className="absolute inset-0 gradient-radial-cyan opacity-20" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="glass-surface rounded-2xl p-8 border-glow-cyan relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full blur-[60px]" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Link2 className="w-5 h-5 text-accent" />
                    <span className="text-xs uppercase tracking-wider text-accent font-semibold">{t("landing.riotConnectBeta")}</span>
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-heading font-bold text-foreground mb-3">{t("landing.riotConnectTitle")}</h3>
                  <p className="text-muted-foreground mb-6 max-w-lg">{t("landing.riotConnectDesc")}</p>
                  <div className="space-y-2 mb-6">
                    {[t("landing.riotConnectFeature1"), t("landing.riotConnectFeature2"), t("landing.riotConnectFeature3")].map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Zap className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="lg" disabled className="opacity-60">
                    <Lock className="w-4 h-4" />
                    {t("landing.riotConnectButton")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Modules Preview */}
      <section className="py-24 relative border-t border-border/20">
        <div className="absolute inset-0 gradient-radial-gold opacity-20" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
              {t("landing.modulesTitle")}<span className="text-primary">{t("landing.modulesTitle2")}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("landing.modulesSubtitle")}</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { title: t("landing.modFundamentals"), desc: t("landing.modFundamentalsDesc"), diff: t("landing.beginner"), icon: Star, progress: 75 },
              { title: t("landing.modAntiComp"), desc: t("landing.modAntiCompDesc"), diff: t("landing.intermediate"), icon: Shield, progress: 40 },
              { title: t("landing.modPowerspikes"), desc: t("landing.modPowerspikesDesc"), diff: t("landing.advanced"), icon: Zap, progress: 10 },
            ].map((mod, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Link to="/modules" className="block">
                  <div className="glass-surface rounded-xl p-6 hover:border-primary/20 transition-all duration-300 group cursor-pointer h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <mod.icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1 rounded bg-secondary">{mod.diff}</span>
                    </div>
                    <h3 className="font-heading text-lg font-bold text-foreground mb-1">{mod.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{mod.desc}</p>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full transition-all" style={{ width: `${mod.progress}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">{mod.progress}% {t("landing.completed")}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border/20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-heading font-bold text-foreground mb-4">{t("landing.ctaTitle")}</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">{t("landing.ctaDesc")}</p>
          <Link to="/training">
            <Button variant="gold" size="xl"><Trophy className="w-5 h-5" />{t("landing.ctaButton")}</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
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
