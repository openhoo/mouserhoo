import { CART_BASE_PATH, ORDER_BASE_PATH } from "./constants";
import { splitRequestOptions, type MouserHttpClient, type QueryParameters } from "./http";
import type { components, operations } from "./generated/mouser-v1";
import type { JsonResponse, LooseMouserObject, MouserRequestOptions, MouserResponseBody } from "./types";
import { oneOf, optionalBoolean, positiveInteger, requiredString, stringLength, stringPattern } from "./validation";

export type CartSchemas = components["schemas"];
export type CartOperations = Pick<
  operations,
  | "MouserCart_GetCart"
  | "MouserCart_UpdateCart"
  | "MouserCart_AddCartItems"
  | "MouserCart_UpdateCartItems"
  | "MouserCart_RemoveCartItem"
  | "MouserCart_InsertScheduleCartItems"
  | "MouserCart_UpdateScheduleCartItems"
  | "MouserCart_DeleteAllScheduleCartItems"
  | "Order_CreateCartFromOrder"
>;

export type MouserPackagingChoice = "None" | "Cut_Tape" | "MouseReel" | "FullReel";
export type CartItemRequest = Omit<CartSchemas["CartItemRequest"], "PackagingChoice"> & {
  PackagingChoice?: MouserPackagingChoice;
};
export type CartItemRequestRoot = Omit<CartSchemas["CartItemRequestRoot"], "CartItems"> & {
  CartItems?: CartItemRequest[];
};
export type ScheduleCartItemsRequestRoot = CartSchemas["ScheduleCartItemsRequestRoot"];
export type ScheduleReleaseRequest = CartSchemas["ScheduleReleaseRequest"];
export type CartResponse = JsonResponse<operations["MouserCart_GetCart"]>;
export type CreateCartFromOrderResponse = LooseMouserObject<Partial<CartResponse>>;

export interface CartCountryCurrencyOptions extends MouserRequestOptions {
  countryCode?: string;
  currencyCode?: string;
}

export type GetCartOptions = CartCountryCurrencyOptions;
export type UpdateCartOptions = CartCountryCurrencyOptions;
export type AddCartItemsOptions = CartCountryCurrencyOptions;
export type UpdateCartItemsOptions = CartCountryCurrencyOptions;
export type RemoveCartItemOptions = CartCountryCurrencyOptions;
export type ScheduleCartItemsOptions = MouserRequestOptions;
export type DeleteAllScheduleCartItemsOptions = MouserRequestOptions;
export type CreateCartFromOrderOptions = CartCountryCurrencyOptions;

const PACKAGING_CHOICES = ["None", "Cut_Tape", "MouseReel", "FullReel"] as const;
const CART_XML_ARRAY_ITEM_NAMES = {
  CartItems: "CartItemRequest",
  ScheduleCartItems: "ScheduleReleaseRequest",
  ScheduledReleases: "KeyValuePairOfStringAndInt32"
} as const;

export class CartClient {
  constructor(private readonly http: MouserHttpClient) {}

