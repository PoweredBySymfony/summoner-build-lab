import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http.js";
import { PLATFORM_TO_REGION, type RiotPlatform, type RiotRegion } from "./routing.js";
import { RiotRequestScheduler, resolveRetryAfterMs } from "./riotRequestScheduler.js";

type RequestOptions = {
  query?: Record<string, string | number | undefined>;
  timeoutMs?: number;
  region?: RiotRegion;
  platform?: RiotPlatform;
};

type QueueEntry<T> = () => Promise<T>;

type RiotApiClientMetrics = {
  totalRequests: number;
  successfulRequests: number;
  rateLimitResponses: number;
  retryAfterFallbacks: number;
  totalBackoffMs: number;
};

const DEFAULT_RATE_LIMIT_BACKOFF_MS = 5_000;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class RiotApiClient {
  private readonly region = env.RIOT_REGION;
  private readonly platform = env.RIOT_PLATFORM;
  private readonly baseDelayMs = Math.max(0, env.RIOT_API_BASE_DELAY_MS);
  private readonly concurrency = Math.max(1, env.RIOT_API_CONCURRENCY);
  private readonly retryCount = Math.max(0, env.RIOT_API_RETRY_COUNT);
  private readonly schedulers = new Map<string, RiotRequestScheduler>();
  private readonly metrics: RiotApiClientMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    rateLimitResponses: 0,
    retryAfterFallbacks: 0,
    totalBackoffMs: 0,
  };

  private ensureConfigured() {
    if (!env.RIOT_API_KEY) {
      throw new HttpError(503, "RIOT_API_KEY is not configured.");
    }
  }

  private buildUrl(path: string, options: RequestOptions) {
    const isRegional = path.startsWith("/riot") || path.startsWith("/lol/match");
    const host = isRegional ? `${options.region ?? this.region}.api.riotgames.com` : `${options.platform ?? this.platform}.api.riotgames.com`;
    const url = new URL(`https://${host}${path}`);

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url;
  }

  private getScheduler(scopeKey: string) {
    const existing = this.schedulers.get(scopeKey);
    if (existing) {
      return existing;
    }

    const scheduler = new RiotRequestScheduler({
      baseDelayMs: this.baseDelayMs,
      concurrency: this.concurrency,
    });
    this.schedulers.set(scopeKey, scheduler);
    return scheduler;
  }

  private getScopeKey(path: string, options: RequestOptions) {
    const isRegional = path.startsWith("/riot") || path.startsWith("/lol/match");
    return isRegional ? `region:${options.region ?? this.region}` : `platform:${options.platform ?? this.platform}`;
  }

  private schedule<T>(scopeKey: string, task: QueueEntry<T>) {
    return this.getScheduler(scopeKey).schedule(task);
  }

  getMetricsSnapshot() {
    return { ...this.metrics };
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    this.ensureConfigured();
    const scopeKey = this.getScopeKey(path, options);

    return this.schedule(scopeKey, async () => {
      for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
        this.metrics.totalRequests += 1;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);

        try {
          const response = await fetch(this.buildUrl(path, options), {
            headers: {
              "X-Riot-Token": env.RIOT_API_KEY!,
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            const retryAfter = response.headers.get("Retry-After");
            const retryAfterSeconds = retryAfter && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) : undefined;
            const retryAfterMs = response.status === 429
              ? resolveRetryAfterMs(retryAfter, DEFAULT_RATE_LIMIT_BACKOFF_MS)
              : undefined;
            const details = {
              statusText: response.statusText,
              retryAfterSeconds,
              retryAfterMs,
            };

            switch (response.status) {
              case 401:
                throw new HttpError(401, "Riot API authentication failed.", details);
              case 403:
                throw new HttpError(403, "Riot API access forbidden for this key or route.", details);
              case 404:
                throw new HttpError(404, "Riot resource not found.", details);
              case 429:
                this.metrics.rateLimitResponses += 1;
                if (!retryAfter) {
                  this.metrics.retryAfterFallbacks += 1;
                }
                this.metrics.totalBackoffMs += retryAfterMs ?? DEFAULT_RATE_LIMIT_BACKOFF_MS;
                this.getScheduler(scopeKey).defer(retryAfterMs ?? DEFAULT_RATE_LIMIT_BACKOFF_MS);
                if (attempt < this.retryCount) {
                  await sleep(retryAfterMs ?? DEFAULT_RATE_LIMIT_BACKOFF_MS);
                  continue;
                }
                throw new HttpError(429, "Riot API rate limit exceeded.", details);
              default:
                throw new HttpError(response.status, "Riot API request failed.", details);
            }
          }

          this.metrics.successfulRequests += 1;
          return (await response.json()) as T;
        } catch (error) {
          if (error instanceof HttpError) {
            throw error;
          }

          if (error instanceof Error && error.name === "AbortError") {
            throw new HttpError(504, "Riot API request timed out.");
          }

          throw new HttpError(502, "Unable to reach Riot API.");
        } finally {
          clearTimeout(timeout);
        }
      }

      throw new HttpError(502, "Riot API request failed after retries.");
    });
  }

  getAccountByRiotId(gameName: string, tagLine: string) {
    return this.request<{ puuid: string; gameName: string; tagLine: string }>(
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    );
  }

  getAccountByRiotIdOnRegion(gameName: string, tagLine: string, region: RiotRegion) {
    return this.request<{ puuid: string; gameName: string; tagLine: string }>(
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { region },
    );
  }

  getAccountByPuuidOnRegion(puuid: string, region: RiotRegion) {
    return this.request<{ puuid: string; gameName?: string; tagLine?: string }>(
      `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`,
      { region },
    );
  }

  getSummonerByPuuid(puuid: string) {
    return this.request<{ puuid: string; gameName?: string; profileIconId?: number; summonerLevel?: number }>(
      `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
    );
  }

  getSummonerByPuuidOnPlatform(puuid: string, platform: RiotPlatform) {
    return this.request<{ puuid: string; gameName?: string; profileIconId?: number; summonerLevel?: number }>(
      `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
      { platform },
    );
  }

  getSummonerBySummonerIdOnPlatform(summonerId: string, platform: RiotPlatform) {
    return this.request<{ puuid: string; gameName?: string; profileIconId?: number; summonerLevel?: number }>(
      `/lol/summoner/v4/summoners/${encodeURIComponent(summonerId)}`,
      { platform },
    );
  }

  getLeagueEntriesByQueueOnPlatform(
    platform: RiotPlatform,
    queue: "RANKED_SOLO_5x5",
    tier: "challenger" | "grandmaster" | "master",
  ) {
    return this.request<{
      tier: string;
      queue: string;
      entries: Array<{
        summonerId: string;
        summonerName?: string;
        leaguePoints: number;
        wins: number;
        losses: number;
      }>;
    }>(
      `/lol/league/v4/${tier}leagues/by-queue/${encodeURIComponent(queue)}`,
      { platform },
    );
  }

  getMatchIdsByPuuid(puuid: string, count = 10) {
    return this.request<string[]>(`/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`, {
      query: { count },
    });
  }

  getMatchIdsByPuuidOnRegion(
    puuid: string,
    region: RiotRegion,
    count = 10,
    options?: {
      start?: number;
      startTime?: number;
      endTime?: number;
      queue?: number;
    },
  ) {
    return this.request<string[]>(`/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`, {
      region,
      query: {
        count,
        start: options?.start,
        startTime: options?.startTime,
        endTime: options?.endTime,
        queue: options?.queue,
      },
    });
  }

  getMatchById(matchId: string) {
    return this.request<Record<string, unknown>>(`/lol/match/v5/matches/${encodeURIComponent(matchId)}`);
  }

  getMatchByIdOnRegion(matchId: string, region: RiotRegion) {
    return this.request<Record<string, unknown>>(`/lol/match/v5/matches/${encodeURIComponent(matchId)}`, {
      region,
    });
  }

  getMatchTimelineByIdOnRegion(matchId: string, region: RiotRegion) {
    return this.request<Record<string, unknown>>(
      `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`,
      { region },
    );
  }

  getRegionForPlatform(platform: RiotPlatform) {
    return PLATFORM_TO_REGION[platform];
  }
}

export const riotApiClient = new RiotApiClient();
