import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, BrainCircuit, Sparkles } from "lucide-react";
import ChampionPortrait from "@/components/ChampionPortrait";
import { Button } from "@/components/ui/button";
import { useChampionLearning, useGenerateChampionPuzzle } from "@/api/hooks";

const Champion = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { data, isLoading } = useChampionLearning(slug);
  const generate = useGenerateChampionPuzzle();

  if (isLoading || !data) {
    return <div className="min-h-screen bg-background pt-24"><div className="container mx-auto px-6"><div className="glass-surface rounded-xl p-6">Loading champion workspace...</div></div></div>;
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-6 space-y-6">
        <div className="glass-surface rounded-2xl p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-5">
              <ChampionPortrait champion={data.champion} size="lg" />
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-2">OTP learning mode</p>
                <h1 className="font-heading text-4xl font-bold text-foreground">{data.champion.name}</h1>
                <p className="text-muted-foreground">{data.champion.title}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {data.champion.roles.map((role) => (
                    <span key={role} className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground">{role}</span>
                  ))}
                  {data.champion.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                variant="gold"
                onClick={async () => {
                  const result = await generate.mutateAsync({ championId: data.champion.databaseId });
                  navigate(`/training/${result.slug}`);
                }}
                disabled={generate.isPending}
              >
                <Sparkles className="w-4 h-4" />
                Generate a new OTP puzzle
              </Button>
              <div className="text-sm text-muted-foreground">
                {data.progress ? `Mastery score: ${data.progress.masteryScore}` : "No saved OTP progress yet."}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass-surface rounded-2xl p-6">
            <div className="flex items-center gap-2 text-primary mb-4">
              <BarChart3 className="w-4 h-4" />
              <h2 className="font-heading text-xl font-bold">Champion stats</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Attempts</span><span>{data.progress?.totalAttempts ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Correct</span><span>{data.progress?.correctAttempts ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Patch</span><span>{data.champion.patch}</span></div>
            </div>
          </div>

          <div className="lg:col-span-2 glass-surface rounded-2xl p-6">
            <div className="flex items-center gap-2 text-primary mb-4">
              <BrainCircuit className="w-4 h-4" />
              <h2 className="font-heading text-xl font-bold">Champion-specific puzzles</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {data.puzzles.map((puzzle) => (
                <button key={puzzle.id} onClick={() => navigate(`/training/${puzzle.slug}`)} className="rounded-xl border border-border/60 p-4 text-left hover:border-primary/40 transition-colors">
                  <p className="text-xs uppercase tracking-wider text-primary font-semibold">{puzzle.mode}</p>
                  <h3 className="font-semibold text-foreground mt-2">{puzzle.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{puzzle.shortPrompt}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Champion;
