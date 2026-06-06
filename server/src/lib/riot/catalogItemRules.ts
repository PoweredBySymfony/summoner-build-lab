type CatalogItemCandidate = {
  maps?: Record<string, boolean> | null;
  gold?: { total?: number | null; purchasable?: boolean | null } | null;
  inStore?: boolean | null;
};

export function isPurchasableCatalogItem(riotItemId: number, item: CatalogItemCandidate) {
  return (
    Boolean(item.maps?.["11"]) &&
    riotItemId < 100000 &&
    (item.gold?.total ?? 0) > 0 &&
    item.gold?.purchasable !== false &&
    item.inStore !== false
  );
}

function isStandardSummonersRiftItem(riotItemId: number, item: CatalogItemCandidate) {
  return isPurchasableCatalogItem(riotItemId, item) && Boolean(item.maps?.["11"]);
}

function countEnabledMaps(maps?: Record<string, boolean> | null) {
  return Object.values(maps ?? {}).filter(Boolean).length;
}

export function compareCanonicalItemCandidates(
  left: [string, CatalogItemCandidate],
  right: [string, CatalogItemCandidate],
) {
  const leftIsStandard = isStandardSummonersRiftItem(Number(left[0]), left[1]);
  const rightIsStandard = isStandardSummonersRiftItem(Number(right[0]), right[1]);

  if (leftIsStandard !== rightIsStandard) {
    return leftIsStandard ? -1 : 1;
  }

  const mapDelta = countEnabledMaps(left[1].maps) - countEnabledMaps(right[1].maps);
  if (mapDelta !== 0) {
    return mapDelta;
  }

  return Number(left[0]) - Number(right[0]);
}

export function deriveBootItemIds(
  items: Array<[string, { tags?: string[] | null; from?: Array<string | number> | null }]>,
) {
  const bootItemIds = new Set<number>();

  for (const [itemId, item] of items) {
    if (item.tags?.includes("Boots")) {
      bootItemIds.add(Number(itemId));
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [itemId, item] of items) {
      const numericItemId = Number(itemId);
      if (bootItemIds.has(numericItemId)) {
        continue;
      }
      const buildsFrom = Array.isArray(item.from) ? item.from.map((entry) => Number(entry)) : [];
      if (buildsFrom.some((entry) => bootItemIds.has(entry))) {
        bootItemIds.add(numericItemId);
        changed = true;
      }
    }
  }

  return bootItemIds;
}
