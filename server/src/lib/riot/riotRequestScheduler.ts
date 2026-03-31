export type RiotRequestSchedulerOptions = {
  baseDelayMs: number;
  concurrency: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

type QueueTask<T> = () => Promise<T>;

export function resolveRetryAfterMs(
  retryAfterHeader: string | null | undefined,
  fallbackMs = 5_000,
  now = Date.now(),
) {
  if (!retryAfterHeader) {
    return fallbackMs;
  }

  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.max(0, Math.ceil(asSeconds * 1_000));
  }

  const asDate = Date.parse(retryAfterHeader);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - now);
  }

  return fallbackMs;
}

export class RiotRequestScheduler {
  private readonly baseDelayMs: number;
  private readonly concurrency: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private nextAvailableAt = 0;
  private activeCount = 0;
  private readonly pending: Array<() => void> = [];

  constructor(options: RiotRequestSchedulerOptions) {
    this.baseDelayMs = Math.max(0, options.baseDelayMs);
    this.concurrency = Math.max(1, options.concurrency);
    this.now = options.now ?? Date.now;
    this.sleep =
      options.sleep ??
      ((ms) =>
        new Promise((resolve) => {
          setTimeout(resolve, ms);
        }));
  }

  defer(ms: number) {
    if (ms <= 0) {
      return;
    }

    this.nextAvailableAt = Math.max(this.nextAvailableAt, this.now() + ms);
  }

  schedule<T>(task: QueueTask<T>) {
    return new Promise<T>((resolve, reject) => {
      this.pending.push(() => {
        this.runTask(task).then(resolve, reject);
      });
      this.drain();
    });
  }

  private drain() {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const start = this.pending.shift();
      if (!start) {
        return;
      }

      this.activeCount += 1;
      start();
    }
  }

  private reserveStartAt() {
    const scheduledAt = Math.max(this.nextAvailableAt, this.now());
    this.nextAvailableAt = scheduledAt + this.baseDelayMs;
    return scheduledAt;
  }

  private async runTask<T>(task: QueueTask<T>) {
    try {
      const scheduledAt = this.reserveStartAt();
      const waitMs = Math.max(0, scheduledAt - this.now());
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }

      return await task();
    } finally {
      this.activeCount -= 1;
      this.drain();
    }
  }
}
