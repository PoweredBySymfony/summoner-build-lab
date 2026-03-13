import { Link, useLocation } from "react-router-dom";
import { Swords, LayoutDashboard, BookOpen, User, Trophy, Zap, Globe } from "lucide-react";
import { useLanguage } from "@/i18n/context";

const Navbar = () => {
  const location = useLocation();
  const { lang, setLang, t } = useLanguage();

  const navItems = [
    { path: "/", label: t("nav.home"), icon: Zap },
    { path: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { path: "/modules", label: t("nav.modules"), icon: BookOpen },
    { path: "/profile", label: t("nav.profile"), icon: User },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-surface border-b border-border/40">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-yellow-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Swords className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-lg font-bold leading-none tracking-wide text-foreground">
              ITEM<span className="text-primary">FORGE</span>
            </span>
            <span className="text-[9px] text-muted-foreground tracking-widest uppercase">Training Tool</span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all border border-transparent hover:border-border/40"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="uppercase">{lang}</span>
          </button>

          {/* CTA */}
          <Link
            to="/training"
            className="flex items-center gap-2 h-10 px-5 rounded-lg bg-gradient-to-r from-primary to-yellow-600 text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">{t("nav.train")}</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
