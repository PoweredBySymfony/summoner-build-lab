import type { Champion, Item, Prisma } from "@prisma/client";
import { dataDragonClient, type ChampionSummaryResponse, type ItemResponse } from "../gameData/dataDragonClient.js";
import { compareCanonicalItemCandidates, deriveBootItemIds, isPurchasableCatalogItem } from "../riot/catalogItemRules.js";
import { slugify } from "../slug.js";

export type PatchChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type PatchEntryStatus = "changed" | "new" | "unchanged" | "removed";
export type RemoteChampion = ChampionSummaryResponse["data"][string];
export type RemoteItem = ItemResponse["data"][string];

const jsonArray = (value: Prisma.JsonValue | null | undefined) => Array.isArray(value) ? value.map(String) : [];

const jsonRecord = (value: Prisma.JsonValue | null | undefined) =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const formatList = (value: string[]) => value.length ? value.join(", ") : "Aucun";

const formatRecord = (value: Record<string, unknown>) => {
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? entries.map(([key, entryValue]) => `${key}: ${String(entryValue)}`).join(", ") : "Aucune";
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const addChange = (
  changes: PatchChange[],
  field: string,
  label: string,
  beforeValue: string | number | boolean | null | undefined,
  afterValue: string | number | boolean | null | undefined,
) => {
  const before = String(beforeValue ?? "Non renseigne");
  const after = String(afterValue ?? "Non renseigne");
  if (before !== after) {
    changes.push({ field, label, before, after });
  }
};

const addArrayChange = (
  changes: PatchChange[],
  field: string,
  label: string,
  beforeValue: string[],
  afterValue: string[],
) => {
  const before = formatList([...beforeValue].sort());
  const after = formatList([...afterValue].sort());
  if (before !== after) {
    changes.push({ field, label, before, after });
  }
};

const addRecordChange = (
  changes: PatchChange[],
  field: string,
  label: string,
  beforeValue: Record<string, unknown>,
  afterValue: Record<string, unknown>,
) => {
  const before = formatRecord(beforeValue);
  const after = formatRecord(afterValue);
  if (before !== after) {
    changes.push({ field, label, before, after });
  }
};

const summarizeChanges = (changes: PatchChange[], fallback: string) => {
  if (!changes.length) {
    return [fallback];
  }

  return changes.slice(0, 3).map((change) => change.label);
};

export function diffChampionPatch(champion: Champion, remoteChampion: RemoteChampion | undefined) {
  if (!remoteChampion) {
    const change = {
      field: "availability",
      label: "Champion absent du patch cible",
      before: "Present dans le catalogue local",
      after: "Absent des donnees Data Dragon cible",
    };
    return { patchStatus: "removed" as const, changeSummary: [change.label], changes: [change] };
  }

  const changes: PatchChange[] = [];
  addChange(changes, "name", "Nom", champion.name, remoteChampion.name);
  addChange(changes, "title", "Titre", champion.title, remoteChampion.title);
  addArrayChange(changes, "tags", "Tags Riot", jsonArray(champion.tags), remoteChampion.tags ?? []);
  addRecordChange(changes, "stats", "Statistiques de base", jsonRecord(champion.stats), remoteChampion.stats ?? {});

  return {
    patchStatus: changes.length ? "changed" as const : "unchanged" as const,
    changeSummary: summarizeChanges(changes, "Patch catalogue a rafraichir sans changement de fiche detecte"),
    changes,
  };
}

export function diffItemPatch(item: Item, remoteItem: RemoteItem | undefined) {
  if (!remoteItem) {
    const change = {
      field: "availability",
      label: "Item absent du patch cible",
      before: "Present dans le catalogue local",
      after: "Absent des donnees Data Dragon cible",
    };
    return { patchStatus: "removed" as const, changeSummary: [change.label], changes: [change] };
  }

  const changes: PatchChange[] = [];
  addChange(changes, "name", "Nom", item.name, remoteItem.name);
  addChange(changes, "description", "Description courte", normalizeText(item.shortDescription), normalizeText(remoteItem.plaintext));
  addChange(changes, "goldTotal", "Cout total", item.goldTotal, remoteItem.gold.total);
  addChange(changes, "goldBase", "Cout de combinaison", item.goldBase, remoteItem.gold.base);
  addChange(changes, "goldSell", "Prix de revente", item.goldSell, remoteItem.gold.sell);
  addArrayChange(changes, "tags", "Tags Riot", jsonArray(item.tags), remoteItem.tags ?? []);
  addArrayChange(changes, "buildsFrom", "Composants", jsonArray(item.buildsFrom), remoteItem.from ?? []);
  addArrayChange(changes, "buildsInto", "Evolutions", jsonArray(item.buildsInto), remoteItem.into ?? []);
  addRecordChange(changes, "stats", "Statistiques", jsonRecord(item.stats), remoteItem.stats ?? {});
  addRecordChange(changes, "maps", "Disponibilite cartes", jsonRecord(item.mapAvailability), remoteItem.maps ?? {});
  addChange(changes, "purchasable", "Achetable", item.isActive, remoteItem.gold.purchasable && remoteItem.inStore !== false);

  return {
    patchStatus: changes.length ? "changed" as const : "unchanged" as const,
    changeSummary: summarizeChanges(changes, "Patch catalogue a rafraichir sans changement de fiche detecte"),
    changes,
  };
}

export function createNewChampionPatchDiff() {
  const change = {
    field: "availability",
    label: "Nouveau champion du patch cible",
    before: "Absent du catalogue local",
    after: "Present dans les donnees Data Dragon cible",
  };
  return { patchStatus: "new" as const, changeSummary: [change.label], changes: [change] };
}

export function createNewItemPatchDiff() {
  const change = {
    field: "availability",
    label: "Nouvel item du patch cible",
    before: "Absent du catalogue local",
    after: "Present dans les donnees Data Dragon cible",
  };
  return { patchStatus: "new" as const, changeSummary: [change.label], changes: [change] };
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

export function buildRemoteStandardItemEntries(remoteItems: Record<string, RemoteItem>) {
  const entries = Object.entries(remoteItems).filter(([itemId, item]) => isPurchasableCatalogItem(Number(itemId), item));
  const canonicalItems = new Map<string, [string, RemoteItem]>();

  for (const entry of entries) {
    const existing = canonicalItems.get(entry[1].name);
    if (!existing || compareCanonicalItemCandidates(entry, existing) < 0) {
      canonicalItems.set(entry[1].name, entry);
    }
  }

  return [...canonicalItems.values()];
}

export function countPatchStatus<T extends { patchStatus: PatchEntryStatus }>(entries: T[], status: PatchEntryStatus) {
  return entries.filter((entry) => entry.patchStatus === status).length;
}

export function buildNewChampionPatchEntry(champion: RemoteChampion, targetPatch: string) {
  return {
    id: slugify(champion.name),
    databaseId: `remote:${champion.id}`,
    riotChampionId: Number(champion.key),
    championKey: champion.id,
    name: champion.name,
    title: champion.title,
    slug: slugify(champion.name),
    icon: dataDragonClient.getChampionIconUrl(targetPatch, champion.id),
    splashImage: dataDragonClient.getChampionSplashUrl(champion.id),
    image: dataDragonClient.getChampionIconUrl(targetPatch, champion.id),
    roles: [],
    tags: champion.tags ?? [],
    stats: champion.stats ?? {},
    patch: targetPatch,
    isActive: true,
    ...createNewChampionPatchDiff(),
  };
}

export function buildNewItemPatchEntries(remoteItems: Record<string, RemoteItem>, localItemIds: Set<number>, targetPatch: string) {
  const remoteBootItemIds = deriveBootItemIds(Object.entries(remoteItems));
  return buildRemoteStandardItemEntries(remoteItems)
    .filter(([itemId]) => !localItemIds.has(Number(itemId)))
    .map(([itemId, item]) => {
      const riotItemId = Number(itemId);
      return {
        id: slugify(item.name || itemId),
        databaseId: `remote:${itemId}`,
        riotItemId,
        name: item.name || `Item ${itemId}`,
        slug: slugify(item.name || itemId),
        icon: dataDragonClient.getItemIconUrl(targetPatch, itemId),
        image: dataDragonClient.getItemIconUrl(targetPatch, itemId),
        cost: item.gold.total,
        baseCost: item.gold.base,
        sellPrice: item.gold.sell,
        category: detectCategory(item.tags),
        tags: item.tags ?? [],
        itemGroups: [],
        stats: item.stats ?? {},
        shortDescription: item.plaintext || null,
        fullDescription: item.description || null,
        activeEffect: null,
        passiveEffect: null,
        buildsFrom: item.from ?? [],
        buildsInto: item.into ?? [],
        buildsFromIcons: (item.from ?? []).map((entry) => ({
          riotItemId: Number(entry),
          icon: dataDragonClient.getItemIconUrl(targetPatch, entry),
        })),
        mapAvailability: item.maps ?? null,
        isBoots: remoteBootItemIds.has(riotItemId),
        isLegendary: item.gold.total >= 2200,
        isConsumable: item.consumed ?? false,
        isTrinket: item.tags?.includes("Trinket") ?? false,
        isStarter: item.tags?.includes("Lane") ?? false,
        isActive: item.gold.purchasable && item.inStore !== false,
        patch: targetPatch,
        ...createNewItemPatchDiff(),
      };
    });
}
