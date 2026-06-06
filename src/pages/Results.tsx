import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/useLanguage";

const Results = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background pb-12 pt-24">
      <div className="container mx-auto max-w-3xl px-6">
        <div className="glass-surface rounded-2xl p-8 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-primary">{t("results.sessionComplete")}</p>
          <h1 className="font-heading text-4xl font-bold text-foreground">Retrouve ta vraie progression dans le tableau de bord.</h1>
          <p className="mt-4 text-muted-foreground">
            L'application enregistre maintenant les tentatives directement en base et calcule la progression,
            les streaks et les stats OTP a partir de l'historique sauvegarde. Cette page reste un ecran de transition leger.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/dashboard"><Button variant="gold">Ouvrir le tableau de bord</Button></Link>
            <Link to="/training"><Button variant="outline">Continuer l'entrainement</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
