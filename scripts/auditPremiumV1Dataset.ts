import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../server/src/lib/prisma.js";
import {
  COMPETITIVE_SOURCE_KINDS,
  extractCompetitiveProvenance,
  resolveFirstExistingPath,
} from "./lib/competitiveImportedMatchProvenance.js";

type CliOptions = {
  datasetReportPath: string;
  outputJsonPath: string;
  outputMarkdownPath: string;
  trainingConfigPath: string;
  checkpointReportPath: string;
};

type AuditMatchRow = {
  patch: string | null;
  timelineFetchedAt: Date | null;
  timelineMissingReason: string | null;
  sourceKind: string | null;
  sourceMetadata: unknown;
  sourceRegion: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    datasetReportPath: path.join("ml", "artifacts", "reports", "dataset-report.json"),
    outputJsonPath: path.join("reports", "premium-v1-dataset-audit.json"),
    outputMarkdownPath: path.join("reports", "premium-v1-dataset-audit.md"),
    trainingConfigPath: path.join("ml", "configs", "base.yaml"),
    checkpointReportPath: path.join("data", "runtime", "competitive-ingestion", "report.json"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--dataset-report-path":
        if (next) {
          options.datasetReportPath = next;
        }
        index += 1;
        break;
      case "--output-json":
        if (next) {
          options.outputJsonPath = next;
        }
        index += 1;
        break;
      case "--output-markdown":
        if (next) {
          options.outputMarkdownPath = next;
        }
        index += 1;
        break;
      case "--training-config-path":
        if (next) {
          options.trainingConfigPath = next;
        }
        index += 1;
        break;
      case "--checkpoint-report-path":
        if (next) {
          options.checkpointReportPath = next;
        }
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

function countBy(values: string[]) {
  return Object.entries(
    values.reduce<Record<string, number>>((accumulator, value) => {
      accumulator[value] = (accumulator[value] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function parseSimpleYamlListBlock(raw: string, key: string) {
  const lines = raw.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `${key}:`);
  if (startIndex === -1) {
    return [];
  }
  const values: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("    - ")) {
      break;
    }
    values.push(line.replace("    - ", "").trim().replace(/^"(.*)"$/, "$1"));
  }
  return values;
}

function parseSimpleYamlScalar(raw: string, key: string) {
  const line = raw.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}:`));
  return line ? line.split(":").slice(1).join(":").trim() : null;
}

function buildScopeSummary(matches: AuditMatchRow[]) {
  const totalImportedMatches = matches.length;
  const totalValidTimelines = matches.filter((match) => match.timelineFetchedAt && !match.timelineMissingReason).length;
  const matchsParPatch = countBy(matches.map((match) => String(match.patch ?? "unknown"))).map(({ key, count }) => ({
    patch: key,
    count,
  }));
  const matchsParSourceKind = countBy(matches.map((match) => String(match.sourceKind ?? "unknown"))).map(({ key, count }) => ({
    sourceKind: key,
    count,
  }));
  const matchsParSourceTier = countBy(
    matches.map((match) => extractCompetitiveProvenance(match).priorityTier),
  ).map(({ key, count }) => ({
    sourceTier: key,
    count,
  }));
  const matchsParSourceLeague = countBy(
    matches.map((match) => extractCompetitiveProvenance(match).sourceLeague ?? "unknown"),
  ).map(({ key, count }) => ({
    sourceLeague: key,
    count,
  }));
  const matchsParSourceRegionHint = countBy(
    matches.map((match) => extractCompetitiveProvenance(match).sourceRegionHint ?? "unknown"),
  ).map(({ key, count }) => ({
    sourceRegionHint: key,
    count,
  }));
  const premiumPatchPrefixes = ["26.1", "26.2", "26.3", "26.4", "26.5", "26.6", "26.7"];
  const premiumRecentMatches26x = matches.filter((match) =>
    premiumPatchPrefixes.some((prefix) => String(match.patch ?? "").startsWith(prefix))
  ).length;
  const premiumRecentShare26x = totalImportedMatches > 0 ? Number(((premiumRecentMatches26x / totalImportedMatches) * 100).toFixed(2)) : 0;

  return {
    totalImportedMatches,
    totalValidTimelines,
    matchsParPatch,
    matchsParSourceKind,
    matchsParSourceTier,
    matchsParSourceLeague,
    matchsParSourceRegionHint,
    premiumRecentMatches26x,
    premiumRecentShare26x,
  };
}

function renderScopeMarkdown(title: string, scope: ReturnType<typeof buildScopeSummary>) {
  return [
    `## ${title}`,
    `- Total imported matches: ${scope.totalImportedMatches}`,
    `- Total valid timelines: ${scope.totalValidTimelines}`,
    `- Premium recent matches (26.1-26.7): ${scope.premiumRecentMatches26x}`,
    `- Premium recent share: ${scope.premiumRecentShare26x}`,
    "",
    "### Match Distribution By Source Tier",
    ...scope.matchsParSourceTier.map((entry) => `- ${entry.sourceTier}: ${entry.count}`),
    "",
    "### Match Distribution By Source Kind",
    ...scope.matchsParSourceKind.map((entry) => `- ${entry.sourceKind}: ${entry.count}`),
    "",
    "### Match Distribution By Patch",
    ...scope.matchsParPatch.map((entry) => `- ${entry.patch}: ${entry.count}`),
    "",
    "### Match Distribution By Source League",
    ...scope.matchsParSourceLeague.slice(0, 15).map((entry) => `- ${entry.sourceLeague}: ${entry.count}`),
    "",
    "### Match Distribution By Source Region Hint",
    ...scope.matchsParSourceRegionHint.map((entry) => `- ${entry.sourceRegionHint}: ${entry.count}`),
    "",
  ].join("\n");
}

function buildMarkdown(report: Record<string, unknown>) {
  const dataset = (report.dataset as Record<string, unknown> | undefined) ?? {};
  const snapshotsByPatch = Object.entries((dataset.snapshotsByPatch as Record<string, number> | undefined) ?? {});
  const snapshotsByRole = Object.entries((dataset.snapshotsByRole as Record<string, number> | undefined) ?? {});
  const snapshotsByChampion = Object.entries((dataset.snapshotsByChampion as Record<string, number> | undefined) ?? {});
  const reproduction =
    (((report.reproduction as { commands?: string[] } | undefined)?.commands) ?? []).map((command) => `- \`${command}\``);
  const scopeComparison = (report.scopeComparison as Record<string, unknown> | undefined) ?? {};
  const reportingScopes = (report.reportingScopes as Record<string, string> | undefined) ?? {};
  const scopes = (report.scopes as Record<string, ReturnType<typeof buildScopeSummary>> | undefined) ?? {};

  return [
    "# Premium V1 Dataset Audit",
    "",
    `- Generated at: ${String(report.generatedAt ?? "")}`,
    `- Competitive report path: ${String((report.ingestionCheckpoint as { resolvedCheckpointReportPath?: string } | undefined)?.resolvedCheckpointReportPath ?? "none")}`,
    `- Baseline state: ${String((report.baseline as { state?: string } | undefined)?.state ?? "")}`,
    `- Ingestion freeze: ${String((report.baseline as { ingestionFrozen?: boolean } | undefined)?.ingestionFrozen ?? false)}`,
    `- Training policy verified: ${String((report.trainingPolicy as { recentFirstVerified?: boolean } | undefined)?.recentFirstVerified ?? false)}`,
    "",
    "## Reporting Scopes",
    `- DB-wide: ${String(reportingScopes.dbWide ?? "")}`,
    `- Premium-only: ${String(reportingScopes.premiumOnly ?? "")}`,
    `- Competitive report: ${String(reportingScopes.competitiveReport ?? "")}`,
    "",
    "## Scope Gap",
    `- DB-wide total matches: ${String(scopeComparison.dbWideTotalMatches ?? 0)}`,
    `- Competitive matches in DB: ${String(scopeComparison.competitiveMatchesInDb ?? 0)}`,
    `- Premium-only matches: ${String(scopeComparison.premiumOnlyMatches ?? 0)}`,
    `- Excluded from premium-only because non-competitive: ${String(scopeComparison.excludedNonCompetitiveMatches ?? 0)}`,
    `- Excluded from premium-only because source tier still unknown: ${String(scopeComparison.excludedCompetitiveUnknownTierMatches ?? 0)}`,
    `- Unknown source tier among competitive matches: ${String(scopeComparison.competitiveUnknownTierCount ?? 0)}`,
    `- Explanation: ${String(scopeComparison.explanation ?? "")}`,
    "",
    renderScopeMarkdown("DB-wide", scopes.dbWide ?? buildScopeSummary([])),
    renderScopeMarkdown("Premium-only", scopes.premiumOnly ?? buildScopeSummary([])),
    "## Dataset",
    `- Total snapshots generated: ${String(dataset.totalSnapshotsGenerated ?? 0)}`,
    `- Snapshots trainable strict recents: ${String(dataset.snapshotsTrainableStrictRecents ?? 0)}`,
    `- Candidate pool median: ${String(dataset.candidatePoolMedian ?? 0)}`,
    `- Candidate pool p95: ${String(dataset.candidatePoolP95 ?? 0)}`,
    `- Gold incoherent ratio: ${String(dataset.goldIncoherentRatio ?? 0)}`,
    `- Missing actual item ratio: ${String(dataset.missingActualItemRatio ?? 0)}`,
    "",
    "## Snapshots By Patch",
    ...snapshotsByPatch.map(([patch, count]) => `- ${patch}: ${count}`),
    "",
    "## Snapshots By Role",
    ...snapshotsByRole.map(([role, count]) => `- ${role}: ${count}`),
    "",
    "## Snapshots By Champion",
    ...snapshotsByChampion.slice(0, 20).map(([champion, count]) => `- ${champion}: ${count}`),
    "",
    "## Reproduction",
    ...reproduction,
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const datasetReport = JSON.parse(await readFile(path.resolve(options.datasetReportPath), "utf-8")) as Record<string, unknown>;
  const trainingConfig = await readFile(path.resolve(options.trainingConfigPath), "utf-8");
  const resolvedCheckpointReportPath = await resolveFirstExistingPath([
    options.checkpointReportPath,
    path.join("data", "runtime", "competitive-ingestion", "real-report.json"),
  ]);

  let checkpointReport: Record<string, unknown> = {};
  try {
    checkpointReport = JSON.parse(await readFile(resolvedCheckpointReportPath, "utf-8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const matches = await prisma.importedMatch.findMany({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      patch: true,
      timelineFetchedAt: true,
      timelineMissingReason: true,
      sourceKind: true,
      sourceMetadata: true,
      sourceRegion: true,
    },
  });

  const competitiveMatches = matches.filter((match) =>
    COMPETITIVE_SOURCE_KINDS.includes((match.sourceKind ?? "") as (typeof COMPETITIVE_SOURCE_KINDS)[number])
  );
  const premiumOnlyMatches = competitiveMatches.filter((match) => extractCompetitiveProvenance(match).hasKnownTier);
  const competitiveUnknownTierCount = competitiveMatches.filter((match) => !extractCompetitiveProvenance(match).hasKnownTier).length;

  const strictPrefixes = parseSimpleYamlListBlock(trainingConfig, "strict_train_patch_prefixes");
  const adjacentPrefixes = parseSimpleYamlListBlock(trainingConfig, "adjacent_train_patch_prefixes");
  const trainPatchMode = parseSimpleYamlScalar(trainingConfig, "train_patch_mode");

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    baseline: {
      id: "premium-v1",
      state: "frozen-for-ml-audit",
      ingestionFrozen: true,
      note: "Ne pas relancer l'ingestion competitive tant que l'evaluation premium v1 n'est pas terminee.",
    },
    reportingScopes: {
      dbWide: "Tous les ImportedMatch de la base, quelle que soit la provenance.",
      premiumOnly: "Sous-ensemble premium exploitable: sourceKind competitif + sourceTier connu.",
      competitiveReport: "Rapport pipeline competitif source-filtered, limite aux imports competitifs observes par le checkpoint/report.",
    },
    scopeComparison: {
      dbWideTotalMatches: matches.length,
      competitiveMatchesInDb: competitiveMatches.length,
      premiumOnlyMatches: premiumOnlyMatches.length,
      excludedNonCompetitiveMatches: matches.length - competitiveMatches.length,
      excludedCompetitiveUnknownTierMatches: competitiveUnknownTierCount,
      competitiveUnknownTierCount,
      explanation:
        "Le mismatch venait du fait que le report competitif ne couvre que les imports competitifs, alors que l'audit ML exportait toute la base. Le scope premium-only rend maintenant cet ecart explicite.",
    },
    scopes: {
      dbWide: buildScopeSummary(matches),
      premiumOnly: buildScopeSummary(premiumOnlyMatches),
    },
    dataset: {
      totalSnapshotsGenerated: Number(datasetReport.rows ?? 0),
      snapshotsByPatch: (datasetReport.snapshots_by_patch as Record<string, number> | undefined) ?? {},
      snapshotsByRole: (datasetReport.snapshots_by_role as Record<string, number> | undefined) ?? {},
      snapshotsByChampion: (datasetReport.snapshots_by_champion as Record<string, number> | undefined) ?? {},
      candidatePoolMedian: Number(((datasetReport.quality as Record<string, unknown> | undefined)?.candidate_pool_median ?? 0)),
      candidatePoolP95: Number(((datasetReport.quality as Record<string, unknown> | undefined)?.candidate_pool_p95 ?? 0)),
      goldIncoherentRatio: Number(((datasetReport.quality as Record<string, unknown> | undefined)?.gold_incoherent_ratio ?? 0)),
      missingActualItemRatio: Number(((datasetReport.quality as Record<string, unknown> | undefined)?.missing_actual_item_ratio ?? 0)),
      snapshotsTrainableStrictRecents: Number(datasetReport.snapshots_trainable_strict ?? 0),
      rowsBeforeTrainPatchFilter: Number(datasetReport.rows_before_train_patch_filter ?? 0),
      rowsAfterTrainPatchFilter: Number(datasetReport.rows_after_train_patch_filter ?? 0),
    },
    trainingPolicy: {
      trainPatchMode,
      strictTrainPatchPrefixes: strictPrefixes,
      adjacentTrainPatchPrefixes: adjacentPrefixes,
      recentFirstVerified: trainPatchMode === "strict_recent_competitive" && strictPrefixes.includes("26."),
    },
    ingestionCheckpoint: {
      resolvedCheckpointReportPath,
      totalCompetitiveMatchesInDb: Number(checkpointReport.totalCompetitiveMatchesInDb ?? 0),
      createdMatches: Number(checkpointReport.createdMatches ?? 0),
      discoveredUniqueMatches: Number(checkpointReport.discoveredUniqueMatches ?? 0),
      tierDistribution: checkpointReport.tierDistribution ?? [],
    },
    reproduction: {
      commands: [
        "npm run backfill:competitive-provenance",
        "npm run riot:report-competitive",
        "npm run ml:export-raw",
        "ml\\.venv\\Scripts\\python.exe ml\\scripts\\tasks.py build-dataset",
        "npm run audit:premium-v1-dataset",
      ],
    },
  };

  const outputJsonPath = path.resolve(options.outputJsonPath);
  const outputMarkdownPath = path.resolve(options.outputMarkdownPath);
  await mkdir(path.dirname(outputJsonPath), { recursive: true });
  await mkdir(path.dirname(outputMarkdownPath), { recursive: true });
  await Promise.all([
    writeFile(outputJsonPath, JSON.stringify(reportPayload, null, 2), "utf-8"),
    writeFile(outputMarkdownPath, buildMarkdown(reportPayload), "utf-8"),
  ]);

  console.info(JSON.stringify(reportPayload, null, 2));
}

main()
  .catch((error) => {
    console.error("[premium-v1-audit] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
