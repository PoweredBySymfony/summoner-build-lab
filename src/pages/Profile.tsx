import { Navigate } from "react-router-dom";
import { Bell, Mail, ShieldCheck } from "lucide-react";
import { useCurrentUser, useProgress } from "@/api/hooks";

const Profile = () => {
  const { data: user, isLoading } = useCurrentUser();
  const { data: progress } = useProgress();

  if (!isLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-6 max-w-4xl space-y-6">
        <div className="glass-surface rounded-2xl p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Compte</p>
          <h1 className="font-heading text-4xl font-bold text-foreground">{user?.username}</h1>
          <p className="text-muted-foreground mt-3">{user?.email}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground">{user?.authProvider}</span>
            {user?.linkedGoogle ? <span className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground">Google lié</span> : null}
            {user?.hasPassword ? <span className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground">Mot de passe actif</span> : null}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="glass-surface rounded-2xl p-6"><ShieldCheck className="w-5 h-5 text-primary mb-3" /><p className="font-semibold text-foreground">Tentatives stockées</p><p className="text-sm text-muted-foreground mt-2">{progress?.global.totalAttempts ?? 0} réponses enregistrées dans PostgreSQL.</p></div>
          <div className="glass-surface rounded-2xl p-6"><Bell className="w-5 h-5 text-primary mb-3" /><p className="font-semibold text-foreground">Rappels quotidiens</p><p className="text-sm text-muted-foreground mt-2">Le modèle de préférences est prêt pour des jobs cron d'emails.</p></div>
          <div className="glass-surface rounded-2xl p-6"><Mail className="w-5 h-5 text-primary mb-3" /><p className="font-semibold text-foreground">Authentification</p><p className="text-sm text-muted-foreground mt-2">Google et le login local partagent maintenant un seul compte utilisateur.</p></div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
