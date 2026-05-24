import { describe, expect, it, vi } from "vitest";
import { MouserClient } from "../src";
import type { CartItemRequestRoot, FetchLike, OrderHistoryDateFilter, OrderRequestRoot } from "../src";

describe("CartClient", () => {
  it("maps Cart API methods to the official v1 paths", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ CartKey: "cart-key" }));
    const client = testClient(fetch);
    const cartRequest = {
      CartKey: "cart-key",
      CartItems: [{ MouserPartNumber: "595-NE555P", Quantity: 2, PackagingChoice: "Cut_Tape" }]
    } satisfies CartItemRequestRoot;
    const scheduleRequest = {
      CartKey: "cart-key",
      ScheduleCartItems: [
        {
          MouserPartNumber: "595-NE555P",
          ScheduledReleases: [{ key: "2026-06-01", value: 1 }]
        }
      ]
    };

    const calls: Array<[string, () => Promise<unknown>, string, string, Record<string, string>, unknown]> = [
      [
        "getCart",
        () => client.cart.getCart("cart-key", { countryCode: "US", currencyCode: "USD" }),
        "GET",
        "/api/v1/cart",
        { cartKey: "cart-key", countryCode: "US", currencyCode: "USD" },
        undefined
      ],
      [
        "updateCart",
        () => client.cart.updateCart(cartRequest, { countryCode: "US" }),
        "POST",
        "/api/v1/cart",
        { countryCode: "US" },
        cartRequest
      ],
      [
        "addCartItems",
        () => client.cart.addCartItems(cartRequest),
        "POST",
        "/api/v1/cart/items/insert",
        {},
        cartRequest
      ],
      [
        "updateCartItems",
        () => client.cart.updateCartItems(cartRequest),
        "POST",
        "/api/v1/cart/items/update",
        {},
        cartRequest
      ],
      [
        "removeCartItem",
        () => client.cart.removeCartItem("cart-key", "595-NE555P", { currencyCode: "USD" }),
        "POST",
        "/api/v1/cart/item/remove",
        { cartKey: "cart-key", mouserPartNumber: "595-NE555P", currencyCode: "USD" },
        undefined
      ],
      [
        "insertScheduleCartItems",
        () => client.cart.insertScheduleCartItems(scheduleRequest),
        "POST",
        "/api/v1/cart/insert/schedule",
        {},
        scheduleRequest
      ],
      [
        "updateScheduleCartItems",
        () => client.cart.updateScheduleCartItems(scheduleRequest),
        "POST",
        "/api/v1/cart/update/schedule",
        {},
        scheduleRequest
      ],
      [
        "deleteAllScheduleCartItems",
        () => client.cart.deleteAllScheduleCartItems("cart-key"),
        "POST",
        "/api/v1/cart/deleteall/schedule",
        { cartKey: "cart-key" },
        undefined
      ],
      [
        "createCartFromOrder",
        () => client.cart.createCartFromOrder(123, { countryCode: "US", currencyCode: "USD" }),
        "POST",
        "/api/v1/order/item/CreateCartFromOrder",
        { orderNumber: "123", countryCode: "US", currencyCode: "USD" },
        undefined
      ]
    ];

    for (const [name, call, method, pathname, query, body] of calls) {
      fetch.mockClear();
      await call();

      const [input, init] = fetch.mock.calls[0]!;
      const url = new URL(String(input));
      expect(init?.method, name).toBe(method);
      expect(url.pathname, name).toBe(pathname);
      expect(url.searchParams.get("apiKey"), name).toBe("api-key");
      for (const [key, value] of Object.entries(query)) {
        expect(url.searchParams.get(key), name).toBe(value);
      }
      expect(init?.body, name).toBe(body === undefined ? undefined : JSON.stringify(body));
    }
  });

  it("validates documented cart mutation requirements before sending requests", () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({}));
    const client = testClient(fetch);

    expect(() => client.cart.updateCart({ CartItems: [] })).toThrow("CartItems must include at least one item.");
    expect(() =>
      client.cart.addCartItems({ CartItems: [{ MouserPartNumber: "595-NE555P", Quantity: 0 }] })
    ).toThrow("CartItems[0].Quantity must be a positive integer.");
    expect(() =>
      client.cart.addCartItems({ CartItems: [{ MouserPartNumber: "M".repeat(81), Quantity: 1 }] })
    ).toThrow("CartItems[0].MouserPartNumber must be at most 80 characters.");
    expect(() =>
      client.cart.addCartItems({
        CartItems: [{ MouserPartNumber: "595-NE555P", Quantity: 1, CustomerPartNumber: "ABC*" }]
      })
    ).toThrow("CartItems[0].CustomerPartNumber has an invalid format.");
    expect(() =>
      client.cart.addCartItems({
        CartItems: [{ MouserPartNumber: "595-NE555P", Quantity: 1, PackagingChoice: "Tape" as never }]
      })
    ).toThrow("CartItems[0].PackagingChoice must be one of");
    expect(() =>
      client.cart.insertScheduleCartItems({ ScheduleCartItems: [{ MouserPartNumber: "" }] })
    ).toThrow("ScheduleCartItems[0].MouserPartNumber is required.");
    expect(() => client.cart.createCartFromOrder(0)).toThrow("orderNumber must be a positive integer.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("can send documented XML requests and return raw XML responses", async () => {
    const fetch = vi.fn<FetchLike>(async () =>
      new Response("<CartResponseRoot><CartKey>cart-key</CartKey></CartResponseRoot>", {
        headers: {
          "Content-Type": "application/xml"
        }
      })
    );
    const client = testClient(fetch);

    const result: string = await client.cart.addCartItems(
      {
        CartItems: [
          {
            MouserPartNumber: "595-NE555P",
            Quantity: 2,
            CustomerPartNumber: "A&B"
          }
        ]
      },
      {
        accept: "application/xml",
        contentType: "application/xml",
        responseType: "text"
      }
    );

    const [, init] = fetch.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("Accept")).toBe("application/xml");
    expect(headers.get("Content-Type")).toBe("application/xml");
    expect(init?.body).toBe(
      [
        "<CartItemRequestRoot>",
        "<CartItems>",
        "<CartItemRequest>",
        "<MouserPartNumber>595-NE555P</MouserPartNumber>",
        "<Quantity>2</Quantity>",
        "<CustomerPartNumber>A&amp;B</CustomerPartNumber>",
        "</CartItemRequest>",
        "</CartItems>",
        "</CartItemRequestRoot>"
      ].join("")
    );
    expect(result).toBe("<CartResponseRoot><CartKey>cart-key</CartKey></CartResponseRoot>");
  });
});

