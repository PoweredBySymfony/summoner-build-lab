import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { fr } from "./translations/fr";
import { en } from "./translations/en";

type Language = "fr" | "en";
type Translations = typeof fr;

const translations: Record<Language, Translations> = { fr, en };

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem("itemforge-lang");
    return (stored === "en" || stored === "fr") ? stored : "fr";
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("itemforge-lang", newLang);
  }, []);

  const t = useCallback((key: string): string => {
    const keys = key.split(".");
    let value: any = translations[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return typeof value === "string" ? value : key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
