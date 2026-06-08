import type { RiotPlatform, RiotRegion } from "./routing.js";

type RiotAccountProfile = {
  gameName: string;
  tagLine: string;
  puuid: string;
};

type RiotSummonerProfile = {
  summonerLevel?: number | null;
  profileIconId?: number | null;
};

type PublicProfileItem = {
  riotItemId: number;
  name: string;
  image: string | null;
};

type RiotMatchRecord = Record<string, unknown>;

function clampNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function resolveQueueLabel(queueId: number | null | undefined) {
  switch (queueId) {
    case 420:
      return "Classée Solo/Duo";
    case 440:
      return "Classée Flex";
    case 450:
      return "ARAM";
    case 400:
      return "Draft";
    case 430:
      return "Normal";
    default:
      return queueId ? `File ${queueId}` : "File inconnue";
  }
}

export function collectPublicProfileItemIds(matches: RiotMatchRecord[], puuid: string) {
  return unique(
    matches.flatMap((match) => {
      const info = match.info as { participants?: Array<Record<string, unknown>> } | undefined;
      const participant = info?.participants?.find((entry) => entry.puuid === puuid);
      if (!participant) {
        return [];
      }

      return Array.from({ length: 7 }, (_, index) => clampNumber(participant[`item${index}`]))
        .filter((value) => value > 0);
    }),
  );
}

export function buildPublicPlayerProfile(input: {
  account: RiotAccountProfile;
  summoner: RiotSummonerProfile;
  region: RiotRegion;
  platform: RiotPlatform;
  matches: RiotMatchRecord[];
  itemIndex: Map<number, PublicProfileItem>;
  getItemIconUrl: (riotItemId: number) => string;
}) {
  const recentMatches = input.matches
    .map((match) => {
      const metadata = match.metadata as { matchId?: string } | undefined;
      const info = match.info as {
        gameCreation?: number;
        gameDuration?: number;
        queueId?: number;
        participants?: Array<Record<string, unknown>>;
      } | undefined;
      const participant = info?.participants?.find((entry) => entry.puuid === input.account.puuid);
      if (!participant) {
        return null;
      }

      const kills = clampNumber(participant.kills);
      const deaths = clampNumber(participant.deaths);
      const assists = clampNumber(participant.assists);
      const totalDamageDealtToChampions = clampNumber(participant.totalDamageDealtToChampions);
      const totalMinionsKilled = clampNumber(participant.totalMinionsKilled);
      const neutralMinionsKilled = clampNumber(participant.neutralMinionsKilled);
      const totalCs = totalMinionsKilled + neutralMinionsKilled;
      const durationSeconds = clampNumber(info?.gameDuration);
      const teamId = clampNumber(participant.teamId);
      const teamParticipants = (info?.participants ?? []).filter((entry) => entry.teamId === teamId);
      const teamKills = teamParticipants.reduce((sum, entry) => sum + clampNumber(entry.kills), 0);
      const killParticipation = teamKills > 0 ? ((kills + assists) / teamKills) * 100 : 0;
      const itemIds = Array.from({ length: 7 }, (_, index) => clampNumber(participant[`item${index}`]))
        .filter((value) => value > 0);

      return {
        matchId: metadata?.matchId ?? "",
        championName: typeof participant.championName === "string" ? participant.championName : "Unknown",
        result: participant.win ? "Win" : "Loss",
        kills,
        deaths,
        assists,
        kda: round((kills + assists) / Math.max(1, deaths), 2),
        cs: totalCs,
        damageToChampions: totalDamageDealtToChampions,
        killParticipation: round(killParticipation, 1),
        queueId: info?.queueId ?? null,
        queueLabel: resolveQueueLabel(info?.queueId ?? null),
        gameCreation: info?.gameCreation ? new Date(info.gameCreation).toISOString() : null,
        gameDurationSeconds: durationSeconds || null,
        goldEarned: clampNumber(participant.goldEarned),
        visionScore: clampNumber(participant.visionScore),
        items: itemIds.map((riotItemId) => {
          const item = input.itemIndex.get(riotItemId);
          return {
            riotItemId,
            name: item?.name ?? `Item ${riotItemId}`,
            icon: item?.image ?? input.getItemIconUrl(riotItemId),
          };
        }),
      };
    })
    .filter((match): match is NonNullable<typeof match> => match !== null);

  const wins = recentMatches.filter((match) => match.result === "Win").length;
  const losses = recentMatches.length - wins;
  const totals = recentMatches.reduce(
    (accumulator, match) => ({
      kills: accumulator.kills + match.kills,
      deaths: accumulator.deaths + match.deaths,
      assists: accumulator.assists + match.assists,
      cs: accumulator.cs + match.cs,
      damage: accumulator.damage + match.damageToChampions,
      kp: accumulator.kp + match.killParticipation,
      gold: accumulator.gold + match.goldEarned,
      vision: accumulator.vision + match.visionScore,
      duration: accumulator.duration + (match.gameDurationSeconds ?? 0),
    }),
    { kills: 0, deaths: 0, assists: 0, cs: 0, damage: 0, kp: 0, gold: 0, vision: 0, duration: 0 },
  );

  const championMap = new Map<string, { games: number; wins: number; kills: number; deaths: number; assists: number }>();
  for (const match of recentMatches) {
    const current = championMap.get(match.championName) ?? { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
    current.games += 1;
    current.wins += match.result === "Win" ? 1 : 0;
    current.kills += match.kills;
    current.deaths += match.deaths;
    current.assists += match.assists;
    championMap.set(match.championName, current);
  }

  return {
    profile: {
      riotId: `${input.account.gameName}#${input.account.tagLine}`,
      gameName: input.account.gameName,
      tagLine: input.account.tagLine,
      puuid: input.account.puuid,
      summonerLevel: input.summoner.summonerLevel ?? null,
      profileIconId: input.summoner.profileIconId ?? null,
      region: input.region,
      platform: input.platform,
    },
    summary: {
      matchesAnalyzed: recentMatches.length,
      wins,
      losses,
      winRate: recentMatches.length ? round((wins / recentMatches.length) * 100, 1) : 0,
      averageKda: round((totals.kills + totals.assists) / Math.max(1, totals.deaths), 2),
      averageCs: recentMatches.length ? round(totals.cs / recentMatches.length, 1) : 0,
      averageCsPerMinute: totals.duration > 0 ? round((totals.cs / totals.duration) * 60, 2) : 0,
      averageKillParticipation: recentMatches.length ? round(totals.kp / recentMatches.length, 1) : 0,
      averageDamageToChampions: recentMatches.length ? Math.round(totals.damage / recentMatches.length) : 0,
      averageGoldEarned: recentMatches.length ? Math.round(totals.gold / recentMatches.length) : 0,
      averageVisionScore: recentMatches.length ? round(totals.vision / recentMatches.length, 1) : 0,
      mostPlayedChampions: [...championMap.entries()]
        .map(([championName, value]) => ({
          championName,
          games: value.games,
          wins: value.wins,
          kda: round((value.kills + value.assists) / Math.max(1, value.deaths), 2),
        }))
        .sort((left, right) => right.games - left.games)
        .slice(0, 3),
    },
    recentMatches,
  };
}
