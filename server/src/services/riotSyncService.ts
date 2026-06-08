import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { dataDragonClient } from "../lib/gameData/dataDragonClient.js";
import {
  compareCanonicalItemCandidates,
  deriveBootItemIds,
  isPurchasableCatalogItem,
} from "../lib/riot/catalogItemRules.js";
import {
  buildPublicPlayerProfile,
  collectPublicProfileItemIds,
} from "../lib/riot/publicPlayerProfile.js";
import { riotApiClient } from "../lib/riot/riotApiClient.js";
import { type RiotImportInput } from "../lib/riot/riotBatch.js";
import {
  resolveImportIdentity as resolveRiotImportIdentity,
  resolveLeagueIdentity,
  upsertIndexedAccount,
  type ResolvedImportIdentity,
} from "../lib/riot/riotIdentity.js";
import { slugify } from "../lib/slug.js";
import {
  importMatchForIdentityInternal,
  importRecentMatchesInternal,
  type RiotImportSourceContext,
} from "../lib/riot/matchImportRunner.js";

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

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;|&#160;/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("\u00a0", " ");
}

function formatItemDescription(input: string) {
  return decodeHtmlEntities(
    input
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(mainText|stats)>/gi, "\n")
      .replace(/<(mainText|stats)>/gi, "")
      .replace(/<li>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
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
    const derivedBootItemIds = deriveBootItemIds(items);
    const purchasableItems = items.filter(([itemId, item]) => isPurchasableCatalogItem(Number(itemId), item));
    const canonicalItems = new Map<string, (typeof purchasableItems)[number]>();

    for (const entry of purchasableItems) {
      const existing = canonicalItems.get(entry[1].name);
      if (!existing || compareCanonicalItemCandidates(entry, existing) < 0) {
        canonicalItems.set(entry[1].name, entry);
      }
    }

    const canonicalEntries = [...canonicalItems.values()];
    const canonicalItemIds = canonicalEntries.map(([itemId]) => Number(itemId));

    for (const [itemId, item] of canonicalEntries) {
      const numericItemId = Number(itemId);
      const slug = await buildUniqueItemSlug(numericItemId, item.name);
      await prisma.item.upsert({
        where: { riotItemId: numericItemId },
        update: {
          name: item.name,
          slug,
          shortDescription: decodeHtmlEntities((item.plaintext || "").trim()),
          fullDescription: formatItemDescription(item.description || ""),
          image: dataDragonClient.getItemIconUrl(resolvedVersion, itemId),
          goldTotal: item.gold.total,
          goldBase: item.gold.base,
          goldSell: item.gold.sell,
          category: detectCategory(item.tags),
          tags: item.tags ?? [],
          stats: item.stats ?? {},
          activeEffect: null,
          passiveEffect: null,
          buildsFrom: item.from ?? [],
          buildsInto: item.into ?? [],
          mapAvailability: item.maps ?? null,
          isBoots: derivedBootItemIds.has(numericItemId),
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
          shortDescription: decodeHtmlEntities((item.plaintext || "").trim()),
          fullDescription: formatItemDescription(item.description || ""),
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
          isBoots: derivedBootItemIds.has(numericItemId),
          isLegendary: item.gold.total >= 2200,
          isConsumable: item.consumed ?? false,
          isTrinket: item.tags?.includes("Trinket") ?? false,
          isStarter: item.tags?.includes("Lane") ?? false,
          isActive: item.gold.purchasable && item.inStore !== false,
          activeEffect: null,
          passiveEffect: null,
          patch: resolvedVersion,
        },
      });
    }

    const cleanup = await prisma.item.deleteMany({
      where: {
        AND: [
          {
            riotItemId: {
              notIn: canonicalItemIds,
            },
          },
          {
            puzzleChoices: {
              none: {},
            },
          },
        ],
      },
    });

    await prisma.item.updateMany({
      where: {
        riotItemId: {
          notIn: canonicalItemIds,
        },
      },
      data: {
        isActive: false,
      },
    });

    return {
      version: resolvedVersion,
      count: canonicalEntries.length,
      removedNonStandardCount: cleanup.count,
    };
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
    const result = await importRecentMatchesInternal(userId, puuid, count);
    return prisma.importedMatch.findMany({
      where: {
        riotMatchId: {
          in: result.matches
            .filter((match) => match.timelineMissingReason !== "target-participant-missing")
            .map((match) => match.riotMatchId),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async importRecentMatchesDetailed(userId: string, puuid: string, count = 5) {
    return importRecentMatchesInternal(userId, puuid, count);
  },

  async resolveImportIdentity(input: RiotImportInput) {
    return resolveRiotImportIdentity(input);
  },

  async importMatchForIdentity(
    userId: string,
    matchId: string,
    identity: ResolvedImportIdentity,
    options: Omit<RiotImportSourceContext, "syncPlayerProfile"> = {},
  ) {
    return importMatchForIdentityInternal(identity, {
      userId,
      matchId,
      sourceKind: options.sourceKind,
      sourceMetadata: options.sourceMetadata,
      skipExistingWithDifferentTarget: options.skipExistingWithDifferentTarget,
    });
  },

  async getPublicPlayerProfile(gameName: string, tagLine: string, count = 5) {
    const { account, summoner, region, platform } = await resolveLeagueIdentity(gameName, tagLine);
    const matchIds = await riotApiClient.getMatchIdsByPuuidOnRegion(account.puuid, region, count);
    const matches = await Promise.all(matchIds.map((matchId) => riotApiClient.getMatchByIdOnRegion(matchId, region)));
    const latestVersion = await dataDragonClient.getLatestVersion();

    const allItemIds = collectPublicProfileItemIds(matches, account.puuid);

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

    const profileProjection = buildPublicPlayerProfile({
      account,
      summoner,
      region,
      platform,
      matches,
      itemIndex,
      getItemIconUrl: (riotItemId) => dataDragonClient.getItemIconUrl(latestVersion, riotItemId),
    });
    await Promise.all(
      matches.flatMap((match) => {
        const info = match.info as { participants?: Array<Record<string, unknown>> } | undefined;
        return (info?.participants ?? [])
          .filter((entry) => typeof entry.puuid === "string" && typeof entry.riotIdGameName === "string" && typeof entry.riotIdTagline === "string")
          .map((entry) => upsertIndexedAccount({
            puuid: entry.puuid as string,
            gameName: entry.riotIdGameName as string,
            tagLine: entry.riotIdTagline as string,
          }));
      }),
    );

    return profileProjection;
  },
};
