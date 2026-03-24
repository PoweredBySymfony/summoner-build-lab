import { Link, useLocation } from "react-router-dom";
import { BrainCircuit, Flame, LayoutDashboard, Shield, Swords, Trophy, User } from "lucide-react";
import { useCurrentUser, useLogout } from "@/api/hooks";

const Navbar = () => {
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  const navItems = [
    { path: "/", label: "Accueil", icon: Shield },
    { path: "/dashboard", label: "Progression", icon: LayoutDashboard },
    { path: "/modules", label: "Général", icon: BrainCircuit },
    { path: "/daily", label: "Quotidien", icon: Flame },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-surface border-b border-border/40">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-yellow-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Swords className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold leading-none text-foreground">Summoner Build Lab</p>
            <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">Plateforme de puzzles d'itemisation</p>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                  active ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link to="/training" className="hidden sm:flex items-center gap-2 h-10 px-4 rounded-lg bg-secondary text-foreground text-sm">
            <Trophy className="w-4 h-4" />
            S'entraîner
          </Link>

          {user ? (
            <>
              <Link to="/profile" className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary/10 text-primary text-sm">
                <User className="w-4 h-4" />
                {user.username}
              </Link>
              <button onClick={() => logout.mutate()} className="h-10 px-4 rounded-lg bg-secondary text-sm text-foreground">Déconnexion</button>
            </>
          ) : (
            <Link to="/auth" className="h-10 px-4 rounded-lg bg-gradient-to-r from-primary to-yellow-600 text-primary-foreground font-semibold text-sm flex items-center">
              Connexion
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
