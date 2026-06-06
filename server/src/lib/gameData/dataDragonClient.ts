const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com";

export type ChampionSummaryResponse = {
  data: Record<
    string,
    {
      version: string;
      id: string;
      key: string;
      name: string;
      title: string;
      image: { full: string };
      tags: string[];
      stats: Record<string, number>;
    }
  >;
};

export type ChampionDetailResponse = {
  data: Record<
    string,
    {
      id: string;
      key: string;
      name: string;
      title: string;
      lore?: string;
      blurb?: string;
      image: { full: string };
      tags: string[];
      stats: Record<string, number>;
      passive: {
        name: string;
        description: string;
        image: { full: string };
      };
      spells: Array<{
        id: string;
        name: string;
        description: string;
        tooltip?: string;
        image: { full: string };
      }>;
    }
  >;
};

export type ItemResponse = {
  data: Record<
    string,
    {
      name: string;
      description: string;
      plaintext: string;
      colloq?: string;
      into?: string[];
      from?: string[];
      image: { full: string };
      gold: { base: number; total: number; sell: number; purchasable: boolean };
      maps?: Record<string, boolean>;
      tags?: string[];
      stats?: Record<string, number>;
      requiredChampion?: string;
      consumed?: boolean;
      consumeOnFull?: boolean;
      specialRecipe?: number;
      inStore?: boolean;
    }
  >;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const dataDragonClient = {
  getVersions: () => fetchJson<string[]>(`${DDRAGON_BASE_URL}/api/versions.json`),
  async getLatestVersion() {
    const versions = await this.getVersions();
    if (!versions.length) {
      throw new Error("Unable to resolve latest Data Dragon version.");
    }
    return versions[0];
  },
  getChampionSummary: (version: string, locale = "en_US") =>
    fetchJson<ChampionSummaryResponse>(`${DDRAGON_BASE_URL}/cdn/${version}/data/${locale}/champion.json`),
  async getChampionDetail(version: string, championId: string, locale = "en_US") {
    const response = await fetchJson<ChampionDetailResponse>(`${DDRAGON_BASE_URL}/cdn/${version}/data/${locale}/champion/${championId}.json`);
    return response.data[championId];
  },
  getItemSummary: (version: string, locale = "fr_FR") =>
    fetchJson<ItemResponse>(`${DDRAGON_BASE_URL}/cdn/${version}/data/${locale}/item.json`),
  getChampionIconUrl: (version: string, championId: string) => `${DDRAGON_BASE_URL}/cdn/${version}/img/champion/${championId}.png`,
  getChampionSplashUrl: (championId: string) => `${DDRAGON_BASE_URL}/cdn/img/champion/splash/${championId}_0.jpg`,
  getItemIconUrl: (version: string, itemId: string | number) => `${DDRAGON_BASE_URL}/cdn/${version}/img/item/${itemId}.png`,
};
