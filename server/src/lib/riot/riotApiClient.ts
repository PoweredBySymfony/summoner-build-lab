import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http.js";

type RiotRegion = string;
type RiotPlatform = string;

type RequestOptions = {
  query?: Record<string, string | number | undefined>;
  timeoutMs?: number;
  region?: RiotRegion;
  platform?: RiotPlatform;
};

type QueueEntry<T> = () => Promise<T>;

export class RiotApiClient {
  private readonly region = env.RIOT_REGION;
  private readonly platform = env.RIOT_PLATFORM;
  private readonly baseDelayMs = 120;
  private queue = Promise.resolve();

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

  private schedule<T>(task: QueueEntry<T>) {
    const run = this.queue.then(async () => {
      await new Promise((resolve) => setTimeout(resolve, this.baseDelayMs));
      return task();
    });
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    this.ensureConfigured();

    return this.schedule(async () => {
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
          const details = {
            statusText: response.statusText,
            retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
          };

          switch (response.status) {
            case 401:
              throw new HttpError(401, "Riot API authentication failed.", details);
            case 403:
              throw new HttpError(403, "Riot API access forbidden for this key or route.", details);
            case 404:
              throw new HttpError(404, "Riot resource not found.", details);
            case 429:
              throw new HttpError(429, "Riot API rate limit exceeded.", details);
            default:
              throw new HttpError(response.status, "Riot API request failed.", details);
          }
        }

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
    });
  }

  getAccountByRiotId(gameName: string, tagLine: string) {
    return this.request<{ puuid: string; gameName: string; tagLine: string }>(
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    );
  }

  getSummonerByPuuid(puuid: string) {
    return this.request<{ puuid: string; gameName?: string; profileIconId?: number; summonerLevel?: number }>(
      `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
    );
  }

  getMatchIdsByPuuid(puuid: string, count = 10) {
    return this.request<string[]>(`/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`, {
      query: { count },
    });
  }

  getMatchById(matchId: string) {
    return this.request<Record<string, unknown>>(`/lol/match/v5/matches/${encodeURIComponent(matchId)}`);
  }
}

export const riotApiClient = new RiotApiClient();
