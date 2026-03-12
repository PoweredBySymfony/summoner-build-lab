import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "gold" | "cyan" | "success" | "default";
}

const accentStyles = {
  gold: "border-primary/20 bg-primary/5",
  cyan: "border-accent/20 bg-accent/5",
  success: "border-success/20 bg-success/5",
  default: "border-border/40 bg-card",
};

const iconStyles = {
  gold: "text-primary bg-primary/10",
  cyan: "text-accent bg-accent/10",
  success: "text-success bg-success/10",
  default: "text-muted-foreground bg-secondary",
};

const StatCard = ({ icon: Icon, label, value, sub, accent = "default" }: StatCardProps) => {
  return (
    <div className={`rounded-xl border p-5 transition-all duration-200 hover:scale-[1.01] ${accentStyles[accent]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">{label}</p>
          <p className="text-3xl font-heading font-bold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconStyles[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
