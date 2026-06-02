import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { HttpError } from "../../utils/http.js";
import { riotApiClient } from "./riotApiClient.js";
import {
  RIOT_REGIONS,
  getPlatformSearchOrder,
  type RiotPlatform,
  type RiotRegion,
} from "./routing.js";
import type { RiotImportInput } from "./riotBatch.js";

export type ResolvedImportIdentity = {
  puuid: string;
  gameName: string | null;
  tagLine: string | null;
  region: RiotRegion;
  platform: RiotPlatform;
};

export function normalizeRiotId(gameName: string, tagLine: string) {
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

async function resolvePlatformForPuuid(
  puuid: string,
  tagLine?: string | null,
  preferredPlatform?: string | null,
) {
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

export async function upsertIndexedAccount(input: {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform?: string | null;
  region?: string | null;
  profileIconId?: number | null;
  summonerLevel?: number | null;
}) {
  const existing = await prisma.riotAccountIndex.findUnique({
    where: { puuid: input.puuid },
  });

  try {
    await prisma.riotAccountIndex.upsert({
      where: { puuid: input.puuid },
      update: {
        gameName: input.gameName,
        tagLine: input.tagLine,
        normalizedRiotId: normalizeRiotId(input.gameName, input.tagLine),
        platform: input.platform ?? existing?.platform ?? null,
        region: input.region ?? existing?.region ?? null,
        profileIconId: input.profileIconId ?? existing?.profileIconId ?? null,
        summonerLevel: input.summonerLevel ?? existing?.summonerLevel ?? null,
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
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const conflicting = await prisma.riotAccountIndex.findFirst({
        where: {
          gameName: input.gameName,
          tagLine: input.tagLine,
        },
      });

      if (conflicting) {
        await prisma.riotAccountIndex.update({
          where: { puuid: conflicting.puuid },
          data: {
            normalizedRiotId: normalizeRiotId(input.gameName, input.tagLine),
            platform: input.platform ?? conflicting.platform ?? null,
            region: input.region ?? conflicting.region ?? null,
            profileIconId: input.profileIconId ?? conflicting.profileIconId ?? null,
            summonerLevel: input.summonerLevel ?? conflicting.summonerLevel ?? null,
            lastSeenAt: new Date(),
          },
        });
        return;
      }
    }

    throw error;
  }
}

export async function resolveLeagueIdentity(gameName: string, tagLine: string) {
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

export async function resolveImportIdentity(input: RiotImportInput): Promise<ResolvedImportIdentity> {
  if (input.type === "riot-id") {
    const resolved = await resolveLeagueIdentity(input.gameName, input.tagLine);
    return {
      puuid: resolved.account.puuid,
      gameName: resolved.account.gameName,
      tagLine: resolved.account.tagLine,
      region: resolved.region,
      platform: resolved.platform,
    };
  }

  let indexed = await prisma.riotAccountIndex.findUnique({
    where: { puuid: input.puuid },
  });

  if ((!indexed?.region || !indexed?.platform) && indexed?.gameName && indexed?.tagLine) {
    await resolveLeagueIdentity(indexed.gameName, indexed.tagLine);
    indexed = await prisma.riotAccountIndex.findUnique({ where: { puuid: input.puuid } });
  }

  if (indexed?.region && indexed?.platform) {
    return {
      puuid: indexed.puuid,
      gameName: indexed.gameName,
      tagLine: indexed.tagLine,
      region: indexed.region as RiotRegion,
      platform: indexed.platform as RiotPlatform,
    };
  }

  const resolved = await resolvePlatformForPuuid(input.puuid, indexed?.tagLine, indexed?.platform);
  if (indexed?.gameName && indexed?.tagLine) {
    await upsertIndexedAccount({
      puuid: input.puuid,
      gameName: indexed.gameName,
      tagLine: indexed.tagLine,
      platform: resolved.platform,
      region: resolved.region,
      profileIconId: resolved.summoner.profileIconId ?? null,
      summonerLevel: resolved.summoner.summonerLevel ?? null,
    });
  }

  return {
    puuid: input.puuid,
    gameName: indexed?.gameName ?? null,
    tagLine: indexed?.tagLine ?? null,
    region: resolved.region,
    platform: resolved.platform,
  };
}
