import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

type CliOptions = {
  sample10Before: string | null;
  sample10After: string;
  sample20Before: string | null;
  sample20After: string;
  outputJsonPath: string;
  outputMarkdownPath: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sample10Before: path.join("reports", "match-based-validation-report.before-2026-04-02.json"),
    sample10After: path.join("reports", "match-based-validation-report-10.after.json"),
    sample20Before: null,
    sample20After: path.join("reports", "match-based-validation-report-20.after.json"),
    outputJsonPath: path.join("reports", "match-based-validation-delta-report.json"),
    outputMarkdownPath: path.join("reports", "match-based-validation-delta-report.md"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--sample10-before":
        options.sample10Before = next ?? null;
        index += 1;
        break;
      case "--sample10-after":
        if (next) {
          options.sample10After = next;
        }
        index += 1;
        break;
      case "--sample20-before":
        options.sample20Before = next ?? null;
        index += 1;
        break;
      case "--sample20-after":
        if (next) {
          options.sample20After = next;
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
      default:
        break;
    }
  }

  return options;
}

function asObject(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function loadJsonFile(filePath: string | null) {
  if (!filePath) {
    return null;
  }
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, "utf-8");
  return JSON.parse(raw) as JsonRecord;
}

function formatNumber(value: number | null) {
  return value === null ? "n/a" : String(value);
}

function extractSummary(report: JsonRecord | null) {
  return asObject(report?.summary);
}

function extractTopReasons(summary: JsonRecord | null, limit = 3) {
  return asArray(summary?.rejectionReasonCounts)
    .map(asObject)
    .filter((entry): entry is JsonRecord => entry !== null)
    .slice(0, limit)
    .map((entry) => `${asString(entry.reason) ?? "unknown"}:${asNumber(entry.count) ?? 0}`);
}

function extractSegmentDistribution(summary: JsonRecord | null) {
  if (!summary) {
    return "n/a";
  }
  const counts = new Map<string, number>();
  for (const entry of asArray(summary?.snapshotSegmentCounts)) {
    const record = asObject(entry);
    if (!record) {
      continue;
    }
    counts.set(asString(record.segment) ?? "unknown", asNumber(record.count) ?? 0);
  }
  return ["early", "mid", "late", "none"]
    .map((segment) => `${segment}:${counts.get(segment) ?? 0}`)
    .join(", ");
}

function buildComparison(label: string, beforeReport: JsonRecord | null, afterReport: JsonRecord | null) {
  const beforeSummary = extractSummary(beforeReport);
  const afterSummary = extractSummary(afterReport);
  const beforeCompletedRate = asNumber(beforeSummary?.completedRate);
  const afterCompletedRate = asNumber(afterSummary?.completedRate);
  const beforeFallbackOccurrences = asNumber(beforeSummary?.patchCatalogFallbackOccurrences);
  const afterFallbackOccurrences = asNumber(afterSummary?.patchCatalogFallbackOccurrences);

  return {
    label,
    beforeReportPath: beforeReport ? asString(beforeReport.outputJsonPath) ?? null : null,
    afterReportPath: afterReport ? asString(afterReport.outputJsonPath) ?? null : null,
    completedRate: {
      before: beforeCompletedRate,
      after: afterCompletedRate,
      delta:
        beforeCompletedRate !== null && afterCompletedRate !== null
          ? Number((afterCompletedRate - beforeCompletedRate).toFixed(4))
          : null,
    },
    topRejectionReasons: {
      before: extractTopReasons(beforeSummary),
      after: extractTopReasons(afterSummary),
    },
    patchCatalogFallbackOccurrences: {
      before: beforeFallbackOccurrences,
      after: afterFallbackOccurrences,
      delta:
        beforeFallbackOccurrences !== null && afterFallbackOccurrences !== null
          ? afterFallbackOccurrences - beforeFallbackOccurrences
          : null,
    },
    segmentDistribution: {
      before: extractSegmentDistribution(beforeSummary),
      after: extractSegmentDistribution(afterSummary),
    },
    gate:
      label === "sample-20"
        ? {
            threshold: 0.4,
            completedRate: afterCompletedRate,
            passed: afterCompletedRate !== null ? afterCompletedRate >= 0.4 : null,
            nextStep:
              afterCompletedRate !== null && afterCompletedRate >= 0.4
                ? "OK pour relancer import vers 2000"
                : "continuer qualite/integration",
          }
        : null,
  };
}

function buildMarkdown(input: {
  generatedAt: string;
  comparisons: Array<ReturnType<typeof buildComparison>>;
}) {
  const lines = [
    "# Match-Based Validation Delta Report",
    "",
    `- Generated at: ${input.generatedAt}`,
    "",
  ];

  for (const comparison of input.comparisons) {
    lines.push(`## ${comparison.label}`);
    lines.push("");
    lines.push("| Metric | Before | After | Delta |");
    lines.push("|---|---:|---:|---:|");
    lines.push(
      `| completedRate | ${formatNumber(comparison.completedRate.before)} | ${formatNumber(comparison.completedRate.after)} | ${formatNumber(comparison.completedRate.delta)} |`,
    );
    lines.push(
      `| patch-catalog-fallback occurrences | ${formatNumber(comparison.patchCatalogFallbackOccurrences.before)} | ${formatNumber(comparison.patchCatalogFallbackOccurrences.after)} | ${formatNumber(comparison.patchCatalogFallbackOccurrences.delta)} |`,
    );
    lines.push(`| top rejection reasons | ${comparison.topRejectionReasons.before.join(", ") || "n/a"} | ${comparison.topRejectionReasons.after.join(", ") || "n/a"} | n/a |`);
    lines.push(`| segments | ${comparison.segmentDistribution.before} | ${comparison.segmentDistribution.after} | n/a |`);
    if (comparison.gate) {
      lines.push(`| gate >= 0.4 on 20 | ${comparison.gate.threshold} | ${formatNumber(comparison.gate.completedRate)} | ${comparison.gate.passed === null ? "n/a" : comparison.gate.passed ? "PASS" : "FAIL"} |`);
      lines.push("");
      lines.push(`Decision: ${comparison.gate.nextStep}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [sample10Before, sample10After, sample20Before, sample20After] = await Promise.all([
    loadJsonFile(options.sample10Before),
    loadJsonFile(options.sample10After),
    loadJsonFile(options.sample20Before),
    loadJsonFile(options.sample20After),
  ]);

  const comparisons = [
    buildComparison("sample-10", sample10Before, sample10After),
    buildComparison("sample-20", sample20Before, sample20After),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    comparisons,
  };

  await mkdir(path.dirname(path.resolve(options.outputJsonPath)), { recursive: true });
  await mkdir(path.dirname(path.resolve(options.outputMarkdownPath)), { recursive: true });
  await writeFile(path.resolve(options.outputJsonPath), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  await writeFile(path.resolve(options.outputMarkdownPath), `${buildMarkdown({ generatedAt: report.generatedAt, comparisons })}\n`, "utf-8");

  console.info(JSON.stringify({
    generatedAt: report.generatedAt,
    outputJsonPath: path.resolve(options.outputJsonPath),
    outputMarkdownPath: path.resolve(options.outputMarkdownPath),
  }, null, 2));
}

main().catch((error) => {
  console.error("[match-based-validation-delta] failed", error);
  process.exitCode = 1;
});
