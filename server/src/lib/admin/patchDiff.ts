import type { Champion, Item, Prisma } from "@prisma/client";
import { dataDragonClient, type ChampionDetailResponse, type ChampionSummaryResponse, type ItemResponse } from "../gameData/dataDragonClient.js";
import { compareCanonicalItemCandidates, deriveBootItemIds, isPurchasableCatalogItem } from "../riot/catalogItemRules.js";
import { slugify } from "../slug.js";

export type PatchChange = {
  field: string;
  label: string;
  before: string;
  after: string;
  beforeLines?: PatchValueLine[];
  afterLines?: PatchValueLine[];
};

export type PatchEntryStatus = "changed" | "new" | "unchanged" | "removed";
export type RemoteChampion = ChampionSummaryResponse["data"][string];
export type RemoteItem = ItemResponse["data"][string];
export type PatchValueLine = {
  key: string;
  label: string;
  value: string;
  delta?: string;
  changeType?: "added" | "removed";
  item?: PatchLineItem;
};

type ItemPatchDiffOptions = {
  itemNameById?: Map<string, string>;
  itemReferenceById?: Map<string, PatchLineItem>;
};

type ChampionPatchDiffOptions = {
  localChampionDetail?: RemoteChampionDetail;
  remoteChampionDetail?: RemoteChampionDetail;
  localDisplayChampionDetail?: RemoteChampionDetail;
  remoteDisplayChampionDetail?: RemoteChampionDetail;
};

export type RemoteChampionDetail = ChampionDetailResponse["data"][string];

export type PatchLineItem = {
  id: string;
  databaseId: string;
  riotItemId: number;
  name: string;
  slug: string;
  icon: string;
  image: string;
  cost: number;
  baseCost?: number | null;
  sellPrice?: number | null;
  category?: string | null;
  tags: string[];
  itemGroups: string[];
  stats: Record<string, unknown>;
  shortDescription?: string | null;
  fullDescription?: string | null;
  activeEffect?: string | null;
  passiveEffect?: string | null;
  buildsFrom: string[];
  buildsInto: string[];
  buildsFromIcons?: Array<{ riotItemId: number; icon: string }>;
  mapAvailability?: Record<string, unknown> | null;
  isBoots: boolean;
  isLegendary: boolean;
  isConsumable: boolean;
  isTrinket: boolean;
  isStarter: boolean;
  isActive: boolean;
  patch: string;
};

type StatDescriptor = {
  label: string;
  format?: (value: unknown) => string;
  formatDelta?: (value: number) => string;
};

const parseNumericStatValue = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const formatDecimal = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
};

