import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ItemIcon } from "@/components/ItemIcon";
import { ITEMS, CHAMPIONS } from "@/data/items";
import ChampionPortrait from "@/components/ChampionPortrait";
import { Swords, Target, Brain, TrendingUp, Zap, Shield, Trophy, ChevronRight, Star, Flame } from "lucide-react";

const items = Object.values(ITEMS);
const champs = Object.values(CHAMPIONS);

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* BG effects */}
        <div className="absolute inset-0 gradient-radial-gold opacity-40" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="container mx-auto px-6 pt-24 pb-16 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-6">
                <Flame className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Patch 14.10 — Saison 2025</span>
              </div>

              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-heading font-bold leading-[0.95] mb-6">
                <span className="text-foreground">Maîtrise tes</span>
                <br />
                <span className="text-glow-gold text-primary">choix de build</span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed font-light">
                ItemForge entraîne ta prise de décision d'itemisation. Apprends à
                <span className="text-foreground font-medium"> raisonner ton build</span>, pas juste à copier un guide.
              </p>

              <div className="flex items-center gap-4 mb-12">
                <Link to="/training">
                  <Button variant="gold" size="xl">
                    <Swords className="w-5 h-5" />
                    Commencer l'entraînement
                  </Button>
                </Link>
                <Link to="/modules">
                  <Button variant="outline" size="lg">
                    Voir les modules
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-8">
                {[
                  { value: "200+", label: "Scénarios" },
                  { value: "8", label: "Modules" },
                  { value: "14.10", label: "Patch" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-heading font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Hero visual: Item showcase */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative">
                {/* Floating items grid */}
                <div className="glass-surface rounded-2xl p-8 border-glow-gold">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-4">
                    Exemple de scénario
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-5 mb-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Target className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-foreground">Tu joues Jinx — 15min, 2/1/3</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      L'équipe ennemie a 2 tanks avec Plated Steelcaps. Le prochain objectif est le Drake Infernal. 
                      Quel item achètes-tu ensuite ?
                    </p>
                  </div>

                  {/* Champs preview */}
                  <div className="flex items-center gap-4 mb-5">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Alliés</span>
                      <div className="flex gap-1.5 mt-1.5">
                        {champs.slice(0, 4).map((c) => (
                          <ChampionPortrait key={c.name} champion={c} size="sm" />
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">VS</div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Ennemis</span>
                      <div className="flex gap-1.5 mt-1.5">
                        {champs.slice(4, 8).map((c) => (
                          <ChampionPortrait key={c.name} champion={c} size="sm" />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Item options */}
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Choix proposés</div>
                  <div className="flex items-center gap-3">
                    {items.slice(0, 4).map((item) => (
                      <ItemIcon key={item.id} item={item} size="lg" />
                    ))}
                  </div>
                </div>

                {/* Decorative glow */}
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
              Pourquoi <span className="text-primary">ItemForge</span> ?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Un outil conçu pour développer ton raisonnement d'itemisation, pas pour te donner des builds tout faits.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Brain, title: "Raisonnement", desc: "Apprends à analyser la compo ennemie et adapter ton build en conséquence.", color: "primary" },
              { icon: Target, title: "Scénarios réels", desc: "Des situations de jeu crédibles avec contexte complet: compos, gold, objectifs.", color: "accent" },
              { icon: TrendingUp, title: "Progression", desc: "Suis tes stats, identifie tes faiblesses, et progresse module par module.", color: "primary" },
              { icon: Shield, title: "Patch à jour", desc: "Contenu mis à jour à chaque patch pour rester pertinent en ranked.", color: "accent" },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-surface rounded-xl p-6 hover:border-primary/20 transition-all duration-300 group"
              >
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

      {/* Item Demo Section */}
      <section className="py-24 relative border-t border-border/20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
              Des items que tu <span className="text-accent">connais</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Survole un item pour voir ses stats, passifs et composants. Exactement comme en jeu.
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-6">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="glass-surface rounded-xl p-4 flex flex-col items-center gap-2 w-28 hover:border-primary/30 transition-all">
                  <ItemIcon item={item} size="lg" />
                  <span className="text-[11px] text-center text-muted-foreground font-medium leading-tight">{item.name}</span>
                  <span className="text-[10px] text-primary/80">{item.cost}g</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Preview */}
      <section className="py-24 relative border-t border-border/20">
        <div className="absolute inset-0 gradient-radial-gold opacity-20" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
              Modules d'<span className="text-primary">entraînement</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Du débutant au challenger, progresse à ton rythme sur chaque aspect de l'itemisation.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { title: "Fondamentaux", desc: "Stats de base, composants, synergie d'items", diff: "Débutant", icon: Star, progress: 75 },
              { title: "Anti-compo", desc: "Adapter ton build selon la menace ennemie", diff: "Intermédiaire", icon: Shield, progress: 40 },
              { title: "Powerspikes", desc: "Timing d'items et impact sur les fights", diff: "Avancé", icon: Zap, progress: 10 },
            ].map((mod, i) => (
              <motion.div
                key={mod.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to="/modules" className="block">
                  <div className="glass-surface rounded-xl p-6 hover:border-primary/20 transition-all duration-300 group cursor-pointer h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <mod.icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1 rounded bg-secondary">
                        {mod.diff}
                      </span>
                    </div>
                    <h3 className="font-heading text-lg font-bold text-foreground mb-1">{mod.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{mod.desc}</p>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full transition-all" style={{ width: `${mod.progress}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">{mod.progress}% complété</p>
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
          <h2 className="text-3xl font-heading font-bold text-foreground mb-4">
            Prêt à forger ton avantage ?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Commence un entraînement gratuit et découvre où en est ton game knowledge.
          </p>
          <Link to="/training">
            <Button variant="gold" size="xl">
              <Trophy className="w-5 h-5" />
              Lancer une session
            </Button>
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
          <p className="text-xs text-muted-foreground">
            Projet non-officiel. League of Legends est une marque de Riot Games, Inc.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
