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
};

const rawStatKeyMap: Record<string, { label: string; icon: ItemStatIconKey; format?: (value: number) => string }> = {
  FlatPhysicalDamageMod: { label: "Dégâts d'attaque", icon: "attackDamage", format: (value) => `+${value}` },
  FlatMagicDamageMod: { label: "Puissance", icon: "abilityPower", format: (value) => `+${value}` },
  FlatHPPoolMod: { label: "PV", icon: "health", format: (value) => `+${value}` },
  FlatMPPoolMod: { label: "Mana", icon: "mana", format: (value) => `+${value}` },
  FlatArmorMod: { label: "Armure", icon: "armor", format: (value) => `+${value}` },
  FlatSpellBlockMod: { label: "Résistance magique", icon: "magicResist", format: (value) => `+${value}` },
  PercentAttackSpeedMod: { label: "Vitesse d'attaque", icon: "attackSpeed", format: (value) => `+${Math.round(value * 100)}%` },
  FlatCritChanceMod: { label: "Chances de coup critique", icon: "crit", format: (value) => `+${Math.round(value * 100)}%` },
  FlatMovementSpeedMod: { label: "Vitesse de déplacement", icon: "moveSpeed", format: (value) => `+${value}` },
  FlatHPRegenMod: { label: "Régénération de PV", icon: "healthRegen", format: (value) => `+${value}` },
  FlatMPRegenMod: { label: "Régénération de mana", icon: "manaRegen", format: (value) => `+${value}` },
};

const phraseMap: Array<{ match: RegExp; label: string; icon: ItemStatIconKey }> = [
  { match: /degats d'attaque|attaque physique/i, label: "Dégâts d'attaque", icon: "attackDamage" },
  { match: /puissance|degats magiques/i, label: "Puissance", icon: "abilityPower" },
  { match: /acceleration de competence/i, label: "Accélération de compétence", icon: "abilityHaste" },
  { match: /chances? de coup critique|critique/i, label: "Chances de coup critique", icon: "crit" },
  { match: /vitesse d'attaque/i, label: "Vitesse d'attaque", icon: "attackSpeed" },
  { match: /^pv$|points? de vie|sante/i, label: "PV", icon: "health" },
  { match: /mana/i, label: "Mana", icon: "mana" },
  { match: /armure/i, label: "Armure", icon: "armor" },
  { match: /resistance magique/i, label: "Résistance magique", icon: "magicResist" },
  { match: /vitesse de deplacement/i, label: "Vitesse de déplacement", icon: "moveSpeed" },
  { match: /omnivamp/i, label: "Omnivampirisme", icon: "omnivamp" },
  { match: /vol de vie/i, label: "Vol de vie", icon: "lifesteal" },
  { match: /letalite|penetration d'armure/i, label: "Létalité", icon: "lethality" },
  { match: /penetration magique/i, label: "Pénétration magique", icon: "magicPen" },
  { match: /regeneration de pv/i, label: "Régénération de PV", icon: "healthRegen" },
  { match: /regeneration de mana/i, label: "Régénération de mana", icon: "manaRegen" },
];

const sentenceLike = /[.!?]$/;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseStatLine(line: string): ItemStatLine | null {
  const compact = line.replace(/\s+/g, " ").trim();
  const match = compact.match(/^([+-]?\d+(?:[.,]\d+)?%?)\s+(.+)$/);
  if (!match) {
    return null;
  }

  const [, value, rawLabel] = match;
  const normalizedLabel = normalizeText(rawLabel);
  const descriptor = phraseMap.find((entry) => entry.match.test(normalizedLabel));

  return {
    key: normalizedLabel || rawLabel,
    label: descriptor?.label ?? rawLabel,
    value,
    icon: descriptor?.icon ?? "default",
  };
}

function statLinesFromDescription(item: GameItem) {
  const lines = (item.fullDescription ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ItemStatLine[] = [];
  for (const line of lines) {
    if (!line.startsWith("+") && !/^\d/.test(line)) {
      break;
    }

    const statLine = parseStatLine(line);
    if (!statLine) {
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

      return {
        key,
        label: descriptor.label,
        value: descriptor.format ? descriptor.format(rawValue) : String(rawValue),
        icon: descriptor.icon,
      } satisfies ItemStatLine;
    })
    .filter((entry): entry is ItemStatLine => Boolean(entry));
}

export function getItemStatLines(item: GameItem) {
  const descriptionLines = statLinesFromDescription(item);
  if (descriptionLines.length > 0) {
    return descriptionLines;
  }

  return statLinesFromRawStats(item);
}

export function getItemEffectBlocks(item: GameItem): ItemEffectBlock[] {
  const lines = (item.fullDescription ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const statCount = getItemStatLines(item).length;
  const contentLines = lines.slice(statCount);
  if (!contentLines.length) {
    return [];
  }

  const blocks = (contentLines.join("\n").split(/\n{2,}/g))
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length > 0);

  return blocks.map((block) => {
    if (block.length === 1) {
      return { body: block[0] };
    }

    const [head, ...rest] = block;
    const titleCandidate = head.replace(/:$/, "");
    const looksLikeTitle = titleCandidate.length < 40 && !sentenceLike.test(titleCandidate);

    return looksLikeTitle
      ? { title: titleCandidate, body: rest.join(" ") }
      : { body: block.join(" ") };
  });
}
