import { SEARCH_V1_BASE_PATH, SEARCH_V2_BASE_PATH } from "./constants";
import type { components as V1Components, operations as V1Operations } from "./generated/mouser-v1";
import type { components as V2Components, operations as V2Operations } from "./generated/mouser-v2";
import type { HttpRequestOptions, MouserHttpClient } from "./http";
import type { SearchRateLimiter } from "./rate-limit";
import type {
  JsonResponse,
  LooseMouserObject,
  MouserRequestOptions,
  MouserResponseBody,
} from "./types";
import {
  integerInRange,
  nonNegativeInteger,
  oneOf,
  positiveInteger,
  requiredString,
} from "./validation";

export type SearchV1Schemas = V1Components["schemas"];
export type SearchV2Schemas = V2Components["schemas"];
export type SearchV1Operations = V1Operations;
export type SearchV2Operations = V2Operations;

export type MouserKeywordSearchOption =
  | "None"
  | "Rohs"
  | "InStock"
  | "RohsAndInStock"
  | "1"
  | "2"
  | "4"
  | "8"
  | 1
  | 2
  | 4
  | 8;

export type MouserPartSearchOption = "None" | "Exact" | "1" | "2" | 1 | 2;

const KEYWORD_SEARCH_OPTIONS = [
  "None",
  "Rohs",
  "InStock",
  "RohsAndInStock",
  "1",
  "2",
  "4",
  "8",
  1,
  2,
  4,
  8,
] as const;
const PART_SEARCH_OPTIONS = ["None", "Exact", "1", "2", 1, 2] as const;

export type MouserPart = SearchV1Schemas["MouserPart"];
export type SearchResponse = SearchV1Schemas["SearchResponse"];
export type SearchResponseRoot = SearchV1Schemas["SearchResponseRoot"];
export type ErrorEntity = SearchV1Schemas["ErrorEntity"];

export type KeywordSearchRequest = Omit<
  SearchV1Schemas["SearchByKeywordRequest"],
  "searchOptions"
> & {
  searchOptions?: MouserKeywordSearchOption;
};
export type PartNumberSearchRequest = Omit<
  SearchV1Schemas["SearchByPartRequest"],
  "partSearchOptions"
> & {
  partSearchOptions?: MouserPartSearchOption;
};
export type KeywordAndManufacturerSearchRequest = Omit<
  SearchV2Schemas["SearchByKeywordMfrNameRequest"],
  "searchOptions"
> & {
  searchOptions?: MouserKeywordSearchOption;
};
export type PartNumberAndManufacturerSearchRequest = Omit<
  SearchV2Schemas["SearchByPartMfrNameRequest"],
  "partSearchOptions"
> & {
  partSearchOptions?: MouserPartSearchOption;
};
/** @deprecated Mouser marks the v1 manufacturer-ID method as deprecated. Use keywordAndManufacturerSearch instead. */
export type LegacyKeywordAndManufacturerSearchRequest = Omit<
  SearchV1Schemas["SearchByKeywordMfrRequest"],
  "searchOptions"
> & {
  searchOptions?: MouserKeywordSearchOption;
};
/** @deprecated Mouser marks the v1 manufacturer-ID method as deprecated. Use partNumberAndManufacturerSearch instead. */
export type LegacyPartNumberAndManufacturerSearchRequest = Omit<
  SearchV1Schemas["SearchByPartMfrRequest"],
  "partSearchOptions"
> & {
  partSearchOptions?: MouserPartSearchOption;
};

export type KeywordSearchResponse = JsonResponse<SearchV1Operations["SearchApi_SearchByKeyword"]>;
export type PartNumberSearchResponse = JsonResponse<
  SearchV1Operations["SearchApi_SearchByPartNumber"]
>;
export type ProductDetailsResponse = PartNumberSearchResponse;
/** @deprecated Mouser marks the v1 manufacturer-ID method as deprecated. Use KeywordAndManufacturerSearchResponse instead. */
export type LegacyKeywordAndManufacturerSearchResponse = LooseMouserObject<
  Partial<SearchResponseRoot>
>;
/** @deprecated Mouser marks the v1 manufacturer-ID method as deprecated. Use PartNumberAndManufacturerSearchResponse instead. */
export type LegacyPartNumberAndManufacturerSearchResponse = LooseMouserObject<
  Partial<SearchResponseRoot>
>;
export type KeywordAndManufacturerSearchResponse = JsonResponse<
  SearchV2Operations["SearchApi_LwSearchByKeywordAndManufacturer"]