const toDisplayString = (value: unknown): string => {
  if (value == null) return "Non renseigne";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const formatNumber = (value: unknown) => {
  const numericValue = parseNumericStatValue(value);
  if (numericValue === null) return toDisplayString(value);
  return formatDecimal(numericValue);
};

const formatDeltaNumber = (value: number) => `${value > 0 ? "+" : ""}${formatDecimal(value)}`;

const formatPercentFromRatio = (value: unknown) => {
  const numericValue = parseNumericStatValue(value);
  if (numericValue === null) return toDisplayString(value);
  return `${Math.round(numericValue * 100)}%`;
};

const formatPercentDeltaFromRatio = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;

const championStatDescriptors: Record<string, StatDescriptor> = {
  hp: { label: "PV" },
  hpperlevel: { label: "PV par niveau" },
  mp: { label: "Mana" },
  mpperlevel: { label: "Mana par niveau" },
  movespeed: { label: "Vitesse de deplacement" },
  armor: { label: "Armure" },
  armorperlevel: { label: "Armure par niveau" },
  spellblock: { label: "Resistance magique" },
  spellblockperlevel: { label: "Resistance magique par niveau" },
  attackrange: { label: "Portee d'attaque" },
  hpregen: { label: "Regeneration de PV" },
  hpregenperlevel: { label: "Regeneration de PV par niveau" },
  mpregen: { label: "Regeneration de mana" },
  mpregenperlevel: { label: "Regeneration de mana par niveau" },
  crit: { label: "Chances de coup critique" },
  critperlevel: { label: "Chances de coup critique par niveau" },
  attackdamage: { label: "Degats d'attaque" },
  attackdamageperlevel: { label: "Degats d'attaque par niveau" },
  attackspeed: { label: "Vitesse d'attaque" },
  attackspeedperlevel: { label: "Vitesse d'attaque par niveau" },
};

const itemStatDescriptors: Record<string, StatDescriptor> = {
  FlatPhysicalDamageMod: { label: "Degats d'attaque", format: formatNumber, formatDelta: formatDeltaNumber },
  FlatMagicDamageMod: { label: "Puissance", format: formatNumber, formatDelta: formatDeltaNumber },
  FlatHPPoolMod: { label: "PV", format: formatNumber, formatDelta: formatDeltaNumber },
  FlatMPPoolMod: { label: "Mana", format: formatNumber, formatDelta: formatDeltaNumber },
  FlatArmorMod: { label: "Armure", format: formatNumber, formatDelta: formatDeltaNumber },
  FlatSpellBlockMod: { label: "Resistance magique", format: formatNumber, formatDelta: formatDeltaNumber },
  PercentAttackSpeedMod: { label: "Vitesse d'attaque", format: formatPercentFromRatio, formatDelta: formatPercentDeltaFromRatio },
  FlatCritChanceMod: { label: "Chances de coup critique", format: formatPercentFromRatio, formatDelta: formatPercentDeltaFromRatio },
  FlatMovementSpeedMod: { label: "Vitesse de deplacement", format: formatNumber, formatDelta: formatDeltaNumber },
  PercentMovementSpeedMod: { label: "Vitesse de deplacement", format: formatPercentFromRatio, formatDelta: formatPercentDeltaFromRatio },
  FlatHPRegenMod: { label: "Regeneration de PV", format: formatNumber, formatDelta: formatDeltaNumber },
  FlatMPRegenMod: { label: "Regeneration de mana", format: formatNumber, formatDelta: formatDeltaNumber },
  PercentLifeStealMod: { label: "Vol de vie", format: formatPercentFromRatio, formatDelta: formatPercentDeltaFromRatio },
};

const jsonArray = (value: Prisma.JsonValue | null | undefined) => Array.isArray(value) ? value.map(String) : [];

const jsonRecord = (value: Prisma.JsonValue | null | undefined) =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const formatList = (value: string[]) => value.length ? value.join(", ") : "Aucun";

const formatBoolean = (value: boolean) => value ? "Oui" : "Non";

const formatPurchasable = (value: boolean) =>
  value ? "Oui, disponible a l'achat en boutique" : "Non, retire de l'achat direct en boutique";

const compareText = (left: string, right: string) => left.localeCompare(right);

const compareNumericText = (left: string, right: string) => Number(left) - Number(right);

const mapAvailabilityLabels: Record<string, string> = {
  "11": "Faille de l'invocateur",
  "12": "ARAM",
  "21": "Nexus Blitz",
  "22": "Teamfight Tactics",
  "30": "Arena",
  "33": "Swarm",
};

const formatMapAvailabilityLines = (value: Record<string, unknown>) =>
  Object.entries(value)
    .sort(([left], [right]) => (mapAvailabilityLabels[left] ?? left).localeCompare(mapAvailabilityLabels[right] ?? right))
    .map(([key, entryValue]) => ({
      key,
      label: mapAvailabilityLabels[key] ?? `Carte Riot ${key}`,
      value: typeof entryValue === "boolean" ? formatBoolean(entryValue) : String(entryValue),
    }));

const formatMapAvailabilityRecord = (value: Record<string, unknown>) => {
  const lines = formatMapAvailabilityLines(value);
  return lines.length ? lines.map((line) => `${line.label}: ${line.value}`).join(", ") : "Aucune";
};

const getItemReferenceGroupKey = (itemId: string, options: ItemPatchDiffOptions) => {
  const item = options.itemReferenceById?.get(itemId);
  const label = options.itemNameById?.get(itemId) ?? `Item Riot ${itemId}`;
  return `${label}|${item?.cost ?? ""}|${JSON.stringify(item?.stats ?? {})}`;
};

const formatItemReferenceLines = (itemIds: string[], options: ItemPatchDiffOptions, changeType?: "added" | "removed") => {
  const groups = new Map<string, { ids: string[]; label: string; item?: PatchLineItem }>();
  for (const itemId of itemIds) {
    const key = getItemReferenceGroupKey(itemId, options);
    const existing = groups.get(key);
    if (existing) {
      existing.ids.push(itemId);
      continue;
    }

    groups.set(key, {
      ids: [itemId],
      label: options.itemNameById?.get(itemId) ?? `Item Riot ${itemId}`,
      item: options.itemReferenceById?.get(itemId),
    });
  }

  return [...groups.values()]
    .map((group) => {
      const sortedIds = [...group.ids].sort((left, right) => Number(left) - Number(right));
      return {
        key: sortedIds.join("|"),
        label: group.label,
        value: sortedIds.length > 1 ? `IDs Riot ${sortedIds.join(", ")}` : `ID Riot ${sortedIds[0]}`,
        changeType,
        item: group.item,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
};

const formatItemReferenceList = (itemIds: string[], options: ItemPatchDiffOptions) => {
  const lines = formatItemReferenceLines(itemIds, options);
  return lines.length ? lines.map((line) => `${line.label} (${line.value})`).join(", ") : "Aucun";
};

const getChangedRecordKeys = (beforeValue: Record<string, unknown>, afterValue: Record<string, unknown>, descriptors: Record<string, StatDescriptor>) =>
  [...new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)])].filter((key) => {
    const descriptor = descriptors[key];
    const before = descriptor?.format ? descriptor.format(beforeValue[key]) : formatNumber(beforeValue[key]);
    const after = descriptor?.format ? descriptor.format(afterValue[key]) : formatNumber(afterValue[key]);
    return before !== after;
  });

const formatStatDelta = (beforeValue: unknown, afterValue: unknown, descriptor: StatDescriptor | undefined) => {
  const before = parseNumericStatValue(beforeValue);
  const after = parseNumericStatValue(afterValue);
  if (before === null || after === null) {
    return undefined;
  }

  const delta = after - before;
  if (Math.abs(delta) < 0.0001) {
    return undefined;
  }

  return descriptor?.formatDelta ? descriptor.formatDelta(delta) : formatDeltaNumber(delta);
};

const formatStatLines = (
  value: Record<string, unknown>,
  descriptors: Record<string, StatDescriptor>,
  keys = Object.keys(value),
  deltaBase?: Record<string, unknown>,
) =>
  [...keys]
    .sort((left, right) => {
      const leftLabel = descriptors[left]?.label ?? left;
      const rightLabel = descriptors[right]?.label ?? right;
      return leftLabel.localeCompare(rightLabel);
    })
    .map((key) => {
      const descriptor = descriptors[key];
      const entryValue = value[key];
      return {
        key,
        label: descriptor?.label ?? key,
        value: descriptor?.format ? descriptor.format(entryValue) : formatNumber(entryValue),
        delta: deltaBase ? formatStatDelta(deltaBase[key], entryValue, descriptor) : undefined,
      };
    });

const formatStatRecord = (value: Record<string, unknown>, descriptors: Record<string, StatDescriptor>, keys?: string[]) => {
  const lines = formatStatLines(value, descriptors, keys);
  return lines.length ? lines.map((line) => `${line.label}: ${line.value}`).join(", ") : "Aucune";
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();

const spellSlots = ["Passive", "A", "Z", "E", "R"];

const formatSpellDescription = (value: string | null | undefined) => normalizeText(value).replaceAll(/\{\{[^}]+\}\}/g, "").trim();

const getChampionAbilityEntries = (detail: RemoteChampionDetail | undefined) => {
  if (!detail) {
    return [];
  }

  return [
    {
      key: "passive",
      label: "Passive",
      value: formatSpellDescription(detail.passive.description),
    },
    ...detail.spells.map((spell, index) => ({
      key: spell.id,
      label: `${spellSlots[index + 1] ?? ("Sort " + String(index + 1))} - ${spell.name}`,
      value: formatSpellDescription(spell.tooltip || spell.description),
    })),
  ];
};

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
  const before = formatList([...beforeValue].sort(compareText));
  const after = formatList([...afterValue].sort(compareText));
  if (before !== after) {
    changes.push({ field, label, before, after });
  }
};

