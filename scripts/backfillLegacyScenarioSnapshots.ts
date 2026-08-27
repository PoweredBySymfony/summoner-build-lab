import { Role, type Champion, Prisma } from "@prisma/client";
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

type ChampionRef = Pick<Champion, "id" | "riotChampionId" | "championKey" | "slug" | "rolePrimary"> | null;

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

function resolveItemRefs(itemRefIndex: Map<string, ScenarioItemRef>, slugs: string[]) {
  return slugs
    .map((slug) => resolveItemRef(itemRefIndex, slug))
    .filter(notNull);
}

function getDefaultItemRefs(itemRefIndex: Map<string, ScenarioItemRef>, role: Role | null) {
  return role ? resolveItemRefs(itemRefIndex, defaultItemSlugsByRole[role]) : [];
}

function getLegacySlugs(value: Prisma.JsonValue, shouldRebuild: boolean) {
  return shouldRebuild && isLegacyStringArray(value) ? value : [];
}

function getLegacyStringArray(value: Prisma.JsonValue) {
  return isLegacyStringArray(value) ? value : [];
}

function getEnemyVisibleSlugs(value: Prisma.JsonValue) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? (value as string[])
    : [];
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

function buildMember(
  champion: ChampionRef,
  fallbackSlug: string,
  role: Role | null,
  itemRefs: ScenarioItemRef[],
): ScenarioChampionRef {
  return {
    championId: champion?.id ?? fallbackSlug,
    riotChampionId: champion?.riotChampionId ?? null,
    championKey: champion?.championKey ?? null,
    championSlug: champion?.slug ?? fallbackSlug,
    role,
    items: itemRefs,
  };
}

function buildAllyTeam(input: {
  allySlugs: string[];
  allyChampions: ChampionRef[];
  allyRoles: Array<Role | null>;
  playerChampionSlug: string;
  currentBuild: ScenarioItemRef[];
  itemRefIndex: Map<string, ScenarioItemRef>;
}) {
  return input.allySlugs.map((slug, index) => {
    const champion = input.allyChampions[index];
    const role = input.allyRoles[index];
    const isPlayer = slug === input.playerChampionSlug;
    const items = isPlayer ? input.currentBuild : getDefaultItemRefs(input.itemRefIndex, role);

    return buildMember(champion, slug, role, items);
  });
}

function buildEnemyTeam(input: {
  enemySlugs: string[];
  enemyChampions: ChampionRef[];
  enemyRoles: Array<Role | null>;
  itemRefIndex: Map<string, ScenarioItemRef>;
}) {
  return input.enemySlugs.map((slug, index) => {
    const champion = input.enemyChampions[index];
    const role = input.enemyRoles[index];
    return buildMember(champion, slug, role, getDefaultItemRefs(input.itemRefIndex, role));
  });
}

function mergeVisibleEnemyItems(
  enemyTeam: ScenarioChampionRef[],
  enemyVisibleSlugs: string[],
  itemRefIndex: Map<string, ScenarioItemRef>,
) {
  if (enemyVisibleSlugs.length === 0 || enemyTeam.length === 0) {
    return enemyTeam;
  }

  const extraVisibleItems = resolveItemRefs(itemRefIndex, enemyVisibleSlugs);
  const supportIndex = enemyTeam.findIndex((member) => member.role === Role.SUPPORT);
  const targetIndex = supportIndex >= 0 ? supportIndex : enemyTeam.length - 1;
  const targetMember = enemyTeam[targetIndex];

  return enemyTeam.map((member, index) => {
    if (index !== targetIndex) {
      return member;
    }

    return {
      ...targetMember,
      items: resolveItemRefs(
        itemRefIndex,
        unique([
          ...extraVisibleItems.map((item) => item.itemSlug),
          ...targetMember.items.map((item) => item.itemSlug),
        ]),
      ),
    };
  });
}

function buildBackfillData(input: {
  targets: ReturnType<typeof classifyLegacyScenarioBackfill>;
  scenario: {
    allyItems: Prisma.JsonValue;
    enemyItems: Prisma.JsonValue;
    allyTeam: Prisma.JsonValue;
    enemyTeam: Prisma.JsonValue;
  };
  currentBuild: ScenarioItemRef[];
  rebuiltAllyTeam: ScenarioChampionRef[];
  rebuiltEnemyTeam: ScenarioChampionRef[];
}) {
  const data: Prisma.PuzzleScenarioUpdateInput = {};

  if (input.targets.rebuildCurrentBuild) {
    data.currentBuild = input.currentBuild as Prisma.InputJsonValue;
  }

  if (input.targets.rebuildAllyTeam) {
    data.allyTeam = input.rebuiltAllyTeam as Prisma.InputJsonValue;
    data.allyItems = input.rebuiltAllyTeam as Prisma.InputJsonValue;
  } else if (!Array.isArray(input.scenario.allyItems) || input.scenario.allyItems.length === 0) {
    data.allyItems = input.scenario.allyTeam as Prisma.InputJsonValue;
  }

  if (input.targets.rebuildEnemyTeam) {
    data.enemyTeam = input.rebuiltEnemyTeam as Prisma.InputJsonValue;
    data.enemyItems = input.rebuiltEnemyTeam as Prisma.InputJsonValue;
  } else if (!Array.isArray(input.scenario.enemyItems) || input.scenario.enemyItems.length === 0) {
    data.enemyItems = input.scenario.enemyTeam as Prisma.InputJsonValue;
  }

  return data;
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

    const allySlugs = getLegacySlugs(scenario.allyTeam, backfillTargets.rebuildAllyTeam);
    const enemySlugs = getLegacySlugs(scenario.enemyTeam, backfillTargets.rebuildEnemyTeam);
    const buildSlugs = getLegacyStringArray(scenario.currentBuild);
    const enemyVisibleSlugs = getEnemyVisibleSlugs(scenario.enemyItems);

    const allyChampions = allySlugs.map((slug) => championIndex.get(slug) ?? null);
    const enemyChampions = enemySlugs.map((slug) => championIndex.get(slug) ?? null);
    const allyRoles = inferTeamSlots(allyChampions, scenario.playerChampion.slug, scenario.playerRole);
    const enemyRoles = inferTeamSlots(enemyChampions, "__enemy__", scenario.playerRole);

    const serializedCurrentBuild = resolveItemRefs(itemRefIndex, buildSlugs);
    const fallbackCurrentBuild = getDefaultItemRefs(itemRefIndex, scenario.playerRole);

    const currentBuild = serializedCurrentBuild.length > 0 ? serializedCurrentBuild : fallbackCurrentBuild;

    const rebuiltAllyTeam = buildAllyTeam({
      allySlugs,
      allyChampions,
      allyRoles,
      playerChampionSlug: scenario.playerChampion.slug,
      currentBuild,
      itemRefIndex,
    });
    const rebuiltEnemyTeam = mergeVisibleEnemyItems(
      buildEnemyTeam({ enemySlugs, enemyChampions, enemyRoles, itemRefIndex }),
      enemyVisibleSlugs,
      itemRefIndex,
    );
    const data = buildBackfillData({
      targets: backfillTargets,
      scenario,
      currentBuild,
      rebuiltAllyTeam,
      rebuiltEnemyTeam,
    });

    await prisma.puzzleScenario.update({
      where: { id: scenario.id },
      data,
    });

    updated += 1;
  }

  console.log(`Backfilled ${updated} legacy puzzle scenarios.`);
}

try {
  await main();
} catch (error) {
  console.error("Legacy scenario backfill failed.", error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
