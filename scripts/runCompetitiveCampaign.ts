import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { prisma } from "../server/src/lib/prisma.js";
import { riotApiClient } from "../server/src/lib/riot/riotApiClient.js";

type CampaignOptions = {
  seedPath: string;
  policyPath: string;
  checkpointPath: string;
  quarantinePath: string;
  targetMatches: number;
  stageSize: number;
  countPerSeed: number;
  maxIdsPerSeed: number;
  maxStages: number;
  auditSampleSize: number;
  reportDir: string;
  ownerUserId?: string;
  ownerEmail?: string;
  dryRun: boolean;
  resetCheckpoint: boolean;
  maxSeedDiscoveryFailures: number;
  refreshDiscovery: boolean;
  minCompletedRate: number;
  maxNoViableRate: number;
};

type StageSummary = {
  stage: number;
  importReportPath: string;
  validationReportPath: string;
  throughputReportPath: string;
  premiumDatasetAuditPath: string;
  throughputReport: Record<string, unknown>;
  importReport: Record<string, unknown>;
  validationReport: Record<string, unknown>;
  stopReason: string | null;
  qualityGatePassed: boolean;
};

type CampaignSummary = {
  generatedAt: string;
  seedPath: string;
  policyPath: string;
  checkpointPath: string;
  targetMatches: number;
  stageSize: number;
  countPerSeed: number;
  maxIdsPerSeed: number;
  maxStages: number;
  maxSeedDiscoveryFailures: number;
  auditSampleSize: number;
  preflight: {
    database: "ok" | "failed";
    riot: "ok" | "failed";
    databaseError?: string;
    riotError?: string;
  };
  stages: StageSummary[];
  stoppedReason: string | null;
};

type ArgHandler = (options: CampaignOptions, next: string | undefined) => boolean;

const campaignArgHandlers: Record<string, ArgHandler> = {
  "--seed-path": (o, v) => { if (v) o.seedPath = v; return true; },
  "--policy-path": (o, v) => { if (v) o.policyPath = v; return true; },
  "--checkpoint-path": (o, v) => { if (v) o.checkpointPath = v; return true; },
  "--quarantine-path": (o, v) => { if (v) o.quarantinePath = v; return true; },
  "--report-dir": (o, v) => { if (v) o.reportDir = v; return true; },
  "--owner-user-id": (o, v) => { o.ownerUserId = v; return true; },
  "--owner-email": (o, v) => { o.ownerEmail = v; return true; },
  "--target-matches": (o, v) => { o.targetMatches = Number(v ?? "2000"); return true; },
  "--stage-size": (o, v) => { o.stageSize = Number(v ?? "50"); return true; },
  "--count-per-seed": (o, v) => { o.countPerSeed = Number(v ?? "40"); return true; },
  "--max-ids-per-seed": (o, v) => { o.maxIdsPerSeed = Number(v ?? "400"); return true; },
  "--max-stages": (o, v) => { o.maxStages = Number(v ?? "1"); return true; },
  "--audit-sample-size": (o, v) => { o.auditSampleSize = Number(v ?? "20"); return true; },
  "--max-seed-discovery-failures": (o, v) => { o.maxSeedDiscoveryFailures = Number(v ?? "2"); return true; },
  "--min-completed-rate": (o, v) => { o.minCompletedRate = Number(v ?? "0.9"); return true; },
  "--max-no-viable-rate": (o, v) => { o.maxNoViableRate = Number(v ?? "0.1"); return true; },
  "--dry-run": (o) => { o.dryRun = true; return false; },
  "--reset-checkpoint": (o) => { o.resetCheckpoint = true; return false; },
  "--refresh-discovery": (o) => { o.refreshDiscovery = true; return false; },
};

function parseArgs(argv: string[]): CampaignOptions {
  const options: CampaignOptions = {
    seedPath: path.join("data", "seeds", "competitive-seeds-2026.json"),
    policyPath: path.join("data", "config", "competitive-ingestion-policy-2026.json"),
    checkpointPath: path.join("data", "runtime", "competitive-ingestion", "phase-2000-2026-04-19.checkpoint.json"),
    quarantinePath: path.join("data", "runtime", "competitive-ingestion", "quarantine.json"),
    targetMatches: 2000,
    stageSize: 50,
    countPerSeed: 40,
    maxIdsPerSeed: 400,
    maxStages: 1,
    auditSampleSize: 20,
    reportDir: path.join("data", "runtime", "campaigns", `competitive-${new Date().toISOString().replace(/[:.]/g, "-")}`),
    dryRun: false,
    resetCheckpoint: false,
    maxSeedDiscoveryFailures: 2,
    refreshDiscovery: false,
    minCompletedRate: 0.9,
    maxNoViableRate: 0.1,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const handler = campaignArgHandlers[argv[index]];
    if (handler?.(options, argv[index + 1])) {
      index += 1;
    }
  }

  return options;
}

