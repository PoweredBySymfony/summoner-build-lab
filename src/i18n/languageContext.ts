import { createContext } from "react";
import { en } from "./translations/en";
import { fr } from "./translations/fr";

export type Language = "fr" | "en";
export type TranslationNode = string | { [key: string]: TranslationNode };
export type Translations = Record<string, TranslationNode>;

export interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

export const translations: Record<Language, Translations> = { fr, en };
export const LanguageContext = createContext<LanguageContextType | null>(null);
