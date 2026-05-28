import { useState, useCallback, type ReactNode } from "react";
import { LanguageContext, translations, type Language, type TranslationNode } from "./languageContext";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>("fr");

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang === "en" ? "fr" : newLang);
    localStorage.setItem("itemforge-lang", "fr");
  }, []);

  const t = useCallback((key: string): string => {
    const keys = key.split(".");
    let value: TranslationNode | undefined = translations[lang];
    for (const k of keys) {
      value = typeof value === "object" && value !== null ? value[k] : undefined;
    }
    return typeof value === "string" ? value : key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
