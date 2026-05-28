import { prisma } from "../server/src/lib/prisma.js";
import { resolveItemSlug } from "../server/src/lib/itemSlugAliases.js";

type CliOptions = {
  limit: number;
};

function parseArgs(argv: string[]): CliOptions {
  const limitIndex = argv.findIndex((arg) => arg === "--limit");
  return {
    limit: limitIndex === -1 ? 500 : Number(argv[limitIndex + 1] ?? "500"),
  };
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const requests = await prisma.generatedPuzzleRequest.findMany({
    where: {
      type: "MATCH_BASED",
    },
    orderBy: { createdAt: "desc" },
    take: options.limit,
    select: {
      id: true,
      createdAt: true,
      parameters: true,
    },
  });

  const unresolvedCounts: Record<string, number> = {};
  const examples: Array<{ requestId: string; createdAt: Date; rawSlug: string }> = [];

  for (const request of requests) {
    const parameters = asObject(request.parameters);
    const attemptsSummary = asObject(parameters?.attemptsSummary);
    const attempts = asArray(attemptsSummary?.attempts);
    for (const attempt of attempts) {
      const attemptRecord = asObject(attempt);
      const rejectionReasons = asArray(attemptRecord?.rejectionReasons).map((entry) => String(entry));
      if (!rejectionReasons.includes("good-answer-unresolved")) {
        continue;
      }
      const rawSlug = String(attemptRecord?.goodAnswer ?? "").trim();
      if (!rawSlug) {
        continue;
      }
      unresolvedCounts[rawSlug] = (unresolvedCounts[rawSlug] ?? 0) + 1;
      if (examples.length < 100) {
        examples.push({
          requestId: request.id,
          createdAt: request.createdAt,
          rawSlug,
        });
      }
    }
  }

  const unresolvedEntries = Object.entries(unresolvedCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 100);
  const resolvedCandidateSlugs = [...new Set(unresolvedEntries.map(([rawSlug]) => resolveItemSlug(rawSlug)))];
  const knownItems = await prisma.item.findMany({
    where: {
      slug: { in: resolvedCandidateSlugs },
    },
    select: {
      slug: true,
      name: true,
    },
  });
  const knownBySlug = new Map(knownItems.map((item) => [item.slug, item.name]));

  console.info(JSON.stringify({
    generatedAt: new Date().toISOString(),
    inspectedRequests: requests.length,
    unresolvedTop: unresolvedEntries.map(([rawSlug, count]) => {
      const resolvedSlug = resolveItemSlug(rawSlug);
      return {
        rawSlug,
        count,
        resolvedSlug,
        knownInCatalog: knownBySlug.has(resolvedSlug),
        catalogName: knownBySlug.get(resolvedSlug) ?? null,
        aliasMissing: resolvedSlug === rawSlug && !knownBySlug.has(resolvedSlug),
      };
    }),
    examples,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[audit-ml-unresolved-slugs] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
