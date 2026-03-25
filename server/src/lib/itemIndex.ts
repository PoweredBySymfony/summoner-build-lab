import type { Item } from "@prisma/client";
import { itemSlugAliases } from "./itemSlugAliases.js";
import { mapItemView } from "../services/viewMappers.js";

export function buildItemViewIndex(items: Item[]) {
  const entries = items.map((item) => [item.slug, mapItemView(item)] as const);
  const index = new Map(entries);

  for (const [englishSlug, localizedSlug] of Object.entries(itemSlugAliases)) {
    const localizedItem = index.get(localizedSlug);
    if (localizedItem && !index.has(englishSlug)) {
      index.set(englishSlug, localizedItem);
    }
  }

  return index;
}