describe("OrderClient", () => {
  it("maps Order API methods to the official v1 paths", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ Order: { OrderID: "123" } }));
    const client = testClient(fetch);
    const orderRequest = {
      Order: {
        CartKey: "cart-key",
        CurrencyCode: "USD",
        SubmitOrder: false
      }
    } satisfies OrderRequestRoot;
    const initializeRequest = {
      OrderInitialize: {
        CartKey: "cart-key",
        CurrencyCode: "USD"
      }
    };

    const calls: Array<[string, () => Promise<unknown>, string, string, Record<string, string>, unknown]> = [
      [
        "optionsQuery",
        () => client.order.optionsQuery(initializeRequest),
        "POST",
        "/api/v1/order/options/query",
        {},
        initializeRequest
      ],
      [
        "getCurrencies",
        () => client.order.getCurrencies({ shippingCountryCode: "US" }),
        "GET",
        "/api/v1/order/currencies",
        { shippingCountryCode: "US" },
        undefined
      ],
      [
        "getCountries",
        () => client.order.getCountries({ countryCode: "US" }),
        "GET",
        "/api/v1/order/countries",
        { countryCode: "US" },
        undefined
      ],
      ["createOrder", () => client.order.createOrder(orderRequest), "POST", "/api/v1/order", {}, orderRequest],
      [
        "createFromOrder",
        () => client.order.createFromOrder(456, orderRequest, { countryCode: "US", currencyCode: "USD" }),
        "POST",
        "/api/v1/order/CreateFromOrder",
        { orderNumber: "456", countryCode: "US", currencyCode: "USD" },
        orderRequest
      ],
      ["getOrder", () => client.order.getOrder(456), "GET", "/api/v1/order/456", {}, undefined]
    ];

    for (const [name, call, method, pathname, query, body] of calls) {
      fetch.mockClear();
      await call();

      const [input, init] = fetch.mock.calls[0]!;
      const url = new URL(String(input));
      expect(init?.method, name).toBe(method);
      expect(url.pathname, name).toBe(pathname);
      expect(url.searchParams.get("apiKey"), name).toBe("api-key");
      for (const [key, value] of Object.entries(query)) {
        expect(url.searchParams.get(key), name).toBe(value);
      }
      expect(init?.body, name).toBe(body === undefined ? undefined : JSON.stringify(body));
    }
  });

  it("validates order creation requirements before sending requests", () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({}));
    const client = testClient(fetch);

    expect(() => client.order.createOrder({})).toThrow("Order request must include an Order object.");
    expect(() =>
      client.order.createOrder({ Order: { CartKey: "", CurrencyCode: "USD", SubmitOrder: false } })
    ).toThrow("Order.CartKey is required.");
    expect(() =>
      client.order.createOrder({ Order: { CartKey: "cart-key", CurrencyCode: "USDX" } })
    ).toThrow("Order.CurrencyCode must be at most 3 characters.");
    expect(() =>
      client.order.createOrder({ Order: { CartKey: "cart-key", CurrencyCode: "USD", SubmitOrder: "true" as never } })
    ).toThrow("Order.SubmitOrder must be a boolean.");
    expect(() =>
      client.order.createOrder({ Order: { CartKey: "cart-key", CurrencyCode: "USD", OrderType: "Hold" as never } })
    ).toThrow("Order.OrderType must be one of");
    expect(() =>
      client.order.createOrder({
        Order: {
          CartKey: "cart-key",
          CurrencyCode: "USD",
          ShippingAddress: {
            CountryCode: "USA",
            FirstName: "Ada",
            LastName: "Lovelace",
            AddressOne: "12",
            City: "London",
            PhoneNumber: "123"
          }
        }
      })
    ).toThrow("Order.ShippingAddress.CountryCode must be at most 2 characters.");
    expect(() =>
      client.order.createOrder({
        Order: {
          CartKey: "cart-key",
          CurrencyCode: "USD",
          Payment: { Method: 1, PoNumber: "P".repeat(21) }
        }
      })
    ).toThrow("Order.Payment.PoNumber must be at most 20 characters.");
    expect(() => client.order.getOrder(0)).toThrow("orderNumber must be a positive integer.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows Swagger-valid order previews without SubmitOrder", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ Order: { OrderID: "123" } }));
    const client = testClient(fetch);
    const request = {
      Order: {
        CartKey: "cart-key",
        CurrencyCode: "USD"
      }
    } satisfies OrderRequestRoot;

    await client.order.createOrder(request);

    const [, init] = fetch.mock.calls[0]!;
    expect(init?.body).toBe(JSON.stringify(request));
  });
});

