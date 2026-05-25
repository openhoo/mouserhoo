import type { MouserResponseMetadata } from "./response-metadata";

export type MaybePromise<T> = T | Promise<T>;

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ApiKeyRequestContext {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ApiKeyProvider {
  getApiKey(options?: ApiKeyRequestContext): MaybePromise<string>;
}

export type ResponseHook = (metadata: MouserResponseMetadata) => MaybePromise<void>;

export interface MouserRetryOptions {
  retries?: number;
  retryOnStatuses?: readonly number[];
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export type MouserRequestContentType =
  | "application/json"
  | "text/json"
  | "application/xml"
  | "text/xml"
  | "application/x-www-form-urlencoded";

export type MouserResponseContentType =
  | "application/json"
  | "text/json"
  | "application/xml"
  | "text/xml";
export type MouserResponseType = "auto" | "json" | "text";

export interface MouserRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: HeadersInit;
  retry?: MouserRetryOptions | false;
  contentType?: MouserRequestContentType;
  accept?: MouserResponseContentType;
  responseType?: MouserResponseType;
}

export type LooseMouserObject<T extends object = object> = T & {
  [key: string]: unknown;
};

export type MouserResponseBody<Options, JsonBody> = Options extends { responseType: "json" }
  ? JsonBody
  : Options extends { responseType: "text" }
    ? string
    : Options extends { accept: "application/xml" | "text/xml" }
      ? string
      : JsonBody;

export type JsonResponse<Operation> = Operation extends {
  responses: {
    200: {
      content: {
        "application/json": infer ResponseBody;
      };
    };
  };
}
  ? ResponseBody
  : never;

export type OperationRequestBody<Operation> = Operation extends {
  requestBody: {
    content: {
      "application/json": infer RequestBody;
    };
  };
}
  ? RequestBody
  : never;
