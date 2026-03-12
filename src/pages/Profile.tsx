import { motion } from "framer-motion";
import { ItemIcon } from "@/components/ItemIcon";
import { ITEMS } from "@/data/items";
import { User, Trophy, Target, Flame, Star, Calendar, TrendingUp, Shield, Swords, Zap } from "lucide-react";

const items = Object.values(ITEMS);

const Profile = () => {
  const streakDays = [true, true, true, false, true, true, true, true, false, false, true, true, true, true, true, false, true, true, true, true, true, true, true, false, false, true, true, true, true, true];

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="glass-surface rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 gradient-radial-gold opacity-20" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center">
                <User className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">Summoner</h1>
                <p className="text-sm text-muted-foreground">Membre depuis Janvier 2025</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1 text-sm text-primary font-medium">
                    <Star className="w-4 h-4" /> Niveau 12
                  </span>
                  <span className="flex items-center gap-1 text-sm text-accent font-medium">
                    <Flame className="w-4 h-4" /> Streak 7j
                  </span>
                  <span className="flex items-center gap-1 text-sm text-foreground">
                    <Trophy className="w-4 h-4 text-primary" /> 34 sessions
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Badges */}
          <div className="glass-surface rounded-xl p-6">
            <h3 className="font-heading text-lg font-bold text-foreground mb-4">Badges</h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: Flame, label: "7j Streak", unlocked: true },
                { icon: Target, label: "80% Précision", unlocked: true },
                { icon: Swords, label: "100 scénarios", unlocked: true },
                { icon: Shield, label: "Anti-tank pro", unlocked: true },
                { icon: Zap, label: "Speed demon", unlocked: false },
                { icon: Trophy, label: "Perfect session", unlocked: false },
                { icon: Star, label: "Niveau 20", unlocked: false },
                { icon: TrendingUp, label: "30j Streak", unlocked: false },
              ].map((badge, i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg ${
                    badge.unlocked ? "bg-primary/5 border border-primary/20" : "bg-secondary/30 border border-border/20 opacity-40"
                  }`}
                >
                  <badge.icon className={`w-5 h-5 ${badge.unlocked ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-[10px] text-center text-muted-foreground font-medium">{badge.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Streak calendar */}
          <div className="glass-surface rounded-xl p-6">
            <h3 className="font-heading text-lg font-bold text-foreground mb-4">
              <Calendar className="w-4 h-4 inline mr-2 text-primary" />
              Streak — Février 2025
            </h3>
            <div className="grid grid-cols-7 gap-1.5">
              {["L", "M", "M", "J", "V", "S", "D"].map((d) => (
                <div key={d} className="text-[10px] text-center text-muted-foreground font-medium pb-1">{d}</div>
              ))}
              {/* Offset for starting day */}
              {Array.from({ length: 5 }).map((_, i) => <div key={`empty-${i}`} />)}
              {streakDays.map((active, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-sm flex items-center justify-center text-[10px] ${
                    active ? "bg-primary/30 text-primary font-medium" : "bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div className="glass-surface rounded-xl p-6 mb-8">
          <h3 className="font-heading text-lg font-bold text-foreground mb-4">Spécialités</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { label: "Itemisation ADC", pct: 85, items: ["infinity_edge", "kraken_slayer"] },
              { label: "Anti-compo", pct: 60, items: ["zhonyas", "guardian_angel"] },
              { label: "Items utilitaires", pct: 45, items: ["morellonomicon"] },
            ].map((spec) => (
              <div key={spec.label} className="bg-secondary/30 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{spec.label}</span>
                  <span className="text-sm font-heading font-bold text-primary">{spec.pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full" style={{ width: `${spec.pct}%` }} />
                </div>
                <div className="flex gap-2">
                  {spec.items.map((id) => ITEMS[id] && (
                    <ItemIcon key={id} item={ITEMS[id]} size="sm" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Favorite items */}
        <div className="glass-surface rounded-xl p-6">
          <h3 className="font-heading text-lg font-bold text-foreground mb-4">Items les plus étudiés</h3>
          <div className="flex flex-wrap gap-4">
            {items.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-secondary/30 rounded-lg p-3 pr-5">
                <ItemIcon item={item} size="sm" />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{Math.floor(Math.random() * 20 + 5)} scénarios</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
