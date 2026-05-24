import { ORDER_BASE_PATH } from "./constants";
import { splitRequestOptions, type MouserHttpClient, type QueryParameters } from "./http";
import type { components, operations } from "./generated/mouser-v1";
import type { JsonResponse, MouserRequestOptions, MouserResponseBody } from "./types";
import {
  oneOf,
  optionalBoolean,
  optionalInteger,
  positiveInteger,
  requiredString,
  stringLength,
  stringPattern
} from "./validation";

export type OrderSchemas = components["schemas"];
export type OrderOperations = Pick<
  operations,
  | "Order_OptionsQuery"
  | "Order_GetCurrencies"
  | "Order_GetCountries"
  | "Order_Create"
  | "Order_CreateFromOrder"
  | "Order_GetOrder"
>;

export type OrderInitializeRequestRoot = OrderSchemas["OrderInializeRequestRoot"];
export type OrderInitializeRequest = OrderSchemas["OrderInitializeRequest"];
export type OrderAddressRequest = OrderSchemas["OrderAddress"];
export type OrderPaymentRequest = Omit<
  OrderSchemas["PaymentTypeRequest"],
  "UseRfcNumber" | "VatInvoiceAddress"
> & {
  UseRfcNumber?: boolean;
  VatInvoiceAddress?: OrderAddressRequest;
};
export type OrderRequest = Omit<
  OrderSchemas["OrderRequestType"],
  "Payment" | "ShippingAddress" | "SubmitOrder"
> & {
  Payment?: OrderPaymentRequest;
  ShippingAddress?: OrderAddressRequest;
  SubmitOrder?: boolean;
};
export type OrderRequestRoot = Omit<OrderSchemas["OrderRequestRootType"], "Order"> & {
  Order?: OrderRequest;
};
export type OrderOptionsQueryResponse = JsonResponse<operations["Order_OptionsQuery"]>;
export type OrderCurrenciesResponse = JsonResponse<operations["Order_GetCurrencies"]>;
export type OrderCountriesResponse = JsonResponse<operations["Order_GetCountries"]>;
export type CreateOrderResponse = JsonResponse<operations["Order_Create"]>;
export type CreateOrderFromOrderResponse = JsonResponse<operations["Order_CreateFromOrder"]>;
export type GetOrderResponse = JsonResponse<operations["Order_GetOrder"]>;

export interface GetCurrenciesOptions extends MouserRequestOptions {
  shippingCountryCode?: string;
}

export interface GetCountriesOptions extends MouserRequestOptions {
  countryCode?: string;
}

export interface CreateOrderFromOrderOptions extends MouserRequestOptions {
  countryCode?: string;
  currencyCode?: string;
}

const ADDRESS_LOCATION_TYPES = ["Residential", "Commercial", "PostOfficeBox", "APOFPO"] as const;
const ORDER_TYPES = ["Unspecified", "Rush", "Complete"] as const;
const TAX_STATUSES = ["None", "Taxable", "NonTaxable"] as const;
const VAT_INVOICE_TYPES = ["None", "GeneralWithoutTxID", "General", "Vat"] as const;

export class OrderClient {
  constructor(private readonly http: MouserHttpClient) {}

