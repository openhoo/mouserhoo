import type { MaybePromise } from "./types";

export const MOUSER_SEARCH_REQUESTS_PER_MINUTE = 30;
export const MOUSER_SEARCH_REQUESTS_PER_DAY = 1000;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SearchRateLimitWaitOptions {
  signal?: AbortSignal;
}

export interface SearchRateLimiter {
  waitForAvailableRequest(options?: SearchRateLimitWaitOptions): MaybePromise<void>;
}

export interface MouserSearchRateLimitOptions {
  requestsPerMinute?: number;
  requestsPerDay?: number;
  now?: () => number;
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}

export type MouserSearchRateLimiterInput = SearchRateLimiter | MouserSearchRateLimitOptions | false | undefined;

export class MouserSearchRateLimiter implements SearchRateLimiter {
  private readonly requestsPerMinute: number;
  private readonly requestsPerDay: number;
  private readonly now: () => number;
  private readonly sleep: (delayMs: number, signal?: AbortSignal) => Promise<void>;
  private minuteWindowStartedAt: number | undefined;
  private dayWindowStartedAt: number | undefined;
  private minuteRequestCount = 0;
  private dayRequestCount = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: MouserSearchRateLimitOptions = {}) {
    this.requestsPerMinute = options.requestsPerMinute ?? MOUSER_SEARCH_REQUESTS_PER_MINUTE;
    this.requestsPerDay = options.requestsPerDay ?? MOUSER_SEARCH_REQUESTS_PER_DAY;
    assertPositiveInteger(this.requestsPerMinute, "requestsPerMinute");
    assertPositiveInteger(this.requestsPerDay, "requestsPerDay");
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? sleep;
  }

  waitForAvailableRequest(options: SearchRateLimitWaitOptions = {}): Promise<void> {
    const reservation = this.queue.then(() => this.reserve(options.signal));
    this.queue = reservation.catch(() => undefined);
    return reservation;
  }

  private async reserve(signal?: AbortSignal): Promise<void> {
    assertNotAborted(signal);

    while (true) {
      const now = this.now();
      this.refreshWindows(now);

      if (this.minuteRequestCount < this.requestsPerMinute && this.dayRequestCount < this.requestsPerDay) {
        this.minuteRequestCount += 1;
        this.dayRequestCount += 1;
        return;
      }

      const waitMs = this.nextWindowDelay(now);
      if (waitMs <= 0) {
        continue;
      }

      await this.sleep(waitMs, signal);
    }
  }

  private refreshWindows(now: number): void {
    if (
      this.minuteWindowStartedAt === undefined ||
      now < this.minuteWindowStartedAt ||
      now - this.minuteWindowStartedAt >= MINUTE_MS
    ) {
      this.minuteWindowStartedAt = now;
      this.minuteRequestCount = 0;
    }

    if (
      this.dayWindowStartedAt === undefined ||
      now < this.dayWindowStartedAt ||
      now - this.dayWindowStartedAt >= DAY_MS
    ) {
      this.dayWindowStartedAt = now;
      this.dayRequestCount = 0;
    }
  }

  private nextWindowDelay(now: number): number {
    const delays: number[] = [];

    if (this.minuteRequestCount >= this.requestsPerMinute && this.minuteWindowStartedAt !== undefined) {
      delays.push(this.minuteWindowStartedAt + MINUTE_MS - now);
    }

    if (this.dayRequestCount >= this.requestsPerDay && this.dayWindowStartedAt !== undefined) {
      delays.push(this.dayWindowStartedAt + DAY_MS - now);
    }

    if (delays.length === 0) {
      return 0;
    }

    return Math.max(...delays.map((delay) => Math.max(0, delay)));
  }
}

export function resolveSearchRateLimiter(input: MouserSearchRateLimiterInput): SearchRateLimiter | undefined {
  if (!input) {
    return undefined;
  }

  if (isSearchRateLimiter(input)) {
    return input;
  }

  return new MouserSearchRateLimiter(input);
}

function isSearchRateLimiter(value: SearchRateLimiter | MouserSearchRateLimitOptions): value is SearchRateLimiter {
  return typeof (value as SearchRateLimiter).waitForAvailableRequest === "function";
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Mouser search rate-limit wait was aborted.", "AbortError");
  }
}

function sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  assertNotAborted(signal);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(done, delayMs);

    function done(): void {
      signal?.removeEventListener("abort", abort);
      resolve();
    }

    function abort(): void {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason ?? new DOMException("Mouser search rate-limit wait was aborted.", "AbortError"));
    }

    signal?.addEventListener("abort", abort, { once: true });
  });
}
