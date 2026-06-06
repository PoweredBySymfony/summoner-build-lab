export type SectionKey = "overview" | "champions" | "items" | "puzzles";

export const roleOptions = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FLEX"] as const;
export const puzzleModes = ["GENERAL", "CHAMPION_SPECIFIC", "PERSONALIZED", "DAILY"] as const;
export const puzzleDifficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
