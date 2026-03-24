import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ChampionPortrait from "@/components/ChampionPortrait";
import { useCatalog, usePuzzles } from "@/api/hooks";

const Modules = () => {
  const { data: catalog } = useCatalog();
  const { data: puzzles = [] } = usePuzzles({ mode: "general", limit: 40 });
  const [query, setQuery] = useState("");

  const champions = useMemo(() => {
    const all = catalog?.champions ?? [];
    return query ? all.filter((champion) => champion.name.toLowerCase().includes(query.toLowerCase())) : all.slice(0, 24);
  }, [catalog?.champions, query]);

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-6 space-y-6">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="glass-surface rounded-2xl p-8">
            <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Mode général</p>
            <h1 className="font-heading text-4xl font-bold text-foreground">Travaille les grands principes d'itemisation.</h1>
            <p className="text-muted-foreground mt-4 max-w-2xl">
              Ces puzzles restent focalisés sur le rôle et le contexte sans t'enfermer sur un seul champion. Utilise-les pour construire un raisonnement global avant de creuser ton OTP.
            </p>
          </div>

          <div className="glass-surface rounded-2xl p-8">
            <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Mode OTP</p>
            <h2 className="font-heading text-2xl font-bold text-foreground">Approfondis un champion à fond.</h2>
            <p className="text-muted-foreground mt-4">Cherche un champion, ouvre l'espace OTP puis génère une série de questions centrées sur son itemisation.</p>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Recherche ton champion principal"
              className="mt-5 w-full rounded-xl bg-secondary border border-border/60 px-4 py-3 text-sm"
            />
            <div className="flex flex-wrap gap-2 mt-4">
              {champions.slice(0, 10).map((champion) => (
                <Link key={champion.id} to={`/champions/${champion.slug}`} className="rounded-xl border border-border/60 p-2 hover:border-primary/40">
                  <ChampionPortrait champion={champion} size="sm" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {puzzles.map((puzzle) => (
            <Link key={puzzle.id} to={`/training/${puzzle.slug}`} className="glass-surface rounded-2xl p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.25em] text-primary font-semibold">{puzzle.difficulty}</span>
                <span className="text-xs text-muted-foreground">{puzzle.patch}</span>
              </div>
              <h2 className="font-heading text-xl font-bold text-foreground mt-3">{puzzle.title}</h2>
              <p className="text-sm text-muted-foreground mt-3">{puzzle.shortPrompt}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {puzzle.tags.slice(0, 4).map((tag) => (
                  <span key={tag.slug} className="rounded-full bg-secondary px-3 py-1 text-[11px] text-foreground">{tag.name}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Modules;
