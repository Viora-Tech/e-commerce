# Migration 0177: schema review fixes and the Markets tables

From `docs/reviews/2026-10-27-schema-review.md` (owner: "fix those things", and Markets).

## Integrity and speed
- **Indexes** on the core tables that had only a primary key (cart and cart lines, product and
  its options and media, variant, order and order lines, payment, refund, shipment, order note,
  discount usage, stock adjustments, collection products) and on the newer tables the review
  listed. Each one names the request it serves in `schema.ts`.
- **Uniqueness:** `product (store_id, handle)` and `order (store_id, number)`. Built in a `DO`
  block: when the data already holds duplicates, a plain `*_nonunique` index is created instead,
  so the deploy never fails (the local dev data has two draft #1s from a demo seed and took the
  fallback). If production took it, fix the duplicates and add the unique index in a later
  migration.
- **Order numbers** come from `store_counter` (`takeOrderNumber` / `bumpOrderNumberPast` in
  `core/order/order-number.ts`, used by checkout, drafts and the Shopify import), so the
  checkout transaction no longer holds the `store` row locked until it commits. The counter takes
  `max(counter, store.next_order_number)`, so an older build still counting on the store row
  during a rolling deploy cannot hand out a number twice; the unique index refuses it if it ever
  did. Seeded past the store's counter and its highest order number.
- **`updated_at`** on `order`, `variant`, `payment` and `refund`, kept current by the
  `touch_updated_at` trigger.
- **Foreign keys** added `NOT VALID` (new rows only): `refund.gift_card_id`, `shipment.pickup_id`,
  `return_request.{gift_card_id, exchange_order_id, reship_shipment_id, shipment_id}` and
  `return_request_line.exchange_variant_id`, all `on delete set null`.
- **Reviews:** `deleteProduct` archives a product that has reviews instead of deleting it (their
  foreign key cascades), so imported Judge.me reviews are kept.
- **Retention support:** `stores_with_retention_due(at)` (SECURITY DEFINER, `storesWithRetentionDue`)
  for the cart and log prune jobs (separate PR).

Not done on purpose: CHECK constraints for the text enums and the email/code case rules. A
check applies to new rows, and some sign-in and import paths may write values the check would
refuse; that needs a look at production data first (the read was not available).

## Markets (schema only; the proxy and admin come next)
- `market` (one primary per store: India, INR, no subfolder, created for every store),
  `market_region` (a country is in at most one market of a store), `exchange_rate`
  (platform-wide reference rates), `translation` (content per language), all under RLS except
  `exchange_rate`; `market`, `market_region` and `translation` drop the storefront cache.
- `store_markets(store_id)` (SECURITY DEFINER, `storeMarkets`) for the storefront proxy.
- Presentment money: `cart.{market_id, presentment_currency, country_code}`,
  `order.{market_id, presentment_currency, exchange_rate, presentment_*_minor, tax_regime}`,
  `order_line.presentment_unit_price_minor`, `payment`/`refund` `.{currency, amount_minor}`.
  Every `*_paise` column stays rupees.
- International addresses: `address.province`, `customer_address.province` (`state_code` is ''
  and `pincode` is the postal code abroad); `shipping_zone.country_codes` (default `{IN}`);
  `discount.market_ids`.
- Export invoices: `invoice.{supply_type, currency, exchange_rate, port_code, shipping_bill_no,
  shipping_bill_date}`; the LUT number goes in the invoice settings JSON.

Tests: `packages/db` (RLS coverage, cache triggers) 57; core order, cart, catalog, discounts and
checkout 458, plus `order-number.test.ts` (4, including 8 parallel checkouts getting 8 numbers);
Shopify import 155; API orders, drafts, discounts, bulk edit, inventory, store data 42. Repo-wide
typecheck: 60 of 60 packages. Migration applied to a copy of the local dev database (real seed
data) as well as an empty one.
