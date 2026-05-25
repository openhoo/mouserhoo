# mouserhoo

[![npm version](https://img.shields.io/npm/v/%40openhoo%2Fmouserhoo?label=npm)](https://www.npmjs.com/package/@openhoo/mouserhoo)
![coverage](https://img.shields.io/badge/coverage-92%25%2B-brightgreen)

TypeScript SDK for Mouser API authentication, Search, Cart, Order, and Order History endpoints.

This package is built against Mouser's official documentation:

- API Solutions: https://eu.mouser.com/api-solutions/
- Search API overview: https://eu.mouser.com/api-search/
- Cart API overview: https://eu.mouser.com/api-cart/
- Order API overview: https://eu.mouser.com/api-order/
- Order History API overview: https://www.mouser.co.uk/api-orderhistory/
- Developer Swagger UI: https://api.mouser.com/api/docs/ui/index
- Swagger V1 JSON: https://api.mouser.com/api/docs/V1
- Swagger V2 JSON: https://api.mouser.com/api/docs/V2

The SDK uses Mouser's documented API-key authentication. Generated TypeScript schema types come from Mouser's Swagger V1 and V2 JSON documents.

## Install

```sh
npm install mouserhoo
```

## API key authentication

Mouser's Search API uses an `apiKey` query parameter. Sign up through Mouser's Search API page to receive a key.

```ts
import { MouserClient } from "mouserhoo";

const client = new MouserClient({
  apiKey: process.env.MOUSER_API_KEY!
});

const results = await client.productSearch.keywordSearch({
  keyword: "microcontroller",
  records: 10,
  searchOptions: "InStock"
});
```

For key rotation or secret-manager integration, provide an `ApiKeyProvider`:

```ts
const client = new MouserClient({
  apiKeyProvider: {
    async getApiKey() {
      return await loadMouserApiKey();
    }
  }
});
```

Pass `timeoutMs` on the client or on an individual request to abort slow API calls.

Failed HTTP responses throw `MouserApiError`. Transport failures before a response is received, including timeouts and caller aborts, throw `MouserNetworkError`.
Retries are opt-in and honor numeric or date-based `Retry-After` headers:

```ts
const client = new MouserClient({
  apiKey: process.env.MOUSER_API_KEY!,
  retry: {
    retries: 2
  }
});
```

Use `onResponse` to capture response metadata and any standard rate-limit headers Mouser returns:

```ts
const client = new MouserClient({
  apiKey: process.env.MOUSER_API_KEY!,
  onResponse: ({ status, rateLimit }) => {
    console.log(status, rateLimit.remaining, rateLimit.retryAfter);
  }
});
```

Mouser's Swagger documents JSON, XML, text JSON, text XML, and form-url-encoded media types on request-body endpoints. The SDK defaults to JSON, and you can override request/response media types globally or per call:

```ts
const client = new MouserClient({
  apiKey: process.env.MOUSER_API_KEY!,
  accept: "application/json",
  contentType: "application/json"
});

const rawXml = await client.cart.addCartItems(
  {
    CartItems: [{ MouserPartNumber: "595-NE555P", Quantity: 2 }]
  },
  {
    accept: "application/xml",
    contentType: "application/xml",
    responseType: "text"
  }
);
```

Search API calls are paced against Mouser's documented limits by default:

```ts
const client = new MouserClient({
  apiKey: process.env.MOUSER_API_KEY!,
  searchRateLimiter: {
    requestsPerMinute: 30,
    requestsPerDay: 1000
  }
});
```

Set `searchRateLimiter: false` to disable local pacing, or pass custom limiter settings when another process already coordinates your API budget.

## Search API methods

```ts
await client.productSearch.keywordSearch({
  keyword: "op amp",
  records: 10,
  startingRecord: 0,
  searchOptions: "RohsAndInStock"
});

await client.productSearch.partNumberSearch({
  mouserPartNumber: "595-NE555P",
  partSearchOptions: "Exact"
});

await client.productSearch.productDetails("595-NE555P");

await client.productSearch.keywordAndManufacturerSearch({
  keyword: "timer",
  manufacturerName: "Texas Instruments",
  records: 10,
  pageNumber: 1
});

await client.productSearch.partNumberAndManufacturerSearch({
  mouserPartNumber: "NE555P",
  manufacturerName: "Texas Instruments",
  partSearchOptions: "Exact"
});

await client.productSearch.manufacturerList();
```

`productDetails` is a convenience wrapper over Mouser's documented Search by Part Number method. It sends an exact part-number search and returns the official `SearchResponseRoot` payload.

Mouser documents a maximum of 50 returned parts per search call, 30 calls per minute, and 1,000 calls per day on the Search API overview page.
The SDK validates documented search options, paging values, and part-number limits before sending requests.

Mouser's Swagger still documents deprecated v1 manufacturer-ID search endpoints; the SDK exposes them with deprecated method names for compatibility:

```ts
await client.productSearch.keywordAndManufacturerSearchById({
  keyword: "timer",
  manufacturerId: 123
});
await client.productSearch.partNumberAndManufacturerSearchById({
  mouserPartNumber: "NE555P",
  manufacturerId: 123
});
await client.productSearch.manufacturerListById();
```

## Cart API methods

```ts
const cart = await client.cart.addCartItems({
  CartItems: [
    {
      MouserPartNumber: "595-NE555P",
      Quantity: 2
    }
  ]
});

await client.cart.getCart(cart.CartKey!);
await client.cart.updateCart({
  CartKey: cart.CartKey,
  CartItems: [{ MouserPartNumber: "595-NE555P", Quantity: 5 }]
});
await client.cart.removeCartItem(cart.CartKey!, "595-NE555P");
await client.cart.createCartFromOrder(123456);
```

Scheduled-delivery endpoints are also exposed:

```ts
await client.cart.insertScheduleCartItems({
  CartKey: cart.CartKey,
  ScheduleCartItems: [
    {
      MouserPartNumber: "595-NE555P",
      ScheduledReleases: [{ key: "2026-06-01", value: 1 }]
    }
  ]
});

await client.cart.updateScheduleCartItems({
  CartKey: cart.CartKey,
  ScheduleCartItems: [
    {
      MouserPartNumber: "595-NE555P",
      ScheduledReleases: [{ key: "2026-07-01", value: 1 }]
    }
  ]
});

await client.cart.deleteAllScheduleCartItems(cart.CartKey!);
```

## Order API methods

```ts
const options = await client.order.optionsQuery({
  OrderInitialize: {
    CartKey: cart.CartKey,
    CurrencyCode: "USD"
  }
});

await client.order.getCurrencies({ shippingCountryCode: "US" });
await client.order.getCountries({ countryCode: "US" });

const preview = await client.order.createOrder({
  Order: {
    CartKey: cart.CartKey!,
    CurrencyCode: "USD",
    SubmitOrder: false
  }
});

await client.order.createFromOrder(123456, {
  Order: {
    CartKey: cart.CartKey!,
    CurrencyCode: "USD",
    SubmitOrder: false
  }
});

await client.order.getOrder(123456);
```

Per Mouser's Order API documentation, set `SubmitOrder: false` to request an order summary; set it to `true` only when you intend to submit the order.
Mouser's Swagger marks `SubmitOrder` with a default of `false`, so the SDK allows it to be omitted. The SDK also validates documented order enum and length constraints before sending requests.

## Order History API methods

```ts
await client.orderHistory.byDateFilter("ThisMonth");
await client.orderHistory.byDateRange("1/30/2026", "4/30/2026");
await client.orderHistory.salesOrderNumber("SO123456");
await client.orderHistory.webOrderNumber(123456);
```

## Development

```sh
npm install
npm run generate:types
npm run verify
```

`npm install` configures the tracked Git commit hook that validates commit messages with hooversion before Git accepts them.

`npm run check` runs type checking, unit tests with V8 coverage thresholds, and the package build. Coverage includes runtime source files and excludes generated OpenAPI types, type-only modules, and barrel exports.

`npm run generate:types` refreshes generated TypeScript schema types from Mouser's official Swagger V1 and V2 JSON documents.

## Credits

This SDK is built from Mouser's public API documentation and Swagger definitions. Mouser product names, API names, and documentation are owned by Mouser Electronics and their respective owners.

The generated TypeScript schema types are produced with `openapi-typescript` after converting Mouser's Swagger definitions with `swagger2openapi`.

This project is not affiliated with, endorsed by, or sponsored by Mouser Electronics.

## License

MIT. See [LICENSE](LICENSE).
