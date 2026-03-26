import type { Champion } from "@prisma/client";
import { mapChampionView } from "../services/viewMappers.js";

export function buildChampionViewIndex(champions: Champion[]) {
  const index = new Map<string, ReturnType<typeof mapChampionView>>();

  for (const champion of champions) {
    const view = mapChampionView(champion);
    index.set(champion.slug, view);
    index.set(champion.id, view);

    if (champion.championKey) {
      index.set(champion.championKey, view);
    }

    if (typeof champion.riotChampionId === "number") {
      index.set(String(champion.riotChampionId), view);
    }
  }

  return index;
}