  optionsQuery<TOptions extends MouserRequestOptions | undefined = undefined>(
    request: OrderInitializeRequestRoot = {},
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, OrderOptionsQueryResponse>> {
    validateOrderInitializeRequestRoot(request);

    return this.http.request<MouserResponseBody<TOptions, OrderOptionsQueryResponse>>({
      method: "POST",
      path: `${ORDER_BASE_PATH}/options/query`,
      body: request,
      xmlRootName: "OrderInializeRequestRoot",
      requestOptions: options
    });
  }

  getCurrencies<TOptions extends GetCurrenciesOptions | undefined = undefined>(
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, OrderCurrenciesResponse>> {
    const [requestOptions, query] = splitRequestOptions(options);

    return this.http.request<MouserResponseBody<TOptions, OrderCurrenciesResponse>>({
      method: "GET",
      path: `${ORDER_BASE_PATH}/currencies`,
      query: query as QueryParameters,
      requestOptions
    });
  }

  getCountries<TOptions extends GetCountriesOptions | undefined = undefined>(
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, OrderCountriesResponse>> {
    const [requestOptions, query] = splitRequestOptions(options);

    return this.http.request<MouserResponseBody<TOptions, OrderCountriesResponse>>({
      method: "GET",
      path: `${ORDER_BASE_PATH}/countries`,
      query: query as QueryParameters,
      requestOptions
    });
  }

  createOrder<TOptions extends MouserRequestOptions | undefined = undefined>(
    request: OrderRequestRoot,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CreateOrderResponse>> {
    validateOrderRequestRoot(request);

    return this.http.request<MouserResponseBody<TOptions, CreateOrderResponse>>({
      method: "POST",
      path: ORDER_BASE_PATH,
      body: request,
      xmlRootName: "OrderRequestRootType",
      requestOptions: options
    });
  }

  createFromOrder<TOptions extends CreateOrderFromOrderOptions | undefined = undefined>(
    orderNumber: number,
    request: OrderRequestRoot,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CreateOrderFromOrderResponse>> {
    positiveInteger(orderNumber, "orderNumber");
    validateOrderRequestRoot(request);
    const [requestOptions, query] = splitRequestOptions(options);

    return this.http.request<MouserResponseBody<TOptions, CreateOrderFromOrderResponse>>({
      method: "POST",
      path: `${ORDER_BASE_PATH}/CreateFromOrder`,
      query: {
        ...query,
        orderNumber
      } as QueryParameters,
      body: request,
      xmlRootName: "OrderRequestRootType",
      requestOptions
    });
  }

  getOrder<TOptions extends MouserRequestOptions | undefined = undefined>(
    orderNumber: number,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, GetOrderResponse>> {
    positiveInteger(orderNumber, "orderNumber");

    return this.http.request<MouserResponseBody<TOptions, GetOrderResponse>>({
      method: "GET",
      path: `${ORDER_BASE_PATH}/${orderNumber}`,
      requestOptions: options
    });
  }
}

function validateOrderRequestRoot(request: OrderRequestRoot): void {
  if (!request || typeof request !== "object" || !request.Order) {
    throw new TypeError("Order request must include an Order object.");
  }

  requiredString(request.Order.CartKey, "Order.CartKey");
  stringLength(request.Order.CartKey, "Order.CartKey", { max: 36 });
  requiredString(request.Order.CurrencyCode, "Order.CurrencyCode");
  stringLength(request.Order.CurrencyCode, "Order.CurrencyCode", { max: 3 });
  optionalBoolean(request.Order.SubmitOrder, "Order.SubmitOrder");
  oneOf(request.Order.OrderType, "Order.OrderType", ORDER_TYPES);
  stringLength(request.Order.IECCode, "Order.IECCode", { max: 10 });

  if (request.Order.ShippingAddress) {
    validateOrderAddress(request.Order.ShippingAddress, "Order.ShippingAddress");
  }

  validateShippingMethod(request.Order.PrimaryShipping, "Order.PrimaryShipping");
  validateShippingMethod(request.Order.SecondaryShipping, "Order.SecondaryShipping");
  validateFreightAccount(request.Order.PrimaryFreightAccount, "Order.PrimaryFreightAccount");
  validateFreightAccount(request.Order.SecondaryFreightAccount, "Order.SecondaryFreightAccount");
  validatePayment(request.Order.Payment, "Order.Payment");
}

function validateOrderInitializeRequestRoot(request: OrderInitializeRequestRoot): void {
  if (!request || typeof request !== "object") {
    throw new TypeError("Order initialize request must be an object.");
  }

  if (!request.OrderInitialize) {
    return;
  }

  stringLength(request.OrderInitialize.CartKey, "OrderInitialize.CartKey", { max: 36 });
  stringLength(request.OrderInitialize.CurrencyCode, "OrderInitialize.CurrencyCode", { max: 3 });

  if (request.OrderInitialize.ShippingAddress) {
    validateOrderAddress(request.OrderInitialize.ShippingAddress, "OrderInitialize.ShippingAddress");
  }
}

function validateOrderAddress(address: OrderAddressRequest, name: string): void {
  if (!address || typeof address !== "object") {
    throw new TypeError(`${name} must be an object.`);
  }

  oneOf(address.AddressLocationTypeID, `${name}.AddressLocationTypeID`, ADDRESS_LOCATION_TYPES);
  requiredString(address.CountryCode, `${name}.CountryCode`);
  stringLength(address.CountryCode, `${name}.CountryCode`, { max: 2 });
  requiredString(address.FirstName, `${name}.FirstName`);
  stringLength(address.FirstName, `${name}.FirstName`, { max: 22 });
  requiredString(address.LastName, `${name}.LastName`);
  stringLength(address.LastName, `${name}.LastName`, { max: 23 });
  stringLength(address.AttentionLine, `${name}.AttentionLine`, { max: 20 });
  stringLength(address.Company, `${name}.Company`, { max: 100 });
  requiredString(address.AddressOne, `${name}.AddressOne`);
  stringLength(address.AddressOne, `${name}.AddressOne`, { min: 3, max: 60 });
  stringLength(address.AddressTwo, `${name}.AddressTwo`, { max: 35 });
  requiredString(address.City, `${name}.City`);
  stringLength(address.City, `${name}.City`, { max: 30 });
  stringLength(address.StateOrProvince, `${name}.StateOrProvince`, { max: 50 });
  stringLength(address.PostalCode, `${name}.PostalCode`, { max: 10 });
  requiredString(address.PhoneNumber, `${name}.PhoneNumber`);
  stringLength(address.PhoneNumber, `${name}.PhoneNumber`, { max: 15 });
  stringLength(address.PhoneExtension, `${name}.PhoneExtension`, { max: 5 });
  stringLength(address.EmailAddress, `${name}.EmailAddress`, { max: 50 });
}

function validateShippingMethod(method: OrderSchemas["ShippingMethod"] | undefined, name: string): void {
  if (!method) {
    return;
  }

  optionalInteger(method.Code, `${name}.Code`);
}

function validateFreightAccount(account: OrderSchemas["FreightAccount"] | undefined, name: string): void {
  if (!account) {
    return;
  }

  stringLength(account.Number, `${name}.Number`, { max: 9 });
  stringPattern(account.Number, `${name}.Number`, /^\w{6,9}$/);
}

function validatePayment(payment: OrderPaymentRequest | undefined, name: string): void {
  if (!payment) {
    return;
  }

  if (!Number.isInteger(payment.Method)) {
    throw new RangeError(`${name}.Method must be an integer.`);
  }

  stringLength(payment.VatAccountNumber, `${name}.VatAccountNumber`, { max: 20 });
  stringLength(payment.TaxCertificateKey, `${name}.TaxCertificateKey`, { max: 20 });
  oneOf(payment.TaxStatus, `${name}.TaxStatus`, TAX_STATUSES);
  stringLength(payment.PoNumber, `${name}.PoNumber`, { max: 20 });
  oneOf(payment.VatInvoiceType, `${name}.VatInvoiceType`, VAT_INVOICE_TYPES);
  stringLength(payment.BankName, `${name}.BankName`, { max: 20 });
  stringLength(payment.BankAccountNumber, `${name}.BankAccountNumber`, { max: 35 });
  optionalBoolean(payment.UseRfcNumber, `${name}.UseRfcNumber`);
  optionalBoolean(payment.VatNumberValidForEuShipments, `${name}.VatNumberValidForEuShipments`);

  if (payment.VatInvoiceAddress) {
    validateOrderAddress(payment.VatInvoiceAddress, `${name}.VatInvoiceAddress`);
  }
}
