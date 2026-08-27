export function renderMarkdownReport(report: Record<string, unknown>) {
  const patchDistribution = Array.isArray(report.patchDistribution)
    ? (report.patchDistribution as Array<{ patch: string; count: number }>)
    : [];
  const tierDistribution = Array.isArray(report.tierDistribution)
    ? (report.tierDistribution as Array<{ tier: string; count: number }>)
    : [];
  const patchBucketDistribution = Array.isArray(report.patchBucketDistribution)
    ? (report.patchBucketDistribution as Array<{ bucket: string; count: number }>)
    : [];
  const queueDistribution = Array.isArray(report.queueDistribution)
    ? (report.queueDistribution as Array<{ queueId: string; count: number }>)
    : [];

  return [
    "# Competitive Ingestion Report",
    "",
    `- Generated at: ${String(report.generatedAt ?? "")}`,
    `- Policy mode: ${String(report.policyMode ?? "")}`,
    `- Total seeds: ${String(report.totalSeeds ?? 0)}`,
    `- Resolved seeds: ${String(report.resolvedSeedCount ?? 0)}`,
    `- Resolved but no matches: ${String(report.resolvedButNoMatches ?? 0)}`,
    `- Resolved but rejected by policy: ${String(report.resolvedButRejectedByPolicy ?? 0)}`,
    `- Discovered: ${String(report.discoveredUniqueMatches ?? 0)}`,
    `- Discovered after time filter: ${String(report.discoveredUniqueMatchesAfterTimeFilter ?? 0)}`,
    `- Policy accepted: ${String(report.policyAcceptedMatches ?? 0)}`,
    `- Attempted: ${String(report.attemptedMatches ?? 0)}`,
    `- Imported: ${String(report.createdMatches ?? 0)}`,
    `- Rejected by policy: ${String(report.rejectedMatches ?? 0)}`,
    `- Failed fetch/import: ${String(report.failedMatchesCount ?? 0)}`,
    `- Dry run: ${String(report.dryRun ?? false)}`,
    `- Exact target imports: ${String(report.matchesImportedExactTargetPatch ?? 0)}`,
    `- Adjacent recent imports: ${String(report.matchesImportedAdjacentRecentPatch ?? 0)}`,
    `- Pro imports: ${String(report.matchesImportedPro ?? 0)}`,
    `- Elite imports: ${String(report.matchesImportedElite ?? 0)}`,
    "",
    "## Rejection Fractions",
    `- before-season-window: ${String(((report.rejectedReasonFractions as { beforeSeasonWindow?: number } | undefined)?.beforeSeasonWindow ?? 0).toFixed?.(4) ?? 0)}`,
    `- patch-not-allowed: ${String(((report.rejectedReasonFractions as { patchNotAllowed?: number } | undefined)?.patchNotAllowed ?? 0).toFixed?.(4) ?? 0)}`,
    `- queue-not-allowed: ${String(((report.rejectedReasonFractions as { queueNotAllowed?: number } | undefined)?.queueNotAllowed ?? 0).toFixed?.(4) ?? 0)}`,
    "",
    "## Patch Buckets",
    ...patchBucketDistribution.map((entry) => `- ${entry.bucket}: ${entry.count}`),
    "",
    "## Queue Distribution",
    ...queueDistribution.map((entry) => `- ${entry.queueId}: ${entry.count}`),
    "",
    "## Tier Distribution",
    ...tierDistribution.map((entry) => `- ${entry.tier}: ${entry.count}`),
    "",
    "## Patch Distribution",
    ...patchDistribution.slice(0, 12).map((entry) => `- ${entry.patch}: ${entry.count}`),
    "",
    `- Why zero before: ${String(report.whyZeroBefore ?? "")}`,
    `- What was relaxed: ${String(report.whatWasRelaxed ?? "")}`,
    "",
  ].join("\n");
}
