import { getItemEffectBlocks, getItemStatLines, getRawItemStatLines } from "@/lib/itemPresentation";
import type { ChampionView, GameItem } from "@/types/domain";

export type StaticDataAuditSeverity = "error" | "warning";

export type StaticDataAuditIssue = {
  entityType: "item" | "champion";
  severity: StaticDataAuditSeverity;
  code: string;
  name: string;
  slug: string;
  patch: string;
  riotId: number | null;
  detail: string;
};

export type StaticDataAuditReport = {
  generatedAt: string;
  itemSummary: {
    audited: number;
    latestPatch: string | null;
    issueCount: number;
    issuesByCode: Record<string, number>;
  };
  championSummary: {
    audited: number;
    latestPatch: string | null;
    issueCount: number;
    issuesByCode: Record<string, number>;
  };
  issues: StaticDataAuditIssue[];
};

const flatLabels = new Set(["degats d'attaque", "puissance", "pv", "mana", "armure", "resistance magique"]);
const percentLabels = new Set([
  "chances de coup critique",
  "vitesse d'attaque",
  "vol de vie",
  "omnivampirisme",
  "tenacite",
  "efficacite des soins et boucliers",
]);

const championRequiredFields: Array<keyof ChampionView> = [
  "name",
  "slug",
  "icon",
  "image",
  "patch",
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function startsWithStatLeak(effectText: string, label: string, value: string) {
  const normalizedValue = normalizeText(value).replaceAll(/\s+/g, "");
  const normalizedLabel = normalizeText(label);
  const normalizedEffect = normalizeText(effectText);

  return normalizedEffect.startsWith(`${normalizedValue} ${normalizedLabel}`) || normalizedEffect.startsWith(`${normalizedLabel} ${normalizedValue}`);
}

function isPatchLike(patch: string) {
  return /^\d+\.\d+\.\d+$/.test(String(patch ?? "").trim());
}

function comparePatch(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function getLatestPatch(values: string[]) {
  const patchSet = [...new Set(values.filter(Boolean))];
  if (patchSet.length === 0) {
    return null;
  }
  const sortedPatches = [...patchSet].sort(comparePatch);
  return sortedPatches.at(-1) ?? null;
}

function pushIssue(issues: StaticDataAuditIssue[], issue: StaticDataAuditIssue) {
  issues.push(issue);
}

type BaseIssue = Omit<StaticDataAuditIssue, "severity" | "code" | "detail">;
type ItemStatLineSet = ReturnType<typeof getItemStatLines>;
type ItemRawStatLineSet = ReturnType<typeof getRawItemStatLines>;

function auditItemDisplayStats(
  displayStatLines: ItemStatLineSet,
  seenSignatures: Set<string>,
  seenLabels: Set<string>,
  baseIssue: BaseIssue,
): StaticDataAuditIssue[] {
  const issues: StaticDataAuditIssue[] = [];
  for (const statLine of displayStatLines) {
    const labelKey = normalizeText(statLine.label);
    const signature = `${labelKey}::${statLine.value}`;
    if (seenSignatures.has(signature)) {
      issues.push({ ...baseIssue, severity: "error", code: "duplicate-display-stat", detail: `${statLine.label} ${statLine.value}` });
    }
    seenSignatures.add(signature);
    if (seenLabels.has(labelKey)) {
      issues.push({ ...baseIssue, severity: "warning", code: "duplicate-display-label", detail: statLine.label });
    }
    seenLabels.add(labelKey);
    if (statLine.icon === "default") {
      issues.push({ ...baseIssue, severity: "warning", code: "missing-display-icon", detail: `${statLine.label} ${statLine.value}` });
    }
    const hasPercent = statLine.value.includes("%");
    if (hasPercent && flatLabels.has(labelKey)) {
      issues.push({ ...baseIssue, severity: "error", code: "percent-on-flat-label", detail: `${statLine.label} ${statLine.value}` });
    }
    if (!hasPercent && percentLabels.has(labelKey)) {
      issues.push({ ...baseIssue, severity: "warning", code: "missing-percent-on-percent-label", detail: `${statLine.label} ${statLine.value}` });
    }
  }
  return issues;
}

function auditItemRawStats(
  rawStatLines: ItemRawStatLineSet,
  displayStatLines: ItemStatLineSet,
  baseIssue: BaseIssue,
): StaticDataAuditIssue[] {
  const issues: StaticDataAuditIssue[] = [];
  const rawByLabel = new Map(rawStatLines.map((line) => [normalizeText(line.label), line]));
  for (const rawLine of rawStatLines) {
    const displayLine = rawByLabel.get(normalizeText(rawLine.label));
    const present = displayStatLines.some((entry) => normalizeText(entry.label) === normalizeText(rawLine.label) && entry.value === rawLine.value);
    if (!present) {
      issues.push({ ...baseIssue, severity: "error", code: "raw-stat-missing-from-display", detail: `${rawLine.label} ${rawLine.value}` });
    }
    if (!displayLine) {
      issues.push({ ...baseIssue, severity: "error", code: "raw-stat-label-missing-from-display", detail: rawLine.label });
    }
  }
  return issues;
}

type ItemEffectBlock = ReturnType<typeof getItemEffectBlocks>[number];

function auditItemEffects(
  effectBlocks: ItemEffectBlock[],
  displayStatLines: ItemStatLineSet,
  baseIssue: BaseIssue,
): StaticDataAuditIssue[] {
  const issues: StaticDataAuditIssue[] = [];
  for (const effectBlock of effectBlocks) {
    const effectText = [effectBlock.title, effectBlock.body].filter(Boolean).join(" ");
    for (const statLine of displayStatLines) {
      if (startsWithStatLeak(effectText, statLine.label, statLine.value)) {
        issues.push({ ...baseIssue, severity: "error", code: "base-stat-leaked-into-effects", detail: `${statLine.label} ${statLine.value}` });
      }
    }
  }
  const normalizedEffects = effectBlocks.map((block) => ({
    text: normalizeText([block.title, block.body].filter(Boolean).join(" ")),
    icon: block.icon,
  }));
  const hasCritDamageEffect = normalizedEffects.some((block) => block.text.includes("degats de coup critique"));
  if (hasCritDamageEffect && !normalizedEffects.some((block) => block.icon === "crit")) {
    issues.push({ ...baseIssue, severity: "error", code: "missing-crit-damage-icon", detail: "effet de degats critiques sans icone crit" });
  }
  if (hasCritDamageEffect && displayStatLines.some((line) => normalizeText(line.label) === "chances de coup critique" && line.value.includes("30%"))) {
    issues.push({ ...baseIssue, severity: "error", code: "crit-damage-mislabeled-as-crit-chance", detail: "30% critique detecte sur un libelle de chance critique" });
  }
  return issues;
}

function auditItem(item: GameItem, latestPatch: string | null) {
  const issues: StaticDataAuditIssue[] = [];
  const displayStatLines = getItemStatLines(item);
  const rawStatLines = getRawItemStatLines(item);
  const effectBlocks = getItemEffectBlocks(item);

  const baseIssue: BaseIssue = {
    entityType: "item" as const,
    name: item.name,
    slug: item.slug,
    patch: item.patch,
    riotId: item.riotItemId,
  };

  if (!item.name.trim() || !item.slug.trim() || !item.image.trim()) {
    pushIssue(issues, { ...baseIssue, severity: "error", code: "missing-required-field", detail: "name / slug / image manquant" });
  }

  if (!isPatchLike(item.patch)) {
    pushIssue(issues, { ...baseIssue, severity: "error", code: "invalid-patch-format", detail: item.patch || "(empty)" });
  } else if (latestPatch && item.patch !== latestPatch) {
    pushIssue(issues, { ...baseIssue, severity: "warning", code: "patch-not-latest", detail: `patch=${item.patch}, latest=${latestPatch}` });
  }

  const seenSignatures = new Set<string>();
  const seenLabels = new Set<string>();
  issues.push(
    ...auditItemDisplayStats(displayStatLines, seenSignatures, seenLabels, baseIssue),
    ...auditItemRawStats(rawStatLines, displayStatLines, baseIssue),
    ...auditItemEffects(effectBlocks, displayStatLines, baseIssue),
  );

  return issues;
}

function auditChampionStats(stats: unknown, baseIssue: BaseIssue): StaticDataAuditIssue[] {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    return [{ ...baseIssue, severity: "error", code: "invalid-stats-shape", detail: "stats doit etre un objet" }];
  }
  const issues: StaticDataAuditIssue[] = [];
  for (const [key, value] of Object.entries(stats)) {
    if (value === null || value === undefined) {
      pushIssue(issues, { ...baseIssue, severity: "warning", code: "null-stat-value", detail: key });
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      pushIssue(issues, { ...baseIssue, severity: "error", code: "non-numeric-stat-value", detail: `${key}=${String(value)}` });
    }
  }
  return issues;
}

function auditChampion(champion: ChampionView, latestPatch: string | null) {
  const issues: StaticDataAuditIssue[] = [];
  const baseIssue: BaseIssue = {
    entityType: "champion" as const,
    name: champion.name,
    slug: champion.slug,
    patch: champion.patch,
    riotId: champion.riotChampionId ?? null,
  };

  for (const field of championRequiredFields) {
    const value = champion[field];
    if (typeof value !== "string" || !value.trim()) {
      pushIssue(issues, { ...baseIssue, severity: "error", code: "missing-required-field", detail: String(field) });
    }
  }

  if (!champion.riotChampionId || !champion.championKey) {
    pushIssue(issues, {
      ...baseIssue,
      severity: "error",
      code: "missing-riot-identity",
      detail: `riotChampionId=${champion.riotChampionId ?? "null"}, championKey=${champion.championKey ?? "null"}`,
    });
  }

  if (!Array.isArray(champion.tags) || champion.tags.length === 0) {
    pushIssue(issues, { ...baseIssue, severity: "warning", code: "missing-tags", detail: "tags vides" });
  }

  issues.push(...auditChampionStats(champion.stats, baseIssue));

  if (!isPatchLike(champion.patch)) {
    pushIssue(issues, { ...baseIssue, severity: "error", code: "invalid-patch-format", detail: champion.patch || "(empty)" });
  } else if (latestPatch && champion.patch !== latestPatch) {
    pushIssue(issues, { ...baseIssue, severity: "warning", code: "patch-not-latest", detail: `patch=${champion.patch}, latest=${latestPatch}` });
  }

  return issues;
}

function summarizeIssues(issues: StaticDataAuditIssue[]) {
  return issues.reduce<Record<string, number>>((accumulator, issue) => {
    accumulator[issue.code] = (accumulator[issue.code] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function runStaticDataAudit(input: { items: GameItem[]; champions: ChampionView[] }): StaticDataAuditReport {
  const latestItemPatch = getLatestPatch(input.items.map((item) => item.patch));
  const latestChampionPatch = getLatestPatch(input.champions.map((champion) => champion.patch));
  const itemIssues = input.items.flatMap((item) => auditItem(item, latestItemPatch));
  const championIssues = input.champions.flatMap((champion) => auditChampion(champion, latestChampionPatch));
  const issues = [...itemIssues, ...championIssues].sort((left, right) => {
    if (left.entityType !== right.entityType) {
      return left.entityType.localeCompare(right.entityType);
    }
    if (left.severity !== right.severity) {
      return left.severity.localeCompare(right.severity);
    }
    return left.slug.localeCompare(right.slug);
  });

  return {
    generatedAt: new Date().toISOString(),
    itemSummary: {
      audited: input.items.length,
      latestPatch: latestItemPatch,
      issueCount: itemIssues.length,
      issuesByCode: summarizeIssues(itemIssues),
    },
    championSummary: {
      audited: input.champions.length,
      latestPatch: latestChampionPatch,
      issueCount: championIssues.length,
      issuesByCode: summarizeIssues(championIssues),
    },
    issues,
  };
}

export function buildStaticDataAuditMarkdown(report: StaticDataAuditReport) {
  const itemTopCodes = Object.entries(report.itemSummary.issuesByCode)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);
  const championTopCodes = Object.entries(report.championSummary.issuesByCode)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);
  const topIssues = report.issues.slice(0, 20);

  return [
    "# Static Data Audit",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Items audited: ${report.itemSummary.audited}`,
    `- Champions audited: ${report.championSummary.audited}`,
    `- Item issues: ${report.itemSummary.issueCount}`,
    `- Champion issues: ${report.championSummary.issueCount}`,
    `- Latest item patch: ${report.itemSummary.latestPatch ?? "unknown"}`,
    `- Latest champion patch: ${report.championSummary.latestPatch ?? "unknown"}`,
    "",
    "## Item Summary",
    ...(itemTopCodes.length > 0
      ? itemTopCodes.map(([code, count]) => `- ${code}: ${count}`)
      : ["- No item issues detected."]),
    "",
    "## Champion Summary",
    ...(championTopCodes.length > 0
      ? championTopCodes.map(([code, count]) => `- ${code}: ${count}`)
      : ["- No champion issues detected."]),
    "",
    "## Sample Issues",
    ...(topIssues.length > 0
      ? topIssues.map((issue) => `- [${issue.entityType}] ${issue.slug} | ${issue.severity} | ${issue.code} | ${issue.detail}`)
      : ["- No issues detected."]),
    "",
  ].join("\n");
}
