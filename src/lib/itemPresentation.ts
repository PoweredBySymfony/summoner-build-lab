import type { GameItem } from "@/types/domain";

export type ItemStatIconKey =
  | "attackDamage"
  | "abilityPower"
  | "health"
  | "mana"
  | "armor"
  | "magicResist"
  | "attackSpeed"
  | "abilityHaste"
  | "crit"
  | "moveSpeed"
  | "omnivamp"
  | "lifesteal"
  | "lethality"
  | "magicPen"
  | "healthRegen"
  | "manaRegen"
  | "tenacity"
  | "default";

export type ItemStatLine = {
  key: string;
  label: string;
  value: string;
  icon: ItemStatIconKey;
};

export type ItemEffectBlock = {
  title?: string;
  body: string;
  icon?: ItemStatIconKey;
};

type ItemStatSemanticKey =
  | "attackDamage"
  | "abilityPower"
  | "health"
  | "mana"
  | "armor"
  | "magicResist"
  | "attackSpeed"
  | "abilityHaste"
  | "ultimateHaste"
  | "summonerHaste"
  | "critChance"
  | "critDamage"
  | "moveSpeed"
  | "omnivamp"
  | "lifesteal"
  | "healShieldPower"
  | "lethality"
  | "armorPen"
  | "magicPen"
  | "healthRegen"
  | "manaRegen"
  | "tenacity";

type ResolvedItemStatLine = ItemStatLine & {
  semanticKey: ItemStatSemanticKey | null;
  numericValue: number | null;
  isPercent: boolean;
};

type PhraseDescriptor = {
  match: RegExp;
  label: string;
  icon: ItemStatIconKey;
  semanticKey: ItemStatSemanticKey;
};

const rawStatKeyMap: Record<
  string,
  {
    label: string;
    icon: ItemStatIconKey;
    semanticKey: ItemStatSemanticKey;
    format?: (value: number) => string;
  }
> = {
  FlatPhysicalDamageMod: { label: "Degats d'attaque", icon: "attackDamage", semanticKey: "attackDamage", format: (value) => `+${value}` },
  FlatMagicDamageMod: { label: "Puissance", icon: "abilityPower", semanticKey: "abilityPower", format: (value) => `+${value}` },
  FlatHPPoolMod: { label: "PV", icon: "health", semanticKey: "health", format: (value) => `+${value}` },
  FlatMPPoolMod: { label: "Mana", icon: "mana", semanticKey: "mana", format: (value) => `+${value}` },
  FlatArmorMod: { label: "Armure", icon: "armor", semanticKey: "armor", format: (value) => `+${value}` },
  FlatSpellBlockMod: { label: "Resistance magique", icon: "magicResist", semanticKey: "magicResist", format: (value) => `+${value}` },
  PercentAttackSpeedMod: { label: "Vitesse d'attaque", icon: "attackSpeed", semanticKey: "attackSpeed", format: (value) => `+${Math.round(value * 100)}%` },
  FlatCritChanceMod: { label: "Chances de coup critique", icon: "crit", semanticKey: "critChance", format: (value) => `+${Math.round(value * 100)}%` },
  FlatMovementSpeedMod: { label: "Vitesse de deplacement", icon: "moveSpeed", semanticKey: "moveSpeed", format: (value) => `+${value}` },
  PercentMovementSpeedMod: { label: "Vitesse de deplacement", icon: "moveSpeed", semanticKey: "moveSpeed", format: (value) => `+${Math.round(value * 100)}%` },
  FlatHPRegenMod: { label: "Regeneration de PV", icon: "healthRegen", semanticKey: "healthRegen", format: (value) => `+${value}` },
  FlatMPRegenMod: { label: "Regeneration de mana", icon: "manaRegen", semanticKey: "manaRegen", format: (value) => `+${value}` },
  PercentLifeStealMod: { label: "Vol de vie", icon: "lifesteal", semanticKey: "lifesteal", format: (value) => `+${Math.round(value * 100)}%` },
};

