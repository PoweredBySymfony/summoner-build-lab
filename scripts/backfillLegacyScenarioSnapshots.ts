import { Role, type Champion, type Item, Prisma } from "@prisma/client";
import { prisma } from "../server/src/lib/prisma.js";
import { resolveItemSlug } from "../server/src/lib/itemSlugAliases.js";
import { classifyLegacyScenarioBackfill, isLegacyStringArray } from "../server/src/lib/scenarioBackfill.js";

type ScenarioItemRef = {
  itemId: string;
  riotItemId: number;
  itemSlug: string;
};

type ScenarioChampionRef = {
  championId: string;
  riotChampionId: number | null;
  championKey: string | null;
  championSlug: string;
  role: Role | null;
  items: ScenarioItemRef[];
  note?: string;
};

const slotOrder: Role[] = [Role.TOP, Role.JUNGLE, Role.MID, Role.ADC, Role.SUPPORT];

const defaultItemSlugsByRole: Record<Role, string[]> = {
  TOP: ["plated-steelcaps", "sunfire-aegis"],
  JUNGLE: ["plated-steelcaps", "black-cleaver"],
  MID: ["zhonyas-hourglass", "shadowflame"],
  ADC: ["infinity-edge", "bloodthirster"],
  SUPPORT: ["locket-of-the-iron-solari", "knights-vow"],
  FLEX: [],
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function notNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

async function buildItemRefIndex() {
  const items = await prisma.item.findMany({
    select: { id: true, riotItemId: true, slug: true },
  });

  const index = new Map<string, ScenarioItemRef>();
  for (const item of items) {
    const ref = {
      itemId: item.id,
      riotItemId: item.riotItemId,
      itemSlug: item.slug,
    } satisfies ScenarioItemRef;

    index.set(item.slug, ref);
    index.set(item.id, ref);
    index.set(String(item.riotItemId), ref);
  }

  return index;
}

async function buildChampionIndex() {
  const champions = await prisma.champion.findMany({
    select: { id: true, riotChampionId: true, championKey: true, slug: true, rolePrimary: true },
  });

  return new Map(champions.map((champion) => [champion.slug, champion]));
}

function resolveItemRef(itemRefIndex: Map<string, ScenarioItemRef>, raw: string): ScenarioItemRef | null {
  return itemRefIndex.get(raw) ?? itemRefIndex.get(resolveItemSlug(raw)) ?? null;
}

function inferTeamSlots(
  championEntries: Array<Pick<Champion, "slug" | "rolePrimary"> | null>,
  playerChampionSlug: string,
  playerRole: Role,
) {
  const assigned = new Set<Role>();
  const resolved: Array<Role | null> = new Array(championEntries.length).fill(null);

  championEntries.forEach((champion, index) => {
    if (champion?.slug === playerChampionSlug) {
      resolved[index] = playerRole;
      assigned.add(playerRole);
    }
  });

  championEntries.forEach((champion, index) => {
    if (resolved[index] || !champion?.rolePrimary || assigned.has(champion.rolePrimary)) {
      return;
    }

    resolved[index] = champion.rolePrimary;
    assigned.add(champion.rolePrimary);
  });

  const remainingSlots = slotOrder.filter((slot) => !assigned.has(slot));
  resolved.forEach((slot, index) => {
    if (slot) {
      return;
    }

    resolved[index] = remainingSlots.shift() ?? null;
  });

  return resolved;
}

async function main() {
  const [itemRefIndex, championIndex, scenarios] = await Promise.all([
    buildItemRefIndex(),
    buildChampionIndex(),
    prisma.puzzleScenario.findMany({
      select: {
        id: true,
        playerRole: true,
        currentBuild: true,
        allyTeam: true,
        enemyTeam: true,
        allyItems: true,
        enemyItems: true,
        playerChampion: { select: { slug: true } },
      },
    }),
  ]);

  let updated = 0;

  for (const scenario of scenarios) {
    const backfillTargets = classifyLegacyScenarioBackfill({
      allyTeam: scenario.allyTeam,
      enemyTeam: scenario.enemyTeam,
      currentBuild: scenario.currentBuild,
    });

    if (!backfillTargets.shouldUpdate) {
      continue;
    }

    const allySlugs = backfillTargets.rebuildAllyTeam && isLegacyStringArray(scenario.allyTeam) ? scenario.allyTeam : [];
    const enemySlugs = backfillTargets.rebuildEnemyTeam && isLegacyStringArray(scenario.enemyTeam) ? scenario.enemyTeam : [];
    const buildSlugs = isLegacyStringArray(scenario.currentBuild) ? scenario.currentBuild : [];
    const enemyVisibleSlugs = Array.isArray(scenario.enemyItems) && scenario.enemyItems.every((entry) => typeof entry === "string")
      ? (scenario.enemyItems as string[])
      : [];

    const allyChampions = allySlugs.map((slug) => championIndex.get(slug) ?? null);
    const enemyChampions = enemySlugs.map((slug) => championIndex.get(slug) ?? null);
    const allyRoles = inferTeamSlots(allyChampions, scenario.playerChampion.slug, scenario.playerRole);
    const enemyRoles = inferTeamSlots(enemyChampions, "__enemy__", scenario.playerRole);

    const serializedCurrentBuild =
      buildSlugs
        .map((slug) => resolveItemRef(itemRefIndex, slug))
        .filter(notNull);

    const fallbackCurrentBuild =
      defaultItemSlugsByRole[scenario.playerRole]
        .map((slug) => resolveItemRef(itemRefIndex, slug))
        .filter(notNull);

    const currentBuild = serializedCurrentBuild.length > 0 ? serializedCurrentBuild : fallbackCurrentBuild;

    const buildMember = (
      champion: Pick<Champion, "id" | "riotChampionId" | "championKey" | "slug" | "rolePrimary"> | null,
      fallbackSlug: string,
      role: Role | null,
      itemRefs: ScenarioItemRef[],
    ): ScenarioChampionRef => ({
      championId: champion?.id ?? fallbackSlug,
      riotChampionId: champion?.riotChampionId ?? null,
      championKey: champion?.championKey ?? null,
      championSlug: champion?.slug ?? fallbackSlug,
      role,
      items: itemRefs,
    });

    const rebuiltAllyTeam = allySlugs.map((slug, index) => {
      const champion = allyChampions[index];
      const role = allyRoles[index];
      const isPlayer = slug === scenario.playerChampion.slug;
      const items = isPlayer
        ? currentBuild
        : ((role ? defaultItemSlugsByRole[role] : [])
            .map((itemSlug) => resolveItemRef(itemRefIndex, itemSlug))
            .filter(notNull));

      return buildMember(champion, slug, role, items);
    });

    const rebuiltEnemyTeam = enemySlugs.map((slug, index) => {
      const champion = enemyChampions[index];
      const role = enemyRoles[index];
      const defaultItems = (role ? defaultItemSlugsByRole[role] : [])
        .map((itemSlug) => resolveItemRef(itemRefIndex, itemSlug))
        .filter(notNull);
      return buildMember(champion, slug, role, defaultItems);
    });

    if (enemyVisibleSlugs.length > 0 && rebuiltEnemyTeam.length > 0) {
      const extraVisibleItems = enemyVisibleSlugs
        .map((slug) => resolveItemRef(itemRefIndex, slug))
        .filter(notNull);

      const supportIndex = rebuiltEnemyTeam.findIndex((member) => member.role === Role.SUPPORT);
      const targetIndex = supportIndex >= 0 ? supportIndex : rebuiltEnemyTeam.length - 1;
      rebuiltEnemyTeam[targetIndex] = {
        ...rebuiltEnemyTeam[targetIndex],
        items: unique([
          ...extraVisibleItems.map((item) => item.itemSlug),
          ...rebuiltEnemyTeam[targetIndex].items.map((item) => item.itemSlug),
        ])
          .map((slug) => resolveItemRef(itemRefIndex, slug))
          .filter(notNull),
      };
    }

    const data: Prisma.PuzzleScenarioUpdateInput = {};

    if (backfillTargets.rebuildCurrentBuild) {
      data.currentBuild = currentBuild as Prisma.InputJsonValue;
    }

    if (backfillTargets.rebuildAllyTeam) {
      data.allyTeam = rebuiltAllyTeam as Prisma.InputJsonValue;
      data.allyItems = rebuiltAllyTeam as Prisma.InputJsonValue;
    } else if (!Array.isArray(scenario.allyItems) || scenario.allyItems.length === 0) {
      data.allyItems = scenario.allyTeam as Prisma.InputJsonValue;
    }

    if (backfillTargets.rebuildEnemyTeam) {
      data.enemyTeam = rebuiltEnemyTeam as Prisma.InputJsonValue;
      data.enemyItems = rebuiltEnemyTeam as Prisma.InputJsonValue;
    } else if (!Array.isArray(scenario.enemyItems) || scenario.enemyItems.length === 0) {
      data.enemyItems = scenario.enemyTeam as Prisma.InputJsonValue;
    }

    await prisma.puzzleScenario.update({
      where: { id: scenario.id },
      data,
    });

    updated += 1;
  }

  console.log(`Backfilled ${updated} legacy puzzle scenarios.`);
}

main()
  .catch((error) => {
    console.error("Legacy scenario backfill failed.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
