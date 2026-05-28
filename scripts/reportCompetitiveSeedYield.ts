import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCompetitiveSeedKey,
  loadCompetitiveIngestionCheckpoint,
  type CompetitiveIngestionCheckpoint,
  type CompetitiveResolvedSeed,
  type CompetitiveSeedMatchDiscovery,
} from "../server/src/lib/riot/competitiveIngestion.js";

type CliOptions = {
  checkpointPath: string;
  jsonPath: string;
  markdownPath: string;
};

type SeedYieldRow = {
  seedKey: string;
  playerName: string;
  team: string;
  league: string;
  role: string;
  priorityTier: string;
  resolutionStatus: string;
  cluster: string | null;
  discoveredMatches: number;
  importedMatches: number;
  rejectedMatches: number;
  failedMatches: number;
  recommendation: string;
};

const DEFAULT_CHECKPOINT_PATH = "data/runtime/competitive-ingestion/phase-2000-wide-pro-2026-04-28.checkpoint.json";
const DEFAULT_JSON_PATH = "reports/competitive-seed-yield-report.json";
const DEFAULT_MARKDOWN_PATH = "reports/competitive-seed-yield-report.md";

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    checkpointPath: DEFAULT_CHECKPOINT_PATH,
    jsonPath: DEFAULT_JSON_PATH,
    markdownPath: DEFAULT_MARKDOWN_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--checkpoint-path" && next) {
      options.checkpointPath = next;
      index += 1;
    } else if (arg === "--json-path" && next) {
      options.jsonPath = next;
      index += 1;
    } else if (arg === "--markdown-path" && next) {
      options.markdownPath = next;
      index += 1;
    }
  }

  return options;
}

