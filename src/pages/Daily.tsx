import { Link } from "react-router-dom";
import { Flame, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDailyChallenge } from "@/api/hooks";

const Daily = () => {
  const { data, isLoading } = useDailyChallenge();

  if (isLoading) {
    return <div className="min-h-screen bg-background pt-24"><div className="container mx-auto px-6"><div className="glass-surface rounded-xl p-6">Chargement du défi quotidien...</div></div></div>;
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="glass-surface rounded-2xl p-8 border-glow-gold">
          <div className="flex items-center gap-2 text-primary text-sm font-semibold uppercase tracking-[0.25em]">
            <Flame className="w-4 h-4" />
            Défi quotidien
          </div>
          <h1 className="font-heading text-4xl font-bold text-foreground mt-4">{data?.puzzle.title}</h1>
          <p className="text-muted-foreground mt-3 max-w-3xl">{data?.puzzle.description}</p>
          <div className="flex flex-wrap gap-3 mt-6 text-sm">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">Patch {data?.puzzle.patch}</span>
            <span className="rounded-full bg-secondary px-3 py-1 text-foreground">{data?.puzzle.difficulty}</span>
            <span className="rounded-full bg-secondary px-3 py-1 text-foreground">{data?.puzzle.mode}</span>
          </div>
          <div className="mt-8">
            <Link to={`/training/${data?.puzzle.slug}`}>
              <Button variant="gold" size="lg">
                <Trophy className="w-4 h-4" />
                Résoudre le puzzle du jour
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Daily;
