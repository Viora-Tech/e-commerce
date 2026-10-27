# Schema review, 27 Oct 2026 (with Markets)

The owner asked for a review of the whole database schema, including what Markets (selling
abroad, like Shopify Markets) needs. This is that review. Nothing here is built yet: the fixes
and the Markets design wait for the owner's go-ahead (decisions at the end).

## How it was checked

- **Scope:** 173 tables in 26 schema files (`packages/db/src/*-schema.ts`, `schema.ts`, and the
  plugin schemas under `packages/plugin-*/src/schema.ts`), built by 161 migrations.
- **Automated checks:** every migration applied to a fresh database
  (`commerce_test_schemareview`), then catalogue queries for row-level security, foreign keys
  without an index, unique indexes that span stores, column types, cascades and unenforced
  references. The SQL is kept in the session scratchpad; the counts are in the appendix.
- **Read by hand:** all of `packages/db/src/schema.ts` (the core: store, catalogue, stock,
  customers, carts, orders, payments, shipping, discounts, domains, gift cards, metafields), the
  billing and app tables, the GST invoice tables, and the code paths that read the hottest
  tables (cart count, order placement, payment confirmation, product pages).
- **Not read line by line:** the other 20 schema files (inbox, automations, marketing,
  purchasing, returns, affiliates, pixels, AI, API access, …). They went through the automated
  checks only. They are newer and mostly well indexed; their few gaps are listed in the appendix.

## Verdict

The foundations are sound. Store isolation is done properly: all 159 tables that hold a store's
data have row-level security turned on and forced, every one with the same policy
(`store_id = app.store_id`), and no `store_id` is nullable. Every timestamp has a time zone.
Money is integer paise throughout, never floats. Orders keep snapshots (titles, prices, tax,
shipping rate, address) so history never rewrites itself. Payments are guarded well (one capture
per order, idempotency keys, webhook dedupe tables, a transactional outbox).

The weak spots are:

1. **The original core tables were created without indexes.** The product, variant, cart and
   order line tables have nothing but a primary key. Every lookup on them reads the whole table,
   for every store on the platform, and the cost grows with all stores' data, not one store's.
2. **Two uniqueness rules exist only in code:** a product's handle within a store, and an order
   number within a store.
3. **Some tables grow forever,** carts above all.
4. **India-only assumptions** in addresses, shipping zones, money and invoices. Fine today, and
   exactly what Markets has to change.

Fixing 1 and 2 is cheap now (the tables are small, so the indexes build in seconds) and gets
expensive later.

## P0: fix now

### 1. Core tables have no indexes

Created in `0000_tables.sql` before indexes were a habit and never revisited. The automated check
found 80 foreign keys with no index starting with their columns, and 40 tables with no index
starting with `store_id`. With row-level security every query also filters on `store_id`, so a
table with neither reads every row of every store.

The ones that matter, with the request that pays for it:

