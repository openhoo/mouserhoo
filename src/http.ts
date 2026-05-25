import { assertApiKey, MouserApiKeyAuth } from "./auth";
import { MOUSER_API_BASE_URL } from "./constants";
import {
  apiErrorMessage,
  MouserApiError,
  MouserConfigurationError,
  MouserNetworkError,
} from "./errors";
import { responseMetadata } from "./response-metadata";
import { resolveRequestSignal } from "./signal";
import type {
  ApiKeyProvider,
  FetchLike,
  MouserRequestContentType,
  MouserRequestOptions,
  MouserResponseContentType,
  MouserResponseType,
  MouserRetryOptions,
  ResponseHook,
} from "./types";

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParameters = Record<string, QueryValue | readonly QueryValue[]>;

export interface MouserHttpClientOptions {
  apiKey?: string;
  apiKeyProvider?: ApiKeyProvider;
  apiBaseUrl?: string;
  fetch?: FetchLike;
  defaultHeaders?: HeadersInit;
  timeoutMs?: number;
  onResponse?: ResponseHook;
  retry?: MouserRetryOptions | false;
  contentType?: MouserRequestContentType;
  accept?: MouserResponseContentType;
  responseType?: MouserResponseType;
}

export interface HttpRequestOptions {
  method: "GET" | "POST";
  path: string;
  query?: QueryParameters;
  body?: unknown;
  requestOptions?: MouserRequestOptions;
  xmlRootName?: string;
  xmlArrayItemNames?: Record<string, string>;
}

export class MouserHttpClient {
  private readonly apiKeyProvider: ApiKeyProvider;
  private readonly apiBaseUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly defaultHeaders?: HeadersInit;
  private readonly timeoutMs?: number;
  private readonly onResponse?: ResponseHook;
  private readonly retry?: MouserRetryOptions | false;
  private readonly contentType?: MouserRequestContentType;
  private readonly accept?: MouserResponseContentType;
  private readonly responseType: MouserResponseType;

  constructor(options: MouserHttpClientOptions) {
    this.apiKeyProvider = resolveApiKeyProvider(options);
    this.apiBaseUrl = options.apiBaseUrl ?? MOUSER_API_BASE_URL;
    this.fetchFn = options.fetch ?? getGlobalFetch();
    this.defaultHeaders = options.defaultHeaders;
    this.timeoutMs = options.timeoutMs;
    this.onResponse = options.onResponse;
    this.retry = options.retry;
    this.contentType = options.contentType;
    this.accept = options.accept;
    this.responseType = options.responseType ?? "auto";
  }

  async request<T>(options: HttpRequestOptions): Promise<T> {
    const retry = resolveRetryOptions(options.requestOptions?.retry ?? this.retry);
    let attempt = 0;

    while (true) {
      const result = await this.send(options);

      if (result.response.ok) {
        return result.parsed as T;
      }

      if (!shouldRetry(result.response, retry, attempt)) {
        throw new MouserApiError({
          message: apiErrorMessage(
            result.response.status,
            result.response.statusText,
            result.parsed,
          ),
          status: result.response.status,
          statusText: result.response.statusText,
          url: result.url.toString(),
          method: options.method,
          details: result.parsed,
          headers: result.response.headers,
        });
      }

      try {
        await sleep(
          retryDelayMs(result.response.headers, retry, attempt),
          options.requestOptions?.signal,
        );
      } catch (cause) {
        throw new MouserNetworkError({
          url: result.url.toString(),
          method: options.method,
          cause,
        });
      }
      attempt += 1;
    }
  }

