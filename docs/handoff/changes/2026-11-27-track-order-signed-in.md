# Track order: a signed-in shopper's recent orders

Branch `feat/track-order-signed-in` (from `origin/dev`). Not pushed or merged. No migration.

## What the shopper sees

- **Signed out**: `/track-order` is unchanged (order number + email or mobile, "Sign in to see
  all orders").
- **Signed in, with orders**: drawn in the account look (`AccountFrame`): the title "Track your
  order" with a "View all orders" link (`/account`), then the latest 5 orders as the same cards
  `/account` shows (`OrderList`: number, date, items count, delivery status pill, payment pill
  when not simply paid, pictures, total; each opens `/account/orders/<number>`). Pre-orders and
  two-parcel orders therefore read exactly as on `/account`. Below them the lookup form, now
  "Track another order" (an `h2`) without the sign-in line.
- **Signed in, no orders yet**: the lookup alone, without the sign-in line.

## Code

- `apps/storefront/src/app/-s/[storeId]/track-order/page.tsx`: reads `currentCustomer`, then
  `listCustomerOrders(..., { limit: RECENT_ORDERS_LIMIT })` and `storeTimeZone` in one `inStore`.
- `apps/storefront/src/components/track-order/recent-orders.tsx` (new): head + `OrderList`.
- `apps/storefront/src/components/track-order/track-order-form.tsx`: `another` and `signedIn` props.
- `apps/storefront/src/data/track-order.ts`: `recent`, `another` copy, `RECENT_ORDERS_LIMIT`.
  The storefront has no Hindi overlay for this copy (`data/hi` only holds cart words).

## Caching

The page reads the session cookie, so it is a per-request render with Next's default
`private, no-cache, no-store` answer (the store layout already read cookies). The proxy's
`edgeCacheControl` never marks `/track-order` shared: it is not in `SHARED_PAGES`, and any
`wc_customer` cookie makes a request personal. The plain-HTML and Hono paths only take the home,
`/pages/*` and product pages, so imported Liquid theme stores (Waimers) get this Next page as
before, inside their theme header and footer.

## Tests

`apps/storefront/src/components/track-order/track-order-page.test.ts`: signed out unchanged and
no order query; signed in lists orders with links and "Track another order"; signed in with no
orders; no `dynamic`/`revalidate` export; `edgeCacheControl` is null for `/track-order` with and
without `wc_customer`.
