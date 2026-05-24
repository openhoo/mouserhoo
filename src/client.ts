import { MouserHttpClient } from "./http";
import { CartClient } from "./cart";
import { OrderClient } from "./order";
import { OrderHistoryClient } from "./order-history";
import { ProductSearchClient } from "./product-search";
import { resolveSearchRateLimiter, type MouserSearchRateLimiterInput } from "./rate-limit";
import type {
  ApiKeyProvider,
  FetchLike,
  MouserRequestContentType,
  MouserResponseContentType,
  MouserResponseType,
  MouserRetryOptions,
  ResponseHook
} from "./types";

export interface MouserClientOptions {
  apiKey?: string;
  apiKeyProvider?: ApiKeyProvider;
  apiBaseUrl?: string;
  fetch?: FetchLike;
  defaultHeaders?: HeadersInit;
  timeoutMs?: number;
  onResponse?: ResponseHook;
  searchRateLimiter?: MouserSearchRateLimiterInput;
  retry?: MouserRetryOptions | false;
  contentType?: MouserRequestContentType;
  accept?: MouserResponseContentType;
  responseType?: MouserResponseType;
}

export class MouserClient {
  readonly cart: CartClient;
  readonly order: OrderClient;
  readonly orderHistory: OrderHistoryClient;
  readonly productSearch: ProductSearchClient;
  readonly search: ProductSearchClient;

  constructor(options: MouserClientOptions) {
    const http = new MouserHttpClient({
      apiKey: options.apiKey,
      apiKeyProvider: options.apiKeyProvider,
      apiBaseUrl: options.apiBaseUrl,
      fetch: options.fetch,
      defaultHeaders: options.defaultHeaders,
      timeoutMs: options.timeoutMs,
      onResponse: options.onResponse,
      retry: options.retry,
      contentType: options.contentType,
      accept: options.accept,
      responseType: options.responseType
    });
    const searchRateLimiter = resolveSearchRateLimiter(options.searchRateLimiter ?? {});

    this.cart = new CartClient(http);
    this.order = new OrderClient(http);
    this.orderHistory = new OrderHistoryClient(http);
    this.productSearch = new ProductSearchClient(http, searchRateLimiter);
    this.search = this.productSearch;
  }
}
