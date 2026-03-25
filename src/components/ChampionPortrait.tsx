import type { ChampionView } from "@/types/domain";
import { useState } from "react";

interface ChampionPortraitProps {
  champion: ChampionView;
  size?: "sm" | "md" | "lg";
  showInfo?: boolean;
}

const sizeMap = {
  sm: "w-9 h-9",
  md: "w-10 h-10",
  lg: "w-14 h-14",
};

const ChampionPortrait = ({ champion, size = "md", showInfo = false }: ChampionPortraitProps) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${sizeMap[size]} rounded-lg border border-border/60 overflow-hidden bg-muted/50 relative`}
        title={champion.name}
      >
        {!failed ? (
          <img src={champion.icon} alt={champion.name} className="w-full h-full object-cover" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-foreground bg-gradient-to-br from-primary/15 to-secondary">
            {champion.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg" />
      </div>
      {showInfo && (
        <div className="text-center">
          <p className="text-[10px] font-medium text-foreground leading-none">{champion.name}</p>
          <p className="text-[9px] text-muted-foreground">{champion.roles[0]}</p>
        </div>
      )}
    </div>
  );
};

export default ChampionPortrait;