| Table | Missing index | Who pays |
| --- | --- | --- |
| `cart_line` | `(cart_id)` | **Every storefront page** (the header's cart count), the cart page, checkout |
| `cart` | `(store_id, status, updated_at)`, `(customer_id)` | Abandoned-checkout job, sign-in cart merge |
| `product` | `(store_id, handle)` unique, `(store_id, status, created_at)` | Every product page (looked up by handle), admin product list |
| `variant` | `(product_id)`, `(store_id, sku)` | Every product page and card, cart, checkout, SKU search |
| `product_option`, `product_option_value`, `variant_option_value`, `product_media` | the parent id | Every product page |
| `media` | `(store_id, created_at)` | Media library |
| `order_line` | `(order_id)`, `(variant_id)` | Every order view, invoice, fulfilment, profit report, "orders containing this product" |
| `order` | `(store_id, number)` unique, `(store_id, placed_at)`, `(customer_id)` | Thank-you and pay pages (looked up by number), the All orders list, a customer's order history |
| `payment` | `(order_id)`, `(provider_ref)` | Every payment confirmation and gateway webhook (`payments/confirm.ts` finds the attempt by `provider_ref`) |
| `refund`, `shipment`, `order_note` | `(order_id)` | Order page |
| `discount_usage` | `(discount_id, email)`, `(order_id)` | **Every checkout with a code** (the one-use-per-customer check, `customerUsageCount`) |
| `inventory_adjustment` | `(variant_id, created_at)` | Stock history; a row for every line sold, so the fastest-growing core table |
| `inventory_level` | `(location_id)` | Location stock pages, transfers |
| `collection_product` | `(product_id)` | Product save (automatic collections), product page "in collections" |

Today Waimers' tables are small (about 250 products and 1,300 orders), so none of this shows. The
cost grows with the total rows across all stores. The fix is a single migration of plain
`CREATE INDEX` statements; at today's sizes it locks each table for well under a second. A draft
is in the appendix.

### 2. Two uniqueness rules live only in code

- **Product handle per store.** `uniqueHandle()` checks and then inserts, so two saves at the same
  moment (or an import and a manual save) can both take `mat`. Then `/products/mat` shows
  whichever row Postgres returns first. Add a unique `(store_id, handle)`.
- **Order number per store.** Numbers come from `store.next_order_number` with an atomic
  `UPDATE … RETURNING`, so duplicates are unlikely today. But nothing in the database stops an
  import or a script from writing one, and pages find an order by its number. Add a unique
  `(store_id, number)`.

Both migrations first need a check that production has no duplicates. If it finds any, they must
be fixed by hand before the unique index can be built.

### 3. Carts are never deleted

Nothing deletes a `cart` or `cart_line` row. Every visitor who adds something leaves a cart behind
forever, and with no `cart_line(cart_id)` index (above) every page view pays for all of them. A
nightly prune is proposed:
- open carts with no contact details and untouched for 30 days: delete;
- carts with contact details (recoverable, shown under Abandoned checkouts): keep for 90 days;
- converted carts: delete once the order exists. `order.cart_id` has no foreign key on purpose,
  so orders are unaffected.

## P1: next

### 4. The order number locks the whole store row during checkout

`placeOrder` takes the next number by updating the `store` row, partway through its transaction.
That row stays locked until the transaction ends, after stock is reserved, the discount counted,
and lines, parcels and outbox rows written. So **from that point on, a store's checkouts go
through one at a time**, and a settings save in the admin waits behind them. That's normal traffic
today; in a drop (Waimers' pre-order launches) it caps how many orders a minute go through. Fix: move the
counter to its own one-row-per-store table, `store_counter (store_id, name, value)`, and take the
number as the last step before commit.

### 5. `order` has no `updated_at` (nor do `variant`, `payment`, `refund`)

There's no way to ask what changed since a given time (incremental exports, a Shopify-style
`updated_at_min` API, sync to Tally or a marketplace). `product`, `customer` and `shipment` have
one; `order` and `variant` matter most. Add `updated_at` to all four, kept current by a trigger
so no write path can forget it.

### 6. Logs kept forever, some holding personal data

API activity, automation step runs and pixel logs are pruned. These are not:
- `outbox_event`: dispatched rows stay. The partial index keeps the relay fast, but the table
  only grows. Delete dispatched rows after 30 days.
- `payment_event` and `shipment_webhook_event` keep raw gateway and courier payloads, which hold
  shopper emails, phone numbers, card last-4 digits and addresses. Keep 180 days for disputes,
  then delete the payload and keep the row.
- `notification` (who was emailed what) is small and useful. Keep it.

India's DPDP Act asks you to keep personal data only as long as it's needed, so these retention
periods belong in the privacy policy.

### 7. Phone encryption covers one copy out of five

`customer.phone` is encrypted at rest with a blind index for lookups. The same number sits in
plain text on `order.phone`, `cart.phone`, `address.phone` and `customer_address.phone`, so the
encryption protects little. Either encrypt those too (the readers already cope with plaintext
during a backfill), or drop the per-column encryption and rely on disk and backup encryption.
Mixing the two gives the cost of both and the protection of neither.

## P2: tidy-ups

8. **38 reference columns without a foreign key.** Most are deliberate and should stay that way:
   polymorphic `metafield.owner_id` and `automation_run.subject_id`, orders on the platform's
   sales store, and snapshot fields like `order.discount_id` and `order.shipping_rate_id` that
   must outlive the row they point at. These should get a foreign key: `refund.gift_card_id`,
   `return_request.{exchange_order_id, gift_card_id, reship_shipment_id, shipment_id}`,
   `return_request_line.exchange_variant_id`, `shipment.pickup_id`, `affiliate.discount_id`,
   `affiliate_code.discount_id` (set null on delete).
9. **Deleting a product deletes its reviews** (`review.product_id … on delete cascade`). A product
   with imported Judge.me reviews and no orders is hard-deleted, and its reviews go with it.
   Use `set null` with the product title kept on the review, or archive such products instead of
   deleting them.
10. **Many enums are checked only in TypeScript.** Drizzle's `text({ enum })` adds no database
    check. `order`, `payment`, `store_domain`, `gift_card` and `fulfillment_order` add their own;
    `product.status`, `cart.status`, `refund.status`, `shipment.status`, `collection.kind` and
    every `discount` enum (`type`, `kind`, `method`, `status`, `applies_to`,
    `customer_eligibility`) have none. An import or script can write a value the app then fails
    on. Add CHECKs from the same arrays (the `oneOf()` helper already does this).
11. **Case rules only in code:** `customer.email` (lower case) and `discount.code` (upper case).
    Add `check (email = lower(email))` and `check (code = upper(code))` so a script can't create
    `Foo@x.com` beside `foo@x.com`.
12. **The `store` row holds everything:** 14 JSON columns of settings, the encrypted gateway,
    courier and login credentials, the legacy theme and the order counter. Any `select * from store` pulls
    the secrets along. Move the encrypted credentials into a `store_secret` table, read only where
    needed. Not urgent; do it with item 4.
13. **Money is 32-bit integer paise in 78 columns** (3 are bigint). One value is capped at
    ₹2.14 crore: fine for D2C orders and refunds, tight for B2B purchase orders. Sums in SQL come
    back as bigint, so reports are safe. New money columns (Markets) should be `bigint`; leave the
    existing ones.
14. **`shipment (provider, waybill)` is unique across all stores.** Needed, because a courier
    webhook finds the shipment by waybill before it knows the store. But two stores on a courier's
    sandbox can clash on test waybills. Leave it; just know why a test booking can fail with
    "already exists".
15. **`customer.default_address`** is a JSON copy of the latest order's address beside the real
    address book (`customer_address`). The two can disagree. Read the default from the book.
16. **`product.tags` and `customer.tags`** have no GIN index. Fine until tag filters are slow.

## Markets: what the schema needs

What Markets is, in our terms: the store groups countries into **markets** (India, then for
example "Gulf" or "USA and Canada"). Each market has its own currency, prices (converted with a
percentage and rounding, or fixed per product), product availability, shipping rates, domain or
subfolder (`waimers.in/en-us`), and taxes and duties.

### What stops it today

- **Addresses are Indian:** `address.state_code` and `pincode` are NOT NULL, the state is a GST
  state code, and the PIN is assumed to be 6 digits. `country` exists but defaults to `IN`, and
  nothing reads it. The same holds for `customer_address`, `location` and `CustomerAddress`.
- **Shipping zones are Indian:** a zone is Indian states plus PIN rules, and "no states" means
  all of India. There's no country list.
- **One currency per store:** `store.currency` is `INR`, money columns are named and treated as
  paise, and core code has 41 hard-coded `'INR'` strings and 89 files using `formatPaise`.
- **No presentment money on orders:** there's nowhere to record "charged USD 120.00 at 83.12".
- **Invoices are domestic GST only:** no export invoice (no LUT number, currency, exchange rate,
  port code or shipping bill).
- **Discounts are Indian:** `shipping_states` is Indian states, and fixed amounts are rupees.

### India-specific rules the design has to follow (check with your CA)

- **Export of goods is zero-rated under GST.** Most D2C exporters file a **LUT** (Letter of
  Undertaking, Form GST RFD-11, renewed every financial year) and charge no IGST. The invoice
  must say "Supply meant for export under LUT without payment of IGST" and carry the LUT ARN.
  Without a LUT, IGST is charged and refunded later.
- **The invoice's rupee value** uses the exchange rate CBIC notifies under the Customs Act for
  the date of supply (CGST Rule 34). This is not the gateway's rate, so store the rate used and
  where it came from.
- **Payment:** export proceeds must reach India (FEMA). Razorpay and Cashfree international
  payments settle in INR and provide the e-FIRC / e-BRC. Card payments in other currencies need
  international payments enabled on the gateway account.
- **Shipping:** courier exports of commercial goods go under CSB-V, up to ₹10 lakh per
  consignment. This is what ShipGlobal, DHL Express and FedEx handle. Duties are usually paid by
  the buyer on delivery (DAP); DDP needs the courier's support.
- **Customs data** is already on variants (`hs_code`, `country_of_origin`). Good.

### Proposed schema, in three phases

**Phase 1: sell abroad in rupees.** Smallest step, no currency changes. Prices stay in INR, and
the storefront may show an approximate local price for reference only.

| Change | Detail |
| --- | --- |
| Addresses go international | `address`, `customer_address`: `state_code` and `pincode` become nullable. Add `province` (free text or ISO 3166-2) and `postal_code` (alphanumeric). Add a CHECK so Indian addresses still need a GST state and a 6-digit PIN. Phone stored as E.164. |
| Shipping zones get countries | `shipping_zone.country_codes text[] not null default '{IN}'`. State and PIN rules apply only to `IN`. Rates stay in paise (weight bands suit international well). |
| Tax regime on the order | `order.tax_regime` (`domestic_gst`, `export_lut`, `export_igst`), set at checkout from the destination country and the store's LUT. `fulfillment_order` gets the same. |
| Export invoices | `invoice_settings`: `lut_arn`, `lut_valid_from`, `lut_valid_until`. `invoice`: `supply_type`, `port_code`, `shipping_bill_no`, `shipping_bill_date`. |
| International couriers | ShipGlobal as a courier package like `shipping-fedex` (needs the owner's API access), next to DHL and FedEx. |

**Phase 2: markets and local currency.**

```
market            id, store_id, name, handle, is_primary (one per store: India),
                  enabled, currency (ISO 4217), price_adjustment_bp (+1000 = +10%),
                  rounding ('none' | 'whole' | 'x99'), duties_mode ('dap' | 'ddp'),
                  created_at, updated_at
market_region     market_id, store_id, country_code (ISO 3166-1)
                  unique (store_id, country_code): a country is in exactly one market
exchange_rate     base 'INR', quote, rate numeric(18,8), as_of, source
                  ('cbic' | 'rbi' | 'gateway' | 'manual')   platform-wide, no store_id
cart              + market_id, presentment_currency, country_code
order             + market_id, presentment_currency, exchange_rate numeric(18,8),
                  presentment_{subtotal,discount,shipping,tax,total}_minor bigint
order_line        + presentment_unit_price_minor bigint
payment, refund   + currency, amount_minor bigint (what the shopper paid or got back;
                  amount_paise stays the INR settlement figure)
discount          + market_ids uuid[] (empty = every market); fixed amounts converted
```

Rule: every existing `*_paise` column keeps meaning shop-currency rupees. Reports, GST and profit
stay in INR. The new `*_minor` columns always sit beside a currency code and are `bigint`.

**Phase 3: market-specific catalogue and web presence.**

```
market_price          market_id, variant_id, price_minor, compare_at_minor
                      (fixed prices that beat the converted ones)
market_product_rule   market_id, product_id, excluded boolean
                      (products not sold there; store exceptions only)
market_web_presence   market_id, kind ('domain' | 'subfolder'), store_domain_id or
                      subfolder ('en-us'), default_locale
translation           store_id, resource_type, resource_id, locale, field, value
                      (titles and descriptions per language; the storefront adds hreflang)
```

### Decisions for the owner

1. Is Phase 1 (sell abroad in INR with export invoices) enough to start, and does Viora India hold
   a LUT?
2. Which countries first (Gulf, US/Canada, UK, others)?
3. Is Markets a Pro-plan feature?

## Checkout apps: Pro plan only, always paid (owner said yes)

An app that adds something to checkout (shipping options or delivery dates from a courier app,
upsells, gifting) can be turned on only on the **Pro** plan, and it **costs extra even on Pro**.
This needs no schema change: `app_purchase` already records bought apps, and
`packages/core/src/billing/apps.ts` holds the price table. The change is code:
- an app declares the surfaces it adds to (`surfaces: ['checkout']`);
- the pricing entry gains `requiresPlan: 'pro'` and `alwaysPaid: true` (today `includedFrom`
  means free from that plan up);
- the install button and checkout rendering both check plan and purchase. Checkout drops a
  lapsed app's blocks rather than failing.

Open decision: the monthly price of each checkout app.

## Appendix A: automated check results

| Check | Result |
| --- | --- |
| Tables | 173 (159 with `store_id`, 14 platform/auth tables without) |
| Row-level security | On and forced on all 159 store tables, plus `store`; one policy shape (`store_id = app.store_id`) everywhere |
| `store_id` nullable | none |
| Tables without a primary key | none |
| `timestamp without time zone` | none |
| Foreign keys | 323 (251 no action, 61 cascade, 11 set null); all 159 to `store` are no action |
| Foreign keys with no index on their columns | 80 (P0 item 1 lists the ones that matter) |
| Tables with no index starting with `store_id` | 40 |
| Unique indexes not including `store_id` | 47, all scoped by a store-owned parent or a global token, except `shipment (provider, waybill)`, `store_domain.hostname` and `sender_email.domain`, which are global on purpose |
| Money-like columns | 78 `integer` paise, 3 `bigint` paise, none floating point |
| `uuid … _id` columns without a foreign key | 38 (P2 item 8) |
| CHECK constraints | 125 |
| `jsonb` columns | 111 |
| Redundant indexes | 1 (`channel_listing_store`, covered by `channel_listing_item`) |

Newer tables with foreign keys but no index (low traffic today): `marketing_automation_run`
(`cart_id`, `order_id`, `customer_id`, `converted_order_id`), `marketing_message.customer_id`,
`review.{customer_id, order_id}`, `affiliate_commission.{payout_id, clawback_payout_id}`,
`affiliate_payout.affiliate_id`, `gift_card_transaction.{order_id, payment_id}`,
`api_activity.grant_id`, `shipment_manifest.pickup_id`, `purchase_order_line.variant_id`,
`transfer_line.{transfer_id, variant_id}`, `invoice.{order_id, refund_id}`.

## Appendix B: draft index migration (P0 items 1 and 2)

Written in `schema.ts` as `index()` / `uniqueIndex()` so drizzle-kit generates it. Plain
`CREATE INDEX` (drizzle migrations run in a transaction, so no `CONCURRENTLY`); at today's sizes
each takes milliseconds.

```sql
-- Pre-check (must return nothing before the two unique indexes):
--   select store_id, handle, count(*) from product group by 1, 2 having count(*) > 1;
--   select store_id, number, count(*) from "order" group by 1, 2 having count(*) > 1;

create unique index product_store_handle on product (store_id, handle);
create index product_store_status on product (store_id, status, created_at);
create index variant_product on variant (product_id);
create index variant_store_sku on variant (store_id, sku) where sku is not null;
create index product_option_product on product_option (product_id);
create index product_option_value_option on product_option_value (option_id);
create index variant_option_value_variant on variant_option_value (variant_id);
create index variant_option_value_value on variant_option_value (option_value_id);
create index product_media_product on product_media (product_id, position);
create index product_media_media on product_media (media_id);
create index media_store_created on media (store_id, created_at);
create index collection_product_product on collection_product (product_id);

create unique index order_store_number on "order" (store_id, number);
create index order_store_placed on "order" (store_id, placed_at);
create index order_customer on "order" (customer_id) where customer_id is not null;
create index order_line_order on order_line (order_id);
create index order_line_variant on order_line (variant_id);
create index payment_order on payment (order_id);
create index payment_provider_ref on payment (provider_ref);
create index refund_order on refund (order_id);
create index refund_payment on refund (payment_id);
create index shipment_order on shipment (order_id);
create index order_note_order on order_note (order_id, created_at);
create index discount_usage_discount_email on discount_usage (discount_id, email);
create index discount_usage_order on discount_usage (order_id);

create index cart_store_status_updated on cart (store_id, status, updated_at);
create index cart_customer on cart (customer_id) where customer_id is not null;
create index cart_line_cart on cart_line (cart_id);
create index cart_line_variant on cart_line (variant_id);

create index inventory_adjustment_variant on inventory_adjustment (variant_id, created_at);
create index inventory_level_location on inventory_level (location_id);
create index gift_card_transaction_order on gift_card_transaction (order_id) where order_id is not null;
```
