import { riotApiClient } from "../lib/riot/riotApiClient.js";

export const riotSyncService = {
  getAccountProfile: async (gameName: string, tagLine: string) => {
    const account = await riotApiClient.getAccountByRiotId(gameName, tagLine);
    const summoner = await riotApiClient.getSummonerByPuuid(account.puuid);

    return {
      account,
      summoner,
    };
  },
  getRecentMatches: async (puuid: string, count = 5) => {
    const ids = await riotApiClient.getMatchIdsByPuuid(puuid, count);
    const matches = await Promise.all(ids.map((matchId) => riotApiClient.getMatchById(matchId)));

    return {
      ids,
      matches,
    };
  },
};
