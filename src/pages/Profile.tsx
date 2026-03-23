import { motion } from "framer-motion";
import { User, Trophy, Flame, Star } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";
import { useLanguage } from "@/i18n/context";
import { useDashboard } from "@/api/hooks";

const Profile = () => {
  const { t } = useLanguage();
  const { data } = useDashboard();

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-6 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="glass-surface rounded-2xl p-8 relative overflow-hidden">
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center">
                <User className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">{data?.user.username ?? "Summoner"}</h1>
                <p className="text-sm text-muted-foreground">{t("profile.memberSince")}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1 text-sm text-primary font-medium">
                    <Star className="w-4 h-4" /> {t("profile.level")} {data?.user.level ?? 0}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-accent font-medium">
                    <Flame className="w-4 h-4" /> {t("profile.streak")} {data?.user.streak ?? 0}j
                  </span>
                  <span className="flex items-center gap-1 text-sm text-foreground">
                    <Trophy className="w-4 h-4 text-primary" /> {data?.stats.sessions ?? 0} {t("profile.sessions")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="glass-surface rounded-xl p-6">
          <h3 className="font-heading text-lg font-bold text-foreground mb-4">{t("profile.mostStudied")}</h3>
          <div className="flex flex-wrap gap-4">
            {(data?.featuredItems ?? []).map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-secondary/30 rounded-lg p-3 pr-5">
                <ItemIcon item={item} size="sm" />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
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