const addItemReferenceArrayChange = (
  changes: PatchChange[],
  field: string,
  label: string,
  beforeValue: string[],
  afterValue: string[],
  options: ItemPatchDiffOptions,
) => {
  const beforeIds = new Set(beforeValue);
  const afterIds = new Set(afterValue);
  const removedIds = beforeValue.filter((itemId) => !afterIds.has(itemId)).sort(compareNumericText);
  const addedIds = afterValue.filter((itemId) => !beforeIds.has(itemId)).sort(compareNumericText);

  if (removedIds.length || addedIds.length) {
    const before = removedIds.length ? `${formatItemReferenceList(removedIds, options)} retires` : "Aucun item retire";
    const after = addedIds.length ? `${formatItemReferenceList(addedIds, options)} ajoutes` : "Aucun item ajoute";
    changes.push({
      field,
      label,
      before,
      after,
      beforeLines: formatItemReferenceLines(removedIds, options, "removed"),
      afterLines: formatItemReferenceLines(addedIds, options, "added"),
    });
  }
};

const addMapAvailabilityChange = (
  changes: PatchChange[],
  beforeValue: Record<string, unknown>,
  afterValue: Record<string, unknown>,
) => {
  const before = formatMapAvailabilityRecord(beforeValue);
  const after = formatMapAvailabilityRecord(afterValue);
  if (before !== after) {
    changes.push({
      field: "maps",
      label: "Disponibilite cartes",
      before,
      after,
      beforeLines: formatMapAvailabilityLines(beforeValue),
      afterLines: formatMapAvailabilityLines(afterValue),
    });
  }
};

