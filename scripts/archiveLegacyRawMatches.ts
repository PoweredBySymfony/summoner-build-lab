import { createGzip } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { Prisma } from "@prisma/client";

import { prisma } from "../server/src/lib/prisma.js";
import { canonicalizePatch, classifyPatchBucket } from "../server/src/lib/riot/patchCanonical.js";

type CliOptions = {
  archiveDir: string;
  strictTrainPatchPrefixes: string[];
  adjacentTrainPatchPrefixes: string[];
  dryRun: boolean;
  limit?: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    archiveDir: path.join("data", "archive", "legacy-raw"),
    strictTrainPatchPrefixes: ["26."],
    adjacentTrainPatchPrefixes: ["26.6", "26.5", "26.4", "26.3"],
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--archive-dir":
        if (next) {
          options.archiveDir = next;
        }
        index += 1;
        break;
      case "--strict-train-patch-prefixes":
        if (next) {
          options.strictTrainPatchPrefixes = next.split(",").map((value) => value.trim()).filter(Boolean);
        }
        index += 1;
        break;
      case "--adjacent-train-patch-prefixes":
        if (next) {
          options.adjacentTrainPatchPrefixes = next.split(",").map((value) => value.trim()).filter(Boolean);
        }
        index += 1;
        break;
      case "--limit":
        if (next) {
          options.limit = Number(next);
        }
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function summarizeTimeline(rawTimeline: Record<string, unknown>) {
  const info =
    typeof rawTimeline.info === "object" && rawTimeline.info !== null && !Array.isArray(rawTimeline.info)
      ? (rawTimeline.info as Record<string, unknown>)
      : {};
  const frames = Array.isArray(info.frames) ? info.frames : [];
  let eventCount = 0;

  for (const frame of frames) {
    if (typeof frame !== "object" || frame === null || Array.isArray(frame)) {
      continue;
    }
    const events = (frame as Record<string, unknown>).events;
    if (Array.isArray(events)) {
      eventCount += events.length;
    }
  }

  const timestamps = frames
    .map((frame) =>
      typeof frame === "object" && frame !== null && !Array.isArray(frame)
        ? Number((frame as Record<string, unknown>).timestamp ?? Number.NaN)
        : Number.NaN)
    .filter(Number.isFinite);

  return {
    frameCount: frames.length,
    eventCount,
    firstFrameTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : null,
    lastFrameTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : null,
  };
}

async function gzipJsonToFile(payload: unknown, outputPath: string) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const source = Readable.from([JSON.stringify(payload)]);
  const gzip = createGzip({ level: 9 });
  await pipeline(source, gzip, createWriteStream(outputPath));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const archiveDir = path.resolve(options.archiveDir);

  const matches = await prisma.importedMatch.findMany({
    where: {
      timelineFetchedAt: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: options.limit,
    select: {
      id: true,
      riotMatchId: true,
      patch: true,
      gameCreationAt: true,
      createdAt: true,
      sourceKind: true,
      timelineData: true,
    },
  });

  let archived = 0;
  let skipped = 0;

  for (const match of matches) {
    const timelineData =
      typeof match.timelineData === "object" && match.timelineData !== null && !Array.isArray(match.timelineData)
        ? (match.timelineData as Prisma.JsonObject)
        : null;
    const rawTimeline =
      timelineData && typeof timelineData.raw === "object" && timelineData.raw !== null && !Array.isArray(timelineData.raw)
        ? (timelineData.raw as Prisma.JsonObject)
        : null;

    if (!timelineData || !rawTimeline) {
      skipped += 1;
      continue;
    }

    const patchInfo = canonicalizePatch(match.patch, match.gameCreationAt);
    const patchCanonical = patchInfo.patchCanonical;
    const patchBucket = classifyPatchBucket(
      patchCanonical,
      options.strictTrainPatchPrefixes,
      options.adjacentTrainPatchPrefixes,
    );
    const trainable = patchBucket !== "out_of_target_patch";

    if (trainable) {
      skipped += 1;
      continue;
    }

    const outputPath = path.join(archiveDir, `${match.riotMatchId}.timeline.json.gz`);
    const timelineSummary = summarizeTimeline(rawTimeline as Record<string, unknown>);
    const archivedAt = new Date().toISOString();

    if (!options.dryRun) {
      await gzipJsonToFile(
        {
          riotMatchId: match.riotMatchId,
          patch: match.patch,
          patchCanonical,
          patchFormat: patchInfo.patchFormat,
          gameCreationAt: toIsoString(match.gameCreationAt),
          createdAt: toIsoString(match.createdAt),
          sourceKind: match.sourceKind,
          rawTimeline,
        },
        outputPath,
      );

      await prisma.importedMatch.update({
        where: { id: match.id },
        data: {
          timelineData: {
            archived: true,
            archivedAt,
            archivePath: outputPath,
            patchCanonical,
            patchFormat: patchInfo.patchFormat,
            patchBucket,
            summary: timelineSummary,
          } satisfies Prisma.InputJsonObject,
        },
      });
    }

    archived += 1;
  }

  console.info(
    JSON.stringify(
      {
        archiveDir,
        dryRun: options.dryRun,
        strictTrainPatchPrefixes: options.strictTrainPatchPrefixes,
        adjacentTrainPatchPrefixes: options.adjacentTrainPatchPrefixes,
        archivedMatches: archived,
        skippedMatches: skipped,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[ml-archive-legacy-raw] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
