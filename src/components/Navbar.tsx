import { Link, useLocation } from "react-router-dom";
import { BrainCircuit, Flame, FlaskConical, LayoutDashboard, Shield, Swords, Trophy, User } from "lucide-react";
import { useCurrentUser, useLogout } from "@/api/hooks";

const Navbar = () => {
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  const navItems = [
    { path: "/", label: "Accueil", icon: Shield },
    { path: "/dashboard", label: "Progression", icon: LayoutDashboard },
    { path: "/modules", label: "Entrainement", icon: BrainCircuit },
    { path: "/daily", label: "Quotidien", icon: Flame },
    { path: "/lab", label: "Lab", icon: FlaskConical },
  ];

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/40 glass-surface">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-yellow-600 shadow-lg shadow-primary/20">
            <Swords className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading text-lg font-bold leading-none text-foreground">Summoner Build Lab</p>
            <p className="hidden truncate text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:block">
              Plateforme de puzzles d&apos;itemisation
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all ${
                  active ? "border border-primary/20 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link to="/training" className="hidden h-11 items-center gap-2 rounded-lg bg-secondary px-4 text-sm text-foreground sm:flex">
            <Trophy className="h-4 w-4" />
            S&apos;entraîner
          </Link>

          {user ? (
            <>
              {user.isAdmin ? (
                <Link to="/admin" className="hidden h-11 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 text-sm text-primary lg:flex">
                  <Shield className="h-4 w-4" />
                  Backoffice
                </Link>
              ) : null}
              <Link to="/profile" className="flex h-11 items-center gap-2 rounded-lg bg-primary/10 px-4 text-sm text-primary">
                <User className="h-4 w-4" />
                {user.username}
              </Link>
              <button type="button" onClick={() => logout.mutate()} className="h-11 rounded-lg bg-secondary px-4 text-sm text-foreground">
                Deconnexion
              </button>
            </>
          ) : (
            <Link to="/auth" className="flex h-11 items-center rounded-lg bg-gradient-to-r from-primary to-yellow-600 px-4 text-sm font-semibold text-primary-foreground">
              Connexion
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
