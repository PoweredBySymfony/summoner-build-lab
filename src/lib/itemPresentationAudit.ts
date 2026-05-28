import { getItemEffectBlocks, getItemStatLines } from "@/lib/itemPresentation";
import type { GameItem } from "@/types/domain";

export type ItemPresentationAuditIssue = {
  riotItemId: number;
  name: string;
  kind: string;
  detail: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function startsWithStatLeak(effectText: string, label: string, value: string) {
  const normalizedValue = normalizeText(value).replace(/\s+/g, "");
  const normalizedLabel = normalizeText(label);
  const normalizedEffect = normalizeText(effectText);

  return normalizedEffect.startsWith(`${normalizedValue} ${normalizedLabel}`) || normalizedEffect.startsWith(`${normalizedLabel} ${normalizedValue}`);
}

export function auditItems(items: GameItem[]) {
  const issues: ItemPresentationAuditIssue[] = [];

  for (const item of items) {
    const statLines = getItemStatLines(item);
    const effectBlocks = getItemEffectBlocks(item);
    const seen = new Set<string>();

    for (const statLine of statLines) {
      const signature = `${normalizeText(statLine.label)}::${statLine.value}`;
      if (seen.has(signature)) {
        issues.push({
          riotItemId: item.riotItemId,
          name: item.name,
          kind: "duplicate-base-stat",
          detail: `${statLine.label} ${statLine.value}`,
        });
      }
      seen.add(signature);
    }

    for (const statLine of statLines) {
      if (statLine.icon === "default") {
        issues.push({
          riotItemId: item.riotItemId,
          name: item.name,
          kind: "missing-base-stat-icon",
          detail: `${statLine.label} ${statLine.value}`,
        });
      }
    }

    for (const block of effectBlocks) {
      const leadingText = [block.title, block.body].filter(Boolean).join(" ");
      for (const statLine of statLines) {
        if (startsWithStatLeak(leadingText, statLine.label, statLine.value)) {
          issues.push({
            riotItemId: item.riotItemId,
            name: item.name,
            kind: "base-stat-leaked-into-effects",
            detail: `${statLine.label} ${statLine.value}`,
          });
        }
      }
    }

    if (
      effectBlocks.some((block) => normalizeText(block.body).includes("degats de coup critique")) &&
      !effectBlocks.some((block) => block.icon === "crit")
    ) {
      issues.push({
        riotItemId: item.riotItemId,
        name: item.name,
        kind: "missing-crit-damage-icon",
        detail: "Effet de degats critiques sans icone",
      });
    }
  }

  return issues;
}
