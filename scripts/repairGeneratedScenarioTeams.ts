import { Role, type Champion, type Item, Prisma } from "@prisma/client";
import { prisma } from "../server/src/lib/prisma.js";
import { resolveItemSlug } from "../server/src/lib/itemSlugAliases.js";

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

type GeneratedEnemyTeamMember = {
  championSlug: string;
  role?: string;
  items?: string[];
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

const slotPools: Record<Role, string[]> = {
  TOP: ["aatrox", "camille", "ornn", "ksante", "gwen", "malphite", "darius", "renekton"],
  JUNGLE: ["vi", "viego", "lillia", "lee-sin", "sejuani", "jarvan-iv", "wukong", "maokai"],
  MID: ["ahri", "orianna", "syndra", "veigar", "viktor", "azir", "sylas", "zed"],
  ADC: ["jinx", "kaisa", "ezreal", "xayah", "ashe", "smolder", "caitlyn", "aphelios"],
  SUPPORT: ["nautilus", "leona", "thresh", "rakan", "lulu", "milio", "soraka", "rell"],
  FLEX: [],
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function notNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

function isRichTeam(value: unknown): value is ScenarioChampionRef[] {
  return Array.isArray(value) && value.some((entry) => Boolean(entry) && typeof entry === "object" && "championSlug" in entry);
}

function isTeamMissing(value: unknown) {
  return !Array.isArray(value) || value.length === 0;
}

function parseRole(value: unknown, fallback: Role) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.toUpperCase();
  return Role[normalized as keyof typeof Role] ?? fallback;
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

function buildMember(
  champion: Pick<Champion, "id" | "riotChampionId" | "championKey" | "slug"> | null,
  fallbackSlug: string,
  role: Role,
  itemRefs: ScenarioItemRef[],
  note?: string,
): ScenarioChampionRef {
  return {
    championId: champion?.id ?? fallbackSlug,
    riotChampionId: champion?.riotChampionId ?? null,
    championKey: champion?.championKey ?? null,
    championSlug: champion?.slug ?? fallbackSlug,
    role,
    items: itemRefs,
    note,
  };
}

function parseCurrentBuild(
  value: unknown,
  itemRefIndex: Map<string, ScenarioItemRef>,
  fallbackRole: Role,
) {
  const fromScenario = Array.isArray(value)
    ? value
        .map((entry) => {
          if (typeof entry === "string") {
            return resolveItemRef(itemRefIndex, entry);
          }

          if (entry && typeof entry === "object" && "itemSlug" in entry) {
            return resolveItemRef(itemRefIndex, String(entry.itemSlug));
          }

          if (entry && typeof entry === "object" && "itemId" in entry) {
            return resolveItemRef(itemRefIndex, String(entry.itemId));
          }

          if (entry && typeof entry === "object" && "riotItemId" in entry) {
            return resolveItemRef(itemRefIndex, String(entry.riotItemId));
          }

          return null;
        })
        .filter(notNull)
    : [];

  if (fromScenario.length > 0) {
    return fromScenario;
  }

  return defaultItemSlugsByRole[fallbackRole].map((slug) => resolveItemRef(itemRefIndex, slug)).filter(notNull);
}

function buildAllyTeam(
  playerChampionSlug: string,
  playerRole: Role,
  currentBuild: ScenarioItemRef[],
  championIndex: Map<string, Pick<Champion, "id" | "riotChampionId" | "championKey" | "slug" | "rolePrimary">>,
  itemRefIndex: Map<string, ScenarioItemRef>,
) {
  const used = new Set([playerChampionSlug]);

  return slotOrder.map((role) => {
    const championSlug =
      role === playerRole
        ? playerChampionSlug
        : slotPools[role].find((slug) => !used.has(slug)) ?? slotPools[role][0];
    used.add(championSlug);
    const champion = championIndex.get(championSlug) ?? null;
    const items =
      role === playerRole
        ? currentBuild
        : defaultItemSlugsByRole[role].map((slug) => resolveItemRef(itemRefIndex, slug)).filter(notNull);

    return buildMember(champion, championSlug, role, items, role === playerRole ? "Champion du joueur" : undefined);
  });
}

function buildEnemyTeam(
  rawEnemyTeam: unknown,
  championIndex: Map<string, Pick<Champion, "id" | "riotChampionId" | "championKey" | "slug" | "rolePrimary">>,
  itemRefIndex: Map<string, ScenarioItemRef>,
) {
  if (Array.isArray(rawEnemyTeam) && rawEnemyTeam.length > 0 && typeof rawEnemyTeam[0] === "object") {
    return (rawEnemyTeam as GeneratedEnemyTeamMember[]).map((member, index) => {
      const fallbackRole = slotOrder[index] ?? Role.TOP;
      const role = parseRole(member.role, fallbackRole);
      const championSlug = member.championSlug;
      const champion = championIndex.get(championSlug) ?? null;
      const items = (member.items ?? [])
        .map((itemSlug) => resolveItemRef(itemRefIndex, itemSlug))
        .filter(notNull);

      return buildMember(
        champion,
        championSlug,
        role,
        items.length > 0
          ? items
          : defaultItemSlugsByRole[role].map((slug) => resolveItemRef(itemRefIndex, slug)).filter(notNull),
      );
    });
  }

  if (Array.isArray(rawEnemyTeam) && rawEnemyTeam.every((entry) => typeof entry === "string")) {
    return (rawEnemyTeam as string[]).map((championSlug, index) => {
      const role = slotOrder[index] ?? Role.TOP;
      const champion = championIndex.get(championSlug) ?? null;
      const items = defaultItemSlugsByRole[role].map((slug) => resolveItemRef(itemRefIndex, slug)).filter(notNull);
      return buildMember(champion, championSlug, role, items);
    });
  }

  return [];
}

async function main() {
  const [itemRefIndex, championIndex, rows] = await Promise.all([
    buildItemRefIndex(),
    buildChampionIndex(),
    prisma.puzzle.findMany({
      where: {
        generatedFrom: { some: {} },
        scenario: {
          is: {
            OR: [{ allyTeam: { equals: [] } }, { enemyTeam: { equals: [] } }],
          },
        },
      },
      include: {
        champion: true,
        generatedFrom: { orderBy: { createdAt: "desc" }, take: 1 },
        scenario: {
          include: {
            playerChampion: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let repaired = 0;

  for (const puzzle of rows) {
    if (!puzzle.scenario) {
      continue;
    }

    const request = puzzle.generatedFrom[0];
    const parameters = request?.parameters;
    const playerRole = parseRole(
      parameters && typeof parameters === "object" ? (parameters as Record<string, unknown>).playerSlot ?? (parameters as Record<string, unknown>).role : undefined,
      puzzle.scenario.playerRole,
    );

    const currentBuild = parseCurrentBuild(puzzle.scenario.currentBuild, itemRefIndex, playerRole);
    const nextAllyTeam = isTeamMissing(puzzle.scenario.allyTeam)
      ? buildAllyTeam(puzzle.scenario.playerChampion.slug, playerRole, currentBuild, championIndex, itemRefIndex)
      : puzzle.scenario.allyTeam;
    const nextEnemyTeam = isTeamMissing(puzzle.scenario.enemyTeam)
      ? buildEnemyTeam(
          parameters && typeof parameters === "object" ? (parameters as Record<string, unknown>).enemyTeam : undefined,
          championIndex,
          itemRefIndex,
        )
      : puzzle.scenario.enemyTeam;

    if (!isRichTeam(nextAllyTeam) || !isRichTeam(nextEnemyTeam)) {
      continue;
    }

    await prisma.puzzleScenario.update({
      where: { id: puzzle.scenario.id },
      data: {
        allyTeam: nextAllyTeam as Prisma.InputJsonValue,
        enemyTeam: nextEnemyTeam as Prisma.InputJsonValue,
        allyItems:
          !Array.isArray(puzzle.scenario.allyItems) || puzzle.scenario.allyItems.length === 0
            ? (nextAllyTeam as Prisma.InputJsonValue)
            : undefined,
        enemyItems:
          !Array.isArray(puzzle.scenario.enemyItems) || puzzle.scenario.enemyItems.length === 0
            ? (nextEnemyTeam as Prisma.InputJsonValue)
            : undefined,
      },
    });

    repaired += 1;
  }

  console.log(`Repaired ${repaired} generated puzzle scenarios with missing teams.`);
}

main()
  .catch((error) => {
    console.error("Generated scenario team repair failed.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
