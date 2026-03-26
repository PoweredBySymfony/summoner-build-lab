import type { LocalizedText } from "@/types/domain";

export const getLocalized = (value: LocalizedText | undefined, lang: "fr" | "en") => {
  if (!value) {
    return "";
  }

  return value[lang] ?? value.en ?? value.fr;
};