  getCart<TOptions extends GetCartOptions | undefined = undefined>(
    cartKey: string,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CartResponse>> {
    requiredString(cartKey, "cartKey");
    stringLength(cartKey, "cartKey", { max: 36 });
    const [requestOptions, query] = splitRequestOptions(options);

    return this.http.request<MouserResponseBody<TOptions, CartResponse>>({
      method: "GET",
      path: CART_BASE_PATH,
      query: {
        ...query,
        cartKey
      } as QueryParameters,
      requestOptions
    });
  }

  updateCart<TOptions extends UpdateCartOptions | undefined = undefined>(
    request: CartItemRequestRoot,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CartResponse>> {
    validateCartItemRequestRoot(request);
    const [requestOptions, query] = splitRequestOptions(options);

    return this.http.request<MouserResponseBody<TOptions, CartResponse>>({
      method: "POST",
      path: CART_BASE_PATH,
      query: query as QueryParameters,
      body: request,
      xmlRootName: "CartItemRequestRoot",
      xmlArrayItemNames: CART_XML_ARRAY_ITEM_NAMES,
      requestOptions
    });
  }

  addCartItems<TOptions extends AddCartItemsOptions | undefined = undefined>(
    request: CartItemRequestRoot,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CartResponse>> {
    validateCartItemRequestRoot(request);
    const [requestOptions, query] = splitRequestOptions(options);

    return this.http.request<MouserResponseBody<TOptions, CartResponse>>({
      method: "POST",
      path: `${CART_BASE_PATH}/items/insert`,
      query: query as QueryParameters,
      body: request,
      xmlRootName: "CartItemRequestRoot",
      xmlArrayItemNames: CART_XML_ARRAY_ITEM_NAMES,
      requestOptions
    });
  }

  updateCartItems<TOptions extends UpdateCartItemsOptions | undefined = undefined>(
    request: CartItemRequestRoot,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CartResponse>> {
    validateCartItemRequestRoot(request);
    const [requestOptions, query] = splitRequestOptions(options);

    return this.http.request<MouserResponseBody<TOptions, CartResponse>>({
      method: "POST",
      path: `${CART_BASE_PATH}/items/update`,
      query: query as QueryParameters,
      body: request,
      xmlRootName: "CartItemRequestRoot",
      xmlArrayItemNames: CART_XML_ARRAY_ITEM_NAMES,
      requestOptions
    });
  }

  removeCartItem<TOptions extends RemoveCartItemOptions | undefined = undefined>(
    cartKey: string,
    mouserPartNumber: string,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CartResponse>> {
    requiredString(cartKey, "cartKey");
    stringLength(cartKey, "cartKey", { max: 36 });
    requiredString(mouserPartNumber, "mouserPartNumber");
    stringLength(mouserPartNumber, "mouserPartNumber", { max: 80 });
    const [requestOptions, query] = splitRequestOptions(options);

    return this.http.request<MouserResponseBody<TOptions, CartResponse>>({
      method: "POST",
      path: `${CART_BASE_PATH}/item/remove`,
      query: {
        ...query,
        cartKey,
        mouserPartNumber
      } as QueryParameters,
      requestOptions
    });
  }

  insertScheduleCartItems<TOptions extends ScheduleCartItemsOptions | undefined = undefined>(
    request: ScheduleCartItemsRequestRoot,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CartResponse>> {
    validateScheduleCartItemsRequestRoot(request);

    return this.http.request<MouserResponseBody<TOptions, CartResponse>>({
      method: "POST",
      path: `${CART_BASE_PATH}/insert/schedule`,
      body: request,
      xmlRootName: "ScheduleCartItemsRequestRoot",
      xmlArrayItemNames: CART_XML_ARRAY_ITEM_NAMES,
      requestOptions: options
    });
  }

  updateScheduleCartItems<TOptions extends ScheduleCartItemsOptions | undefined = undefined>(
    request: ScheduleCartItemsRequestRoot,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CartResponse>> {
    validateScheduleCartItemsRequestRoot(request);

    return this.http.request<MouserResponseBody<TOptions, CartResponse>>({
      method: "POST",
      path: `${CART_BASE_PATH}/update/schedule`,
      body: request,
      xmlRootName: "ScheduleCartItemsRequestRoot",
      xmlArrayItemNames: CART_XML_ARRAY_ITEM_NAMES,
      requestOptions: options
    });
  }

  deleteAllScheduleCartItems<TOptions extends DeleteAllScheduleCartItemsOptions | undefined = undefined>(
    cartKey: string,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CartResponse>> {
    requiredString(cartKey, "cartKey");
    stringLength(cartKey, "cartKey", { max: 36 });

    return this.http.request<MouserResponseBody<TOptions, CartResponse>>({
      method: "POST",
      path: `${CART_BASE_PATH}/deleteall/schedule`,
      query: {
        cartKey
      },
      requestOptions: options
    });
  }

  createCartFromOrder<TOptions extends CreateCartFromOrderOptions | undefined = undefined>(
    orderNumber: number,
    options?: TOptions
  ): Promise<MouserResponseBody<TOptions, CreateCartFromOrderResponse>> {
    positiveInteger(orderNumber, "orderNumber");
    const [requestOptions, query] = splitRequestOptions(options);

    return this.http.request<MouserResponseBody<TOptions, CreateCartFromOrderResponse>>({
      method: "POST",
      path: `${ORDER_BASE_PATH}/item/CreateCartFromOrder`,
      query: {
        ...query,
        orderNumber
      } as QueryParameters,
      requestOptions
    });
  }
}

function validateCartItemRequestRoot(request: CartItemRequestRoot): void {
  if (!request || typeof request !== "object") {
    throw new TypeError("Cart item request is required.");
  }

  if (!Array.isArray(request.CartItems) || request.CartItems.length === 0) {
    throw new RangeError("CartItems must include at least one item.");
  }

  for (const [index, item] of request.CartItems.entries()) {
    requiredString(item.MouserPartNumber, `CartItems[${index}].MouserPartNumber`);
    stringLength(item.MouserPartNumber, `CartItems[${index}].MouserPartNumber`, { max: 80 });
    positiveInteger(item.Quantity, `CartItems[${index}].Quantity`);
    stringLength(item.CustomerPartNumber, `CartItems[${index}].CustomerPartNumber`, { max: 21 });
    stringPattern(item.CustomerPartNumber, `CartItems[${index}].CustomerPartNumber`, /^[^*]*$/);
    oneOf(item.PackagingChoice, `CartItems[${index}].PackagingChoice`, PACKAGING_CHOICES);
  }

  stringLength(request.CartKey, "CartKey", { max: 36 });
  optionalBoolean(request.MouserPaysCustomsAndDuties, "MouserPaysCustomsAndDuties");
}

function validateScheduleCartItemsRequestRoot(request: ScheduleCartItemsRequestRoot): void {
  if (!request || typeof request !== "object") {
    throw new TypeError("Schedule cart items request is required.");
  }

  if (!Array.isArray(request.ScheduleCartItems) || request.ScheduleCartItems.length === 0) {
    throw new RangeError("ScheduleCartItems must include at least one item.");
  }

  for (const [index, item] of request.ScheduleCartItems.entries()) {
    requiredString(item.MouserPartNumber, `ScheduleCartItems[${index}].MouserPartNumber`);
    stringLength(item.MouserPartNumber, `ScheduleCartItems[${index}].MouserPartNumber`, { max: 80 });
  }

  stringLength(request.CartKey, "CartKey", { max: 36 });
}
