import type { GameItem } from "@/types/domain";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface ItemIconProps {
  item: GameItem;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

export const ItemIcon = ({ item, size = "md", showTooltip = true, className = "" }: ItemIconProps) => {
  const [hovered, setHovered] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div
        className={`${sizeMap[size]} rounded-md border border-border/60 bg-muted/50 overflow-hidden cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 ${className}`}
        style={{ boxShadow: "inset 0 2px 4px hsl(222 47% 4% / 0.5)" }}
      >
        {!failed ? (
          <img src={item.icon} alt={item.name} className="w-full h-full object-cover" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-foreground bg-gradient-to-br from-primary/15 to-secondary px-1 text-center">
            {item.name.slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>

      {showTooltip && (
        <AnimatePresence>
          {hovered && <ItemTooltip item={item} />}
        </AnimatePresence>
      )}
    </div>
  );
};

const ItemTooltip = ({ item }: { item: GameItem }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 pointer-events-none"
    >
      <div className="glass-surface rounded-lg p-4 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded border border-primary/30 overflow-hidden flex-shrink-0">
            <img src={item.icon} alt={item.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-heading text-sm font-bold text-primary leading-tight">{item.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-primary/80 font-semibold">{item.cost} gold</span>
            </div>
            <div className="flex gap-1 mt-1">
              {item.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-3" />

        {/* Stats */}
        <div className="space-y-1 mb-3">
          {Object.entries(item.stats || {}).slice(0, 6).map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-accent font-medium">{String(value)}</span>
            </div>
          ))}
        </div>

        {/* Passive */}
        {item.passiveEffect && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-2" />
            <div className="mb-3">
              <span className="text-[11px] font-semibold text-primary">Passive</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                {item.passiveEffect}
              </p>
            </div>
          </>
        )}

        {/* Active */}
        {item.activeEffect && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-2" />
            <div className="mb-3">
              <span className="text-[11px] font-semibold text-accent">Active</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                {item.activeEffect}
              </p>
            </div>
          </>
        )}

        {/* Build Path */}
        {item.buildsFrom.length > 0 && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-2" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Build path</span>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {item.buildsFrom.slice(0, 4).map((comp, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground px-2 py-1 rounded bg-secondary/50">
                    {comp}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Arrow */}
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-card border-r border-b border-border/60" />
      </div>
    </motion.div>
  );
};

export default ItemIcon;