>;
export type PartNumberAndManufacturerSearchResponse = JsonResponse<
  SearchV2Operations["SearchApi_LwSearchByPartNumberAndManufacturer"]
>;
export type ManufacturerListResponse = JsonResponse<
  SearchV2Operations["SearchApi_GetLwManufacturerList"]
>;
export interface LegacyManufacturer {
  ManufacturerId?: number;
  ManufacturerName?: string;
  [key: string]: unknown;
}
/** @deprecated Mouser marks the v1 manufacturer-list method as deprecated. Use ManufacturerListResponse instead. */
export type LegacyManufacturerListResponse = LooseMouserObject<{
  MouserManufacturerList?: {
    Count?: number;
    ManufacturerList?: LegacyManufacturer[];
  };
  Errors?: ErrorEntity[];
}>;

export type SearchRequestOptions = MouserRequestOptions;
export type ProductDetailsOptions = MouserRequestOptions &
  Pick<PartNumberSearchRequest, "partSearchOptions" | "mouserPaysCustomsAndDuties">;

export class ProductSearchClient {
  constructor(
    private readonly http: MouserHttpClient,
    private readonly rateLimiter?: SearchRateLimiter,
  ) {}

  keywordSearch<TOptions extends SearchRequestOptions | undefined = undefined>(
    request: KeywordSearchRequest,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, KeywordSearchResponse>> {
    validateKeywordSearchRequest(request);

    return this.request<MouserResponseBody<TOptions, KeywordSearchResponse>>({
      method: "POST",
      path: `${SEARCH_V1_BASE_PATH}/keyword`,
      body: {
        SearchByKeywordRequest: request,
      },
      xmlRootName: "SearchByKeywordRequestRoot",
      requestOptions: options,
    });
  }

  partNumberSearch<TOptions extends SearchRequestOptions | undefined = undefined>(
    request: PartNumberSearchRequest,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, PartNumberSearchResponse>> {
    validatePartNumberSearchRequest(request);

    return this.request<MouserResponseBody<TOptions, PartNumberSearchResponse>>({
      method: "POST",
      path: `${SEARCH_V1_BASE_PATH}/partnumber`,
      body: {
        SearchByPartRequest: request,
      },
      xmlRootName: "SearchByPartRequestRoot",
      requestOptions: options,
    });
  }

  productDetails<TOptions extends ProductDetailsOptions | undefined = undefined>(
    mouserPartNumber: string,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, ProductDetailsResponse>> {
    validatePartNumberList(mouserPartNumber, "mouserPartNumber");
    const partSearchOptions = options?.partSearchOptions ?? "Exact";

    return this.request<MouserResponseBody<TOptions, ProductDetailsResponse>>({
      method: "POST",
      path: `${SEARCH_V1_BASE_PATH}/partnumber`,
      body: {
        SearchByPartRequest: {
          mouserPartNumber,
          partSearchOptions,
          mouserPaysCustomsAndDuties: options?.mouserPaysCustomsAndDuties,
        },
      },
      xmlRootName: "SearchByPartRequestRoot",
      requestOptions: options,
    });
  }

  /** @deprecated Mouser marks this v1 endpoint as deprecated. Use keywordAndManufacturerSearch instead. */
  keywordAndManufacturerSearchById<TOptions extends SearchRequestOptions | undefined = undefined>(
    request: LegacyKeywordAndManufacturerSearchRequest,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, LegacyKeywordAndManufacturerSearchResponse>> {
    validateKeywordSearchRequest(request);

    return this.request<MouserResponseBody<TOptions, LegacyKeywordAndManufacturerSearchResponse>>({
      method: "POST",
      path: `${SEARCH_V1_BASE_PATH}/keywordandmanufacturer`,
      body: {
        SearchByKeywordMfrRequest: request,
      },
      xmlRootName: "SearchByKeywordMfrRequestRoot",
      requestOptions: options,
    });
  }

  keywordAndManufacturerSearch<TOptions extends SearchRequestOptions | undefined = undefined>(
    request: KeywordAndManufacturerSearchRequest,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, KeywordAndManufacturerSearchResponse>> {
    validateKeywordSearchRequest(request);

    return this.request<MouserResponseBody<TOptions, KeywordAndManufacturerSearchResponse>>({
      method: "POST",
      path: `${SEARCH_V2_BASE_PATH}/keywordandmanufacturer`,
      body: {
        SearchByKeywordMfrNameRequest: request,
      },
      xmlRootName: "SearchByKeywordMfrNameRequestRoot",
      requestOptions: options,
    });
  }

  partNumberAndManufacturerSearch<TOptions extends SearchRequestOptions | undefined = undefined>(
    request: PartNumberAndManufacturerSearchRequest,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, PartNumberAndManufacturerSearchResponse>> {
    validatePartNumberSearchRequest(request);

    return this.request<MouserResponseBody<TOptions, PartNumberAndManufacturerSearchResponse>>({
      method: "POST",
      path: `${SEARCH_V2_BASE_PATH}/partnumberandmanufacturer`,
      body: {
        SearchByPartMfrNameRequest: request,
      },
      xmlRootName: "SearchByPartMfrNameRequestRoot",
      requestOptions: options,
    });
  }

  /** @deprecated Mouser marks this v1 endpoint as deprecated. Use partNumberAndManufacturerSearch instead. */
  partNumberAndManufacturerSearchById<
    TOptions extends SearchRequestOptions | undefined = undefined,
  >(
    request: LegacyPartNumberAndManufacturerSearchRequest,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, LegacyPartNumberAndManufacturerSearchResponse>> {
    validatePartNumberSearchRequest(request);

    return this.request<
      MouserResponseBody<TOptions, LegacyPartNumberAndManufacturerSearchResponse>
    >({
      method: "POST",
      path: `${SEARCH_V1_BASE_PATH}/partnumberandmanufacturer`,
      body: {
        SearchByPartMfrRequest: request,
      },
      xmlRootName: "SearchByPartMfrRequestRoot",
      requestOptions: options,
    });
  }

  /** @deprecated Mouser marks this v1 endpoint as deprecated. Use manufacturerList instead. */
  manufacturerListById<TOptions extends SearchRequestOptions | undefined = undefined>(
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, LegacyManufacturerListResponse>> {
    return this.request<MouserResponseBody<TOptions, LegacyManufacturerListResponse>>({
      method: "GET",
      path: `${SEARCH_V1_BASE_PATH}/manufacturerlist`,
      requestOptions: options,
    });
  }

  manufacturerList<TOptions extends SearchRequestOptions | undefined = undefined>(
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, ManufacturerListResponse>> {
    return this.request<MouserResponseBody<TOptions, ManufacturerListResponse>>({
      method: "GET",
      path: `${SEARCH_V2_BASE_PATH}/manufacturerlist`,
      requestOptions: options,
    });
  }

  manufacturers<TOptions extends SearchRequestOptions | undefined = undefined>(
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, ManufacturerListResponse>> {
    return this.manufacturerList(options);
  }

  private async request<T>(options: HttpRequestOptions): Promise<T> {
    await this.rateLimiter?.waitForAvailableRequest({
      signal: options.requestOptions?.signal,
    });

    return this.http.request<T>(options);
  }
}

function validateKeywordSearchRequest(
  request:
    | KeywordSearchRequest
    | KeywordAndManufacturerSearchRequest
    | LegacyKeywordAndManufacturerSearchRequest,
): void {
  requiredString(request.keyword, "keyword");
  oneOf(request.searchOptions, "searchOptions", KEYWORD_SEARCH_OPTIONS);

  if (request.records !== undefined) {
    integerInRange(request.records, "records", 0, 50);
  }

  if ("startingRecord" in request && request.startingRecord !== undefined) {
    nonNegativeInteger(request.startingRecord, "startingRecord");
  }

  if ("pageNumber" in request && request.pageNumber !== undefined) {
    positiveInteger(request.pageNumber, "pageNumber");
  }
}

function validatePartNumberSearchRequest(
  request:
    | PartNumberSearchRequest
    | PartNumberAndManufacturerSearchRequest
    | LegacyPartNumberAndManufacturerSearchRequest,
): void {
  requiredString(request.mouserPartNumber, "mouserPartNumber");
  validatePartNumberList(request.mouserPartNumber, "mouserPartNumber");
  oneOf(request.partSearchOptions, "partSearchOptions", PART_SEARCH_OPTIONS);
}

function validatePartNumberList(value: string | undefined, name: string): void {
  requiredString(value, name);

  const parts = value.split("|");
  if (parts.length > 10) {
    throw new RangeError(
      `${name} may include at most 10 part numbers separated by pipe characters.`,
    );
  }

  for (const part of parts) {
    if (part.length < 3 || part.length > 40) {
      throw new RangeError(`${name} entries must be between 3 and 40 characters.`);
    }
  }
}
