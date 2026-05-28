import type { ChampionView, GameItem } from "@/types/domain";
import type {
  BuildValidationIssue,
  InventoryBlockReason,
  InventoryRuleClass,
  ItemLabSetup,
  LabRoleKey,
  SetupInventoryValidation,
  SlotItemValidation,
} from "@/lib/item-lab/types";
import { getRoleConfig } from "@/lib/item-lab/roleConfig";

type DerivedItemRule = {
  itemClass: InventoryRuleClass;
  allowedRoles?: LabRoleKey[];
  exclusiveGroups: string[];
  upgradeFromItemIds: string[];
};

type ValidationContext = {
  champion?: ChampionView | null;
  setup: ItemLabSetup;
  catalog: GameItem[];
  targetSlotIndex: number;
};

const BASIC_BOOTS_RIOT_ITEM_ID = 1001;

const SLOT_HINTS = {
  adcBootsOnly: "Le 7e slot ADC est reserve aux bottes.",
  midTier3BootsOnly: "Les bottes de 3e rang sont reservees au role MID.",
  upgradeLocked: "Certaines evolutions ne sont disponibles qu'en remplacement direct de leur base.",
};

const toRiotItemId = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeGroupKey = (value: string) => value.trim().toLowerCase();
const formatGroupLabel = (value: string) => {
  if (value === "lastwhisper") return "Last Whisper";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const buildIndexes = (catalog: GameItem[]) => {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const byRiotItemId = new Map(catalog.map((item) => [item.riotItemId, item]));
  return { byId, byRiotItemId };
};

const resolveUpgradeFromItemIds = (item: GameItem, byRiotItemId: Map<number, GameItem>) =>
  item.buildsFrom
    .map(toRiotItemId)
    .filter((value): value is number => value !== null)
    .map((riotItemId) => byRiotItemId.get(riotItemId)?.id ?? null)
    .filter((value): value is string => Boolean(value));

const getItemClass = (item: GameItem, upgradeFromItems: GameItem[]): InventoryRuleClass => {
  if (item.isTrinket) return "trinket";
  if (item.isConsumable) return "consumable";
  if (item.isStarter) return "starter";
  if (!item.isBoots) return "standard";

  const buildsFromBasicBoots = item.buildsFrom.some((entry) => toRiotItemId(entry) === BASIC_BOOTS_RIOT_ITEM_ID);
  const upgradesBootsItem = upgradeFromItems.some((entry) => entry.isBoots && entry.riotItemId !== BASIC_BOOTS_RIOT_ITEM_ID);

  if (upgradesBootsItem) return "tier3-boots";
  if (buildsFromBasicBoots) return "tier2-boots";
  return "boots";
};

const deriveItemRule = (item: GameItem, catalog: GameItem[], indexes = buildIndexes(catalog)): DerivedItemRule => {
  const upgradeFromItems = resolveUpgradeFromItemIds(item, indexes.byRiotItemId)
    .map((itemId) => indexes.byId.get(itemId) ?? null)
    .filter((entry): entry is GameItem => Boolean(entry));

  const itemClass = getItemClass(item, upgradeFromItems);
  const allowedRoles = itemClass === "tier3-boots" ? (["MID"] satisfies LabRoleKey[]) : undefined;
  const exclusiveGroups = item.itemGroups.map(normalizeGroupKey);

  return {
    itemClass,
    allowedRoles,
    exclusiveGroups,
    upgradeFromItemIds: upgradeFromItems.map((entry) => entry.id),
  };
};

const makeReason = (code: InventoryBlockReason["code"], message: string): InventoryBlockReason => ({ code, message });

const toUniqueHints = (reasonsByItemId: Record<string, InventoryBlockReason[]>, setup: ItemLabSetup, slotIndex: number) => {
  const hints = new Set<string>();
  if (setup.role === "ADC" && slotIndex === getRoleConfig(setup.role).maxItems - 1) {
    hints.add(SLOT_HINTS.adcBootsOnly);
  }

  for (const reasons of Object.values(reasonsByItemId)) {
    for (const reason of reasons) {
      if (reason.code === "role-locked") hints.add(SLOT_HINTS.midTier3BootsOnly);
      if (reason.code === "upgrade-slot-locked") hints.add(SLOT_HINTS.upgradeLocked);
    }
  }

  return Array.from(hints);
};

const getInventoryWithoutTargetSlot = (setup: ItemLabSetup, slotIndex: number) =>
  setup.itemIds
    .map((itemId, index) => (index === slotIndex ? null : itemId))
    .filter((itemId): itemId is string => Boolean(itemId));

const getCurrentItem = (setup: ItemLabSetup, catalogIndex: Map<string, GameItem>, slotIndex: number) => {
  const currentItemId = setup.itemIds[slotIndex];
  return currentItemId ? catalogIndex.get(currentItemId) ?? null : null;
};

const validateCandidate = ({
  setup,
  catalog,
  targetSlotIndex,
  item,
}: ValidationContext & { item: GameItem }): InventoryBlockReason[] => {
  const indexes = buildIndexes(catalog);
  const derivedRule = deriveItemRule(item, catalog, indexes);
  const currentItem = getCurrentItem(setup, indexes.byId, targetSlotIndex);
  const inventoryWithoutTarget = getInventoryWithoutTargetSlot(setup, targetSlotIndex);
  const ownedItems = inventoryWithoutTarget.map((itemId) => indexes.byId.get(itemId) ?? null).filter((entry): entry is GameItem => Boolean(entry));
  const ownedIds = new Set(ownedItems.map((entry) => entry.id));
  const reasons: InventoryBlockReason[] = [];

  if (!item.isActive) {
    reasons.push(makeReason("inactive-item", "Item inactif dans le patch courant."));
  }

  if (item.isStarter) {
    reasons.push(makeReason("starter-item", "Les items de depart ne sont pas proposes dans le Lab."));
  }

  if (item.isConsumable) {
    reasons.push(makeReason("consumable-item", "Les consommables ne font pas partie du build final compare."));
  }

  if (item.isTrinket) {
    reasons.push(makeReason("trinket-item", "Les trinkets sont exclus de cette comparaison de build."));
  }

  if (ownedIds.has(item.id) && currentItem?.id !== item.id) {
    reasons.push(makeReason("duplicate-item", "Cet item est deja present dans ce setup."));
  }

  if (derivedRule.allowedRoles && !derivedRule.allowedRoles.includes(setup.role)) {
    reasons.push(makeReason("role-locked", "Cet item est reserve a un autre role actif."));
  }

  const roleConfig = getRoleConfig(setup.role);
  if (setup.role === "ADC" && targetSlotIndex === roleConfig.maxItems - 1 && !item.isBoots) {
    reasons.push(makeReason("slot-boots-only", "Le 7e slot ADC n'accepte que des bottes."));
  }

  for (const group of derivedRule.exclusiveGroups) {
    const conflict = ownedItems.find((ownedItem) => deriveItemRule(ownedItem, catalog, indexes).exclusiveGroups.includes(group));
    if (conflict) {
      const reasonCode = group === normalizeGroupKey("Boots") ? "boots-conflict" : "exclusive-group";
      reasons.push(makeReason(reasonCode, `${item.name} est bloque car ${conflict.name} occupe deja le groupe ${formatGroupLabel(group)}.`));
      break;
    }
  }

  const upgradeConflict = derivedRule.upgradeFromItemIds
    .map((itemId) => indexes.byId.get(itemId) ?? null)
    .find((entry) => entry && ownedIds.has(entry.id));
  if (upgradeConflict) {
    reasons.push(makeReason("upgrade-slot-locked", `${item.name} doit remplacer ${upgradeConflict.name} dans son slot d'origine.`));
  }

  return reasons;
};

export class InventoryValidationService {
  static getSlotItemValidation(context: ValidationContext): SlotItemValidation {
    const allowedItems: GameItem[] = [];
    const blockedItems: SlotItemValidation["blockedItems"] = [];
    const blockedReasonsByItemId: Record<string, InventoryBlockReason[]> = {};

    for (const item of context.catalog) {
      const reasons = validateCandidate({ ...context, item });
      if (reasons.length === 0) {
        allowedItems.push(item);
        continue;
      }

      blockedReasonsByItemId[item.id] = reasons;
      blockedItems.push({ item, reasons });
    }

    return {
      allowedItems,
      blockedItems,
      blockedReasonsByItemId,
      hints: toUniqueHints(blockedReasonsByItemId, context.setup, context.targetSlotIndex),
    };
  }

  static canSelectItem(context: ValidationContext & { itemId: string }) {
    const validation = InventoryValidationService.getSlotItemValidation(context);
    const allowed = validation.allowedItems.some((item) => item.id === context.itemId);
    return {
      allowed,
      reasons: validation.blockedReasonsByItemId[context.itemId] ?? [],
    };
  }

  static validateSetupInventory({
    champion,
    setup,
    catalog,
  }: {
    champion?: ChampionView | null;
    setup: ItemLabSetup;
    catalog: GameItem[];
  }): SetupInventoryValidation {
    const indexes = buildIndexes(catalog);
    const issues: BuildValidationIssue[] = [];

    setup.itemIds.forEach((itemId, slotIndex) => {
      if (!itemId) return;
      const item = indexes.byId.get(itemId);
      if (!item) return;

      const reasons = validateCandidate({
        champion,
        setup,
        catalog,
        targetSlotIndex: slotIndex,
        item,
      });

      if (reasons.length === 0) return;

      issues.push({
        slotIndex,
        itemId,
        itemName: item.name,
        reasons,
      });
    });

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
