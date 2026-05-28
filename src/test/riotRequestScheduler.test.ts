import { describe, expect, it } from "vitest";

import { RiotRequestScheduler, resolveRetryAfterMs } from "../../server/src/lib/riot/riotRequestScheduler";

describe("riotRequestScheduler", () => {
  it("falls back when Retry-After header is missing", () => {
    expect(resolveRetryAfterMs(undefined, 3_000, 0)).toBe(3_000);
  });

  it("parses Retry-After seconds", () => {
    expect(resolveRetryAfterMs("2", 3_000, 0)).toBe(2_000);
  });

  it("pauses queued requests after a backoff is registered", async () => {
    let now = 0;
    const sleepCalls: number[] = [];
    const scheduler = new RiotRequestScheduler({
      baseDelayMs: 100,
      concurrency: 1,
      now: () => now,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        now += ms;
      },
    });

    await scheduler.schedule(async () => {
      scheduler.defer(2_000);
      return "first";
    });

    await scheduler.schedule(async () => "second");

    expect(sleepCalls).toEqual([2_000]);
  });
});
