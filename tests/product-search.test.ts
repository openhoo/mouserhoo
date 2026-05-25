import { describe, expect, it, vi } from "vitest";
import { MouserApiError, MouserClient, MouserConfigurationError, MouserNetworkError } from "../src";
import type { ApiKeyProvider, FetchLike, KeywordSearchRequest, MouserPartSearchOption } from "../src";

describe("ProductSearchClient", () => {
  it("posts keyword search requests using Mouser's documented API key query authentication", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ SearchResults: { NumberOfResult: 0, Parts: [] } }));
    const client = new MouserClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch
    });

    await client.productSearch.keywordSearch(
      {
        keyword: "microcontroller",
        records: 10,
        startingRecord: 0,
        searchOptions: "InStock"
      },
      {
        headers: {
          "X-Test": "value"
        }
      }
    );

    const [input, init] = fetch.mock.calls[0]!;
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);

    expect(init?.method).toBe("POST");
    expect(url.origin).toBe("https://api.mouser.test");
    expect(url.pathname).toBe("/api/v1/search/keyword");
    expect(url.searchParams.get("apiKey")).toBe("api-key");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Test")).toBe("value");
    expect(init?.body).toBe(
      JSON.stringify({
        SearchByKeywordRequest: {
          keyword: "microcontroller",
          records: 10,
          startingRecord: 0,
          searchOptions: "InStock"
        }
      })
    );
  });

  it("maps productDetails to the documented part-number search method with Exact matching", async () => {
    const fetch = vi.fn<FetchLike>(async () =>
      jsonResponse({
        SearchResults: {
          NumberOfResult: 1,
          Parts: [{ MouserPartNumber: "595-NE555P" }]
        }
      })
    );
    const client = testClient(fetch);

    await client.productSearch.productDetails("595-NE555P", {
      mouserPaysCustomsAndDuties: true
    });

    const [input, init] = fetch.mock.calls[0]!;
    const url = new URL(String(input));

    expect(init?.method).toBe("POST");
    expect(url.pathname).toBe("/api/v1/search/partnumber");
    expect(init?.body).toBe(
      JSON.stringify({
        SearchByPartRequest: {
          mouserPartNumber: "595-NE555P",
          partSearchOptions: "Exact",
          mouserPaysCustomsAndDuties: true
        }
      })
    );
  });

  it("maps all first-milestone Search API methods to official v1 and v2 paths", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const client = testClient(fetch);

    const calls: Array<[string, () => Promise<unknown>, string, string | undefined]> = [
      ["keywordSearch", () => client.productSearch.keywordSearch({ keyword: "op amp" }), "/api/v1/search/keyword", "POST"],
      [
        "partNumberSearch",
        () => client.productSearch.partNumberSearch({ mouserPartNumber: "595-NE555P" }),
        "/api/v1/search/partnumber",
        "POST"
      ],
      [
        "keywordAndManufacturerSearchById",
        () =>
          client.productSearch.keywordAndManufacturerSearchById({
            keyword: "timer",
            manufacturerId: 123,
            records: 10,
            startingRecord: 0
          }),
        "/api/v1/search/keywordandmanufacturer",
        "POST"
      ],
      [
        "partNumberAndManufacturerSearchById",
        () =>
          client.productSearch.partNumberAndManufacturerSearchById({
            mouserPartNumber: "NE555P",
            manufacturerId: 123,
            partSearchOptions: "Exact"
          }),
        "/api/v1/search/partnumberandmanufacturer",
        "POST"
      ],
      [
        "keywordAndManufacturerSearch",
        () =>
          client.productSearch.keywordAndManufacturerSearch({
            keyword: "timer",
            manufacturerName: "Texas Instruments",
            records: 10,
            pageNumber: 1
          }),
        "/api/v2/search/keywordandmanufacturer",
        "POST"
      ],
      [
        "partNumberAndManufacturerSearch",
        () =>
          client.productSearch.partNumberAndManufacturerSearch({
            mouserPartNumber: "NE555P",
            manufacturerName: "Texas Instruments",
            partSearchOptions: "Exact"
          }),
        "/api/v2/search/partnumberandmanufacturer",
        "POST"
      ],
      ["manufacturerList", () => client.productSearch.manufacturerList(), "/api/v2/search/manufacturerlist", "GET"],
      [
        "manufacturerListById",
        () => client.productSearch.manufacturerListById(),
        "/api/v1/search/manufacturerlist",
        "GET"
      ],
      ["manufacturers", () => client.productSearch.manufacturers(), "/api/v2/search/manufacturerlist", "GET"]
    ];

    for (const [name, call, pathname, method] of calls) {
      fetch.mockClear();
      await call();

      const [input, init] = fetch.mock.calls[0]!;
      const url = new URL(String(input));
      expect(url.pathname, name).toBe(pathname);
      expect(url.searchParams.get("apiKey"), name).toBe("api-key");
      expect(init?.method, name).toBe(method);
    }
  });

  it("supports an async API key provider", async () => {
    const apiKeyProvider = {
      getApiKey: vi.fn(async () => "provided-api-key")
    } satisfies ApiKeyProvider;
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ SearchResults: { NumberOfResult: 0, Parts: [] } }));
    const client = new MouserClient({
      apiKeyProvider,
      apiBaseUrl: "https://api.mouser.test",
      fetch
    });

    await client.productSearch.keywordSearch({ keyword: "sensor" }, { timeoutMs: 25 });

    const [input] = fetch.mock.calls[0]!;
    expect(new URL(String(input)).searchParams.get("apiKey")).toBe("provided-api-key");
    expect(apiKeyProvider.getApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 25
      })
    );
  });

  it("can send documented text/json and form-url-encoded requests", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ SearchResults: { NumberOfResult: 0, Parts: [] } }));
    const client = testClient(fetch);

    await client.productSearch.keywordSearch(
      {
        keyword: "op amp",
        records: 10
      },
      {
        accept: "text/json",
        contentType: "application/x-www-form-urlencoded"
      }
    );

    const [, init] = fetch.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("Accept")).toBe("text/json");
    expect(headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(init?.body).toBe("SearchByKeywordRequest.keyword=op+amp&SearchByKeywordRequest.records=10");
  });

  it("throws a configuration error when no authentication is configured", () => {
    expect(() => new MouserClient({ fetch: vi.fn<FetchLike>() })).toThrow(MouserConfigurationError);
  });

  it("throws MouserApiError for failed HTTP responses", async () => {
    const fetch = vi.fn<FetchLike>(async () =>
      jsonResponse(
        {
          Errors: [{ Message: "API key is invalid" }],
          RequestId: "request-id"
        },
        401,
        "Unauthorized",
        {
          "Retry-After": "30"
        }
      )
    );
    const client = testClient(fetch);

    await expect(client.productSearch.keywordSearch({ keyword: "sensor" })).rejects.toMatchObject({
      name: "MouserApiError",
      message: "Mouser API error 401: API key is invalid",
      status: 401,
      requestId: "request-id",
      rateLimit: {
        retryAfter: 30
      }
    } satisfies Partial<MouserApiError>);
  });

  it("retries retryable HTTP responses when configured", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        jsonResponse({ Errors: [{ Message: "Too many requests" }] }, 429, "Too Many Requests", {
          "Retry-After": "0"
        })
      )
      .mockResolvedValueOnce(jsonResponse({ SearchResults: { NumberOfResult: 0, Parts: [] } }));
    const client = new MouserClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
      retry: {
        retries: 1
      }
    });

    await client.productSearch.keywordSearch({ keyword: "sensor" });

    expect(fetch).toHaveBeenCalledTimes(2);
    const [input] = fetch.mock.calls[1]!;
    const url = new URL(String(input));
    expect(url.searchParams.get("retry")).toBeNull();
  });

  it("wraps transport failures in MouserNetworkError", async () => {
    const fetch = vi.fn<FetchLike>(async () => {
      throw new TypeError("network unreachable");
    });
    const client = testClient(fetch);

    await expect(client.productSearch.manufacturerList()).rejects.toMatchObject({
      name: "MouserNetworkError",
      message: "Mouser request failed before receiving a response: network unreachable",
      method: "GET",
      isTimeout: false,
      isAbort: false
    } satisfies Partial<MouserNetworkError>);
  });

  it("emits response metadata with parsed rate-limit headers", async () => {
    const onResponse = vi.fn();
    const fetch = vi.fn<FetchLike>(async () =>
      jsonResponse(
        { SearchResults: { NumberOfResult: 0, Parts: [] } },
        200,
        "OK",
        {
          "X-RateLimit-Limit": "1000",
          "X-RateLimit-Remaining": "999"
        }
      )
    );
    const client = new MouserClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
      onResponse
    });

    await client.productSearch.keywordSearch({ keyword: "sensor" });

    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        status: 200,
        url: "https://api.mouser.test/api/v1/search/keyword?apiKey=api-key",
        rateLimit: expect.objectContaining({
          limit: 1000,
          remaining: 999
        })
      })
    );
  });

  it("aborts API requests after the configured timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn<FetchLike>(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          })
      );
      const client = testClient(fetch);

      const request = client.productSearch.manufacturerList({ timeoutMs: 50 });
      const assertion = expect(request).rejects.toMatchObject({
        name: "MouserNetworkError",
        message: "Mouser request timed out after 50ms.",
        isTimeout: true,
        method: "GET"
      } satisfies Partial<MouserNetworkError>);

      await vi.advanceTimersByTimeAsync(50);
      await assertion;
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("validates documented search limits before sending requests", () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({}));
    const client = testClient(fetch);

    expect(() => client.productSearch.keywordSearch({ keyword: "x", records: 51 })).toThrow(
      "records must be an integer between 0 and 50."
    );
    expect(() =>
      client.productSearch.keywordSearch({ keyword: "x", searchOptions: "LeadFree" as never })
    ).toThrow("searchOptions must be one of");
    expect(() => client.productSearch.keywordSearch({ keyword: "x", startingRecord: -1 })).toThrow(
      "startingRecord must be a non-negative integer."
    );
    expect(() => client.productSearch.keywordAndManufacturerSearch({ keyword: "x", pageNumber: 0 })).toThrow(
      "pageNumber must be a positive integer."
    );
    expect(() =>
      client.productSearch.partNumberSearch({
        mouserPartNumber: "595-NE555P",
        partSearchOptions: "StartsWith" as never
      })
    ).toThrow("partSearchOptions must be one of");
    expect(() => client.productSearch.partNumberSearch({ mouserPartNumber: "AB" })).toThrow(
      "mouserPartNumber entries must be between 3 and 40 characters."
    );
    expect(() =>
      client.productSearch.partNumberSearch({
        mouserPartNumber: [
          "P1A",
          "P2A",
          "P3A",
          "P4A",
          "P5A",
          "P6A",
          "P7A",
          "P8A",
          "P9A",
          "P10",
          "P11"
        ].join("|")
      })
    ).toThrow("mouserPartNumber may include at most 10 part numbers separated by pipe characters.");

    expect(fetch).not.toHaveBeenCalled();
  });

  it("can pace Search API calls with the optional Mouser limits helper", async () => {
    let now = 0;
    const waits: number[] = [];
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ SearchResults: { NumberOfResult: 0, Parts: [] } }));
    const client = new MouserClient({
      apiKey: "api-key",
      apiBaseUrl: "https://api.mouser.test",
      fetch,
      searchRateLimiter: {
        requestsPerMinute: 1,
        requestsPerDay: 1000,
        now: () => now,
        sleep: async (delayMs) => {
          waits.push(delayMs);
          now += delayMs;
        }
      }
    });

    await client.productSearch.keywordSearch({ keyword: "sensor" });
    await client.productSearch.manufacturerList();

    expect(waits).toEqual([60_000]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("types documented search option values", () => {
    const keywordRequest = {
      keyword: "resistor",
      searchOptions: "RohsAndInStock"
    } satisfies KeywordSearchRequest;
    const numericOption = {
      mouserPartNumber: "595-NE555P",
      partSearchOptions: 2
    } satisfies { mouserPartNumber: string; partSearchOptions: MouserPartSearchOption };

    expect(keywordRequest.searchOptions).toBe("RohsAndInStock");
    expect(numericOption.partSearchOptions).toBe(2);

    // @ts-expect-error Mouser documents only None, Rohs, InStock, RohsAndInStock or IDs 1, 2, 4, 8.
    const invalidKeywordOption = { keyword: "resistor", searchOptions: "LeadFree" } satisfies KeywordSearchRequest;
    // @ts-expect-error Mouser part-number search documents only None, Exact or IDs 1, 2.
    const invalidPartOption = { mouserPartNumber: "595-NE555P", partSearchOptions: "StartsWith" } satisfies {
      mouserPartNumber: string;
      partSearchOptions: MouserPartSearchOption;
    };

    void invalidKeywordOption;
    void invalidPartOption;
  });
});

function testClient(fetch: FetchLike): MouserClient {
  return new MouserClient({
    apiKey: "api-key",
    apiBaseUrl: "https://api.mouser.test",
    fetch
  });
}

function jsonResponse(
  body: unknown,
  status = 200,
  statusText = "OK",
  headers: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}
