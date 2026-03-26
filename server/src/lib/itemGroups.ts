import type { Item } from "@prisma/client";

type ItemGroupId =
  | "Annul"
  | "Blight"
  | "Boots"
  | "Eternity"
  | "Fatality"
  | "Hydra"
  | "Immolate"
  | "LastWhisper"
  | "Lifeline"
  | "Manaflow"
  | "Quicksilver"
  | "Spellblade"
  | "Stasis";

const LIFELINE_ITEM_IDS = new Set([2525, 3053, 3155, 3156, 6673]);
const HYDRA_ITEM_IDS = new Set([3077, 3074, 3748, 6698, 6631]);
const MANAFLOW_ITEM_IDS = new Set([2526, 3003, 3004, 3070, 3119]);
const LAST_WHISPER_ITEM_IDS = new Set([3033, 3036, 6694]);
const BLIGHT_ITEM_IDS = new Set([3135, 3137, 4630]);
const FATALITY_ITEM_IDS = new Set([6676]);
const STASIS_ITEM_IDS = new Set([2420, 2421, 3157]);

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasDescriptionKeyword = (item: Item, keyword: RegExp) => keyword.test(normalizeText(item.fullDescription));

export const getItemGroups = (item: Item): ItemGroupId[] => {
  const groups = new Set<ItemGroupId>();
  const normalizedName = normalizeText(item.name);

  if (item.isBoots) {
    groups.add("Boots");
  }

  if (FATALITY_ITEM_IDS.has(item.riotItemId)) {
    groups.add("Fatality");
  }

  if (HYDRA_ITEM_IDS.has(item.riotItemId) || item.buildsFrom && Array.isArray(item.buildsFrom) && item.buildsFrom.some((entry) => Number(entry) === 3077)) {
    groups.add("Hydra");
  }

  if (LIFELINE_ITEM_IDS.has(item.riotItemId) || hasDescriptionKeyword(item, /\blien vital\b/i)) {
    groups.add("Lifeline");
  }

  if (MANAFLOW_ITEM_IDS.has(item.riotItemId) || hasDescriptionKeyword(item, /\bflux de mana\b/i)) {
    groups.add("Manaflow");
  }

  if (hasDescriptionKeyword(item, /\blame enchantee\b/i)) {
    groups.add("Spellblade");
  }

  if (hasDescriptionKeyword(item, /\binvalidation\b/i)) {
    groups.add("Annul");
  }

  if (BLIGHT_ITEM_IDS.has(item.riotItemId)) {
    groups.add("Blight");
  }

  if (hasDescriptionKeyword(item, /\beternite\b/i) || normalizedName.includes("eternite")) {
    groups.add("Eternity");
  }

  if (hasDescriptionKeyword(item, /\bimmolation\b/i)) {
    groups.add("Immolate");
  }

  if (hasDescriptionKeyword(item, /\bmercure\b/i) && !item.isBoots) {
    groups.add("Quicksilver");
  }

  if (STASIS_ITEM_IDS.has(item.riotItemId) || hasDescriptionKeyword(item, /\bstase\b/i)) {
    groups.add("Stasis");
  }

  if (LAST_WHISPER_ITEM_IDS.has(item.riotItemId) || (Array.isArray(item.buildsFrom) && item.buildsFrom.some((entry) => Number(entry) === 3035))) {
    groups.add("LastWhisper");
  }

  return Array.from(groups);
};
