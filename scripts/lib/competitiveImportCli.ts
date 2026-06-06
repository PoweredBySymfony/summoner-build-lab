import path from "node:path";

export type CliOptions = {
  ownerUserId?: string;
  ownerEmail?: string;
  seedPath: string;
  policyPath: string;
  checkpointPath: string;
  quarantinePath: string;
  reportPath: string;
  markdownReportPath: string;
  targetMatches: number;
  countPerSeed: number;
  maxIdsPerSeed: number;
  startTime?: number;
  endTime?: number | null;
  dryRun: boolean;
  resetCheckpoint: boolean;
  preferredQueues?: number[];
  fallbackQueues?: number[];
  preferredPatchPrefixes?: string[];
  adjacentPatchPrefixes?: string[];
  maxAttemptsPerRun?: number;
  maxCreatedPerRun?: number;
  maxAuthFailuresPerRun?: number;
  trancheSize?: number;
  maxClassifiedPerRun?: number;
  maxSeedDiscoveryFailures?: number;
  refreshDiscovery: boolean;
};

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    seedPath: path.join("data", "seeds", "competitive-seeds-2026.json"),
    policyPath: path.join("data", "config", "competitive-ingestion-policy-2026.json"),
    checkpointPath: path.join("data", "runtime", "competitive-ingestion", "checkpoint.json"),
    quarantinePath: path.join("data", "runtime", "competitive-ingestion", "quarantine.json"),
    reportPath: path.join("data", "runtime", "competitive-ingestion", "report.json"),
    markdownReportPath: path.join("data", "runtime", "competitive-ingestion", "report.md"),
    ownerEmail: "xtrouche@gmail.com",
    targetMatches: 10000,
    countPerSeed: 30,
    maxIdsPerSeed: 300,
    dryRun: false,
    resetCheckpoint: false,
    refreshDiscovery: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    switch (arg) {
      case "--owner-user-id":
        options.ownerUserId = next;
        index += 1;
        break;
      case "--owner-email":
        options.ownerEmail = next;
        index += 1;
        break;
      case "--seed-path":
        if (next) options.seedPath = next;
        index += 1;
        break;
      case "--policy-path":
        if (next) options.policyPath = next;
        index += 1;
        break;
      case "--checkpoint-path":
        if (next) options.checkpointPath = next;
        index += 1;
        break;
      case "--quarantine-path":
        if (next) options.quarantinePath = next;
        index += 1;
        break;
      case "--report-path":
        if (next) options.reportPath = next;
        index += 1;
        break;
      case "--markdown-report-path":
        if (next) options.markdownReportPath = next;
        index += 1;
        break;
      case "--target-matches":
        options.targetMatches = Number(next ?? "2000");
        index += 1;
        break;
      case "--count-per-seed":
        options.countPerSeed = Number(next ?? "30");
        index += 1;
        break;
      case "--max-ids-per-seed":
        options.maxIdsPerSeed = Number(next ?? "300");
        index += 1;
        break;
      case "--start-time":
        options.startTime = Number(next ?? "0");
        index += 1;
        break;
      case "--end-time":
        options.endTime = next ? Number(next) : null;
        index += 1;
        break;
      case "--preferred-queues":
        if (next) {
          options.preferredQueues = next.split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
        }
        index += 1;
        break;
      case "--fallback-queues":
        if (next) {
          options.fallbackQueues = next.split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
        }
        index += 1;
        break;
      case "--preferred-patch-prefixes":
        if (next) {
          options.preferredPatchPrefixes = next.split(",").map((value) => value.trim()).filter(Boolean);
        }
        index += 1;
        break;
      case "--adjacent-patch-prefixes":
        if (next) {
          options.adjacentPatchPrefixes = next.split(",").map((value) => value.trim()).filter(Boolean);
        }
        index += 1;
        break;
      case "--max-attempts-per-run":
        options.maxAttemptsPerRun = Number(next ?? "0");
        index += 1;
        break;
      case "--max-created-per-run":
        options.maxCreatedPerRun = Number(next ?? "0");
        index += 1;
        break;
      case "--max-auth-failures-per-run":
        options.maxAuthFailuresPerRun = Number(next ?? "0");
        index += 1;
        break;
      case "--tranche-size":
        options.trancheSize = Number(next ?? "0");
        index += 1;
        break;
      case "--max-classified-per-run":
        options.maxClassifiedPerRun = Number(next ?? "0");
        index += 1;
        break;
      case "--max-seed-discovery-failures":
        options.maxSeedDiscoveryFailures = Number(next ?? "3");
        index += 1;
        break;
      case "--refresh-discovery":
        options.refreshDiscovery = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--reset-checkpoint":
        options.resetCheckpoint = true;
        break;
      default:
        break;
    }
  }

  return options;
}

export function applyTranchePreset(options: CliOptions) {
  if (!options.trancheSize || !Number.isFinite(options.trancheSize) || options.trancheSize <= 0) {
    return options;
  }

  return {
    ...options,
    maxCreatedPerRun: options.maxCreatedPerRun ?? options.trancheSize,
    maxAttemptsPerRun: options.maxAttemptsPerRun ?? Math.max(options.trancheSize * 2, options.trancheSize + 10),
    maxAuthFailuresPerRun: options.maxAuthFailuresPerRun ?? 3,
    maxClassifiedPerRun: options.maxClassifiedPerRun ?? Math.max(options.trancheSize * 12, options.trancheSize * 6),
  };
}