  private async send(
    options: HttpRequestOptions,
  ): Promise<{ url: URL; response: Response; parsed: unknown }> {
    const url = await this.buildUrl(options);
    const headers = this.buildHeaders(options);
    const resolvedSignal = resolveRequestSignal({
      signal: options.requestOptions?.signal,
      timeoutMs: options.requestOptions?.timeoutMs ?? this.timeoutMs,
    });

    let response: Response;
    let parsed: unknown;

    try {
      response = await this.fetchFn(url, {
        method: options.method,
        headers,
        body: this.serializeBody(options, headers),
        signal: resolvedSignal.signal,
      });
      parsed = await parseResponseBody(
        response,
        options.requestOptions?.responseType ?? this.responseType,
      );
    } catch (cause) {
      throw new MouserNetworkError({
        url: url.toString(),
        method: options.method,
        cause,
      });
    } finally {
      resolvedSignal.cleanup();
    }

    await this.onResponse?.(
      responseMetadata({
        url,
        method: options.method,
        response,
      }),
    );

    return { url, response, parsed };
  }

  private async buildUrl(options: HttpRequestOptions): Promise<URL> {
    const url = new URL(options.path, this.apiBaseUrl);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        appendQueryParameter(url.searchParams, key, value);
      }
    }

    const apiKey = await this.apiKeyProvider.getApiKey({
      signal: options.requestOptions?.signal,
      timeoutMs: options.requestOptions?.timeoutMs ?? this.timeoutMs,
    });
    assertApiKey(apiKey);
    url.searchParams.set("apiKey", apiKey);

    return url;
  }

  private buildHeaders(options: HttpRequestOptions): Headers {
    const headers = new Headers(this.defaultHeaders);
    const accept = options.requestOptions?.accept ?? this.accept;
    const contentType = options.requestOptions?.contentType ?? this.contentType;

    headers.set("Accept", accept ?? "application/json");

    if (options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", contentType ?? "application/json");
    }

    if (options.requestOptions?.headers) {
      for (const [key, value] of new Headers(options.requestOptions.headers)) {
        headers.set(key, value);
      }
    }

    return headers;
  }

  private serializeBody(options: HttpRequestOptions, headers: Headers): BodyInit | undefined {
    if (options.body === undefined) {
      return undefined;
    }

    const contentType = mediaType(headers.get("Content-Type"));

    if (contentType === "application/x-www-form-urlencoded") {
      return formEncode(options.body);
    }

    if (contentType === "application/xml" || contentType === "text/xml") {
      return xmlEncode(options.body, {
        rootName: options.xmlRootName,
        arrayItemNames: options.xmlArrayItemNames,
      });
    }

    return JSON.stringify(options.body);
  }
}

export function splitRequestOptions<T extends MouserRequestOptions>(
  options: T | undefined,
): [MouserRequestOptions | undefined, Omit<T, keyof MouserRequestOptions>] {
  if (!options) {
    return [undefined, {} as Omit<T, keyof MouserRequestOptions>];
  }

  const { signal, timeoutMs, headers, retry, contentType, accept, responseType, ...query } =
    options;
  return [
    {
      signal,
      timeoutMs,
      headers,
      retry,
      contentType,
      accept,
      responseType,
    },
    query as Omit<T, keyof MouserRequestOptions>,
  ];
}

function resolveApiKeyProvider(options: MouserHttpClientOptions): ApiKeyProvider {
  if (options.apiKeyProvider) {
    return options.apiKeyProvider;
  }

  if (options.apiKey !== undefined) {
    return new MouserApiKeyAuth(options.apiKey);
  }

  throw new MouserConfigurationError("A Mouser apiKey or apiKeyProvider is required.");
}

function appendQueryParameter(
  searchParams: URLSearchParams,
  key: string,
  value: QueryValue | readonly QueryValue[],
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryParameter(searchParams, key, item);
    }
    return;
  }

  if (value === undefined || value === null) {
    return;
  }

  searchParams.append(key, String(value));
}

async function parseResponseBody(
  response: Response,
  responseType: MouserResponseType,
): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  if (responseType === "text") {
    return text;
  }

  if (responseType === "json") {
    return JSON.parse(text) as unknown;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function mediaType(value: string | null): string {
  return value?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function formEncode(value: unknown): string {
  const params = new URLSearchParams();
  appendFormFields(params, "", value);
  return params.toString();
}

function appendFormFields(params: URLSearchParams, prefix: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendFormFields(params, `${prefix}[${index}]`, item);
    });
    return;
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const field = prefix ? `${prefix}.${key}` : key;
      appendFormFields(params, field, item);
    }
    return;
  }

  params.append(prefix, String(value));
}

