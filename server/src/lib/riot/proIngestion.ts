import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Role } from "@prisma/client";

import type { RiotPlatform, RiotRegion } from "./routing.js";
import type { ProPlayerSeed } from "./proSeeds.js";

export type ProResolvedSeed = ProPlayerSeed & {
  resolutionStatus: "resolved" | "unresolved";
  resolutionError: string | null;
  resolutionSource: "seed-puuid" | "seed-riot-id" | "candidate-riot-id" | null;
  resolvedRiotId: string | null;
  puuid: string | null;
  platformHint: RiotPlatform | null;
  cluster: RiotRegion | null;
};

export type ProSeedMatchDiscovery = {
  seedKey: string;
  playerName: string;
  team: string;
  league: string;
  competition: string;
  role: string;
  puuid: string;
  region: RiotRegion;
  matchIds: string[];
};

export type ProMatchImportCandidate = {
  matchId: string;
  seedKey: string;
  order: number;
};

export type ProIngestionAttemptSummary = {
  matchId: string;
  seedKey: string;
  playerName: string;
  team: string;
  league: string;
  competition: string;
  role: string;
  region: string;
  patch: string | null;
  timelineAvailable: boolean;
  timelineMissingReason: string | null;
  targetChampionSlug: string | null;
  targetRole: Role | null;
  gameCreationAt: string | null;
  created: boolean;
  failureReason: string | null;
};

export type ProIngestionCheckpoint = {
  version: 1;
  generatedAt: string;
  targetUniqueMatches: number;
  resolvedSeeds: ProResolvedSeed[];
  discoveredMatches: ProSeedMatchDiscovery[];
  attemptedMatchIds: string[];
  importedMatchIds: string[];
  failedMatches: ProIngestionAttemptSummary[];
};

export type ProIngestionReportRow = {
  patch: string | null;
  timelineMissingReason: string | null;
  gameCreationAt: Date | null;
  timelineFetchedAt: Date | null;
  targetRole: Role | null;
  sourceKind: string | null;
  sourceLeague: string | null;
  sourceCompetition: string | null;
};

export type ProIngestionReport = {
  totalMatches: number;
  totalTimelineMatches: number;
  timelineCoveragePercent: number;
  patchDistribution: Array<{ patch: string; count: number }>;
  leagueDistribution: Array<{ league: string; count: number }>;
  competitionDistribution: Array<{ competition: string; count: number }>;
  roleDistribution: Array<{ role: string; count: number }>;
  timelineMissingReasons: Array<{ reason: string; count: number }>;
  gameDateRange: {
    min: string | null;
    max: string | null;
  };
};

export function buildSeedKey(seed: Pick<ProPlayerSeed, "playerPage" | "team" | "league" | "role">) {
  return `${seed.playerPage}::${seed.team}::${seed.league}::${seed.role}`;
}

export function buildRoundRobinMatchQueue(
  discoveries: ProSeedMatchDiscovery[],
  targetUniqueMatches: number,
): ProMatchImportCandidate[] {
  const groupedByLeague = new Map<string, ProSeedMatchDiscovery[]>();
  for (const discovery of discoveries) {
    const key = discovery.league || "unknown";
    const bucket = groupedByLeague.get(key) ?? [];
    bucket.push(discovery);
    groupedByLeague.set(key, bucket);
  }

  const interleavedDiscoveries: ProSeedMatchDiscovery[] = [];
  const leagueKeys = [...groupedByLeague.keys()].sort();
  while (interleavedDiscoveries.length < discoveries.length) {
    let progressed = false;
    for (const leagueKey of leagueKeys) {
      const bucket = groupedByLeague.get(leagueKey);
      if (!bucket?.length) {
        continue;
      }
      interleavedDiscoveries.push(bucket.shift()!);
      progressed = true;
    }
    if (!progressed) {
      break;
    }
  }

  const uniqueMatches = new Set<string>();
  const cursors = interleavedDiscoveries.map(() => 0);
  const queue: ProMatchImportCandidate[] = [];

  while (uniqueMatches.size < targetUniqueMatches) {
    let progressed = false;

    interleavedDiscoveries.forEach((discovery, discoveryIndex) => {
      if (uniqueMatches.size >= targetUniqueMatches) {
        return;
      }

      while (cursors[discoveryIndex] < discovery.matchIds.length) {
        const matchId = discovery.matchIds[cursors[discoveryIndex]];
        cursors[discoveryIndex] += 1;
        if (uniqueMatches.has(matchId)) {
          continue;
        }

        uniqueMatches.add(matchId);
        queue.push({
          matchId,
          seedKey: discovery.seedKey,
          order: queue.length,
        });
        progressed = true;
        break;
      }
    });

    if (!progressed) {
      break;
    }
  }

  return queue;
}

