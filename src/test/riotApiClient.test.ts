import { afterEach, describe, expect, it, vi } from "vitest";

import { env } from "../../server/src/config/env";
import { RiotApiClient } from "../../server/src/lib/riot/riotApiClient";

const originalPrimaryApiKey = env.RIOT_API_KEY;
const originalSecondaryApiKey = env.RIOT_API_KEY_2;

describe("riotApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    env.RIOT_API_KEY = originalPrimaryApiKey;
    env.RIOT_API_KEY_2 = originalSecondaryApiKey;
  });

  it("retries once after a 429 with Retry-After before succeeding", async () => {
    env.RIOT_API_KEY = "primary-test-key";
    env.RIOT_API_KEY_2 = "secondary-test-key";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 429,
          statusText: "Too Many Requests",
          headers: {
            "Retry-After": "0",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      );

    const client = new RiotApiClient();
    const result = await client.request<{ ok: boolean }>("/riot/account/v1/accounts/by-puuid/test", {
      region: "europe",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.getMetricsSnapshot().rateLimitResponses).toBe(1);
    expect(client.getMetricsSnapshot().successfulRequests).toBe(1);
  });

  it("falls back to the secondary key after a primary 403 and remembers the route preference", async () => {
    env.RIOT_API_KEY = "primary-test-key";
    env.RIOT_API_KEY_2 = "secondary-test-key";

    const usedTokens: string[] = [];
    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(async (_input, init) => {
        usedTokens.push(new Headers(init?.headers).get("X-Riot-Token") ?? "missing");
        return new Response("{}", {
          status: 403,
          statusText: "Forbidden",
        });
      })
      .mockImplementationOnce(async (_input, init) => {
        usedTokens.push(new Headers(init?.headers).get("X-Riot-Token") ?? "missing");
        return new Response(JSON.stringify({ tier: "CHALLENGER", queue: "RANKED_SOLO_5x5", entries: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      })
      .mockImplementationOnce(async (_input, init) => {
        usedTokens.push(new Headers(init?.headers).get("X-Riot-Token") ?? "missing");
        return new Response(JSON.stringify({ tier: "MASTER", queue: "RANKED_SOLO_5x5", entries: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      });

    const client = new RiotApiClient();
    await client.getLeagueEntriesByQueueOnPlatform("euw1", "RANKED_SOLO_5x5", "challenger");
    await client.getLeagueEntriesByQueueOnPlatform("euw1", "RANKED_SOLO_5x5", "master");

    expect(usedTokens).toEqual([
      "primary-test-key",
      "secondary-test-key",
      "secondary-test-key",
    ]);
    expect(client.getMetricsSnapshot().authFallbackResponses).toBe(1);
    expect(client.getMetricsSnapshot().authFallbackRecoveries).toBe(1);
  });
});