interface XmlEncodeOptions {
  rootName?: string;
  arrayItemNames?: Record<string, string>;
}

function xmlEncode(value: unknown, options: XmlEncodeOptions): string {
  if (typeof value === "string") {
    return value;
  }

  if (!options.rootName) {
    throw new TypeError("xmlRootName is required when sending XML requests.");
  }

  return serializeXmlElement(options.rootName, value, options.arrayItemNames ?? {});
}

function serializeXmlElement(
  name: string,
  value: unknown,
  arrayItemNames: Record<string, string>,
): string {
  if (value === undefined || value === null) {
    return `<${name} />`;
  }

  if (Array.isArray(value)) {
    const itemName = arrayItemNames[name] ?? name;
    const items = value.map((item) => serializeXmlElement(itemName, item, arrayItemNames)).join("");
    return `<${name}>${items}</${name}>`;
  }

  if (typeof value === "object") {
    const children = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => serializeXmlElement(key, item, arrayItemNames))
      .join("");
    return `<${name}>${children}</${name}>`;
  }

  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getGlobalFetch(): FetchLike {
  if (typeof globalThis.fetch !== "function") {
    throw new TypeError("A fetch implementation is required in this runtime.");
  }

  return globalThis.fetch.bind(globalThis) as FetchLike;
}

interface ResolvedRetryOptions {
  retries: number;
  retryOnStatuses: readonly number[];
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_STATUSES = [429, 500, 502, 503, 504] as const;

function resolveRetryOptions(
  options: MouserRetryOptions | false | undefined,
): ResolvedRetryOptions | undefined {
  if (!options) {
    return undefined;
  }

  const retry = {
    retries: options.retries ?? 2,
    retryOnStatuses: options.retryOnStatuses ?? DEFAULT_RETRY_STATUSES,
    baseDelayMs: options.baseDelayMs ?? 250,
    maxDelayMs: options.maxDelayMs ?? 30_000,
  };

  if (!Number.isInteger(retry.retries) || retry.retries < 0) {
    throw new RangeError("retry.retries must be a non-negative integer.");
  }

  if (!Number.isFinite(retry.baseDelayMs) || retry.baseDelayMs < 0) {
    throw new RangeError("retry.baseDelayMs must be a non-negative finite number.");
  }

  if (!Number.isFinite(retry.maxDelayMs) || retry.maxDelayMs < 0) {
    throw new RangeError("retry.maxDelayMs must be a non-negative finite number.");
  }

  return retry;
}

function shouldRetry(
  response: Response,
  retry: ResolvedRetryOptions | undefined,
  attempt: number,
): retry is ResolvedRetryOptions {
  return (
    retry !== undefined &&
    attempt < retry.retries &&
    retry.retryOnStatuses.includes(response.status)
  );
}

function retryDelayMs(headers: Headers, retry: ResolvedRetryOptions, attempt: number): number {
  const retryAfter = retryAfterDelayMs(headers.get("Retry-After"));
  if (retryAfter !== undefined) {
    return Math.min(retryAfter, retry.maxDelayMs);
  }

  return Math.min(retry.baseDelayMs * 2 ** attempt, retry.maxDelayMs);
}

function retryAfterDelayMs(value: string | null): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : undefined;
}

function sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  if (signal?.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException("Mouser retry wait was aborted.", "AbortError"),
    );
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(done, delayMs);

    function done(): void {
      signal?.removeEventListener("abort", abort);
      resolve();
    }

    function abort(): void {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason ?? new DOMException("Mouser retry wait was aborted.", "AbortError"));
    }

    signal?.addEventListener("abort", abort, { once: true });
  });
}
