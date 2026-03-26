import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/context";
import Navbar from "./components/Navbar";

const Landing = lazy(() => import("./pages/Landing"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Modules = lazy(() => import("./pages/Modules"));
const Training = lazy(() => import("./pages/Training"));
const Results = lazy(() => import("./pages/Results"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const Daily = lazy(() => import("./pages/Daily"));
const Champion = lazy(() => import("./pages/Champion"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient();

const routeTitles: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/$/, title: "Accueil" },
  { pattern: /^\/auth/, title: "Connexion" },
  { pattern: /^\/dashboard/, title: "Tableau de bord" },
  { pattern: /^\/modules|^\/puzzles/, title: "Entrainement general" },
  { pattern: /^\/daily/, title: "Defi quotidien" },
  { pattern: /^\/training/, title: "Entrainement" },
  { pattern: /^\/champions\//, title: "Champion" },
  { pattern: /^\/players\//, title: "Profil joueur" },
  { pattern: /^\/profile/, title: "Mon profil" },
  { pattern: /^\/admin/, title: "Backoffice" },
];

const RouteTitleSync = () => {
  const location = useLocation();

  useEffect(() => {
    const match = routeTitles.find((entry) => entry.pattern.test(location.pathname));
    document.title = `${match?.title ?? "Summoner Build Lab"} | Summoner Build Lab`;
  }, [location.pathname]);

  return null;
};

const PageFallback = () => (
  <div className="min-h-screen bg-background pb-10 pt-24">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="rounded-[28px] border border-border/60 bg-card/80 p-6 text-muted-foreground shadow-sm">
        Chargement...
      </div>
    </div>
  </div>
);

const KeyedTrainingRoute = () => {
  const { slug } = useParams();
  return <Training key={slug ?? "training-root"} />;
};

const AppFrame = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <>
      {!isAdminRoute && <Navbar />}
      <RouteTitleSync />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/puzzles" element={<Modules />} />
          <Route path="/training" element={<KeyedTrainingRoute />} />
          <Route path="/training/:slug" element={<KeyedTrainingRoute />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/champions/:slug" element={<Champion />} />
          <Route path="/players/:gameName/:tagLine" element={<PlayerProfile />} />
          <Route path="/results" element={<Results />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppFrame />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