function countBy<T>(values: T[], selectKey: (value: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = selectKey(value) ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function buildDiscoveryIndex(discoveries: CompetitiveSeedMatchDiscovery[]) {
  return new Map(discoveries.map((discovery) => [discovery.seedKey, discovery]));
}

function buildImportedCountsBySeed(checkpoint: CompetitiveIngestionCheckpoint) {
  const importedIds = new Set(checkpoint.importedMatchIds);
  const counts = new Map<string, number>();
  for (const discovery of checkpoint.discoveredMatches) {
    const importedForSeed = discovery.matchIds.filter((matchId) => importedIds.has(matchId)).length;
    if (importedForSeed > 0) {
      counts.set(discovery.seedKey, (counts.get(discovery.seedKey) ?? 0) + importedForSeed);
    }
  }
  return counts;
}

function buildRejectedCountsBySeed(checkpoint: CompetitiveIngestionCheckpoint) {
  const counts = new Map<string, number>();
  for (const rejection of checkpoint.rejectedMatchIds) {
    counts.set(rejection.seedKey, (counts.get(rejection.seedKey) ?? 0) + 1);
  }
  return counts;
}

function buildFailedCountsBySeed(checkpoint: CompetitiveIngestionCheckpoint) {
  const counts = new Map<string, number>();
  for (const failure of checkpoint.failedMatches) {
    counts.set(failure.seedKey, (counts.get(failure.seedKey) ?? 0) + 1);
  }
  return counts;
}

function recommendSeed(row: Omit<SeedYieldRow, "recommendation">) {
  if (row.resolutionStatus !== "resolved") {
    return "enrich-riot-id";
  }
  if (row.importedMatches > 0) {
    return "promote-productive";
  }
  if (row.failedMatches > 0) {
    return "quarantine-or-retry-failures";
  }
  if (row.discoveredMatches === 0) {
    return "retry-with-more-pages-or-replace";
  }
  if (row.rejectedMatches > 0) {
    return "inspect-policy-rejections";
  }
  return "monitor";
}

function buildSeedRows(checkpoint: CompetitiveIngestionCheckpoint): SeedYieldRow[] {
  const discoveryIndex = buildDiscoveryIndex(checkpoint.discoveredMatches);
  const importedCounts = buildImportedCountsBySeed(checkpoint);
  const rejectedCounts = buildRejectedCountsBySeed(checkpoint);
  const failedCounts = buildFailedCountsBySeed(checkpoint);

  return checkpoint.resolvedSeeds.map((seed: CompetitiveResolvedSeed) => {
    const seedKey = buildCompetitiveSeedKey(seed);
    const discovery = discoveryIndex.get(seedKey);
    const base = {
      seedKey,
      playerName: seed.playerName,
      team: seed.team,
      league: seed.league,
      role: seed.role,
      priorityTier: seed.priorityTier,
      resolutionStatus: seed.resolutionStatus,
      cluster: seed.cluster,
      discoveredMatches: discovery?.matchIds.length ?? 0,
      importedMatches: importedCounts.get(seedKey) ?? 0,
      rejectedMatches: rejectedCounts.get(seedKey) ?? 0,
      failedMatches: failedCounts.get(seedKey) ?? 0,
    };
    return {
      ...base,
      recommendation: recommendSeed(base),
    };
  }).sort((left, right) =>
    right.importedMatches - left.importedMatches
    || right.discoveredMatches - left.discoveredMatches
    || left.league.localeCompare(right.league)
    || left.playerName.localeCompare(right.playerName),
  );
}

function topRows(rows: SeedYieldRow[], predicate: (row: SeedYieldRow) => boolean, limit = 12) {
  return rows.filter(predicate).slice(0, limit);
}

function renderTable(rows: SeedYieldRow[]) {
  if (rows.length === 0) {
    return "_Aucune seed._";
  }
  const header = "| Seed | League | Role | Region | Decouvert | Importes | Rejets | Echecs | Action |\n|---|---:|---:|---:|---:|---:|---:|---:|---|";
  const lines = rows.map((row) =>
    `| ${row.playerName} (${row.team}) | ${row.league} | ${row.role} | ${row.cluster ?? "unknown"} | ${row.discoveredMatches} | ${row.importedMatches} | ${row.rejectedMatches} | ${row.failedMatches} | ${row.recommendation} |`,
  );
  return [header, ...lines].join("\n");
}

function buildReport(checkpoint: CompetitiveIngestionCheckpoint, checkpointPath: string) {
  const rows = buildSeedRows(checkpoint);
  const resolvedRows = rows.filter((row) => row.resolutionStatus === "resolved");
  const unresolvedRows = rows.filter((row) => row.resolutionStatus !== "resolved");
  const productiveRows = rows.filter((row) => row.importedMatches > 0);
  const resolvedNoMatchesRows = resolvedRows.filter((row) => row.discoveredMatches === 0);
  const discoveredNoImportRows = resolvedRows.filter((row) => row.discoveredMatches > 0 && row.importedMatches === 0);

  const summary = {
    generatedAt: new Date().toISOString(),
    checkpointPath,
    totalSeeds: rows.length,
    resolvedSeeds: resolvedRows.length,
    unresolvedSeeds: unresolvedRows.length,
    productiveSeeds: productiveRows.length,
    resolvedNoMatchesSeeds: resolvedNoMatchesRows.length,
    discoveredNoImportSeeds: discoveredNoImportRows.length,
    importedMatchesInCheckpoint: checkpoint.importedMatchIds.length,
    attemptedMatchesInCheckpoint: checkpoint.attemptedMatchIds.length,
    rejectedMatchesInCheckpoint: checkpoint.rejectedMatchIds.length,
    failedMatchesInCheckpoint: checkpoint.failedMatches.length,
    discoveryStopReason: checkpoint.discoveryStopReason ?? null,
  };

  return {
    summary,
    distributions: {
      recommendations: countBy(rows, (row) => row.recommendation),
      resolvedNoMatchesByLeague: countBy(resolvedNoMatchesRows, (row) => row.league),
      productiveByLeague: countBy(productiveRows, (row) => row.league),
      productiveByRegion: countBy(productiveRows, (row) => row.cluster),
    },
    topProductiveSeeds: topRows(productiveRows, () => true),
    topResolvedNoMatchesSeeds: topRows(
      resolvedNoMatchesRows.sort((left, right) => left.league.localeCompare(right.league) || left.playerName.localeCompare(right.playerName)),
      () => true,
    ),
    topDiscoveredNoImportSeeds: topRows(
      discoveredNoImportRows.sort((left, right) => right.discoveredMatches - left.discoveredMatches || left.playerName.localeCompare(right.playerName)),
      () => true,
    ),
    rows,
  };
}

function renderMarkdown(report: ReturnType<typeof buildReport>) {
  const { summary, distributions } = report;
  return [
    "# Competitive seed yield report",
    "",
    `Generated at: ${summary.generatedAt}`,
    `Checkpoint: \`${summary.checkpointPath}\``,
    "",
    "## Summary",
    "",
    `- Seeds: ${summary.totalSeeds} (${summary.resolvedSeeds} resolved, ${summary.unresolvedSeeds} unresolved)`,
    `- Productive seeds: ${summary.productiveSeeds}`,
    `- Resolved without discovered matches: ${summary.resolvedNoMatchesSeeds}`,
    `- Discovered without import: ${summary.discoveredNoImportSeeds}`,
    `- Imported/attempted/rejected/failed matches in checkpoint: ${summary.importedMatchesInCheckpoint}/${summary.attemptedMatchesInCheckpoint}/${summary.rejectedMatchesInCheckpoint}/${summary.failedMatchesInCheckpoint}`,
    `- Discovery stop reason: ${summary.discoveryStopReason ?? "none"}`,
    "",
    "## Recommendations",
    "",
    ...distributions.recommendations.map((entry) => `- ${entry.key}: ${entry.count}`),
    "",
    "## Productive seeds",
    "",
    renderTable(report.topProductiveSeeds),
    "",
    "## Resolved seeds without matches",
    "",
    renderTable(report.topResolvedNoMatchesSeeds),
    "",
    "## Discovered but not imported",
    "",
    renderTable(report.topDiscoveredNoImportSeeds),
    "",
    "## League signal",
    "",
    "Resolved/no-match by league:",
    ...distributions.resolvedNoMatchesByLeague.slice(0, 10).map((entry) => `- ${entry.key}: ${entry.count}`),
    "",
    "Productive by league:",
    ...distributions.productiveByLeague.slice(0, 10).map((entry) => `- ${entry.key}: ${entry.count}`),
    "",
  ].join("\n");
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const checkpoint = await loadCompetitiveIngestionCheckpoint(options.checkpointPath);
  if (!checkpoint) {
    throw new Error(`Checkpoint not found: ${options.checkpointPath}`);
  }

  const report = buildReport(checkpoint, options.checkpointPath);
  await mkdir(path.dirname(options.jsonPath), { recursive: true });
  await mkdir(path.dirname(options.markdownPath), { recursive: true });
  await writeFile(options.jsonPath, JSON.stringify(report, null, 2), "utf-8");
  await writeFile(options.markdownPath, renderMarkdown(report), "utf-8");

  console.info(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
