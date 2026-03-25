import { Prisma, Role } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { dataDragonClient } from "../lib/gameData/dataDragonClient.js";
import { riotApiClient } from "../lib/riot/riotApiClient.js";
import { RIOT_REGIONS, getPlatformSearchOrder, type RiotPlatform, type RiotRegion } from "../lib/riot/routing.js";
import { slugify } from "../lib/slug.js";
import { HttpError } from "../utils/http.js";

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

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizeRiotId(gameName: string, tagLine: string) {
  return `${gameName.trim().toLowerCase()}#${tagLine.trim().toUpperCase()}`;
}

async function findAccountAcrossRegions(gameName: string, tagLine: string) {
  let lastNotFound: HttpError | null = null;

  for (const region of RIOT_REGIONS) {
    try {
      const account = await riotApiClient.getAccountByRiotIdOnRegion(gameName, tagLine, region);
      return { account, accountRegion: region };
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        lastNotFound = error;
        continue;
      }

      throw error;
    }
  }

  throw lastNotFound ?? new HttpError(404, "Riot account not found.");
}

async function resolvePlatformForPuuid(puuid: string, tagLine?: string | null, preferredPlatform?: string | null) {
  const orderedPlatforms = preferredPlatform
    ? [preferredPlatform as RiotPlatform, ...getPlatformSearchOrder(tagLine)]
    : getPlatformSearchOrder(tagLine);

  let lastNotFound: HttpError | null = null;
  for (const platform of orderedPlatforms) {
    try {
      const summoner = await riotApiClient.getSummonerByPuuidOnPlatform(puuid, platform);
      return { platform, region: riotApiClient.getRegionForPlatform(platform), summoner };
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        lastNotFound = error;
        continue;
      }

      throw error;
    }
  }

  throw lastNotFound ?? new HttpError(404, "League of Legends summoner not found for this Riot account.");
}

async function upsertIndexedAccount(input: {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform?: string | null;
  region?: string | null;
  profileIconId?: number | null;
  summonerLevel?: number | null;
}) {
  await prisma.riotAccountIndex.upsert({
    where: { puuid: input.puuid },
    update: {
      gameName: input.gameName,
      tagLine: input.tagLine,
      normalizedRiotId: normalizeRiotId(input.gameName, input.tagLine),
      platform: input.platform ?? null,
      region: input.region ?? null,
      profileIconId: input.profileIconId ?? null,
      summonerLevel: input.summonerLevel ?? null,
      lastSeenAt: new Date(),
    },
    create: {
      puuid: input.puuid,
      gameName: input.gameName,
      tagLine: input.tagLine,
      normalizedRiotId: normalizeRiotId(input.gameName, input.tagLine),
      platform: input.platform ?? null,
      region: input.region ?? null,
      profileIconId: input.profileIconId ?? null,
      summonerLevel: input.summonerLevel ?? null,
      lastSeenAt: new Date(),
    },
  });
}

async function resolveLeagueIdentity(gameName: string, tagLine: string) {
  const cached = await prisma.riotAccountIndex.findUnique({
    where: {
      gameName_tagLine: {
        gameName,
        tagLine: tagLine.toUpperCase(),
      },
    },
  });

  const { account, accountRegion } = await findAccountAcrossRegions(gameName, tagLine);
  const resolved = await resolvePlatformForPuuid(account.puuid, account.tagLine, cached?.platform);

  await upsertIndexedAccount({
    puuid: account.puuid,
    gameName: account.gameName,
    tagLine: account.tagLine,
    platform: resolved.platform,
    region: resolved.region,
    profileIconId: resolved.summoner.profileIconId ?? null,
    summonerLevel: resolved.summoner.summonerLevel ?? null,
  });

  return {
    account,
    accountRegion,
    platform: resolved.platform,
    region: resolved.region,
    summoner: resolved.summoner,
  };
}

