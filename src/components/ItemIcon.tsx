import type { GameItem } from "@/types/domain";
import { getItemEffectBlocks, getItemStatLines, type ItemStatIconKey } from "@/lib/itemPresentation";
import {
  itemStatBadgeTintClass,
  itemStatIconTintClass,
  itemTooltipArrowClass,
  itemTooltipClassNames,
} from "@/lib/itemStatVisuals";
import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ItemIconProps {
  item: GameItem;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
  highlighted?: boolean;
  onInspect?: (item: GameItem) => void;
  onOpenDetail?: (item: GameItem) => void;
  interactive?: boolean;
  inspectControls?: string;
}

const sizeMap = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
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
    case "tenacity":
      return (
        <>
          <path d="M12 3l7 3v5c0 4.8-2.9 8.3-7 10-4.1-1.7-7-5.2-7-10V6l7-3z" fill="currentColor" />
          <path d="M8 12l2.2 2.2L16 8.4" stroke="rgba(10,12,18,.55)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="5" fill="currentColor" />;
  }
};

const StatBadge = ({ icon }: { icon: ItemStatIconKey }) => (
  <div className={`flex h-6 w-6 items-center justify-center rounded-md border bg-gradient-to-br ${itemStatBadgeTintClass[icon]}`}>
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${itemStatIconTintClass[icon]}`} aria-hidden="true">
      {renderGlyph(icon)}
    </svg>
  </div>
);

const TooltipPortal = ({
  anchor,
  preferredWidth,
  preferredMaxHeight,
  children,
}: {
  anchor: HTMLElement | null;
  preferredWidth: number;
  preferredMaxHeight: number;
  children: (placement: "right" | "left" | "top" | "bottom") => ReactNode;
}) => {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [placement, setPlacement] = useState<"right" | "left" | "top" | "bottom">("right");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportPadding = 16;

  useLayoutEffect(() => {
    if (!anchor) {
      setStyle(null);
      return;
    }

    let frameId: number | null = null;

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const fallbackWidth = Math.min(preferredWidth, window.innerWidth - viewportPadding * 2);
      const measuredWidth = containerRef.current?.offsetWidth ?? fallbackWidth;
      const measuredHeight =
        containerRef.current?.offsetHeight ?? Math.min(preferredMaxHeight, window.innerHeight - viewportPadding * 2);
      const width = Math.min(measuredWidth, window.innerWidth - viewportPadding * 2);
      const panelHeight = Math.min(measuredHeight, window.innerHeight - viewportPadding * 2);
      const gap = 20;
      const spaceRight = window.innerWidth - rect.right - viewportPadding;
      const spaceLeft = rect.left - viewportPadding;
      const spaceBottom = window.innerHeight - rect.bottom - viewportPadding;
      const spaceTop = rect.top - viewportPadding;

      let nextPlacement: "right" | "left" | "top" | "bottom" = "right";
      if (spaceRight >= width + gap) {
        nextPlacement = "right";
      } else if (spaceLeft >= width + gap) {
        nextPlacement = "left";
      } else if (spaceTop >= panelHeight + gap) {
        nextPlacement = "top";
      } else if (spaceBottom >= panelHeight + gap) {
        nextPlacement = "bottom";
      } else {
        nextPlacement = spaceBottom >= spaceTop ? "bottom" : "top";
      }

      setPlacement(nextPlacement);

      if (nextPlacement === "right" || nextPlacement === "left") {
        const left =
          nextPlacement === "right"
            ? Math.min(window.innerWidth - width - viewportPadding, rect.right + gap)
            : Math.max(viewportPadding, rect.left - width - gap);
        const top = Math.min(
          window.innerHeight - panelHeight - viewportPadding,
          Math.max(viewportPadding, rect.top + rect.height / 2 - panelHeight / 2),
        );

        setStyle({
          position: "fixed",
          left,
          top,
          width,
          zIndex: 9999,
          visibility: "visible",
        });
        return;
      }

      const left = Math.min(
        window.innerWidth - width - viewportPadding,
        Math.max(viewportPadding, rect.left + rect.width / 2 - width / 2),
      );
      const top =
        nextPlacement === "top"
          ? Math.max(viewportPadding, rect.top - panelHeight - gap)
          : Math.min(window.innerHeight - panelHeight - viewportPadding, rect.bottom + gap);

      setStyle({
        position: "fixed",
        left,
        top,
        width,
        zIndex: 9999,
        visibility: "visible",
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

    setStyle({
      position: "fixed",
      left: viewportPadding,
      top: viewportPadding,
      width: Math.min(preferredWidth, window.innerWidth - viewportPadding * 2),
      zIndex: 9999,
      visibility: "hidden",
    });
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [anchor, preferredMaxHeight, preferredWidth]);

  if (!style) {
    return null;
  }

  return createPortal(<div ref={containerRef} style={style}>{children(placement)}</div>, document.body);
};

export const ItemIcon = ({
  item,
  size = "md",
  showTooltip = true,
  className = "",
  highlighted = false,
  onInspect,
  onOpenDetail,
  interactive = true,
  inspectControls,
}: ItemIconProps) => {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null);
  const openTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const canPreview = showTooltip || Boolean(onInspect) || Boolean(onOpenDetail);
  const canInteract = interactive && canPreview;
  const statLines = useMemo(() => getItemStatLines(item), [item]);
  const effectBlocks = useMemo(() => getItemEffectBlocks(item), [item]);
  const totalEffectLength = effectBlocks.reduce((sum, block) => sum + block.body.length + (block.title?.length ?? 0), 0);
  const longestStatLabel = statLines.reduce((max, entry) => Math.max(max, entry.label.length), 0);
  const hasDenseContent = totalEffectLength > 220 || effectBlocks.length > 1;
  const layoutMode =
    hasDenseContent || (effectBlocks.length > 0 && item.buildsFrom.length > 0)
      ? "dense"
      : effectBlocks.length > 0 || statLines.length >= 4 || longestStatLabel > 22
        ? "balanced"
        : "compact";
  const tooltipWidth = layoutMode === "dense" ? 384 : layoutMode === "balanced" ? 356 : 332;
  const tooltipMaxHeight = layoutMode === "dense" ? 540 : layoutMode === "balanced" ? 490 : 430;

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current !== null) {
        window.clearTimeout(openTimeoutRef.current);
      }
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const scheduleOpen = () => {
    if (!canPreview) {
      return;
    }

    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setActive(true);
    onInspect?.(item);

    if (!showTooltip) {
      return;
    }

    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
    }

    openTimeoutRef.current = window.setTimeout(() => {
      setHovered(true);
      openTimeoutRef.current = null;
    }, 120);
  };

  const closeTooltip = () => {
    if (!canPreview) {
      return;
    }

    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }

    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setActive(false);
      setHovered(false);
      closeTimeoutRef.current = null;
    }, 90);
  };

  const triggerProps = {
    ref: triggerRef,
    className: "relative inline-block rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "data-item-icon": item.slug,
    "aria-label": item.name,
    "aria-haspopup": showTooltip ? "tooltip" as const : onOpenDetail ? "dialog" as const : undefined,
    "aria-expanded": showTooltip ? hovered : undefined,
    "aria-controls": inspectControls,
    onMouseEnter: scheduleOpen,
    onMouseLeave: closeTooltip,
    onFocus: scheduleOpen,
    onBlur: closeTooltip,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (!canInteract) {
        return;
      }
      event.stopPropagation();
      onInspect?.(item);
      onOpenDetail?.(item);
    },
  };

  const triggerContent = (
    <>
      <div
        className={`${sizeMap[size]} overflow-hidden rounded-md border border-border/60 bg-muted/50 ${canInteract ? "cursor-pointer" : ""} transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 ${active || highlighted ? "border-primary/50 shadow-lg shadow-primary/10" : ""} ${className}`}
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
            <TooltipPortal anchor={triggerRef.current} preferredWidth={tooltipWidth} preferredMaxHeight={tooltipMaxHeight}>
              {(placement) => (
                <ItemTooltip
                  item={item}
                  placement={placement}
                  statLines={statLines}
                  effectBlocks={effectBlocks}
                  maxHeight={tooltipMaxHeight}
                  layoutMode={layoutMode}
                />
              )}
            </TooltipPortal>
          ) : null}
        </AnimatePresence>
      ) : null}
    </>
  );

  return canInteract ? (
    <button
      {...triggerProps}
      type="button"
      aria-pressed={highlighted}
    >
      {triggerContent}
    </button>
  ) : (
    <div
      {...triggerProps}
      role="img"
    >
      {triggerContent}
    </div>
  );
};

const ItemTooltip = ({
  item,
  placement,
  statLines,
  effectBlocks,
  maxHeight,
  layoutMode,
}: {
  item: GameItem;
  placement: "right" | "left" | "top" | "bottom";
  statLines: ReturnType<typeof getItemStatLines>;
  effectBlocks: ReturnType<typeof getItemEffectBlocks>;
  maxHeight: number;
  layoutMode: "compact" | "balanced" | "dense";
}) => {
  const hasComponents = item.buildsFrom.length > 0;
  const hasEffects = effectBlocks.length > 0;
  const useScrollableEffects = hasEffects && (layoutMode !== "compact" || hasComponents);
  const statsGridClass =
    statLines.length === 1
      ? "grid-cols-1"
      : layoutMode === "dense"
        ? "grid-cols-1 xl:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2";
  const statCardClass =
    layoutMode === "compact"
      ? itemTooltipClassNames.statCardCompact
      : itemTooltipClassNames.statCardDefault;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className="pointer-events-none relative"
    >
      <div
        className={itemTooltipClassNames.panel}
        style={{ maxHeight: `min(78vh, ${maxHeight}px)` }}
      >
        <div className="flex max-h-full min-h-0 flex-col overflow-hidden">
          <div className={itemTooltipClassNames.header}>
            <div className="flex items-start gap-3">
              <div className={itemTooltipClassNames.iconFrame}>
                <img src={item.icon} alt={item.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className={itemTooltipClassNames.title}>
                  {item.name}
                </h4>
                <div className={itemTooltipClassNames.priceLine}>
                  <span>{item.cost} or</span>
                  {item.baseCost ? <span className={itemTooltipClassNames.baseCost}>({item.baseCost})</span> : null}
                  {item.category ? (
                    <span className={itemTooltipClassNames.categoryBadge}>
                      {item.category}
                    </span>
                  ) : null}
                </div>
                {item.shortDescription ? (
                  <p className={itemTooltipClassNames.shortDescription}>{item.shortDescription}</p>
                ) : null}
              </div>
            </div>
          </div>

          {statLines.length > 0 ? (
            <div className={itemTooltipClassNames.section}>
              <div className={`grid gap-2 ${statsGridClass}`}>
                {statLines.map((entry) => (
                  <div key={`${item.id}-${entry.key}-${entry.value}`} className={statCardClass}>
                    <StatBadge icon={entry.icon} />
                    <span className={itemTooltipClassNames.statLabel}>{entry.label}</span>
                    <span className={itemTooltipClassNames.statValue}>{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasEffects ? (
            <div className={useScrollableEffects ? itemTooltipClassNames.scrollableSection : itemTooltipClassNames.staticSection}>
              <div className={useScrollableEffects ? "min-h-0 max-h-full overflow-y-auto pr-1" : undefined}>
                <div className="space-y-3">
                  {effectBlocks.map((block, index) => (
                    <div
                      key={`${item.id}-block-${index}`}
                      className={layoutMode === "compact" ? itemTooltipClassNames.effectCardCompact : itemTooltipClassNames.effectCardDefault}
                    >
                      <div className={`flex ${block.icon ? "items-start gap-3" : "block"}`}>
                        {block.icon ? <div className="pt-0.5"><StatBadge icon={block.icon} /></div> : null}
                        <div className="min-w-0 flex-1">
                          {block.title ? (
                            <p className={itemTooltipClassNames.effectTitle}>{block.title}</p>
                          ) : null}
                          <p className={`${itemTooltipClassNames.effectBody} ${layoutMode === "compact" ? "leading-5" : "leading-6"}`}>{block.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {item.buildsFrom.length > 0 ? (
            <div className={itemTooltipClassNames.section}>
              <p className={itemTooltipClassNames.componentsTitle}>Composants</p>
              {item.buildsFromIcons && item.buildsFromIcons.length > 0 ? (
                <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(36px,36px))] gap-2">
                  {item.buildsFromIcons.slice(0, 6).map((component) => (
                    <div
                      key={`${item.id}-component-${component.riotItemId}`}
                      className={itemTooltipClassNames.componentIcon}
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
                      className={itemTooltipClassNames.componentId}
                    >
                      {componentId}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className={itemTooltipArrowClass[placement]} />
    </motion.div>
  );
};

export default ItemIcon;