describe("OrderHistoryClient", () => {
  it("maps Order History API methods to the official v1 paths", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ NumberOfOrders: 0, OrderHistoryItems: [] }));
    const client = testClient(fetch);

    const calls: Array<[string, () => Promise<unknown>, string, Record<string, string>]> = [
      [
        "byDateFilter",
        () => client.orderHistory.byDateFilter("ThisMonth"),
        "/api/v1/orderhistory/ByDateFilter",
        { dateFilter: "ThisMonth" }
      ],
      [
        "byDateRange",
        () => client.orderHistory.byDateRange("1/30/2026", "4/30/2026"),
        "/api/v1/orderhistory/ByDateRange",
        { startDate: "1/30/2026", endDate: "4/30/2026" }
      ],
      [
        "salesOrderNumber",
        () => client.orderHistory.salesOrderNumber("SO123"),
        "/api/v1/orderhistory/salesOrderNumber",
        { salesOrderNumber: "SO123" }
      ],
      [
        "webOrderNumber",
        () => client.orderHistory.webOrderNumber(789),
        "/api/v1/orderhistory/webOrderNumber",
        { webOrderNumber: "789" }
      ]
    ];

    for (const [name, call, pathname, query] of calls) {
      fetch.mockClear();
      await call();

      const [input, init] = fetch.mock.calls[0]!;
      const url = new URL(String(input));
      expect(init?.method, name).toBe("GET");
      expect(url.pathname, name).toBe(pathname);
      expect(url.searchParams.get("apiKey"), name).toBe("api-key");
      for (const [key, value] of Object.entries(query)) {
        expect(url.searchParams.get(key), name).toBe(value);
      }
    }
  });

  it("types documented order-history date filters", () => {
    const filter = "YearToDate" satisfies OrderHistoryDateFilter;
    expect(filter).toBe("YearToDate");

    const fetch = vi.fn<FetchLike>(async () => jsonResponse({}));
    const client = testClient(fetch);
    expect(() => client.orderHistory.byDateFilter("Last30Days" as never)).toThrow("dateFilter must be one of");
    expect(fetch).not.toHaveBeenCalled();

    // @ts-expect-error Mouser documents a fixed dateFilter enum.
    const invalidFilter = "Last30Days" satisfies OrderHistoryDateFilter;
    void invalidFilter;
  });

  it("validates documented order-history date range format", () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({}));
    const client = testClient(fetch);

    expect(() => client.orderHistory.byDateRange("2026-01-30", "4/30/2026")).toThrow(
      "startDate must use mm/dd/yyyy format."
    );
    expect(() => client.orderHistory.byDateRange("2/30/2026", "4/30/2026")).toThrow(
      "startDate must use a valid mm/dd/yyyy date."
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

function testClient(fetch: FetchLike): MouserClient {
  return new MouserClient({
    apiKey: "api-key",
    apiBaseUrl: "https://api.mouser.test",
    fetch
  });
}

function jsonResponse(
  body: unknown,
  status = 200,
  statusText = "OK",
  headers: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}
