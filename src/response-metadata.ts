export interface MouserRateLimit {
  limit?: number;
  remaining?: number;
  reset?: number;
  resetTime?: string;
  retryAfter?: number;
}

export interface MouserResponseMetadata {
  url: string;
  method: string;
  status: number;
  statusText: string;
  headers: Headers;
  rateLimit: MouserRateLimit;
}

export function responseMetadata(options: {
  url: URL;
  method: string;
  response: Response;
}): MouserResponseMetadata {
  return {
    url: options.url.toString(),
    method: options.method,
    status: options.response.status,
    statusText: options.response.statusText,
    headers: options.response.headers,
    rateLimit: parseRateLimitHeaders(options.response.headers),
  };
}

export function parseRateLimitHeaders(headers: Headers): MouserRateLimit {
  return {
    limit: parseOptionalNumber(headers.get("X-RateLimit-Limit")),
    remaining: parseOptionalNumber(headers.get("X-RateLimit-Remaining")),
    reset: parseOptionalNumber(headers.get("X-RateLimit-Reset")),
    resetTime: parseOptionalString(headers.get("X-RateLimit-ResetTime")),
    retryAfter: parseOptionalNumber(headers.get("Retry-After")),
  };
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalString(value: string | null): string | undefined {
  return value === null || value.trim() === "" ? undefined : value;
}
