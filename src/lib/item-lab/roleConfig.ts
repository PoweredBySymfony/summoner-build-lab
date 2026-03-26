import type { ChampionView } from "@/types/domain";
import type { ItemLabSetup, LabRoleKey, RoleConfig } from "@/lib/item-lab/types";

export const ROLE_CONFIG: Record<LabRoleKey, RoleConfig> = {
  TOP: { maxLevel: 20, maxItems: 6 },
  JUNGLE: { maxLevel: 18, maxItems: 6 },
  MID: { maxLevel: 18, maxItems: 6 },
  ADC: { maxLevel: 18, maxItems: 7 },
  SUPPORT: { maxLevel: 18, maxItems: 6 },
};

const ROLE_ALIAS_MAP: Record<string, LabRoleKey> = {
  TOP: "TOP",
  JUNGLE: "JUNGLE",
  MID: "MID",
  MIDDLE: "MID",
  ADC: "ADC",
  BOT: "ADC",
  BOTTOM: "ADC",
  MARKSMAN: "ADC",
  SUPPORT: "SUPPORT",
  SUPP: "SUPPORT",
};

export const ABSOLUTE_MAX_ITEM_SLOTS = Math.max(...Object.values(ROLE_CONFIG).map((entry) => entry.maxItems));

export const normalizeLabRole = (role?: string | null): LabRoleKey => {
  const normalized = role?.trim().toUpperCase() ?? "";
  return ROLE_ALIAS_MAP[normalized] ?? "MID";
};

export const getRoleConfig = (role: LabRoleKey): RoleConfig => ROLE_CONFIG[role];

export const getChampionRoleOptions = (champion?: ChampionView | null): LabRoleKey[] => {
  const roles = (champion?.roles ?? []).map((role) => normalizeLabRole(role));
  return Array.from(new Set(roles)).filter(Boolean) as LabRoleKey[];
};

export const getDefaultChampionRole = (champion?: ChampionView | null): LabRoleKey => {
  const options = getChampionRoleOptions(champion);
  return options[0] ?? "MID";
};

export const buildRoleAwareItemIds = (maxItems: number, current?: Array<string | null>) => {
  const next = Array.from({ length: maxItems }, (_, index) => current?.[index] ?? null);
  return next;
};

export const normalizeSetupForRole = ({
  setup,
  champion,
}: {
  setup: ItemLabSetup;
  champion?: ChampionView | null;
}): ItemLabSetup => {
  const fallbackRole = getDefaultChampionRole(champion);
  const roleOptions = getChampionRoleOptions(champion);
  const role = roleOptions.includes(setup.role) ? setup.role : fallbackRole;
  const config = getRoleConfig(role);

  return {
    ...setup,
    role,
    level: Math.min(Math.max(setup.level, 1), config.maxLevel),
    itemIds: buildRoleAwareItemIds(config.maxItems, setup.itemIds),
  };
};
