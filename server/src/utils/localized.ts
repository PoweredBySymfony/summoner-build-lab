export type LocalizedValue = { fr: string; en: string };

export const toLocalized = (value: unknown): LocalizedValue => {
  if (value && typeof value === "object" && "fr" in value && "en" in value) {
    return value as LocalizedValue;
  }

  if (typeof value === "string") {
    return { fr: value, en: value };
  }

  return { fr: "", en: "" };
};
