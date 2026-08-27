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

type ValueOptionHandler = (options: CliOptions, next: string | undefined) => void;

const parseFiniteNumberList = (value: string) =>
  value.split(",").map((entry) => Number(entry.trim())).filter(Number.isFinite);

const parseStringList = (value: string) =>
  value.split(",").map((entry) => entry.trim()).filter(Boolean);

const valueOptionHandlers: Record<string, ValueOptionHandler> = {
  "--owner-user-id": (options, next) => {
    options.ownerUserId = next;
  },
  "--owner-email": (options, next) => {
    options.ownerEmail = next;
  },
  "--seed-path": (options, next) => {
    if (next) options.seedPath = next;
  },
  "--policy-path": (options, next) => {
    if (next) options.policyPath = next;
  },
  "--checkpoint-path": (options, next) => {
    if (next) options.checkpointPath = next;
  },
  "--quarantine-path": (options, next) => {
    if (next) options.quarantinePath = next;
  },
  "--report-path": (options, next) => {
    if (next) options.reportPath = next;
  },
  "--markdown-report-path": (options, next) => {
    if (next) options.markdownReportPath = next;
  },
  "--target-matches": (options, next) => {
    options.targetMatches = Number(next ?? "2000");
  },
  "--count-per-seed": (options, next) => {
    options.countPerSeed = Number(next ?? "30");
  },
  "--max-ids-per-seed": (options, next) => {
    options.maxIdsPerSeed = Number(next ?? "300");
  },
  "--start-time": (options, next) => {
    options.startTime = Number(next ?? "0");
  },
  "--end-time": (options, next) => {
    options.endTime = next ? Number(next) : null;
  },
  "--preferred-queues": (options, next) => {
    if (next) options.preferredQueues = parseFiniteNumberList(next);
  },
  "--fallback-queues": (options, next) => {
    if (next) options.fallbackQueues = parseFiniteNumberList(next);
  },
  "--preferred-patch-prefixes": (options, next) => {
    if (next) options.preferredPatchPrefixes = parseStringList(next);
  },
  "--adjacent-patch-prefixes": (options, next) => {
    if (next) options.adjacentPatchPrefixes = parseStringList(next);
  },
  "--max-attempts-per-run": (options, next) => {
    options.maxAttemptsPerRun = Number(next ?? "0");
  },
  "--max-created-per-run": (options, next) => {
    options.maxCreatedPerRun = Number(next ?? "0");
  },
  "--max-auth-failures-per-run": (options, next) => {
    options.maxAuthFailuresPerRun = Number(next ?? "0");
  },
  "--tranche-size": (options, next) => {
    options.trancheSize = Number(next ?? "0");
  },
  "--max-classified-per-run": (options, next) => {
    options.maxClassifiedPerRun = Number(next ?? "0");
  },
  "--max-seed-discovery-failures": (options, next) => {
    options.maxSeedDiscoveryFailures = Number(next ?? "3");
  },
};

const flagOptionHandlers: Record<string, (options: CliOptions) => void> = {
  "--refresh-discovery": (options) => {
    options.refreshDiscovery = true;
  },
  "--dry-run": (options) => {
    options.dryRun = true;
  },
  "--reset-checkpoint": (options) => {
    options.resetCheckpoint = true;
  },
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

  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    index += 1;
    const next = argv[index];

    const valueHandler = valueOptionHandlers[arg];
    if (valueHandler) {
      valueHandler(options, next);
      index += 1;
      continue;
    }

    const flagHandler = flagOptionHandlers[arg];
    if (flagHandler) {
      flagHandler(options);
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
