import { afterEach, describe, expect, it, vi } from "vitest";

import { RiotApiClient } from "../../server/src/lib/riot/riotApiClient";

describe("riotApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries once after a 429 with Retry-After before succeeding", async () => {
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
});
