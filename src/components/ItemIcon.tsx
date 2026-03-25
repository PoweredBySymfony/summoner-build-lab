import type { GameItem } from "@/types/domain";
import { getItemEffectBlocks, getItemStatLines, type ItemStatIconKey } from "@/lib/itemPresentation";
import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ItemIconProps {
  item: GameItem;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

const iconTintMap: Record<ItemStatIconKey, string> = {
  attackDamage: "text-[#ffb14a]",
  abilityPower: "text-[#7ec8ff]",
  health: "text-[#7ef08a]",
  mana: "text-[#59a8ff]",
  armor: "text-[#ffd27a]",
  magicResist: "text-[#c9a0ff]",
  attackSpeed: "text-[#ffe66d]",
  abilityHaste: "text-[#7ee7ff]",
  crit: "text-[#ff9f43]",
  moveSpeed: "text-[#f8f1c1]",
  omnivamp: "text-[#9cff8c]",
  lifesteal: "text-[#ff7f7f]",
  lethality: "text-[#ff8a65]",
  magicPen: "text-[#78c2ff]",
  healthRegen: "text-[#8cf5ad]",
  manaRegen: "text-[#8fc6ff]",
  default: "text-[#d9d7cf]",
};

const badgeTintMap: Record<ItemStatIconKey, string> = {
  attackDamage: "from-[#4c2e12] to-[#23160a] border-[#a45b1c]/60",
  abilityPower: "from-[#183954] to-[#0b1826] border-[#4ca7df]/60",
  health: "from-[#19452b] to-[#0d1f15] border-[#4fc96f]/60",
  mana: "from-[#17375b] to-[#0b1727] border-[#4f8fe0]/60",
  armor: "from-[#4a3a17] to-[#21190b] border-[#b8993c]/60",
  magicResist: "from-[#352451] to-[#171024] border-[#9f74ff]/60",
  attackSpeed: "from-[#4e4314] to-[#231d0a] border-[#cab13e]/60",
  abilityHaste: "from-[#17414f] to-[#0a1d23] border-[#55b9d1]/60",
  crit: "from-[#542b12] to-[#261209] border-[#df8f35]/60",
  moveSpeed: "from-[#4d4425] to-[#231d11] border-[#c5b88a]/60",
  omnivamp: "from-[#214523] to-[#0c1f10] border-[#59cc61]/60",
  lifesteal: "from-[#4e1e1e] to-[#240d0d] border-[#d86868]/60",
  lethality: "from-[#4a2118] to-[#220e0a] border-[#d97757]/60",
  magicPen: "from-[#173858] to-[#0b1724] border-[#61aee8]/60",
  healthRegen: "from-[#1d492a] to-[#0d2113] border-[#67db8b]/60",
  manaRegen: "from-[#1b3a57] to-[#0c1824] border-[#5f9ce1]/60",
  default: "from-[#343126] to-[#171610] border-white/10",
};

const renderGlyph = (icon: ItemStatIconKey) => {
  switch (icon) {
    case "attackDamage":
      return <path d="M6 18L18 6l3 3-4 4 2 2-2 2-2-2-4 4-5-1 1-5z" fill="currentColor" />;
    case "abilityPower":
      return (
        <>
          <path d="M12 3l2.6 5.4L20 11l-5.4 2.6L12 19l-2.6-5.4L4 11l5.4-2.6L12 3z" fill="currentColor" />
          <circle cx="12" cy="11" r="2.2" fill="rgba(10,12,18,.45)" />
        </>
      );
    case "health":
      return <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" fill="currentColor" />;
    case "mana":
      return <path d="M12 3c3.2 4.1 5.5 7 5.5 10A5.5 5.5 0 1 1 6.5 13c0-3 2.3-5.9 5.5-10z" fill="currentColor" />;
    case "armor":
      return <path d="M12 3l7 3v5c0 4.8-2.9 8.3-7 10-4.1-1.7-7-5.2-7-10V6l7-3z" fill="currentColor" />;
    case "magicResist":
      return (
        <>
          <path d="M12 3l7 3v5c0 4.8-2.9 8.3-7 10-4.1-1.7-7-5.2-7-10V6l7-3z" fill="currentColor" />
          <path d="M12 7.2l1.3 2.6 2.9.4-2.1 2.1.5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2.1 2.9-.4L12 7.2z" fill="rgba(10,12,18,.5)" />
        </>
      );
    case "attackSpeed":
      return (
        <>
          <path d="M6 16l5-8h3l-5 8H6zM11 16l5-8h2l-5 8h-2z" fill="currentColor" />
          <path d="M14 6h5v5" stroke="currentColor" strokeWidth="2" fill="none" />
        </>
      );
    case "abilityHaste":
      return (
        <>
          <path d="M12 4a8 8 0 1 0 8 8" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M16 4h4v4" stroke="currentColor" strokeWidth="2" fill="none" />
        </>
      );
    case "crit":
      return (
        <>
          <path d="M12 3l2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2L12 3z" fill="currentColor" />
          <path d="M12 7l.8 1.7 1.7.3-1.2 1.2.3 1.7-1.6-.9-1.6.9.3-1.7-1.2-1.2 1.7-.3L12 7z" fill="rgba(10,12,18,.5)" />
        </>
      );
    case "moveSpeed":
      return (
        <>
          <path d="M7 16c2.5-1.2 4.2-3.2 5.1-6H9.3L7 7h6.8l2.5 2.2-1.8 1.3c-.7 2.8-2.7 5.6-6.5 7.5H7z" fill="currentColor" />
          <path d="M15 15h4M13 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "omnivamp":
      return (
        <>
          <path d="M11 4c2.9 3.7 4.7 6.1 4.7 8.5a4.7 4.7 0 1 1-9.4 0C6.3 10.1 8.1 7.7 11 4z" fill="currentColor" />
          <path d="M16 6c1.7 2.1 2.7 3.6 2.7 5a2.7 2.7 0 1 1-5.4 0c0-1.4 1-2.9 2.7-5z" fill="currentColor" opacity=".65" />
        </>
      );
    case "lifesteal":
      return (
        <>
          <path d="M12 4c2.9 3.7 4.7 6.1 4.7 8.5a4.7 4.7 0 1 1-9.4 0C7.3 10.1 9.1 7.7 12 4z" fill="currentColor" />
          <path d="M8 18l8-8" stroke="rgba(10,12,18,.45)" strokeWidth="2" />
        </>
      );
    case "lethality":
      return <path d="M6 19L18 5l1 1-4 6 3 1-8 6-4 1 1-4z" fill="currentColor" />;
    case "magicPen":
      return (
        <>
          <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" />
        </>
      );
    case "healthRegen":
      return (
        <>
          <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" fill="currentColor" />
          <path d="M12 8v6M9 11h6" stroke="rgba(10,12,18,.55)" strokeWidth="2" />
        </>
      );
    case "manaRegen":
      return (
        <>
          <path d="M12 3c3.2 4.1 5.5 7 5.5 10A5.5 5.5 0 1 1 6.5 13c0-3 2.3-5.9 5.5-10z" fill="currentColor" />
          <path d="M12 8v6M9 11h6" stroke="rgba(10,12,18,.55)" strokeWidth="2" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="5" fill="currentColor" />;
  }
};

const StatBadge = ({ icon }: { icon: ItemStatIconKey }) => (
  <div className={`flex h-6 w-6 items-center justify-center rounded-md border bg-gradient-to-br ${badgeTintMap[icon]}`}>
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${iconTintMap[icon]}`} aria-hidden="true">
      {renderGlyph(icon)}
    </svg>
  </div>
);

const TooltipPortal = ({
  anchor,
  children,
}: {
  anchor: HTMLElement | null;
  children: (placement: "top" | "bottom") => ReactNode;
}) => {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");

  useLayoutEffect(() => {
    if (!anchor) {
      return;
    }

    let frameId: number | null = null;

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(420, window.innerWidth - 24);
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2));
      const top = rect.top > 340 ? rect.top - 14 : rect.bottom + 14;
      const nextPlacement = rect.top > 340 ? "top" : "bottom";
      setPlacement(nextPlacement);

      setStyle({
        position: "fixed",
        left,
        top,
        width,
        zIndex: 9999,
      });
    };

    const scheduleUpdate = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updatePosition();
      });
    };

    updatePosition();
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [anchor]);

  if (!style) {
    return null;
  }

  return createPortal(<div style={style}>{children(placement)}</div>, document.body);
};

export const ItemIcon = ({ item, size = "md", showTooltip = true, className = "" }: ItemIconProps) => {
  const [hovered, setHovered] = useState(false);
  const [failed, setFailed] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={triggerRef}
      className="relative"
      tabIndex={showTooltip ? 0 : -1}
      role="img"
      aria-label={item.name}
      aria-haspopup={showTooltip ? "dialog" : undefined}
      aria-expanded={showTooltip ? hovered : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div
        className={`${sizeMap[size]} overflow-hidden rounded-md border border-border/60 bg-muted/50 cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 ${className}`}
        style={{ boxShadow: "inset 0 2px 4px hsl(222 47% 4% / 0.5)" }}
      >
        {!failed ? (
          <img src={item.icon} alt={item.name} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary px-1 text-center text-[9px] font-bold text-foreground">
            {item.name.slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>

      {showTooltip ? (
        <AnimatePresence>
          {hovered ? (
            <TooltipPortal anchor={triggerRef.current}>
              {(placement) => <ItemTooltip item={item} placement={placement} />}
            </TooltipPortal>
          ) : null}
        </AnimatePresence>
      ) : null}
    </div>
  );
};

const ItemTooltip = ({ item, placement }: { item: GameItem; placement: "top" | "bottom" }) => {
  const statLines = getItemStatLines(item);
  const effectBlocks = getItemEffectBlocks(item);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.14 }}
      className="pointer-events-none relative"
    >
      <div className="overflow-hidden rounded-[18px] border border-[#8b6a24]/40 bg-[#0d1320]/96 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <div className="bg-[linear-gradient(180deg,rgba(255,198,90,0.07),rgba(255,198,90,0))] px-4 pb-4 pt-4">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-md border border-[#c49b43]/45 bg-black/20 shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)]">
              <img src={item.icon} alt={item.name} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-heading text-lg font-bold uppercase tracking-[0.04em] text-[#f2c249]">
                {item.name}
              </h4>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#f3d37a]">
                <span>{item.cost} or</span>
                {item.baseCost ? <span className="text-[#c5ab63]/85">({item.baseCost})</span> : null}
              </div>
              {item.shortDescription ? (
                <p className="mt-2 text-sm leading-5 text-[#d1d8e5]/76">{item.shortDescription}</p>
              ) : null}
            </div>
          </div>
        </div>

        {statLines.length > 0 ? (
          <div className="border-t border-white/6 px-4 py-3">
            <div className="space-y-2">
              {statLines.map((entry) => (
                <div key={`${item.id}-${entry.key}-${entry.value}`} className="grid grid-cols-[24px_1fr_auto] items-center gap-3">
                  <StatBadge icon={entry.icon} />
                  <span className="text-sm text-[#f4f5f7]">{entry.label}</span>
                  <span className="text-sm font-semibold text-[#6be8ff]">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {effectBlocks.length > 0 ? (
          <div className="border-t border-white/6 px-4 py-3">
            <div className="space-y-3">
              {effectBlocks.map((block, index) => (
                <div key={`${item.id}-block-${index}`}>
                  {block.title ? (
                    <p className="text-sm font-semibold text-[#f7e3a1]">{block.title}</p>
                  ) : null}
                  <p className="text-sm leading-5 text-[#d4dae5]/84">{block.body}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {item.buildsFrom.length > 0 ? (
          <div className="border-t border-white/6 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8f97a8]">Composants</p>
            {item.buildsFromIcons && item.buildsFromIcons.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.buildsFromIcons.slice(0, 6).map((component) => (
                  <div
                    key={`${item.id}-component-${component.riotItemId}`}
                    className="h-9 w-9 overflow-hidden rounded-md border border-white/10 bg-black/20 shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)]"
                    title={`Composant ${component.riotItemId}`}
                  >
                    <img
                      src={component.icon}
                      alt={`Composant ${component.riotItemId}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.buildsFrom.slice(0, 6).map((componentId) => (
                  <div
                    key={`${item.id}-component-${componentId}`}
                    className="rounded-md border border-white/8 bg-white/5 px-2 py-1 font-mono text-[11px] text-[#c8cfdd]"
                  >
                    {componentId}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {placement === "top" ? (
        <div className="absolute left-1/2 top-[calc(100%-6px)] h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-[#8b6a24]/40 bg-[#0d1320]/96" />
      ) : (
        <div className="absolute bottom-[calc(100%-6px)] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-[#8b6a24]/40 bg-[#0d1320]/96" />
      )}
    </motion.div>
  );
};

export default ItemIcon;
