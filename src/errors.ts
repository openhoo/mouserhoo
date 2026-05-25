import { type MouserRateLimit, parseRateLimitHeaders } from "./response-metadata";

export interface MouserApiErrorOptions {
  message: string;
  status: number;
  statusText: string;
  url: string;
  method: string;
  details?: unknown;
  headers?: Headers;
}

export interface MouserNetworkErrorOptions {
  url: string;
  method: string;
  cause: unknown;
}

export class MouserApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly method: string;
  readonly details?: unknown;
  readonly requestId?: string;
  readonly responseHeaders: Headers;
  readonly rateLimit: MouserRateLimit;

  constructor(options: MouserApiErrorOptions) {
    super(options.message);
    this.name = "MouserApiError";
    this.status = options.status;
    this.statusText = options.statusText;
    this.url = options.url;
    this.method = options.method;
    this.details = options.details;
    this.responseHeaders = options.headers ?? new Headers();
    this.rateLimit = parseRateLimitHeaders(this.responseHeaders);
    this.requestId =
      readStringProperty(options.details, "RequestId") ??
      readStringProperty(options.details, "requestId") ??
      readStringProperty(options.details, "correlationId") ??
      this.responseHeaders.get("x-request-id") ??
      undefined;
  }
}

export class MouserNetworkError extends Error {
  readonly url: string;
  readonly method: string;
  override readonly cause: unknown;
  readonly isTimeout: boolean;
  readonly isAbort: boolean;

  constructor(options: MouserNetworkErrorOptions) {
    super(networkErrorMessage(options.cause), { cause: options.cause });
    this.name = "MouserNetworkError";
    this.url = options.url;
    this.method = options.method;
    this.cause = options.cause;
    this.isTimeout = readErrorName(options.cause) === "TimeoutError";
    this.isAbort = readErrorName(options.cause) === "AbortError";
  }
}

export class MouserConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MouserConfigurationError";
  }
}

export function apiErrorMessage(status: number, statusText: string, details: unknown): string {
  const detail =
    firstMouserErrorMessage(details) ??
    readStringProperty(details, "ErrorMessage") ??
    readStringProperty(details, "Message") ??
    readStringProperty(details, "detail") ??
    readStringProperty(details, "title");

  return detail
    ? `Mouser API error ${status}: ${detail}`
    : `Mouser API error ${status}: ${statusText}`;
}

function firstMouserErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const errors = (value as { Errors?: unknown }).Errors;
  if (!Array.isArray(errors)) {
    return undefined;
  }

  for (const error of errors) {
    const message = readStringProperty(error, "Message");
    if (message) {
      return message;
    }
  }

  return undefined;
}

function readStringProperty(value: unknown, property: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const found = (value as Record<string, unknown>)[property];
  return typeof found === "string" && found.length > 0 ? found : undefined;
}

function networkErrorMessage(cause: unknown): string {
  const message = readErrorMessage(cause);
  const name = readErrorName(cause);

  if (name === "TimeoutError" && message) {
    return message;
  }

  return message
    ? `Mouser request failed before receiving a response: ${message}`
    : "Mouser request failed before receiving a response.";
}

function readErrorName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const name = (value as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

function readErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const message = (value as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}
