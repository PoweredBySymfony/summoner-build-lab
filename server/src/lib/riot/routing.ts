export const RIOT_REGIONS = ["americas", "asia", "europe", "sea"] as const;

export const RIOT_PLATFORMS = [
  "br1",
  "eun1",
  "euw1",
  "jp1",
  "kr",
  "la1",
  "la2",
  "na1",
  "oc1",
  "ru",
  "tr1",
  "ph2",
  "sg2",
  "th2",
  "tw2",
  "vn2",
] as const;

export type RiotRegion = (typeof RIOT_REGIONS)[number];
export type RiotPlatform = (typeof RIOT_PLATFORMS)[number];

export const PLATFORM_TO_REGION: Record<RiotPlatform, RiotRegion> = {
  br1: "americas",
  eun1: "europe",
  euw1: "europe",
  jp1: "asia",
  kr: "asia",
  la1: "americas",
  la2: "americas",
  na1: "americas",
  oc1: "sea",
  ru: "europe",
  tr1: "europe",
  ph2: "sea",
  sg2: "sea",
  th2: "sea",
  tw2: "sea",
  vn2: "sea",
};

const TAGLINE_TO_PLATFORM_PRIORITY: Record<string, RiotPlatform[]> = {
  BR: ["br1"],
  EUNE: ["eun1"],
  EUW: ["euw1"],
  JP: ["jp1"],
  KR: ["kr"],
  LAN: ["la1"],
  LAS: ["la2"],
  NA: ["na1"],
  OCE: ["oc1"],
  RU: ["ru"],
  TR: ["tr1"],
  PH: ["ph2"],
  SG: ["sg2"],
  TH: ["th2"],
  TW: ["tw2"],
  VN: ["vn2"],
};

export function getPlatformSearchOrder(tagLine?: string | null) {
  const normalized = tagLine?.trim().toUpperCase() ?? "";
  const prioritized = normalized ? TAGLINE_TO_PLATFORM_PRIORITY[normalized] ?? [] : [];
  const seen = new Set<RiotPlatform>();

  return [...prioritized, ...RIOT_PLATFORMS].filter((platform) => {
    if (seen.has(platform)) {
      return false;
    }

    seen.add(platform);
    return true;
  });
}
