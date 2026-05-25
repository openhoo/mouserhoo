import { describe, expect, it, setSystemTime, vi } from "bun:test";
import type { FetchLike, SearchRateLimiter } from "../src";
import {
  MouserApiKeyAuth,
  MouserClient,
  type MouserNetworkError,
  MouserSearchRateLimiter,
  parseRateLimitHeaders,
  resolveSearchRateLimiter,
} from "../src";
import { MouserHttpClient } from "../src/http";

describe("MouserApiKeyAuth", () => {
  it("accepts object options and rejects empty API keys", () => {
    const auth = new MouserApiKeyAuth({ apiKey: "object-api-key" });

    expect(auth.getApiKey()).toBe("object-api-key");
    expect(() => new MouserApiKeyAuth(" ")).toThrow("A non-empty Mouser API key is required.");
  });
});

describe("MouserHttpClient", () => {
  it("serializes XML request bodies and returns text responses", async () => {
    const fetch = vi.fn<FetchLike>(
      async () =>
        new Response("<Response />", {
          headers: {
            "Content-Type": "application/xml",
          },
        }),
    );
    const http = new MouserHttpClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
    });

    await expect(
      http.request<string>({
        method: "POST",
        path: "/xml",
        body: {
          Value: `<"&'>`,
          Empty: null,
          Items: [1, 2],
        },
        xmlRootName: "Request",
        requestOptions: {
          contentType: "application/xml",
          responseType: "text",
        },
      }),
    ).resolves.toBe("<Response />");

    const [, init] = fetch.mock.calls[0]!;
    expect(init?.body).toBe(
      [
        "<Request>",
        "<Value>&lt;&quot;&amp;&apos;&gt;</Value>",
        "<Empty />",
        "<Items><Items>1</Items><Items>2</Items></Items>",
        "</Request>",
      ].join(""),
    );
  });

  it("passes through raw XML strings", async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response("{}"));
    const http = new MouserHttpClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
    });

    await http.request({
      method: "POST",
      path: "/xml",
      body: "<Request />",
      requestOptions: {
        contentType: "application/xml",
      },
    });

    const [, init] = fetch.mock.calls[0]!;
    expect(init?.body).toBe("<Request />");
  });

  it("serializes array fields in form-url-encoded request bodies", async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response("{}"));
    const http = new MouserHttpClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
    });

    await http.request({
      method: "POST",
      path: "/form",
      body: {
        Values: ["alpha", "beta"],
      },
      requestOptions: {
        contentType: "application/x-www-form-urlencoded",
      },
    });

    const [, init] = fetch.mock.calls[0]!;
    expect(init?.body).toBe("Values%5B0%5D=alpha&Values%5B1%5D=beta");
  });

  it("wraps XML serialization configuration errors as network errors", async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response("{}"));
    const http = new MouserHttpClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
    });

    await expect(
      http.request({
        method: "POST",
        path: "/xml",
        body: { Value: "x" },
        requestOptions: {
          contentType: "application/xml",
        },
      }),
    ).rejects.toMatchObject({
      name: "MouserNetworkError",
      cause: expect.objectContaining({
        message: "xmlRootName is required when sending XML requests.",
      }),
    } satisfies Partial<MouserNetworkError>);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires an explicit fetch implementation when global fetch is unavailable", () => {
    withGlobalFetch(undefined, () => {
      expect(
        () =>
          new MouserClient({
            apiKey: "api-key",
          }),
      ).toThrow("A fetch implementation is required in this runtime.");
    });
  });

  it("rejects invalid retry options before sending requests", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({}));
    const client = new MouserClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
      searchRateLimiter: false,
    });

    await expect(
      client.productSearch.keywordSearch(
        { keyword: "sensor" },
        {
          retry: {
            retries: -1,
          },
        },
      ),
    ).rejects.toThrow("retry.retries must be a non-negative integer.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("honors date-based Retry-After headers", async () => {
    vi.useFakeTimers();
    setSystemTime(new Date("2026-01-01T00:00:00Z"));
    try {
      const fetch = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse(
            { Errors: [{ Message: "Service unavailable" }] },
            503,
            "Service Unavailable",
            {
              "Retry-After": new Date(Date.now() + 1_000).toUTCString(),
            },
          ),
        )
        .mockResolvedValueOnce(jsonResponse({ SearchResults: { NumberOfResult: 0, Parts: [] } }));
      const client = new MouserClient({
        apiKey: "api-key",
        apiBaseUrl: "https://api.mouser.test",
        fetch,
        retry: {
          retries: 1,
          baseDelayMs: 10_000,
        },
        searchRateLimiter: false,
      });

      const request = client.productSearch.keywordSearch({ keyword: "sensor" });
      await waitForExpectation(() => expect(fetch).toHaveBeenCalledTimes(1));
      await advanceTimersByTime(1_000);

      await expect(request).resolves.toEqual({ SearchResults: { NumberOfResult: 0, Parts: [] } });
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("wraps caller aborts while waiting to retry", async () => {
    const controller = new AbortController();
    const fetch = vi.fn<FetchLike>(async () =>
      jsonResponse({ Errors: [{ Message: "Service unavailable" }] }, 503, "Service Unavailable"),
    );
    const client = new MouserClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
      retry: {
        retries: 1,
        baseDelayMs: 10_000,
      },
      searchRateLimiter: false,
    });

    const request = client.productSearch.keywordSearch(
      { keyword: "sensor" },
      {
        signal: controller.signal,
      },
    );
    await waitForExpectation(() => expect(fetch).toHaveBeenCalledTimes(1));
    await flushMicrotasks();
    controller.abort(new DOMException("caller aborted", "AbortError"));

    await expect(request).rejects.toMatchObject({
      name: "MouserNetworkError",
      isAbort: true,
      method: "POST",
    } satisfies Partial<MouserNetworkError>);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid timeout values before sending requests", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({}));
    const client = new MouserClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
      searchRateLimiter: false,
    });

    await expect(client.cart.getCart("cart-key", { timeoutMs: Number.NaN })).rejects.toThrow(
      "timeoutMs must be a non-negative finite number.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("wraps caller-aborted API requests in MouserNetworkError", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("caller aborted", "AbortError"));
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      throw init?.signal?.reason;
    });
    const client = new MouserClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
      searchRateLimiter: false,
    });

    await expect(
      client.cart.getCart("cart-key", {
        signal: controller.signal,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({
      name: "MouserNetworkError",
      isAbort: true,
      method: "GET",
    } satisfies Partial<MouserNetworkError>);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("wraps non-error transport failures without assuming message shape", async () => {
    const fetch = vi.fn<FetchLike>(async () => {
      throw "offline";
    });
    const client = new MouserClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
      searchRateLimiter: false,
    });

    await expect(client.cart.getCart("cart-key")).rejects.toMatchObject({
      name: "MouserNetworkError",
      message: "Mouser request failed before receiving a response.",
      method: "GET",
      isTimeout: false,
      isAbort: false,
    } satisfies Partial<MouserNetworkError>);
  });
});

