const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com";

type ChampionSummaryResponse = {
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

type ItemResponse = {
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
  getChampionSummary: (version: string) =>
    fetchJson<ChampionSummaryResponse>(`${DDRAGON_BASE_URL}/cdn/${version}/data/en_US/champion.json`),
  getItemSummary: (version: string, locale = "fr_FR") =>
    fetchJson<ItemResponse>(`${DDRAGON_BASE_URL}/cdn/${version}/data/${locale}/item.json`),
  getChampionIconUrl: (version: string, championId: string) => `${DDRAGON_BASE_URL}/cdn/${version}/img/champion/${championId}.png`,
  getChampionSplashUrl: (championId: string) => `${DDRAGON_BASE_URL}/cdn/img/champion/splash/${championId}_0.jpg`,
  getItemIconUrl: (version: string, itemId: string | number) => `${DDRAGON_BASE_URL}/cdn/${version}/img/item/${itemId}.png`,
};
