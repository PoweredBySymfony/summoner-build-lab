import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../server/src/lib/prisma.js";

type CliOptions = {
  datasetReportPath: string;
  outputJsonPath: string;
  outputMarkdownPath: string;
  trainingConfigPath: string;
  checkpointPath: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    datasetReportPath: path.join("ml", "artifacts", "reports", "dataset-report.json"),
    outputJsonPath: path.join("reports", "premium-v1-dataset-audit.json"),
    outputMarkdownPath: path.join("reports", "premium-v1-dataset-audit.md"),
    trainingConfigPath: path.join("ml", "configs", "base.yaml"),
    checkpointPath: path.join("data", "runtime", "competitive-ingestion", "report.json"),
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
          options.checkpointPath = next;
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

function buildMarkdown(report: Record<string, unknown>) {
  const patchDistribution =
    ((report.database as { matchsParPatch?: Array<{ patch: string; count: number }> } | undefined)?.matchsParPatch) ?? [];
  const sourceTierDistribution =
    ((report.database as { matchsParSourceTier?: Array<{ sourceTier: string; count: number }> } | undefined)?.matchsParSourceTier) ?? [];
  const snapshotsByPatch =
    Object.entries((report.dataset as { snapshotsByPatch?: Record<string, number> } | undefined)?.snapshotsByPatch ?? {});
  const snapshotsByRole =
    Object.entries((report.dataset as { snapshotsByRole?: Record<string, number> } | undefined)?.snapshotsByRole ?? {});
  const snapshotsByChampion =
    Object.entries((report.dataset as { snapshotsByChampion?: Record<string, number> } | undefined)?.snapshotsByChampion ?? {});
  const reproduction =
    ((report.reproduction as { commands?: string[] } | undefined)?.commands ?? []).map((command) => `- \`${command}\``);

  return [
    "# Premium V1 Dataset Audit",
    "",
    `- Generated at: ${String(report.generatedAt ?? "")}`,
    `- Baseline state: ${String((report.baseline as { state?: string } | undefined)?.state ?? "")}`,
    `- Ingestion freeze: ${String((report.baseline as { ingestionFrozen?: boolean } | undefined)?.ingestionFrozen ?? false)}`,
    `- Training policy verified: ${String((report.trainingPolicy as { recentFirstVerified?: boolean } | undefined)?.recentFirstVerified ?? false)}`,
    "",
    "## Database",
    `- Total imported matches: ${String((report.database as { totalImportedMatches?: number } | undefined)?.totalImportedMatches ?? 0)}`,
    `- Total valid timelines: ${String((report.database as { totalValidTimelines?: number } | undefined)?.totalValidTimelines ?? 0)}`,
    `- Premium recent matches (26.1-26.7): ${String((report.database as { premiumRecentMatches26x?: number } | undefined)?.premiumRecentMatches26x ?? 0)}`,
    `- Premium recent share: ${String((report.database as { premiumRecentShare26x?: number } | undefined)?.premiumRecentShare26x ?? 0)}`,
    "",
    "## Match Distribution By Patch",
    ...patchDistribution.map((entry) => `- ${entry.patch}: ${entry.count}`),
    "",
    "## Match Distribution By Source Tier",
    ...sourceTierDistribution.map((entry) => `- ${entry.sourceTier}: ${entry.count}`),
    "",
    "## Dataset",
    `- Total snapshots generated: ${String((report.dataset as { totalSnapshotsGenerated?: number } | undefined)?.totalSnapshotsGenerated ?? 0)}`,
    `- Snapshots trainable strict recents: ${String((report.dataset as { snapshotsTrainableStrictRecents?: number } | undefined)?.snapshotsTrainableStrictRecents ?? 0)}`,
    `- Candidate pool median: ${String((report.dataset as { candidatePoolMedian?: number } | undefined)?.candidatePoolMedian ?? 0)}`,
    `- Candidate pool p95: ${String((report.dataset as { candidatePoolP95?: number } | undefined)?.candidatePoolP95 ?? 0)}`,
    `- Gold incoherent ratio: ${String((report.dataset as { goldIncoherentRatio?: number } | undefined)?.goldIncoherentRatio ?? 0)}`,
    `- Missing actual item ratio: ${String((report.dataset as { missingActualItemRatio?: number } | undefined)?.missingActualItemRatio ?? 0)}`,
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
  let checkpointReport: Record<string, unknown> = {};
  try {
    checkpointReport = JSON.parse(await readFile(path.resolve(options.checkpointPath), "utf-8")) as Record<string, unknown>;
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
    },
  });

  const totalImportedMatches = matches.length;
  const totalValidTimelines = matches.filter((match) => match.timelineFetchedAt && !match.timelineMissingReason).length;
  const matchsParPatch = countBy(matches.map((match) => String(match.patch ?? "unknown"))).map(({ key, count }) => ({
    patch: key,
    count,
  }));
  const matchsParSourceTier = countBy(
    matches.map((match) => {
      const metadata =
        typeof match.sourceMetadata === "object" && match.sourceMetadata !== null && !Array.isArray(match.sourceMetadata)
          ? (match.sourceMetadata as Record<string, unknown>)
          : {};
      const seed =
        typeof metadata.seed === "object" && metadata.seed !== null && !Array.isArray(metadata.seed)
          ? (metadata.seed as Record<string, unknown>)
          : {};
      return String(seed.priorityTier ?? "unknown");
    }),
  ).map(({ key, count }) => ({
    sourceTier: key,
    count,
  }));

  const premiumPatchPrefixes = ["26.1", "26.2", "26.3", "26.4", "26.5", "26.6", "26.7"];
  const premiumRecentMatches26x = matches.filter((match) =>
    premiumPatchPrefixes.some((prefix) => String(match.patch ?? "").startsWith(prefix))
  ).length;
  const premiumRecentShare26x = totalImportedMatches > 0 ? Number(((premiumRecentMatches26x / totalImportedMatches) * 100).toFixed(2)) : 0;

  const snapshotsByPatch = (datasetReport.snapshots_by_patch as Record<string, number> | undefined) ?? {};
  const snapshotsByRole = (datasetReport.snapshots_by_role as Record<string, number> | undefined) ?? {};
  const snapshotsByChampion = (datasetReport.snapshots_by_champion as Record<string, number> | undefined) ?? {};
  const quality = (datasetReport.quality as {
    candidate_pool_median?: number;
    candidate_pool_p95?: number;
    gold_incoherent_ratio?: number;
    missing_actual_item_ratio?: number;
  } | undefined) ?? {};
  const candidatePoolMedian = Number(quality.candidate_pool_median ?? 0);
  const candidatePoolP95 = Number(quality.candidate_pool_p95 ?? 0);
  const goldIncoherentRatio = Number(quality.gold_incoherent_ratio ?? 0);
  const missingActualItemRatio = Number(quality.missing_actual_item_ratio ?? 0);
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
    database: {
      totalImportedMatches,
      totalValidTimelines,
      matchsParPatch,
      matchsParSourceTier,
      premiumRecentMatches26x,
      premiumRecentShare26x,
    },
    dataset: {
      totalSnapshotsGenerated: Number(datasetReport.rows ?? 0),
      snapshotsByPatch,
      snapshotsByRole,
      snapshotsByChampion,
      candidatePoolMedian,
      candidatePoolP95,
      goldIncoherentRatio,
      missingActualItemRatio,
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
      totalCompetitiveMatchesInDb: Number(checkpointReport.totalCompetitiveMatchesInDb ?? 0),
      createdMatches: Number(checkpointReport.createdMatches ?? 0),
      discoveredUniqueMatches: Number(checkpointReport.discoveredUniqueMatches ?? 0),
    },
    reproduction: {
      commands: [
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