describe("MouserSearchRateLimiter", () => {
  it("resolves disabled and custom rate limiters", () => {
    const custom = {
      waitForAvailableRequest: vi.fn(),
    } satisfies SearchRateLimiter;

    expect(resolveSearchRateLimiter(false)).toBeUndefined();
    expect(resolveSearchRateLimiter(custom)).toBe(custom);
    expect(() => new MouserSearchRateLimiter({ requestsPerMinute: 0 })).toThrow(
      "requestsPerMinute must be a positive integer.",
    );
  });

  it("waits for the next day window when the daily quota is exhausted", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new MouserSearchRateLimiter({
      requestsPerMinute: 2,
      requestsPerDay: 1,
      now: () => now,
      sleep: async (delayMs) => {
        waits.push(delayMs);
        now += delayMs;
      },
    });

    await limiter.waitForAvailableRequest();
    await limiter.waitForAvailableRequest();

    expect(waits).toEqual([86_400_000]);
  });

  it("uses the built-in wait timer and cleans up abort listeners", async () => {
    vi.useFakeTimers();
    try {
      let now = 0;
      const limiter = new MouserSearchRateLimiter({
        requestsPerMinute: 1,
        requestsPerDay: 1000,
        now: () => now,
      });

      await limiter.waitForAvailableRequest();
      const wait = limiter.waitForAvailableRequest();
      await Promise.resolve();
      now = 60_000;
      await advanceTimersByTime(60_000);

      await expect(wait).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects already-aborted rate-limit waits", async () => {
    const controller = new AbortController();
    const limiter = new MouserSearchRateLimiter();
    controller.abort(new DOMException("caller aborted", "AbortError"));

    await expect(
      limiter.waitForAvailableRequest({ signal: controller.signal }),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("rejects in-flight rate-limit waits when the caller aborts", async () => {
    const controller = new AbortController();
    let now = 0;
    const limiter = new MouserSearchRateLimiter({
      requestsPerMinute: 1,
      requestsPerDay: 1000,
      now: () => now,
    });

    await limiter.waitForAvailableRequest();
    const wait = limiter.waitForAvailableRequest({ signal: controller.signal });
    await flushMicrotasks();
    controller.abort(new DOMException("caller aborted", "AbortError"));
    now = 60_000;

    await expect(wait).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

describe("parseRateLimitHeaders", () => {
  it("ignores blank and invalid rate-limit headers", () => {
    expect(
      parseRateLimitHeaders(
        new Headers({
          "X-RateLimit-Limit": "not-a-number",
          "X-RateLimit-Remaining": "",
          "X-RateLimit-ResetTime": "  ",
        }),
      ),
    ).toEqual({
      limit: undefined,
      remaining: undefined,
      reset: undefined,
      resetTime: undefined,
      retryAfter: undefined,
    });
  });
});

function jsonResponse(
  body: unknown,
  status = 200,
  statusText = "OK",
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

async function advanceTimersByTime(delayMs: number): Promise<void> {
  await flushMicrotasks();
  vi.advanceTimersByTime(delayMs);
  await flushMicrotasks();
}

async function flushMicrotasks(): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await Promise.resolve();
  }
}

async function waitForExpectation(assertion: () => void): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await Promise.resolve();
    }
  }

  throw lastError;
}

function withGlobalFetch(fetch: typeof globalThis.fetch | undefined, run: () => void): void {
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetch,
  });

  try {
    run();
  } finally {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
  }
}