const addPurchasableChange = (
  changes: PatchChange[],
  beforeValue: boolean,
  afterValue: boolean,
) => {
  const before = formatPurchasable(beforeValue);
  const after = formatPurchasable(afterValue);
  if (before !== after) {
    changes.push({ field: "purchasable", label: "Disponibilite boutique", before, after });
  }
};

const addStatRecordChange = (
  changes: PatchChange[],
  label: string,
  beforeValue: Record<string, unknown>,
  afterValue: Record<string, unknown>,
  descriptors: Record<string, StatDescriptor>,
) => {
  const changedKeys = getChangedRecordKeys(beforeValue, afterValue, descriptors);
  const before = formatStatRecord(beforeValue, descriptors, changedKeys);
  const after = formatStatRecord(afterValue, descriptors, changedKeys);
  if (before !== after) {
    changes.push({
      field: "stats",
      label,
      before,
      after,
      beforeLines: formatStatLines(beforeValue, descriptors, changedKeys),
      afterLines: formatStatLines(afterValue, descriptors, changedKeys, beforeValue),
    });
  }
};

const addChampionAbilityChanges = (
  changes: PatchChange[],
  beforeDetail: RemoteChampionDetail | undefined,
  afterDetail: RemoteChampionDetail | undefined,
  beforeDisplayDetail: RemoteChampionDetail | undefined,
  afterDisplayDetail: RemoteChampionDetail | undefined,
) => {
  const beforeEntries = new Map(getChampionAbilityEntries(beforeDetail).map((entry) => [entry.key, entry]));
  const afterEntries = new Map(getChampionAbilityEntries(afterDetail).map((entry) => [entry.key, entry]));
  const beforeDisplayEntries = new Map(getChampionAbilityEntries(beforeDisplayDetail ?? beforeDetail).map((entry) => [entry.key, entry]));
  const afterDisplayEntries = new Map(getChampionAbilityEntries(afterDisplayDetail ?? afterDetail).map((entry) => [entry.key, entry]));
  const changedKeys = [...new Set([...beforeEntries.keys(), ...afterEntries.keys()])].filter((key) => {
    const before = beforeEntries.get(key)?.value ?? "Non renseigne";
    const after = afterEntries.get(key)?.value ?? "Non renseigne";
    return before !== after;
  });

  if (!changedKeys.length) {
    return;
  }

  const beforeLines = changedKeys.map((key) => beforeDisplayEntries.get(key) ?? beforeEntries.get(key) ?? { key, label: afterEntries.get(key)?.label ?? key, value: "Non renseigne" });
  const afterLines = changedKeys.map((key) => afterDisplayEntries.get(key) ?? afterEntries.get(key) ?? { key, label: beforeEntries.get(key)?.label ?? key, value: "Non renseigne" });

  changes.push({
    field: "abilities",
    label: "Sorts",
    before: beforeLines.map((line) => `${line.label}: ${line.value}`).join(" / "),
    after: afterLines.map((line) => `${line.label}: ${line.value}`).join(" / "),
    beforeLines,
    afterLines,
  });
};

const summarizeChanges = (changes: PatchChange[], fallback: string) => {
  if (!changes.length) {
    return [fallback];
  }

  return changes.slice(0, 3).map((change) => change.label);
};

export function diffChampionPatch(champion: Champion, remoteChampion: RemoteChampion | undefined, options: ChampionPatchDiffOptions = {}) {
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
  addStatRecordChange(changes, "Statistiques de base", jsonRecord(champion.stats), remoteChampion.stats ?? {}, championStatDescriptors);
  addChampionAbilityChanges(
    changes,
    options.localChampionDetail,
    options.remoteChampionDetail,
    options.localDisplayChampionDetail,
    options.remoteDisplayChampionDetail,
  );

  return {
    patchStatus: changes.length ? "changed" as const : "unchanged" as const,
    changeSummary: summarizeChanges(changes, "Patch catalogue a rafraichir sans changement de fiche detecte"),
    changes,
  };
}

export function diffItemPatch(item: Item, remoteItem: RemoteItem | undefined, options: ItemPatchDiffOptions = {}) {
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
  addItemReferenceArrayChange(changes, "buildsFrom", "Composants", jsonArray(item.buildsFrom), remoteItem.from ?? [], options);
  addItemReferenceArrayChange(changes, "buildsInto", "Evolutions", jsonArray(item.buildsInto), remoteItem.into ?? [], options);
  addStatRecordChange(changes, "Statistiques", jsonRecord(item.stats), remoteItem.stats ?? {}, itemStatDescriptors);
  addMapAvailabilityChange(changes, jsonRecord(item.mapAvailability), remoteItem.maps ?? {});
  addPurchasableChange(changes, item.isActive, remoteItem.gold.purchasable && remoteItem.inStore !== false);

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
