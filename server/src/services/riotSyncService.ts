import { Prisma, Role } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { dataDragonClient } from "../lib/gameData/dataDragonClient.js";
import { riotApiClient } from "../lib/riot/riotApiClient.js";
import { slugify } from "../lib/slug.js";

const roleMap: Record<string, Role[]> = {
  Fighter: [Role.TOP, Role.JUNGLE],
  Tank: [Role.TOP, Role.SUPPORT],
  Mage: [Role.MID],
  Assassin: [Role.MID, Role.JUNGLE],
  Marksman: [Role.ADC],
  Support: [Role.SUPPORT],
};

function inferRoles(tags: string[]) {
  const flattened = tags.flatMap((tag) => roleMap[tag] ?? []);
  return flattened.length ? flattened : [Role.FLEX];
}

function stripHtml(input: string) {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function detectCategory(tags: string[] = []) {
  if (tags.includes("Boots")) return "boots";
  if (tags.includes("CriticalStrike")) return "crit";
  if (tags.includes("Armor") || tags.includes("SpellBlock")) return "defensive";
  if (tags.includes("SpellDamage")) return "mage";
  if (tags.includes("Lane")) return "starter";
  if (tags.includes("Trinket")) return "trinket";
  if (tags.includes("Health") || tags.includes("HealthRegen")) return "tank";
  if (tags.includes("Damage") || tags.includes("AttackSpeed")) return "fighter";
  return tags[0]?.toLowerCase() ?? "utility";
}

function clampNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

async function buildUniqueItemSlug(riotItemId: number, name: string) {
  const base = slugify(name);
  const existing = await prisma.item.findFirst({
    where: {
      slug: base,
      NOT: { riotItemId },
    },
    select: { id: true },
  });

  return existing ? `${base}-${riotItemId}` : base;
}

export const riotSyncService = {
  async syncChampions(version?: string) {
    const resolvedVersion = version ?? (await dataDragonClient.getLatestVersion());
    const summary = await dataDragonClient.getChampionSummary(resolvedVersion);
    const champions = Object.values(summary.data);

    for (const champion of champions) {
      const roles = inferRoles(champion.tags);
      await prisma.champion.upsert({
        where: { slug: slugify(champion.name) },
        update: {
          riotChampionId: Number(champion.key),
          championKey: champion.id,
          name: champion.name,
          title: champion.title,
          rolePrimary: roles[0],
          roleSecondary: roles[1],
          image: dataDragonClient.getChampionIconUrl(resolvedVersion, champion.id),
          iconImage: dataDragonClient.getChampionIconUrl(resolvedVersion, champion.id),
          splashImage: dataDragonClient.getChampionSplashUrl(champion.id),
          tags: champion.tags,
          stats: champion.stats,
          isActive: true,
          patch: resolvedVersion,
        },
        create: {
          riotChampionId: Number(champion.key),
          championKey: champion.id,
          name: champion.name,
          slug: slugify(champion.name),
          title: champion.title,
          rolePrimary: roles[0],
          roleSecondary: roles[1],
          image: dataDragonClient.getChampionIconUrl(resolvedVersion, champion.id),
          iconImage: dataDragonClient.getChampionIconUrl(resolvedVersion, champion.id),
          splashImage: dataDragonClient.getChampionSplashUrl(champion.id),
          tags: champion.tags,
          stats: champion.stats,
          isActive: true,
          patch: resolvedVersion,
        },
      });
    }

    return { version: resolvedVersion, count: champions.length };
  },

  async syncItems(version?: string) {
    const resolvedVersion = version ?? (await dataDragonClient.getLatestVersion());
    const summary = await dataDragonClient.getItemSummary(resolvedVersion);
    const items = Object.entries(summary.data);

    for (const [itemId, item] of items) {
      const numericItemId = Number(itemId);
      const slug = await buildUniqueItemSlug(numericItemId, item.name);
      await prisma.item.upsert({
        where: { riotItemId: numericItemId },
        update: {
          name: item.name,
          slug,
          shortDescription: stripHtml(item.plaintext || item.description || ""),
          fullDescription: stripHtml(item.description || ""),
          image: dataDragonClient.getItemIconUrl(resolvedVersion, itemId),
          goldTotal: item.gold.total,
          goldBase: item.gold.base,
          goldSell: item.gold.sell,
          category: detectCategory(item.tags),
          tags: item.tags ?? [],
          stats: item.stats ?? {},
          activeEffect: undefined,
          passiveEffect: undefined,
          buildsFrom: item.from ?? [],
          buildsInto: item.into ?? [],
          mapAvailability: item.maps ?? null,
          isBoots: item.tags?.includes("Boots") ?? false,
          isLegendary: item.gold.total >= 2200,
          isConsumable: item.consumed ?? false,
          isTrinket: item.tags?.includes("Trinket") ?? false,
          isStarter: item.tags?.includes("Lane") ?? false,
          isActive: item.gold.purchasable && item.inStore !== false,
          patch: resolvedVersion,
        },
        create: {
          riotItemId: numericItemId,
          name: item.name,
          slug,
          shortDescription: stripHtml(item.plaintext || item.description || ""),
          fullDescription: stripHtml(item.description || ""),
          image: dataDragonClient.getItemIconUrl(resolvedVersion, itemId),
          goldTotal: item.gold.total,
          goldBase: item.gold.base,
          goldSell: item.gold.sell,
          category: detectCategory(item.tags),
          tags: item.tags ?? [],
          stats: item.stats ?? {},
          buildsFrom: item.from ?? [],
          buildsInto: item.into ?? [],
          mapAvailability: item.maps ?? null,
          isBoots: item.tags?.includes("Boots") ?? false,
          isLegendary: item.gold.total >= 2200,
          isConsumable: item.consumed ?? false,
          isTrinket: item.tags?.includes("Trinket") ?? false,
          isStarter: item.tags?.includes("Lane") ?? false,
          isActive: item.gold.purchasable && item.inStore !== false,
          patch: resolvedVersion,
        },
      });
    }

    return { version: resolvedVersion, count: items.length };
  },

  async syncAssets(version?: string) {
    const resolvedVersion = version ?? (await dataDragonClient.getLatestVersion());
    const [champions, items] = await Promise.all([prisma.champion.findMany(), prisma.item.findMany()]);

    await Promise.all([
      ...champions.map((champion) =>
        prisma.champion.update({
          where: { id: champion.id },
          data: {
            image: dataDragonClient.getChampionIconUrl(resolvedVersion, champion.championKey ?? champion.name),
            iconImage: dataDragonClient.getChampionIconUrl(resolvedVersion, champion.championKey ?? champion.name),
            splashImage: dataDragonClient.getChampionSplashUrl(champion.championKey ?? champion.name),
            patch: resolvedVersion,
          },
        }),
      ),
      ...items.map((item) =>
        prisma.item.update({
          where: { id: item.id },
          data: {
            image: dataDragonClient.getItemIconUrl(resolvedVersion, item.riotItemId),
            patch: resolvedVersion,
          },
        }),
      ),
    ]);

    return { version: resolvedVersion, championCount: champions.length, itemCount: items.length };
  },

  async syncAll(version?: string) {
    const resolvedVersion = version ?? (await dataDragonClient.getLatestVersion());
    const champions = await this.syncChampions(resolvedVersion);
    const items = await this.syncItems(resolvedVersion);
    const assets = await this.syncAssets(resolvedVersion);
    return { version: resolvedVersion, champions, items, assets };
  },

  async getAccountProfile(gameName: string, tagLine: string) {
    const account = await riotApiClient.getAccountByRiotId(gameName, tagLine);
    const summoner = await riotApiClient.getSummonerByPuuid(account.puuid);

    return {
      account,
      summoner,
    };
  },

  async importRecentMatches(userId: string, puuid: string, count = 5) {
    const ids = await riotApiClient.getMatchIdsByPuuid(puuid, count);
    const matches = await Promise.all(ids.map((matchId) => riotApiClient.getMatchById(matchId)));

    const imported = [];
    for (const match of matches) {
      const metadata = match.metadata as { matchId?: string; participants?: string[] };
      const info = match.info as { gameVersion?: string; participants?: Array<Record<string, unknown>> };
      const participant = info.participants?.find((entry) => entry.puuid === puuid);
      const championSlug = slugify(String(participant?.championName ?? ""));
      const created = await prisma.importedMatch.upsert({
        where: { riotMatchId: metadata.matchId ?? crypto.randomUUID() },
        update: {
          patch: info.gameVersion?.split(".").slice(0, 2).join("."),
          matchData: {
            raw: match,
            playerChampionSlug: championSlug,
          } as Prisma.InputJsonValue,
        },
        create: {
          userId,
          riotMatchId: metadata.matchId ?? crypto.randomUUID(),
          patch: info.gameVersion?.split(".").slice(0, 2).join("."),
          matchData: {
            raw: match,
            playerChampionSlug: championSlug,
          } as Prisma.InputJsonValue,
        },
      });
      imported.push(created);
    }

    await prisma.playerProfile.upsert({
      where: { userId },
      update: {
        riotPuuid: puuid,
        lastSyncAt: new Date(),
      },
      create: {
        userId,
        riotPuuid: puuid,
        lastSyncAt: new Date(),
      },
    });

    return imported;
  },

  async getPublicPlayerProfile(gameName: string, tagLine: string, count = 5) {
    const account = await riotApiClient.getAccountByRiotId(gameName, tagLine);
    const summoner = await riotApiClient.getSummonerByPuuid(account.puuid);
    const matchIds = await riotApiClient.getMatchIdsByPuuid(account.puuid, count);
    const matches = await Promise.all(matchIds.map((matchId) => riotApiClient.getMatchById(matchId)));

    const recentMatches = matches
      .map((match) => {
        const metadata = match.metadata as { matchId?: string } | undefined;
        const info = match.info as {
          gameCreation?: number;
          gameDuration?: number;
          queueId?: number;
          participants?: Array<Record<string, unknown>>;
        } | undefined;
        const participant = info?.participants?.find((entry) => entry.puuid === account.puuid);
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
        const teamId = clampNumber(participant.teamId);
        const teamParticipants = (info?.participants ?? []).filter((entry) => entry.teamId === teamId);
        const teamKills = teamParticipants.reduce((sum, entry) => sum + clampNumber(entry.kills), 0);
        const killParticipation = teamKills > 0 ? ((kills + assists) / teamKills) * 100 : 0;

        return {
          matchId: metadata?.matchId ?? "",
          championName: String(participant.championName ?? "Unknown"),
          result: Boolean(participant.win) ? "Win" : "Loss",
          kills,
          deaths,
          assists,
          kda: round((kills + assists) / Math.max(1, deaths), 2),
          cs: totalCs,
          damageToChampions: totalDamageDealtToChampions,
          killParticipation: round(killParticipation, 1),
          queueId: info?.queueId ?? null,
          gameCreation: info?.gameCreation ? new Date(info.gameCreation).toISOString() : null,
          gameDurationSeconds: info?.gameDuration ?? null,
        };
      })
      .filter((match): match is NonNullable<typeof match> => Boolean(match));

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
      }),
      { kills: 0, deaths: 0, assists: 0, cs: 0, damage: 0, kp: 0 },
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
        riotId: `${account.gameName}#${account.tagLine}`,
        gameName: account.gameName,
        tagLine: account.tagLine,
        puuid: account.puuid,
        summonerLevel: summoner.summonerLevel ?? null,
        profileIconId: summoner.profileIconId ?? null,
        region: env.RIOT_REGION,
      },
      summary: {
        matchesAnalyzed: recentMatches.length,
        wins,
        losses,
        winRate: recentMatches.length ? round((wins / recentMatches.length) * 100, 1) : 0,
        averageKda: round((totals.kills + totals.assists) / Math.max(1, totals.deaths), 2),
        averageCs: recentMatches.length ? round(totals.cs / recentMatches.length, 1) : 0,
        averageKillParticipation: recentMatches.length ? round(totals.kp / recentMatches.length, 1) : 0,
        averageDamageToChampions: recentMatches.length ? Math.round(totals.damage / recentMatches.length) : 0,
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
  },
};