function resolveCommand(command: string) {
  if (process.platform === "win32" && !command.endsWith(".cmd") && (command === "npx" || command === "npm")) {
    return `${command}.cmd`;
  }
  return command;
}

function buildArgs(base: string[], ...extras: Array<Array<string | undefined>>) {
  return [
    ...base,
    ...extras
      .flat()
      .filter((value): value is string => Boolean(value)),
  ];
}

function resolveTsxCliPath() {
  return path.resolve("node_modules", "tsx", "dist", "cli.mjs");
}

async function runTsxScript(scriptPath: string, args: string[], cwd = process.cwd()) {
  const cliPath = resolveTsxCliPath();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, scriptPath, ...args], {
      cwd,
      stdio: "inherit",
      shell: false,
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptPath} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function runTsxScriptCaptureJson(scriptPath: string, args: string[], cwd = process.cwd()) {
  const cliPath = resolveTsxCliPath();
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let stdout = "";
    const child = spawn(process.execPath, [cliPath, scriptPath, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "inherit"],
      shell: false,
      env: process.env,
    });
    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptPath} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
        return;
      }
      const trimmed = stdout.trim();
      const jsonStart = trimmed.indexOf("{");
      const jsonText = jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed;
      try {
        resolve(JSON.parse(jsonText) as Record<string, unknown>);
      } catch (error) {
        reject(new Error(`Unable to parse JSON from ${scriptPath} ${args.join(" ")}: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  });
}

async function preflight() {
  try {
    await prisma.user.count();
  } catch (error) {
    return {
      database: "failed" as const,
      riot: "failed" as const,
      databaseError: error instanceof Error ? error.message : String(error),
      riotError: "skipped",
    };
  }

  try {
    const entries = await riotApiClient.getLeagueEntriesByQueueOnPlatform("kr", "RANKED_SOLO_5x5", "challenger");
    return {
      database: "ok" as const,
      riot: "ok" as const,
      riotCheck: entries.entries.length,
    };
  } catch (error) {
    return {
      database: "ok" as const,
      riot: "failed" as const,
      riotError: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await prisma.$disconnect();
  }
}

function reportBasePath(reportDir: string, stage: number) {
  const stageTag = String(stage).padStart(2, "0");
  return path.join(reportDir, `stage-${stageTag}`);
}

function resolveCampaignStopReason(
  qualityGatePassed: boolean,
  runAuthFailureCount: number,
  runCreatedCount: number,
  stopReason: string | null,
): string | null {
  if (!qualityGatePassed) return "quality-gate-failed";
  if (runAuthFailureCount > 0) return "auth-failure";
  if (runCreatedCount === 0) return "plateau";
  return stopReason;
}

async function runCampaignStage(options: CampaignOptions, stage: number): Promise<{
  stageSummary: StageSummary;
  stoppedReason: string | null;
}> {
  const stagePrefix = reportBasePath(options.reportDir, stage);
  const importReportPath = `${stagePrefix}.import.json`;
  const importMarkdownPath = `${stagePrefix}.import.md`;
  const validationReportPath = `${stagePrefix}.validation.json`;
  const validationMarkdownPath = `${stagePrefix}.validation.md`;
  const throughputReportPath = `${stagePrefix}.throughput.json`;
  const premiumDatasetAuditPath = `${stagePrefix}.premium-dataset.json`;

  console.info(`[campaign] stage=${stage} import start tranche=${options.stageSize}`);
  await runTsxScript("scripts/importCompetitiveMatches.ts", buildArgs([
    "--seed-path", options.seedPath,
    "--policy-path", options.policyPath,
    "--checkpoint-path", options.checkpointPath,
    "--quarantine-path", options.quarantinePath,
    "--report-path", importReportPath,
    "--markdown-report-path", importMarkdownPath,
    "--target-matches", String(options.targetMatches),
    "--count-per-seed", String(options.countPerSeed),
    "--max-ids-per-seed", String(options.maxIdsPerSeed),
    "--tranche-size", String(options.stageSize),
    "--max-created-per-run", String(options.stageSize),
    "--max-attempts-per-run", String(Math.max(options.stageSize * 2, options.stageSize + 10)),
    "--max-auth-failures-per-run", "3",
    "--max-seed-discovery-failures", String(options.maxSeedDiscoveryFailures),
  ],
  options.dryRun ? ["--dry-run"] : [],
  options.ownerUserId ? ["--owner-user-id", options.ownerUserId] : [],
  options.ownerEmail ? ["--owner-email", options.ownerEmail] : [],
  options.resetCheckpoint ? ["--reset-checkpoint"] : [],
  options.refreshDiscovery ? ["--refresh-discovery"] : [],
  ), process.cwd());

  const importReport = await safeReadJson<Record<string, unknown>>(importReportPath);
  const runAuthFailureCount = Number(importReport.runAuthFailureCount ?? 0);
  const runCreatedCount = Number(importReport.runCreatedCount ?? importReport.createdMatches ?? 0);
  const stopReason = typeof importReport.stopReason === "string" ? importReport.stopReason : null;
  console.info(`[campaign] stage=${stage} import done created=${runCreatedCount} authFailures=${runAuthFailureCount} stopReason=${stopReason ?? "none"}`);

  console.info(`[campaign] stage=${stage} throughput audit start`);
  const throughputReport = await runTsxScriptCaptureJson("scripts/reportCompetitiveThroughput.ts", ["--checkpoint-path", options.checkpointPath]);
  await writeFile(throughputReportPath, `${JSON.stringify(throughputReport, null, 2)}\n`, "utf-8");

  console.info(`[campaign] stage=${stage} premium dataset audit start`);
  await runTsxScript("scripts/auditPremiumV1Dataset.ts", []);
  await writeFile(premiumDatasetAuditPath, await readFile(path.resolve("reports", "premium-v1-dataset-audit.json"), "utf-8"), "utf-8");

  console.info(`[campaign] stage=${stage} validation audit start sample=${options.auditSampleSize}`);
  await runTsxScript("scripts/evaluateMatchBasedValidation.ts", [
    "--sample-size", String(options.auditSampleSize),
    "--report-path", validationReportPath,
    "--markdown-report-path", validationMarkdownPath,
  ]);
  const validationReport = await safeReadJson<Record<string, unknown>>(validationReportPath);
  const summarySection = validationReport.summary as { completedRate?: number; noViableSnapshotFoundRate?: number } | undefined;
  const completedRate = Number(summarySection?.completedRate ?? 0);
  const noViableRate = Number(summarySection?.noViableSnapshotFoundRate ?? 1);
  const qualityGatePassed = completedRate >= options.minCompletedRate && noViableRate <= options.maxNoViableRate;

  const stageSummary: StageSummary = {
    stage, importReportPath, validationReportPath, throughputReportPath, premiumDatasetAuditPath,
    throughputReport, importReport, validationReport, stopReason, qualityGatePassed,
  };

  const campaignCanContinue = runAuthFailureCount === 0
    && runCreatedCount > 0
    && qualityGatePassed
    && !stopReason?.includes("max-auth-failures")
    && !stopReason?.includes("max-created-per-run");

  const stoppedReason = campaignCanContinue
    ? null
    : resolveCampaignStopReason(qualityGatePassed, runAuthFailureCount, runCreatedCount, stopReason);

  return { stageSummary, stoppedReason };
}

function safeReadJson<T>(filePath: string): Promise<T> {
  return readFile(filePath, "utf-8").then((content) => JSON.parse(content) as T);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.reportDir, { recursive: true });

  const preflightResult = await preflight();
  const summary: CampaignSummary = {
    generatedAt: new Date().toISOString(),
    seedPath: path.resolve(options.seedPath),
    policyPath: path.resolve(options.policyPath),
    checkpointPath: path.resolve(options.checkpointPath),
    targetMatches: options.targetMatches,
    stageSize: options.stageSize,
    countPerSeed: options.countPerSeed,
    maxIdsPerSeed: options.maxIdsPerSeed,
    maxStages: options.maxStages,
    maxSeedDiscoveryFailures: options.maxSeedDiscoveryFailures,
    auditSampleSize: options.auditSampleSize,
    preflight: preflightResult.database === "ok" && preflightResult.riot === "ok"
      ? { database: "ok", riot: "ok" }
      : {
          database: preflightResult.database,
          riot: preflightResult.riot,
          ...(preflightResult.databaseError ? { databaseError: preflightResult.databaseError } : {}),
          ...(preflightResult.riotError ? { riotError: preflightResult.riotError } : {}),
        },
    stages: [],
    stoppedReason: null,
  };

  if (summary.preflight.database !== "ok" || summary.preflight.riot !== "ok") {
    summary.stoppedReason = "preflight-failed";
    const summaryPath = path.join(options.reportDir, "campaign-summary.json");
    await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    console.error("[campaign] preflight failed", JSON.stringify(summary.preflight));
    process.exitCode = 1;
    return;
  }

  if (options.maxStages <= 0) {
    summary.stoppedReason = "preflight-only";
    const summaryPath = path.join(options.reportDir, "campaign-summary.json");
    await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    console.info(`[campaign] preflight ok; summary written to ${summaryPath}`);
    return;
  }

  for (let stage = 1; stage <= options.maxStages; stage += 1) {
    const { stageSummary, stoppedReason } = await runCampaignStage(options, stage);
    summary.stages.push(stageSummary);

    if (stoppedReason) {
      summary.stoppedReason = stoppedReason;
      break;
    }

    if (stage >= options.maxStages) {
      summary.stoppedReason = "max-stages-reached";
      break;
    }
  }

  const summaryPath = path.join(options.reportDir, "campaign-summary.json");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
  console.info(`[campaign] summary written to ${summaryPath}`);
  if (summary.stoppedReason === "quality-gate-failed" || summary.stoppedReason === "auth-failure") {
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("[campaign] failed", error);
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