export async function saveProIngestionCheckpoint(checkpointPath: string, checkpoint: ProIngestionCheckpoint) {
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), "utf-8");
}

export async function loadProIngestionCheckpoint(checkpointPath: string) {
  try {
    const raw = await readFile(checkpointPath, "utf-8");
    return JSON.parse(raw) as ProIngestionCheckpoint;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function buildProIngestionReport(rows: ProIngestionReportRow[]): ProIngestionReport {
  const patchCounts = new Map<string, number>();
  const leagueCounts = new Map<string, number>();
  const competitionCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  const missingCounts = new Map<string, number>();
  let timelineCount = 0;
  let minGameDate: Date | null = null;
  let maxGameDate: Date | null = null;

  for (const row of rows) {
    patchCounts.set(row.patch ?? "unknown", (patchCounts.get(row.patch ?? "unknown") ?? 0) + 1);
    leagueCounts.set(row.sourceLeague ?? "unknown", (leagueCounts.get(row.sourceLeague ?? "unknown") ?? 0) + 1);
    competitionCounts.set(
      row.sourceCompetition ?? "unknown",
      (competitionCounts.get(row.sourceCompetition ?? "unknown") ?? 0) + 1,
    );
    roleCounts.set(row.targetRole ?? "UNKNOWN", (roleCounts.get(row.targetRole ?? "UNKNOWN") ?? 0) + 1);

    if (row.timelineFetchedAt) {
      timelineCount += 1;
    } else {
      const reason = row.timelineMissingReason ?? "unknown";
      missingCounts.set(reason, (missingCounts.get(reason) ?? 0) + 1);
    }

    if (row.gameCreationAt && (!minGameDate || row.gameCreationAt < minGameDate)) {
      minGameDate = row.gameCreationAt;
    }

    if (row.gameCreationAt && (!maxGameDate || row.gameCreationAt > maxGameDate)) {
      maxGameDate = row.gameCreationAt;
    }
  }

  return {
    totalMatches: rows.length,
    totalTimelineMatches: timelineCount,
    timelineCoveragePercent: rows.length > 0 ? (timelineCount / rows.length) * 100 : 0,
    patchDistribution: [...patchCounts.entries()]
      .map(([patch, count]) => ({ patch, count }))
      .sort((left, right) => right.count - left.count || left.patch.localeCompare(right.patch)),
    leagueDistribution: [...leagueCounts.entries()]
      .map(([league, count]) => ({ league, count }))
      .sort((left, right) => right.count - left.count || left.league.localeCompare(right.league)),
    competitionDistribution: [...competitionCounts.entries()]
      .map(([competition, count]) => ({ competition, count }))
      .sort((left, right) => right.count - left.count || left.competition.localeCompare(right.competition)),
    roleDistribution: [...roleCounts.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((left, right) => right.count - left.count || left.role.localeCompare(right.role)),
    timelineMissingReasons: [...missingCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
    gameDateRange: {
      min: minGameDate?.toISOString() ?? null,
      max: maxGameDate?.toISOString() ?? null,
    },
  };
}
