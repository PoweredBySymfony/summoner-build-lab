import type { Prisma } from "@prisma/client";
import { getMongoDb } from "../lib/mongo.js";

const MATCH_IMPORTS_COLLECTION = "match_imports_raw";
const TIMELINE_COLLECTION = "timeline_frames_raw";
const SNAPSHOT_COLLECTION = "snapshot_candidates";
const ITEM_EXPLANATION_CACHE_COLLECTION = "item_explanation_cache";
const INGESTION_RUNS_COLLECTION = "ingestion_runs";

export type ImportedMatchArchiveRefs = {
  mongoMatchImportRef: string | null;
  mongoTimelineRef: string | null;
};

function buildCollectionRef(collection: string, riotMatchId: string) {
  return `${collection}:${riotMatchId}`;
}

export const importedMatchArchiveRepository = {
  async persistImportedMatchArtifacts(input: {
    riotMatchId: string;
    patch: string | null;
    sourceRegion: string | null;
    sourceKind?: string | null;
    sourceMetadata?: Prisma.InputJsonObject | null;
    matchMetadata?: Prisma.InputJsonObject | null;
    targetPuuid?: string | null;
    targetGameName?: string | null;
    targetTagLine?: string | null;
    userId: string;
    matchRaw: Prisma.InputJsonObject;
    timelineRaw?: Prisma.InputJsonObject | null;
    gameCreationAt?: Date | null;
  }): Promise<ImportedMatchArchiveRefs> {
    const db = await getMongoDb();
    if (!db) {
      return {
        mongoMatchImportRef: null,
        mongoTimelineRef: null,
      };
    }

    const now = new Date();
    await db.collection(MATCH_IMPORTS_COLLECTION).updateOne(
      { riotMatchId: input.riotMatchId },
      {
        $set: {
          riotMatchId: input.riotMatchId,
          patch: input.patch,
          sourceRegion: input.sourceRegion,
          sourceKind: input.sourceKind ?? null,
          sourceMetadata: input.sourceMetadata ?? null,
          metadata: input.matchMetadata ?? null,
          targetPuuid: input.targetPuuid ?? null,
          targetGameName: input.targetGameName ?? null,
          targetTagLine: input.targetTagLine ?? null,
          userId: input.userId,
          gameCreationAt: input.gameCreationAt ?? null,
          raw: input.matchRaw,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    if (input.timelineRaw) {
      const timelineInfo =
        typeof input.timelineRaw.info === "object" && input.timelineRaw.info
          ? (input.timelineRaw.info as Record<string, unknown>)
          : {};
      const frames = Array.isArray(timelineInfo.frames) ? timelineInfo.frames : [];

      await db.collection(TIMELINE_COLLECTION).updateOne(
        { riotMatchId: input.riotMatchId },
        {
          $set: {
            riotMatchId: input.riotMatchId,
            patch: input.patch,
            sourceRegion: input.sourceRegion,
            targetPuuid: input.targetPuuid ?? null,
            raw: input.timelineRaw,
            frameCount: frames.length,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }

    return {
      mongoMatchImportRef: buildCollectionRef(MATCH_IMPORTS_COLLECTION, input.riotMatchId),
      mongoTimelineRef: input.timelineRaw ? buildCollectionRef(TIMELINE_COLLECTION, input.riotMatchId) : null,
    };
  },

  async getImportedMatchBundle(input: {
    riotMatchId: string;
    fallbackMatchData: Prisma.JsonValue;
    fallbackTimelineData: Prisma.JsonValue | null;
  }) {
    const db = await getMongoDb();
    if (!db) {
      return {
        source: "postgres" as const,
        matchData: input.fallbackMatchData,
        timelineData: input.fallbackTimelineData,
      };
    }

    const [matchDoc, timelineDoc] = await Promise.all([
      db.collection(MATCH_IMPORTS_COLLECTION).findOne({ riotMatchId: input.riotMatchId }),
      db.collection(TIMELINE_COLLECTION).findOne({ riotMatchId: input.riotMatchId }),
    ]);

    if (matchDoc?.raw) {
      return {
        source: "mongo" as const,
        matchData: {
          raw: matchDoc.raw as Prisma.InputJsonValue,
          metadata: (matchDoc.metadata ?? null) as Prisma.InputJsonValue,
        } satisfies Prisma.InputJsonObject,
        timelineData: timelineDoc?.raw
          ? ({ raw: timelineDoc.raw as Prisma.InputJsonValue } satisfies Prisma.InputJsonObject)
          : input.fallbackTimelineData,
      };
    }

    return {
      source: "postgres" as const,
      matchData: input.fallbackMatchData,
      timelineData: input.fallbackTimelineData,
    };
  },

  async persistSnapshotCandidates(input: {
    riotMatchId: string;
    importedMatchId: string;
    patch: string | null;
    targetChampionSlug: string | null;
    targetRole: string | null;
    candidates: Array<Record<string, unknown>>;
  }) {
    const db = await getMongoDb();
    if (!db) {
      return null;
    }

    const now = new Date();
    await db.collection(SNAPSHOT_COLLECTION).updateOne(
      { riotMatchId: input.riotMatchId },
      {
        $set: {
          riotMatchId: input.riotMatchId,
          importedMatchId: input.importedMatchId,
          patch: input.patch,
          targetChampionSlug: input.targetChampionSlug,
          targetRole: input.targetRole,
          candidateCount: input.candidates.length,
          candidates: input.candidates,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    return buildCollectionRef(SNAPSHOT_COLLECTION, input.riotMatchId);
  },

  async recordIngestionRun(input: {
    kind: string;
    targetPuuid: string;
    userId: string;
    requestedMatchCount: number;
    importedMatchCount: number;
    skippedMatchCount: number;
    timelineOkCount: number;
    matches: Array<Record<string, unknown>>;
  }) {
    const db = await getMongoDb();
    if (!db) {
      return null;
    }

    const runId = `${input.kind}:${input.targetPuuid}:${Date.now()}`;
    await db.collection(INGESTION_RUNS_COLLECTION).updateOne(
      { runId },
      {
        $set: {
          runId,
          ...input,
          generatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return runId;
  },

  async getCachedItemExplanation(cacheKey: string) {
    const db = await getMongoDb();
    if (!db) {
      return null;
    }
    return db.collection(ITEM_EXPLANATION_CACHE_COLLECTION).findOne({ cacheKey });
  },

  async cacheItemExplanation(cacheKey: string, payload: Prisma.InputJsonValue) {
    const db = await getMongoDb();
    if (!db) {
      return;
    }

    await db.collection(ITEM_EXPLANATION_CACHE_COLLECTION).updateOne(
      { cacheKey },
      {
        $set: {
          cacheKey,
          payload,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  },
};
