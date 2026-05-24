import type { ApiKeyProvider } from "./types";

export interface MouserApiKeyAuthOptions {
  apiKey: string;
}

export class MouserApiKeyAuth implements ApiKeyProvider {
  readonly apiKey: string;

  constructor(options: MouserApiKeyAuthOptions | string) {
    this.apiKey = typeof options === "string" ? options : options.apiKey;
    assertApiKey(this.apiKey);
  }

  getApiKey(): string {
    return this.apiKey;
  }
}

export function assertApiKey(apiKey: string): void {
  if (apiKey.trim().length === 0) {
    throw new TypeError("A non-empty Mouser API key is required.");
  }
}
