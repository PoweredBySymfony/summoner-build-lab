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
      <div className="container mx-auto px-6 space-y-10">
        <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-stretch">
          <div className="glass-surface rounded-[28px] p-8 lg:p-10 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,201,71,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(71,173,255,0.14),transparent_35%)]" />
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold mb-4">League of Legends itemization training</p>
              <h1 className="font-heading text-5xl leading-tight font-bold text-foreground max-w-3xl">
                Learn itemization globally, then specialize on your OTP with real in-game scenarios.
              </h1>
              <p className="text-muted-foreground text-lg mt-5 max-w-2xl leading-relaxed">
                The catalog now targets full champion and item coverage through Riot/Data Dragon sync, persistent progress, daily challenge streaks, champion-specific puzzle generation, and a first DPM.LOL-inspired player search flow.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link to="/modules"><Button variant="gold" size="lg">Explore general training <ArrowRight className="w-4 h-4" /></Button></Link>
                <Link to="/daily"><Button variant="outline" size="lg">Open daily challenge</Button></Link>
              </div>
              <div className="mt-8">
                <RiotIdSearch />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="glass-surface rounded-2xl p-6">
              <div className="flex items-center gap-2 text-primary mb-3"><Swords className="w-4 h-4" /> Catalog sync</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-3xl font-bold text-foreground">{data?.stats.championCount ?? 0}</p><p className="text-muted-foreground">Champions</p></div>
                <div><p className="text-3xl font-bold text-foreground">{data?.stats.itemCount ?? 0}</p><p className="text-muted-foreground">Items</p></div>
                <div><p className="text-3xl font-bold text-foreground">{data?.stats.puzzleCount ?? 0}</p><p className="text-muted-foreground">Puzzles</p></div>
              </div>
            </div>
            <div className="glass-surface rounded-2xl p-6">
              <div className="flex items-center gap-2 text-primary mb-3"><BrainCircuit className="w-4 h-4" /> OTP workspace</div>
              <div className="flex flex-wrap gap-2">
                {(data?.featuredChampions ?? []).slice(0, 8).map((champion) => (
                  <Link key={champion.id} to={`/champions/${champion.slug}`}>
                    <ChampionPortrait champion={champion} size="sm" />
                  </Link>
                ))}
              </div>
            </div>
            <div className="glass-surface rounded-2xl p-6">
              <div className="flex items-center gap-2 text-primary mb-3"><Flame className="w-4 h-4" /> Daily focus</div>
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

        <section className="grid md:grid-cols-3 gap-5">
          {[
            { title: "General mode", description: "Cross-role itemization principles with richer scenarios and plausible wrong answers.", icon: BrainCircuit },
            { title: "OTP mode", description: "Champion-specific stats, filtered puzzles and on-demand generated scenarios focused on your main.", icon: Sparkles },
            { title: "Daily streak", description: "Daily puzzle entrypoint, streak persistence and reminder architecture for cron-based emails.", icon: Flame },
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
