import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RiotIdSearchProps = {
  defaultValue?: string;
  compact?: boolean;
};

export const RiotIdSearch = ({ defaultValue = "", compact = false }: RiotIdSearchProps) => {
  const navigate = useNavigate();
  const [riotId, setRiotId] = useState(defaultValue);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = riotId.trim();
    const [gameName, tagLine] = trimmed.split("#");

    if (!gameName || !tagLine) {
      return;
    }

    navigate(`/players/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
  };

  return (
    <form onSubmit={submit} className={`rounded-[28px] border border-border/60 bg-background/80 shadow-sm ${compact ? "p-4" : "p-6"}`}>
      <div className={`flex ${compact ? "flex-col gap-3" : "flex-col gap-4 lg:flex-row lg:items-center"}`}>
        <div className="flex-1 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">Player Search</p>
          <label className="sr-only" htmlFor="riot-id-search">Riot ID</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="riot-id-search"
              className={`rounded-2xl pl-11 ${compact ? "h-11" : "h-14 text-base"}`}
              placeholder="Search a Riot ID, ex: QuoiCouBehhhhh#EUW"
              value={riotId}
              onChange={(event) => setRiotId(event.target.value)}
            />
          </div>
          {!compact ? <p className="text-sm text-muted-foreground">Live account lookup and base stats from recent games, structured for future quiz generation.</p> : null}
        </div>
        <Button type="submit" variant="gold" className={`${compact ? "h-11 w-full" : "h-14 min-w-44"} rounded-2xl text-base`}>
          Search profile
        </Button>
      </div>
    </form>
  );
};
