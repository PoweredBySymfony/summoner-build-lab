import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface StatDeltaBadgeProps {
  value: number;
  formatted: string;
}

const StatDeltaBadge = ({ value, formatted }: StatDeltaBadgeProps) => {
  if (Math.abs(value) < 0.009) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/60 px-2 py-1 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" />
        Stable
      </span>
    );
  }

  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${
        positive ? "border border-success/30 bg-success/10 text-emerald-300" : "border border-destructive/30 bg-destructive/10 text-rose-300"
      }`}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {formatted}
    </span>
  );
};

export default StatDeltaBadge;