const phraseMap: PhraseDescriptor[] = [
  { match: /degats d'attaque|attaque physique/i, label: "Degats d'attaque", icon: "attackDamage", semanticKey: "attackDamage" },
  { match: /puissance|degats magiques/i, label: "Puissance", icon: "abilityPower", semanticKey: "abilityPower" },
  { match: /acceleration d'ultime/i, label: "Acceleration d'ultime", icon: "abilityHaste", semanticKey: "ultimateHaste" },
  { match: /acceleration de sort d'invocateur/i, label: "Acceleration de sort d'invocateur", icon: "abilityHaste", semanticKey: "summonerHaste" },
  { match: /acceleration de competence/i, label: "Acceleration de competence", icon: "abilityHaste", semanticKey: "abilityHaste" },
  { match: /degats? de coup critique|degats? critiques?/i, label: "Degats de coup critique", icon: "crit", semanticKey: "critDamage" },
  { match: /chances? de coup critique|taux de coup critique|chance critique/i, label: "Chances de coup critique", icon: "crit", semanticKey: "critChance" },
  { match: /vitesse d'attaque/i, label: "Vitesse d'attaque", icon: "attackSpeed", semanticKey: "attackSpeed" },
  { match: /^pv$|points? de vie|sante/i, label: "PV", icon: "health", semanticKey: "health" },
  { match: /mana/i, label: "Mana", icon: "mana", semanticKey: "mana" },
  { match: /armure/i, label: "Armure", icon: "armor", semanticKey: "armor" },
  { match: /resistance magique/i, label: "Resistance magique", icon: "magicResist", semanticKey: "magicResist" },
  { match: /vitesse de deplacement/i, label: "Vitesse de deplacement", icon: "moveSpeed", semanticKey: "moveSpeed" },
  { match: /omnivamp/i, label: "Omnivampirisme", icon: "omnivamp", semanticKey: "omnivamp" },
  { match: /vampirisme physique|vol de vie/i, label: "Vol de vie", icon: "lifesteal", semanticKey: "lifesteal" },
  { match: /efficacite des soins et boucliers/i, label: "Efficacite des soins et boucliers", icon: "healthRegen", semanticKey: "healShieldPower" },
  { match: /letalite/i, label: "Letalite", icon: "lethality", semanticKey: "lethality" },
  { match: /penetration d'armure/i, label: "Penetration d'armure", icon: "lethality", semanticKey: "armorPen" },
  { match: /penetration magique/i, label: "Penetration magique", icon: "magicPen", semanticKey: "magicPen" },
  { match: /regeneration de base des pv|regeneration de base du pv|regeneration de pv/i, label: "Regeneration de PV", icon: "healthRegen", semanticKey: "healthRegen" },
  { match: /regeneration de base du mana|regeneration de mana/i, label: "Regeneration de mana", icon: "manaRegen", semanticKey: "manaRegen" },
  { match: /tenacite/i, label: "Tenacite", icon: "tenacity", semanticKey: "tenacity" },
];

const baseStatSemanticKeys = new Set<ItemStatSemanticKey>([
  "attackDamage",
  "abilityPower",
  "health",
  "mana",
  "armor",
  "magicResist",
  "attackSpeed",
  "abilityHaste",
  "ultimateHaste",
  "summonerHaste",
  "critChance",
  "moveSpeed",
  "omnivamp",
  "lifesteal",
  "healShieldPower",
  "lethality",
  "armorPen",
  "magicPen",
  "healthRegen",
  "manaRegen",
  "tenacity",
]);

const sentenceLike = /[.!?]$/;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseNumericValue(value: string) {
  const sanitized = value.replace("%", "").replace(",", ".");
  const numericValue = Number.parseFloat(sanitized);

  return {
    numericValue: Number.isFinite(numericValue) ? numericValue : null,
    isPercent: value.includes("%"),
  };
}

function resolveDescriptor(rawLabel: string) {
  const normalizedLabel = normalizeText(rawLabel);
  const descriptor = phraseMap.find((entry) => entry.match.test(normalizedLabel));
  return { descriptor, normalizedLabel };
}

function parseStatLine(line: string): ResolvedItemStatLine | null {
  const compact = line.replace(/\s+/g, " ").trim();
  const match = compact.match(/^([+-]?\d+(?:[.,]\d+)?%?)\s+(.+)$/);
  if (!match) {
    return null;
  }

  const [, value, rawLabel] = match;
  const { descriptor, normalizedLabel } = resolveDescriptor(rawLabel);
  const { numericValue, isPercent } = parseNumericValue(value);

  return {
    key: normalizedLabel || rawLabel,
    label: descriptor?.label ?? rawLabel,
    value,
    icon: descriptor?.icon ?? "default",
    semanticKey: descriptor?.semanticKey ?? null,
    numericValue,
    isPercent,
  };
}

function getDescriptionLines(item: GameItem) {
  return (item.fullDescription ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getLeadingDescriptionStatLines(item: GameItem) {
  const parsed: ResolvedItemStatLine[] = [];

  for (const line of getDescriptionLines(item)) {
    if (!line.startsWith("+") && !/^\d/.test(line)) {
      break;
    }

    const statLine = parseStatLine(line);
    if (!statLine) {
      break;
    }

    if (!statLine.semanticKey || !baseStatSemanticKeys.has(statLine.semanticKey)) {
      break;
    }

    parsed.push(statLine);
  }

  return parsed;
}

function statLinesFromRawStats(item: GameItem) {
  if (!item.stats || typeof item.stats !== "object" || Array.isArray(item.stats)) {
    return [];
  }

  return Object.entries(item.stats)
    .map(([key, rawValue]) => {
      if (typeof rawValue !== "number") {
        return null;
      }

      const descriptor = rawStatKeyMap[key];
      if (!descriptor) {
        return null;
      }

      const value = descriptor.format ? descriptor.format(rawValue) : String(rawValue);
      const { numericValue, isPercent } = parseNumericValue(value);

      return {
        key,
        label: descriptor.label,
        value,
        icon: descriptor.icon,
        semanticKey: descriptor.semanticKey,
        numericValue,
        isPercent,
      } satisfies ResolvedItemStatLine;
    })
    .filter((entry): entry is ResolvedItemStatLine => Boolean(entry));
}

function hasSameNumericMeaning(left: ResolvedItemStatLine, right: ResolvedItemStatLine) {
  if (left.semanticKey !== right.semanticKey) {
    return false;
  }

  if (left.isPercent !== right.isPercent) {
    return false;
  }

  if (left.numericValue === null || right.numericValue === null) {
    return left.value === right.value;
  }

  return Math.abs(left.numericValue - right.numericValue) < 0.001;
}

function mergeBaseStatLines(item: GameItem) {
  const rawStatLines = statLinesFromRawStats(item);
  const leadingDescriptionStats = getLeadingDescriptionStatLines(item);

  if (rawStatLines.length === 0) {
    return leadingDescriptionStats;
  }

  const merged = [...rawStatLines];
  for (const descriptionLine of leadingDescriptionStats) {
    const alreadyCovered = rawStatLines.some((rawLine) => hasSameNumericMeaning(rawLine, descriptionLine));
    if (!alreadyCovered) {
      merged.push(descriptionLine);
    }
  }

  return merged;
}

function toPublicStatLines(lines: ResolvedItemStatLine[]): ItemStatLine[] {
  return lines.map(({ key, label, value, icon }) => ({
    key,
    label,
    value,
    icon,
  }));
}

function inferEffectIcon(title: string | undefined, body: string) {
  const candidates = [title, body];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const parsed = parseStatLine(candidate);
    if (parsed?.semanticKey === "critDamage") {
      return parsed.icon;
    }
  }

  return undefined;
}

export function getItemStatLines(item: GameItem) {
  return toPublicStatLines(mergeBaseStatLines(item));
}

export function getItemEffectBlocks(item: GameItem): ItemEffectBlock[] {
  const lines = getDescriptionLines(item);
  const contentLines = lines.slice(getLeadingDescriptionStatLines(item).length);
  if (!contentLines.length) {
    return [];
  }

  const blocks = contentLines
    .join("\n")
    .split(/\n{2,}/g)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length > 0);

  return blocks.map((block) => {
    if (block.length === 1) {
      return { body: block[0], icon: inferEffectIcon(undefined, block[0]) };
    }

    const [head, ...rest] = block;
    const titleCandidate = head.replace(/:$/, "");
    const looksLikeTitle = titleCandidate.length < 40 && !sentenceLike.test(titleCandidate);

    if (looksLikeTitle) {
      return {
        title: titleCandidate,
        body: rest.join(" "),
        icon: inferEffectIcon(titleCandidate, rest.join(" ")),
      };
    }

    const body = block.join(" ");
    return { body, icon: inferEffectIcon(undefined, body) };
  });
}
