import { Link } from "react-router-dom";
import { ArrowRight, BrainCircuit, Flame, Sparkles, Swords } from "lucide-react";
import ChampionPortrait from "@/components/ChampionPortrait";
import { ItemIcon } from "@/components/ItemIcon";
import { RiotIdSearch } from "@/components/RiotIdSearch";
import { Button } from "@/components/ui/button";
import { useBootstrap } from "@/api/hooks";

const Landing = () => {
  const { data } = useBootstrap();

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto space-y-10 px-4 sm:px-6">
        <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-stretch">
          <div className="glass-surface relative min-w-0 rounded-[28px] p-6 sm:p-8 lg:p-10">
            <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(255,201,71,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(71,173,255,0.14),transparent_35%)]" />
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold mb-4">Entraînement à l'itemisation League of Legends</p>
              <h1 className="max-w-3xl text-balance font-heading text-4xl font-bold leading-tight text-foreground sm:text-5xl">
                Apprends l'itemisation globalement, puis spécialise-toi sur ton OTP avec de vrais scénarios de game.
              </h1>
              <p className="text-muted-foreground text-lg mt-5 max-w-2xl leading-relaxed">
                Le catalogue couvre maintenant les champions et les items via le sync Riot/Data Dragon, avec progression persistante, défi quotidien, génération OTP et recherche de profil inspirée de DPM.LOL.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link to="/modules"><Button variant="gold" size="lg">Explorer l'entraînement général <ArrowRight className="w-4 h-4" /></Button></Link>
                <Link to="/daily"><Button variant="outline" size="lg">Ouvrir le défi quotidien</Button></Link>
              </div>
              <div className="mt-8">
                <RiotIdSearch />
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-4">
            <div className="glass-surface rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 text-primary mb-3"><Swords className="w-4 h-4" /> Catalogue synchronisé</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-3xl font-bold text-foreground">{data?.stats.championCount ?? 0}</p><p className="text-muted-foreground">Champions</p></div>
                <div><p className="text-3xl font-bold text-foreground">{data?.stats.itemCount ?? 0}</p><p className="text-muted-foreground">Items</p></div>
                <div><p className="text-3xl font-bold text-foreground">{data?.stats.puzzleCount ?? 0}</p><p className="text-muted-foreground">Puzzles</p></div>
              </div>
            </div>
            <div className="glass-surface rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 text-primary mb-3"><BrainCircuit className="w-4 h-4" /> Espace OTP</div>
              <div className="flex flex-wrap gap-2">
                {(data?.featuredChampions ?? []).slice(0, 8).map((champion) => (
                  <Link key={champion.id} to={`/champions/${champion.slug}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl">
                    <ChampionPortrait champion={champion} size="sm" />
                  </Link>
                ))}
              </div>
            </div>
            <div className="glass-surface rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 text-primary mb-3"><Flame className="w-4 h-4" /> Focus quotidien</div>
              <p className="font-semibold text-foreground">{data?.dailyChallenge.title}</p>
              <p className="text-sm text-muted-foreground mt-2">{data?.dailyChallenge.shortPrompt}</p>
              <div className="flex gap-2 mt-4">
                {(data?.featuredItems ?? []).slice(0, 4).map((item) => (
                  <ItemIcon key={item.id} item={item} size="sm" />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {[
            { title: "Mode général", description: "Principes transverses d'itemisation avec scénarios plus riches et mauvaises réponses crédibles.", icon: BrainCircuit },
            { title: "Mode OTP", description: "Stats par champion, puzzles filtrés et scénarios générés à la demande autour de ton main.", icon: Sparkles },
            { title: "Streak quotidien", description: "Défi journalier, persistance du streak et base prête pour les rappels email.", icon: Flame },
          ].map(({ title, description, icon: Icon }) => (
            <div key={title} className="glass-surface rounded-2xl p-6">
              <Icon className="w-5 h-5 text-primary mb-4" />
              <h2 className="font-heading text-xl font-bold text-foreground">{title}</h2>
              <p className="text-muted-foreground mt-3">{description}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default Landing;