function resolveQueueLabel(queueId: number | null | undefined) {
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
    const { account, summoner, region, platform } = await resolveLeagueIdentity(gameName, tagLine);

    return {
      account,
      summoner,
      region,
      platform,
    };
  },

  async getPlayerAutocomplete(query: string, count = 8) {
    const normalized = query.trim();
    if (!normalized) {
      return [];
    }

    const compact = normalized.toLowerCase();
    const [gameNameQuery, rawTagLineQuery] = normalized.split("#");
    const tagLineQuery = rawTagLineQuery?.trim().toUpperCase() ?? "";

    const entries = await prisma.riotAccountIndex.findMany({
      where: {
        OR: [
          { gameName: { contains: gameNameQuery.trim(), mode: "insensitive" } },
          { normalizedRiotId: { contains: compact } },
          ...(tagLineQuery ? [{ tagLine: { contains: tagLineQuery, mode: "insensitive" as const } }] : []),
        ],
      },
      orderBy: [
        { lastSeenAt: "desc" },
      ],
      take: Math.max(count * 3, 12),
    });

    return entries
      .map((entry) => ({
        ...entry,
        riotId: `${entry.gameName}#${entry.tagLine}`,
        score: [
          entry.normalizedRiotId === compact ? 1000 : 0,
          entry.gameName.toLowerCase().startsWith(gameNameQuery.trim().toLowerCase()) ? 300 : 0,
          tagLineQuery && entry.tagLine.startsWith(tagLineQuery) ? 150 : 0,
          entry.normalizedRiotId.includes(compact) ? 75 : 0,
        ].reduce((sum, value) => sum + value, 0),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.lastSeenAt.getTime() - left.lastSeenAt.getTime();
      })
      .slice(0, count)
      .map(({ score: _score, normalizedRiotId: _normalizedRiotId, ...entry }) => entry);
  },

  async importRecentMatches(userId: string, puuid: string, count = 5) {
    const indexed = await prisma.riotAccountIndex.findUnique({ where: { puuid } });
    const region = indexed?.region as RiotRegion | undefined;
    if (!region) {
      throw new HttpError(400, "Unable to determine Riot region for this player. Open the profile first.");
    }

    const ids = await riotApiClient.getMatchIdsByPuuidOnRegion(puuid, region, count);
    const matches = await Promise.all(ids.map((matchId) => riotApiClient.getMatchByIdOnRegion(matchId, region)));

    const imported = [];
    for (const match of matches) {
      const metadata = match.metadata as { matchId?: string; participants?: string[] };
      const info = match.info as { gameVersion?: string; participants?: Array<Record<string, unknown>> };
      const participant = info.participants?.find((entry) => entry.puuid === puuid);
      await Promise.all(
        (info.participants ?? [])
          .filter((entry) => typeof entry.puuid === "string" && typeof entry.riotIdGameName === "string" && typeof entry.riotIdTagline === "string")
          .map((entry) => upsertIndexedAccount({
            puuid: String(entry.puuid),
            gameName: String(entry.riotIdGameName),
            tagLine: String(entry.riotIdTagline),
          })),
      );
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
        riotGameName: indexed?.gameName,
        riotTagLine: indexed?.tagLine,
        lastSyncAt: new Date(),
        region: region,
      },
      create: {
        userId,
        riotPuuid: puuid,
        riotGameName: indexed?.gameName,
        riotTagLine: indexed?.tagLine,
        lastSyncAt: new Date(),
        region: region,
      },
    });

    return imported;
  },

  async getPublicPlayerProfile(gameName: string, tagLine: string, count = 5) {
    const { account, summoner, region, platform } = await resolveLeagueIdentity(gameName, tagLine);
    const matchIds = await riotApiClient.getMatchIdsByPuuidOnRegion(account.puuid, region, count);
    const matches = await Promise.all(matchIds.map((matchId) => riotApiClient.getMatchByIdOnRegion(matchId, region)));

    const allItemIds = unique(
      matches.flatMap((match) => {
        const info = match.info as { participants?: Array<Record<string, unknown>> } | undefined;
        const participant = info?.participants?.find((entry) => entry.puuid === account.puuid);
        if (!participant) {
          return [];
        }

        return Array.from({ length: 7 }, (_, index) => clampNumber(participant[`item${index}`])).filter((value) => value > 0);
      }),
    );

    const itemIndex = new Map(
      (await prisma.item.findMany({
        where: {
          riotItemId: {
            in: allItemIds,
          },
        },
        select: {
          riotItemId: true,
          name: true,
          image: true,
        },
      })).map((item) => [item.riotItemId, item]),
    );

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
        const durationSeconds = clampNumber(info?.gameDuration);
        const teamId = clampNumber(participant.teamId);
        const teamParticipants = (info?.participants ?? []).filter((entry) => entry.teamId === teamId);
        const teamKills = teamParticipants.reduce((sum, entry) => sum + clampNumber(entry.kills), 0);
        const killParticipation = teamKills > 0 ? ((kills + assists) / teamKills) * 100 : 0;
        const itemIds = Array.from({ length: 7 }, (_, index) => clampNumber(participant[`item${index}`])).filter((value) => value > 0);

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
          queueLabel: resolveQueueLabel(info?.queueId ?? null),
          gameCreation: info?.gameCreation ? new Date(info.gameCreation).toISOString() : null,
          gameDurationSeconds: durationSeconds || null,
          goldEarned: clampNumber(participant.goldEarned),
          visionScore: clampNumber(participant.visionScore),
          items: itemIds.map((riotItemId) => {
            const item = itemIndex.get(riotItemId);
            return {
              riotItemId,
              name: item?.name ?? `Item ${riotItemId}`,
              icon: item?.image ?? "",
            };
          }),
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

    await Promise.all(
      matches.flatMap((match) => {
        const info = match.info as { participants?: Array<Record<string, unknown>> } | undefined;
        return (info?.participants ?? [])
          .filter((entry) => typeof entry.puuid === "string" && typeof entry.riotIdGameName === "string" && typeof entry.riotIdTagline === "string")
          .map((entry) => upsertIndexedAccount({
            puuid: String(entry.puuid),
            gameName: String(entry.riotIdGameName),
            tagLine: String(entry.riotIdTagline),
          }));
      }),
    );

    return {
      profile: {
        riotId: `${account.gameName}#${account.tagLine}`,
        gameName: account.gameName,
        tagLine: account.tagLine,
        puuid: account.puuid,
        summonerLevel: summoner.summonerLevel ?? null,
        profileIconId: summoner.profileIconId ?? null,
        region,
        platform,
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
  },
};
