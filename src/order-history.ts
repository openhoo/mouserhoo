import { ORDER_HISTORY_BASE_PATH } from "./constants";
import type { components, operations } from "./generated/mouser-v1";
import type { MouserHttpClient } from "./http";
import type { JsonResponse, MouserRequestOptions, MouserResponseBody } from "./types";
import { oneOf, positiveInteger, requiredString } from "./validation";

export type OrderHistorySchemas = components["schemas"];
export type OrderHistoryOperations = Pick<
  operations,
  | "MouserOrderHistory_OrderHistory"
  | "MouserOrderHistory_GetApiV{versionOrderhistoryByDateRange"
  | "MouserOrderHistory_GetOrderAsync"
  | "MouserOrderHistory_GetWebOrderAsync"
>;

export type OrderHistoryDateFilter =
  operations["MouserOrderHistory_OrderHistory"]["parameters"]["query"]["dateFilter"];
export type OrderHistoryResponse = JsonResponse<operations["MouserOrderHistory_OrderHistory"]>;
export type OrderHistoryDetailResponse = JsonResponse<
  operations["MouserOrderHistory_GetOrderAsync"]
>;

const ORDER_HISTORY_DATE_FILTERS = [
  "None",
  "All",
  "Today",
  "Yesterday",
  "ThisWeek",
  "LastWeek",
  "ThisMonth",
  "LastMonth",
  "ThisQuarter",
  "LastQuarter",
  "ThisYear",
  "LastYear",
  "YearToDate",
] as const;

export class OrderHistoryClient {
  constructor(private readonly http: MouserHttpClient) {}

  byDateFilter<TOptions extends MouserRequestOptions | undefined = undefined>(
    dateFilter: OrderHistoryDateFilter,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, OrderHistoryResponse>> {
    requiredString(dateFilter, "dateFilter");
    oneOf(dateFilter, "dateFilter", ORDER_HISTORY_DATE_FILTERS);

    return this.http.request<MouserResponseBody<TOptions, OrderHistoryResponse>>({
      method: "GET",
      path: `${ORDER_HISTORY_BASE_PATH}/ByDateFilter`,
      query: {
        dateFilter,
      },
      requestOptions: options,
    });
  }

  byDateRange<TOptions extends MouserRequestOptions | undefined = undefined>(
    startDate: string,
    endDate: string,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, OrderHistoryResponse>> {
    validateMouserDate(startDate, "startDate");
    validateMouserDate(endDate, "endDate");

    return this.http.request<MouserResponseBody<TOptions, OrderHistoryResponse>>({
      method: "GET",
      path: `${ORDER_HISTORY_BASE_PATH}/ByDateRange`,
      query: {
        startDate,
        endDate,
      },
      requestOptions: options,
    });
  }

  salesOrderNumber<TOptions extends MouserRequestOptions | undefined = undefined>(
    salesOrderNumber: string,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, OrderHistoryDetailResponse>> {
    requiredString(salesOrderNumber, "salesOrderNumber");

    return this.http.request<MouserResponseBody<TOptions, OrderHistoryDetailResponse>>({
      method: "GET",
      path: `${ORDER_HISTORY_BASE_PATH}/salesOrderNumber`,
      query: {
        salesOrderNumber,
      },
      requestOptions: options,
    });
  }

  webOrderNumber<TOptions extends MouserRequestOptions | undefined = undefined>(
    webOrderNumber: number,
    options?: TOptions,
  ): Promise<MouserResponseBody<TOptions, OrderHistoryDetailResponse>> {
    positiveInteger(webOrderNumber, "webOrderNumber");

    return this.http.request<MouserResponseBody<TOptions, OrderHistoryDetailResponse>>({
      method: "GET",
      path: `${ORDER_HISTORY_BASE_PATH}/webOrderNumber`,
      query: {
        webOrderNumber,
      },
      requestOptions: options,
    });
  }
}

function validateMouserDate(value: string, name: string): void {
  requiredString(value, name);

  const match = /^(?<month>\d{1,2})\/(?<day>\d{1,2})\/(?<year>\d{4})$/.exec(value);
  if (!match?.groups) {
    throw new RangeError(`${name} must use mm/dd/yyyy format.`);
  }

  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const year = Number(match.groups.year);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`${name} must use a valid mm/dd/yyyy date.`);
  }
}
