# OSS commerce gap analysis: us vs Medusa, Saleor, Vendure

Written 23 September 2026 against `main` at `9adbffc`. Compares our commerce core with three
open-source platforms and ends with ten builds, each small enough for one PR.

Sources were shallow clones read on 2026-09-23:

| Project | Commit read | Licence | What we may take |
| --- | --- | --- | --- |
| Medusa (`medusajs/medusa`, `develop`) | shallow HEAD | MIT, except the Enterprise Materials listed in `ENTERPRISE-LICENSE.md` (RBAC and SSO: `packages/modules/rbac/`, `packages/core/framework/src/policies/`, `core-flows/src/rbac/`, and so on) | Code and patterns outside those paths, keeping the MIT notice. Nothing below cites an Enterprise path. |
| Saleor (`saleor/saleor`) | shallow HEAD | BSD-3-Clause | Code and patterns, keeping the notice. It is Python, so in practice we take the data model and the algorithm, not the code. |
| Vendure (`vendure-ecommerce/vendure`) | shallow HEAD | GPL-3.0 or commercial | **Ideas only.** No code copied or pasted into this document or the repo. Paths are cited only so a reader can check the idea. |

Paths starting `medusa/`, `saleor/` or `vendure/` are in those repositories; everything else is
ours. Effort follows `docs/architecture.md`: S is up to 2 days, M up to a week, L more than a week.

## Summary

Our core is small and mostly correct for a single-location, INR-only D2C store: RLS, a saga for
`placeOrder`, server-side totals, GST split, webhook dedupe. The three projects are ahead in
four ways that matter now:

1. **Concurrency and replay on the money path.** Both Medusa and Saleor lock the cart, stop a
   second completion, and return the existing order on replay. We do none of that, and our
   discount usage limit and refund ceiling can both be passed under concurrency.
2. **Orders store facts, not a status.** Medusa and Saleor keep per-line quantity counters and
   per-payment amounts, and work out payment and fulfilment status from them. Our one `status`
   column holds payment, shipment and lifecycle together (handoff loose end 1).
3. **Stock is held per line, not just counted.** Saleor's `Allocation` and Medusa's
   `ReservationItem` tie held stock to an order line and a location. We only bump one
   `reserved` counter.
4. **Events are durable and apps are isolated.** Saleor delivers signed webhooks to apps with a
   delivery log. We enqueue work after commit and run every app's hook in one job.

We also have gaps that are ours alone: shipping is always charged at ₹0, collection-scoped
discounts never match, and nothing expires unpaid orders or handles RTO.

---

## 1. Checkout lifecycle

**We have.** A cart with lines whose price is fixed when the line is added
(`packages/core/src/cart/cart.ts:136-164`). The `placeOrder` saga runs loadCart, resolveDiscount,
reserveStock, createOrder, redeemGiftCards, chargePayment, recordPayment and markCartConverted
inside one `withStore` transaction (`packages/core/src/order/place-order.ts:528-562`). The
storefront action checks pincode serviceability, then calls `placeOrder`, then sends
notifications after the commit (`apps/storefront/src/lib/cart-actions.ts:122-181`). Carts are
`open | converted | abandoned` (`packages/db/src/schema.ts:667`) and are never expired.

Problems in our code:

- **No lock on the cart.** `loadCart` reads the cart without `FOR UPDATE`
  (`place-order.ts:108`). Two concurrent submits (double tap, a retry on a flaky connection)
  both see `open`, both reserve stock, and both create an order. The order has no `cart_id`, so
  a replay cannot find the first order.
- **Stale prices.** The order uses `cart_line.unit_price_paise` (`place-order.ts:114`), which is
  fixed when the line is added. A price change after that is never applied, in either
  direction.
- **Shipping is always ₹0.** `applyDiscount(subtotalPaise, 0, applied)` (`place-order.ts:276-280`)
  passes zero shipping, and no contract returns a rate (see area 4).
- **A gateway call inside the transaction.** `createPayment` runs while the transaction holds
  row locks on `inventory_level` from `reserveStock` (`place-order.ts:192-203`, `:438`).
  Razorpay latency then blocks every other checkout for the same SKU. That hurts during a sale
  drop.
- **No retry and no expiry for an unpaid order.** A failed or abandoned Razorpay payment leaves
  the order `placed` with stock reserved indefinitely. `applyPaymentStatus` only promotes
  `placed` to `paid` (`packages/core/src/payments/confirm.ts:27-32`). A capture that arrives
  after a cancel is recorded on the payment and silently ignored on the order.

**Medusa.** `completeCartWorkflow` takes a lock keyed by cart id for up to 30 seconds with a
2-minute TTL, then reads the `order_cart` link to find an order already created for this cart
and return it (`medusa/packages/core/core-flows/src/cart/workflows/complete-cart.ts:355-391`).
The workflow is stored with a 3-day retention time, so a replay gets the stored result. It
creates the order first and authorises payment last, so only a few steps can need a payment
rollback (`complete-cart.ts:115-122`). Payment sessions carry an `idempotency_key` to the
provider (`medusa/packages/core/types/src/payment/provider.ts:84`).

**Saleor.** `create_order_from_checkout` does `select_for_update()` on the checkout row and sets
`completing_started_at` as an in-progress guard
(`saleor/saleor/checkout/complete_checkout.py:1596-1609`, `:1844-1850`). The order keeps
`checkout_token`, and `get_by_checkout_token` returns the existing order on replay
(`saleor/saleor/order/models.py:49-51`, `:266`). Checkout prices expire: `price_expiration`
(`saleor/saleor/checkout/models.py:275`) is renewed after `CHECKOUT_PRICES_TTL`, 1 hour by
default (`saleor/saleor/settings.py:1007`), and the checkout is repriced once it passes. The
channel can expire unpaid orders (`expire_orders_after`), finish checkouts that are fully paid
(`automatically_complete_fully_paid_checkouts`), and refund money taken on checkouts that
expired (`release_funds_for_expired_checkouts`, `checkout_ttl_before_releasing_funds`)
(`saleor/saleor/channel/models.py:36-73`).

**Vendure (idea).** A pluggable "changed price handling strategy" decides what happens when a
variant's price changes while it sits in an order. By default the latest price wins, and the
change since the line was added is exposed to the storefront
(`vendure/packages/core/src/config/order/changed-price-handling-strategy.ts`).

**Gap.** Cart locking and replay, repricing on submit, unpaid-order expiry, payment retry, and
keeping gateway I/O out of locked transactions.

**Recommendation.**

- *Lock and replay (S).* `select … for update` on the cart in `loadCart`. Add `order.cart_id`
  with a unique index on `(store_id, cart_id)`. If the cart is already `converted`, return the
  order that has that `cart_id` rather than throwing. This is Saleor's `checkout_token` pattern
  (BSD). Risk: low, one migration.
- *Reprice on submit (S).* In `loadCart`, re-read `variant.price_paise` and available stock. If
  either changed, update the cart lines and throw `CartChanged` so the storefront shows the new
  total before the shopper pays. This takes Vendure's idea (ideas only) and Saleor's
  `price_expiration` concept. Risk: UX copy only.
- *Unpaid-order expiry (S/M).* Add a store setting `expireUnpaidAfterMinutes`, default 60 for
  online methods and never for COD. A worker repeat job cancels expired `placed` orders whose
  payments are all `pending` or `failed`, which releases stock through `cancelOrder`. A capture
  that arrives for a cancelled order raises a "refund needed" flag, and later an automatic
  refund. Take Saleor's `expire_orders_after` and `release_funds_for_expired_checkouts`
  (BSD, model only). Risk: expiring an order whose webhook is merely late. Before expiring,
  call `provider.fetchStatus`, which already exists in the payment contract.
- *Payment session outside the lock (M, with area 5 payment attempts).* Commit
  order + reservation first, then call `createPayment` in its own step outside the transaction,
  keyed by an attempt id. Medusa orders its steps this way; Saleor splits
  `complete_checkout_pre_payment_part` and `complete_checkout_post_payment_part`
  (`complete_checkout.py:1089`, `:1139`).

**India.** COD orders have no payment step, so the lock and replay change is what stops
duplicate COD orders. Duplicate COD orders are the costly kind: each becomes an RTO. Expiry must
skip COD and manual UPI; manual UPI needs its own longer window, for example 24 hours, because
the shopper pays from another app.

## 2. Inventory

**We have.** Locations, with one `inventory_level` row per variant and location holding
`on_hand`, `reserved` and `incoming` (`packages/db/src/schema.ts:363-386`). Exactly one row per
variant is sellable online (`fulfils_online`, unique partial index at `:384`), so multiple
locations exist but only one sells. There is an adjustment ledger with reasons
(`schema.ts:392-407`), purchase orders, and transfers (`packages/core/src/inventory/transfers.ts`).
Reservation is a conditional `UPDATE … where on_hand - reserved >= qty`
(`place-order.ts:192-203`); that part is correct under concurrency. Packing moves `on_hand` and
`reserved` down together, and cancelling releases the unpacked remainder
(`packages/core/src/order/committed-stock.ts:30-62`). Stock tracking is a single flag,
`variant.track_inventory`, and there is no backorder or preorder.

Problems: stock held is not linked to an order line or a location. `releaseCommittedStock`
decrements whatever row is sellable *now*, so switching the sellable location, or turning
`track_inventory` off, while orders are open leaves `reserved` wrong for good
(`committed-stock.ts:55-62`). Cart stock is never held, and that is fine for us; see below.

**Saleor.** `Stock` (per warehouse: `quantity`, `quantity_allocated`), `Allocation`
(`order_line`, `stock`, `quantity_allocated`, unique per pair)
(`saleor/saleor/warehouse/models.py:527-594`), and an optional checkout-time `Reservation` with
`reserved_until` (`:668-690`). The reservation window is set by site settings
`reserve_stock_duration_anonymous_user` and `reserve_stock_duration_authenticated_user`
(`saleor/saleor/site/models.py:84-89`). `allocate_stocks` locks the stock rows, sorts
warehouses by the channel's strategy (`PRIORITIZE_SORTING_ORDER` or `PRIORITIZE_HIGH_STOCK`),
and splits one line across warehouses (`saleor/saleor/warehouse/management.py:91`, `:268-316`;
`saleor/saleor/channel/__init__.py:4-10`). Preorders have their own allocation tables and
thresholds (`warehouse/models.py:597-666`; `saleor/saleor/product/models.py:366-368`).

**Medusa.** An `InventoryItem` is separate from the variant. A variant links to one or more
items with `required_quantity`, which covers bundles and multi-packs
(`medusa/packages/core/core-flows/src/cart/steps/reserve-inventory.ts:22-29`, link
`product-variant-inventory-item.ts`). `ReservationItem` stores `line_item_id`, `location_id`,
`quantity` and `allow_backorder` (`medusa/packages/modules/inventory/src/models/reservation-item.ts`).
`InventoryLevel` stores stocked, reserved and incoming quantities and computes available
(`inventory-level.ts`). Which locations can serve an order comes from the sales-channel to
stock-location link.

**Vendure (idea).** Stock movements are typed entities (Allocation, Sale, Cancellation, Release,
StockAdjustment) forming a full ledger (`vendure/packages/core/src/entity/stock-movement/`). A
pluggable `StockLocationStrategy` picks the location
(`vendure/packages/core/src/config/catalog/stock-location-strategy.ts`). Backorders come from a
negative `outOfStockThreshold` per variant or channel.

**Gap.** Held stock is not tied to lines, there is no allocation across locations, and there are
no backorders, preorders or bundles.

**Recommendation.**

- *Allocation table (M).* Add `order_line_allocation(order_line_id, inventory_level_id,
  quantity)`, written by `reserveStock` and read by pack and cancel, so a release always goes
  back to the row it came from. The `reserved` column stays as a cached sum. Take Saleor's
  `Allocation` (BSD, model only). Risk: a data migration that backfills open orders onto the
  current sellable row.
- *Allocation strategy (M, after the allocation table).* Allow several sellable locations,
  choosing by priority order, or by nearest pincode to the destination when Delhivery reports
  it serviceable from both. Take Saleor's `sort_stocks` idea; the pincode rule is ours.
- *Backorder and preorder (S).* Add `variant.inventory_policy: deny | continue`, the Shopify
  name, and let `reserveStock` skip the availability condition for `continue`. Preorder with an
  end date and a cap can come later (Saleor's `preorder_end_date` and
  `preorder_global_threshold`).
- *Bundles (L, later).* Medusa's variant to inventory item mapping with `required_quantity`.
  This needs inventory to be keyed by an inventory item rather than a variant, so it is not
  worth doing until a merchant asks.
- *No cart-time reservation.* Saleor makes it optional and it is off by default. D2C carts in
  India are abandoned at high rates, and holding stock for them costs sales. Keep reserving at
  order placement.

**India.** Merchants often run a home warehouse plus a 3PL or a Delhivery fulfilment centre.
Pincode-proximity allocation cuts both RTO and delivery days. GST registration is per state, so
an order shipped from a location in another state changes which GST applies (CGST+SGST or
IGST). The allocation must feed `computeOrderGst`'s `storeState`, which is currently always the
store address (`place-order.ts:289-298`).

## 3. Discounts and promotions

**We have.** One `discount` table: `kind` is code or automatic; `method` is percent, fixed or
free shipping; scope is all, products or collections; a minimum subtotal; a usage limit and a
per-customer limit; a time window (`packages/db/src/schema.ts:925-951`). Plus `discount_usage`.
One discount per order: a valid code wins, otherwise the best automatic discount
(`packages/core/src/discounts/resolve.ts:109-143`). Gift cards are handled separately.

Bugs:

- **The usage limit is not atomic.** The limit is checked in the evaluator
  (`discounts/evaluate.ts:98`) from a snapshot read earlier. The increment
  `used_count + 1` has no condition (`place-order.ts:351-354`), so two checkouts at 99/100
  both pass and the count ends at 101. The comment at `place-order.ts:341-342` claims the
  opposite. The per-customer cap has the same race.
- **Collection-scoped discounts never apply.** `loadDiscountCart` does not load
  `collectionIds` (`discounts/resolve.ts:24-35`), and the evaluator filters on them
  (`evaluate.ts:72`), so an `applies_to = collections` discount always finds no eligible items.

**Medusa.** `Promotion` (`code`, `is_automatic`, `limit`, `used`, type `standard | buyget`) plus
`ApplicationMethod` (`fixed | percentage`; target `order | items | shipping_methods`;
allocation `each | across | once`; `max_quantity`, `apply_to_quantity`,
`buy_rules_min_quantity`) plus rule sets `rules`, `target_rules` and `buy_rules` with
operators `gte/lte/gt/lt/eq/ne/in`. There are also campaigns with spend or usage budgets,
including per-attribute budgets such as "per `customer_email`"
(`medusa/packages/core/utils/src/promotion/index.ts:1-66`;
`medusa/packages/modules/promotion/src/models/`). `registerUsage` locks promotion and budget
rows with `FOR UPDATE` in a stable id order, sets `lock_timeout = '3s'`, and re-checks limits
under the lock (`medusa/packages/modules/promotion/src/services/promotion-module.ts:305-446`).
Buy-X-get-Y is in `utils/compute-actions/buy-get.ts`. Promotions stack by default; the engine
returns add and remove adjustment actions per line and per shipping method.

**Saleor.** Discounts come in two shapes. *Promotions* are either catalogue promotions, where a
`catalogue_predicate` precomputes a discounted price per variant per channel so listing pages
show the sale price, or order promotions, with an `order_predicate` on subtotal or quantity and
a reward of `subtotal_discount` or `gift`
(`saleor/saleor/discount/models.py:321-441`). *Vouchers* have many `VoucherCode`s (bulk
single-use codes), `apply_once_per_order`, `apply_once_per_customer`, `single_use`,
`only_for_staff` and `min_checkout_items_quantity` (`discount/models.py:99-233`). Discounts on
an order are stored as rows per line (`OrderLineDiscount`), with a unique `(line, unique_type)`
constraint so at most one discount of each type applies per line
(`discount/models.py:543-573`). Voucher usage is an `F("used") + 1` update
(`saleor/saleor/discount/utils/voucher.py:69-93`).

**Vendure (idea).** Promotions are a list of *conditions* (minimum amount, contains products,
facet values, customer group, buy X get Y) and *actions* (order percentage or fixed, line
fixed, product percentage, facet percentage, free shipping, buy X get Y free), each declared
with typed arguments that generate the admin form
(`vendure/packages/core/src/config/promotion/`). A `priorityValue` orders them.

**Gap.** Atomic limits; per-line discount records; buy X get Y; tiered offers ("₹200 off above
₹1,999, ₹500 off above ₹3,999"); bulk unique codes; stacking rules; sale prices shown on
listings.

**Recommendation.**

- *Fix the two bugs (S, first).* Make the increment conditional:
  `update discount set used_count = used_count + 1 where id = $1 and (usage_limit is null or
  used_count < usage_limit) returning id`. If no row is returned, drop the discount and throw
  `CartChanged`. Check the per-customer cap under `select … for update` on the discount row.
  Load `collection_product` ids in `loadDiscountCart`. The lock-and-recheck order is Medusa's
  (MIT); the SQL is ours.
- *Discounts as rows per line (M).* Add `order_line_discount(order_line_id, discount_id,
  amount_paise)` so returns can pro-rate refunds and GST invoices show the discount per line.
  This also removes the one-discount-per-order shape. Take Saleor's `OrderLineDiscount` and
  its unique type (BSD).
- *Rule and action model v2 (M/L).* Model a discount as rules (conditions) plus targets plus
  buy rules, shaped like Medusa's `ApplicationMethod` (MIT; the type shapes may be adapted with
  a notice). That gives buy X get Y, tiers as several rules, and `allocation each | across`.
  Allow stacking only across classes: at most one product discount, one order discount and one
  shipping discount, Shopify's combination rule. Admin forms are generated from typed
  arguments, which is Vendure's idea and matches our `factory.fields` pattern.
- *Bulk codes (S).* Add `discount_code(discount_id, code, used)` for influencer and
  single-use codes (Saleor `VoucherCode`).

**India.** Common patterns: "Flat ₹X off above ₹Y" (tiers), prepaid-only offers ("extra 5% on
UPI"; we already have per-method adjustments, `packages/core/src/payments/adjustments.ts`),
first-order codes (per-customer cap, where the email key should also use the phone number,
since shoppers rotate email addresses), and buy 2 get 1 on accessories. Prices include GST, so
discounts must reduce the taxable value per line; per-line discount rows make the invoice
correct.

## 4. Tax, shipping and payment provider interfaces

**We have.**

- *Tax:* GST is split out of tax-inclusive totals, CGST+SGST within a state and IGST across
  states. The rate is set per variant with a store default, and HSN codes are recorded
  (`packages/core/src/tax/gst.ts:172`, `place-order.ts:287-299`). There is no tax provider
  contract.
- *Shipping:* `ShippingProvider` has `checkServiceability`, `createShipment`, `track`,
  `cancel` and `verifyCredentials` (`packages/shipping/src/types.ts:127-142`). Serviceability
  returns COD and prepaid flags and transit days (`types.ts:30-49`), but **no price**. There
  are no rate tables either, which is why shipping is ₹0.
- *Payments:* `PaymentProvider` has `createPayment`, `confirm`, `fetchStatus`, `refund` and
  `parseWebhook` (`packages/payments/src/types.ts:127-161`). There is no separate authorise,
  capture or void, and no idempotency key on `createPayment` or `refund`.

**Medusa.**

- *Payment provider:* `initiatePayment`, `authorizePayment`, `capturePayment`, `cancelPayment`,
  `refundPayment`, `retrievePayment`, `updatePayment`, `deletePayment`, `getPaymentStatus` and
  `getWebhookActionAndData` (`medusa/packages/core/utils/src/payment/abstract-payment-provider.ts`).
  Session statuses include `requires_more` and `pending_authorization`
  (`payment-session.ts:6-35`).
- *Fulfilment provider:* `getFulfillmentOptions`, `canCalculate` and `calculatePrice`, which
  give calculated rates; `validateFulfillmentData`; `createFulfillment`, `cancelFulfillment`
  and `createReturnFulfillment`; plus document getters for labels and invoices
  (`medusa/packages/core/utils/src/fulfillment/provider.ts:131-491`).
- *Tax provider:* `getTaxLines(itemLines, shippingLines, context)`
  (`medusa/packages/core/types/src/tax/provider.ts:177`).

**Saleor.**

- *Tax:* `TaxConfiguration` per channel: `charge_taxes`, `tax_calculation_strategy`
  (flat rates or a tax app), `prices_entered_with_tax`, `tax_app_id`. Tax classes have country
  rates (`saleor/saleor/tax/models.py:11-77`).
- *Shipping:* a `ShippingMethod` has a price-based or weight-based type, min and max delivery
  days, and `ShippingMethodPostalCodeRule` entries (`start`, `end`, include or exclude)
  (`saleor/saleor/shipping/models.py:235-298`). Each channel listing sets a price and order
  value bounds (`:299-330`).
- *External providers* plug in via synchronous webhooks: `SHIPPING_LIST_METHODS_FOR_CHECKOUT`,
  `CHECKOUT_FILTER_SHIPPING_METHODS`, `CHECKOUT_CALCULATE_TAXES`, and the `TRANSACTION_*`
  payment flow (`saleor/saleor/webhook/event_types.py`).
- *Payment state:* a `TransactionItem` per payment attempt holds `authorized_value`,
  `charged_value`, `refunded_value`, `canceled_value`, `charge_pending_value`,
  `psp_reference` and `idempotency_key`. `TransactionEvent` is the ledger
  (`saleor/saleor/payment/models.py:31-240`).

**Vendure (idea).** A COD fee is a `Surcharge` line on the order (with tax), not a column
(`vendure/packages/core/src/entity/surcharge/`). Shipping calculators and eligibility checkers
are configurable operations with typed arguments.

**Gap.** Shipping rates; void and capture for authorise-then-capture gateways; idempotency keys
through to the provider; recording payment attempts; tax classes.

**Recommendation.**

- *Shipping rates (M).* Add a core `shipping_rate` table: name, condition type
  (flat, order value, weight), bands, price, an optional pincode or state include/exclude
  list, and a COD surcharge. Add an optional `quoteRate?(query)` on `ShippingProvider` for
  couriers that price by API (Shiprocket). Checkout picks the cheapest eligible rate, or lets
  the shopper choose, and `placeOrder` re-quotes it server-side. Take Saleor's
  `ShippingMethod` and `PostalCodeRule` model (BSD) and Medusa's
  `canCalculate`/`calculatePrice` split (MIT). Risk: checkout UI and the free-shipping
  discount path, which exists (`evaluate.ts:110`) but has had no shipping amount to remove.
- *Payment contract v2 (M).* Add optional `capture`, `void` and an `idempotencyKey` on
  `createPayment` and `refund`; Razorpay supports manual capture. Keep it additive so the
  current adapters still pass `describePaymentProvider`. Take the method names from Medusa
  (MIT).
- *Tax classes (S).* Add `tax_class(name, rate_percent, rules)`, where a rule is
  `{ above_unit_price_paise, rate_percent }`, and point variants at a class instead of raw
  `gst_rate_percent`. Skip a tax-provider contract: GST is deterministic, and the providers
  worth plugging in (e-invoicing IRN, e-way bill) sit after the order, as app hooks, not in
  checkout.

**India.** The COD fee must be taxed like the goods it comes with. Our weighted split of the
total already does that; a surcharge row would make it visible on the invoice. Pincode rules
matter more than zones: Northeast, J&K and island pincodes cost more. Weight-slab rates
(first 500 g, then each extra 500 g) are what Delhivery and Shiprocket charge merchants. GST
rates on apparel and footwear depend on the unit price, so tax classes need price-slab rules.

## 5. Orders: status, edits, returns, RTO, refunds

**We have.** `order.status` is one of `draft | placed | paid | fulfilled | delivered | cancelled`
(`packages/db/src/schema.ts:708`). Payment writes `paid` (`confirm.ts:27-32`), the tracking poll
writes `delivered` (`packages/core/src/shipping/shipments.ts:119-122`), and the admin can set
any value (`packages/core/src/order/status.ts:92-114`). Lines carry `fulfilled_quantity` only
(`schema.ts:766`). There is one shipment per order, and its statuses include `rto`
(`schema.ts:882-912`), but **nothing reacts to RTO**: no restock, the COD payment stays
`pending`, and the order stays `fulfilled`. Refunds exist (`packages/core/src/order/refund.ts`),
but the payment row is not locked, so two concurrent refunds can both pass the remaining-amount
check (`refund.ts:49-56`). Order edits exist only for drafts
(`packages/core/src/order/drafts.ts`). There are no returns or exchanges.

**Medusa.** `OrderStatus` is lifecycle only: `pending | completed | draft | archived | canceled |
requires_action` (`medusa/packages/core/utils/src/order/status.ts`). Each order item has
counters: `fulfilled_quantity`, `shipped_quantity`, `delivered_quantity`,
`return_requested_quantity`, `return_received_quantity`, `return_dismissed_quantity` and
`written_off_quantity` (`medusa/packages/modules/order/src/models/order-item.ts:9-19`). Payment
and fulfilment status are *computed* from payments and fulfilments
(`medusa/packages/core/core-flows/src/order/utils/aggregate-status.ts:46-111`), for example
`partially_refunded` and `partially_captured`. Edits, returns, claims and exchanges are
`OrderChange` records with a `version`, requested, confirmed and declined timestamps, and
actions (`order-change.ts:7-33`). Returns have reasons, and exchanges carry payment
collections for the price difference.

**Saleor.** `OrderStatus` has draft, unconfirmed, unfulfilled, partially fulfilled, fulfilled,
partially returned, returned, canceled and expired. `authorize_status` and `charge_status`
(`none | partial | full | overcharged`) are separate columns
(`saleor/saleor/order/__init__.py`; `saleor/saleor/order/models.py:115-126`). Fulfilment groups
can be `returned`, `refunded_and_returned` or `replaced`. A replacement creates a draft order.

**Vendure (idea).** An order state machine that can be customised: `Modifying` and
`ArrangingAdditionalPayment` states handle edits that raise the total, and an
`OrderModification` records the price change, surcharges and any refund
(`vendure/packages/core/src/config/order/default-order-process.ts`,
`entity/order-modification/`).

**Gap.** Status derived from facts; RTO handling; returns and exchanges; edits to placed orders;
safe concurrent refunds.

**Recommendation.**

- *Status split (M; this is handoff loose end 1).* `order.status` becomes
  `draft | open | cancelled | expired` (later `archived`). Add derived, stored-for-filtering
  columns `payment_status` (`pending | paid | partially_refunded | refunded | failed`) and
  `fulfilment_status` (`unfulfilled | partial | fulfilled | delivered | returned | rto`),
  recomputed by one `recomputeOrderStatus(ctx, orderId)` that every writer calls. Take
  Medusa's `aggregate-status.ts` rules (MIT; adapt with a notice) and Saleor's separate
  `charge_status` (BSD). Risk: every list filter, report and notification reads `status`, so a
  single migration must backfill and update all readers.
- *Refund guard (S).* `select … for update` on the payment in `refundPayment` before summing
  refunds, and pass an idempotency key (the refund row id, created first as `pending`) to the
  gateway.
- *RTO v1 (M).* When tracking reports `rto`, mark the COD payment `failed` (voided), set the
  fulfilment status to `rto`, and on "RTO received" in the admin restock through an
  `inventory_adjustment` with reason `returned`. Record the RTO reason and courier charge.
  Line counters (`returned_quantity`) follow Medusa's order-item counters (MIT, model only).
- *Returns and exchanges (L, after RTO).* Add `return(order_id, status, reason)` and
  `return_line(order_line_id, quantity, condition)`, with refund pro-rated by per-line
  discount (area 3). An exchange is a return plus a new order linked to it. Take Medusa's
  `Return` and `OrderChange` shape; skip versioned order changes until order edits are needed.

**India.** RTO is the single largest cost for COD-heavy D2C (commonly 20–30% of COD orders),
so RTO v1 is worth more than returns. Track RTO per pincode and per customer phone so COD can
later be disabled for repeat refusers. That data feeds an RTO-risk rule at checkout (area 1).
Refunds for COD go by UPI or bank transfer. `manual` refunds already cover that; the UPI
reference should be captured.

## 6. Channels, per-channel pricing and availability

**We have.** No channels. One price per variant (`price_paise`, `mrp_paise`;
`packages/db/src/schema.ts:294-296`), INR only, one storefront per store. Product visibility is
`product.status`.

**Medusa.** `SalesChannel` is linked to products, stock locations and publishable API keys
(`medusa/packages/modules/link-modules/src/definitions/product-sales-channel.ts`,
`sales-channel-location.ts`, `publishable-api-key-sales-channel.ts`). Pricing is a
`PriceSet` per variant. A `Price` has currency, `min_quantity` and `max_quantity` (quantity
tiers) and rules such as region or customer group. `PriceList` is `sale | override` with a
start, an end and rules (`medusa/packages/modules/pricing/src/models/price.ts:9-14`,
`price-list.ts:12-18`).

**Saleor.** Channel is the core concept: currency, allocation strategy, warehouses, and order
and checkout policy (`saleor/saleor/channel/models.py:13-75`). Products and variants have
channel listings: `visible_in_listings`, `available_for_purchase_at`, `price_amount`,
`prior_price_amount` and a precomputed `discounted_price_amount`
(`saleor/saleor/product/models.py:311-330`, `:485-544`).

**Vendure (idea).** Channels plus sellers (multi-vendor) with per-channel prices, currency and
`trackInventory` and `outOfStockThreshold` settings per channel.

**Gap.** Real, but not urgent. Stores are already our tenancy unit, and a D2C merchant has one
storefront.

**Recommendation.** Don't build channels yet (L, high blast radius: every catalogue query).
Build the parts merchants ask for:

- *Price lists (M).* `price_list(type sale|b2b, starts_at, ends_at, customer_segment_id)` and
  `price_list_price(variant_id, price_paise, min_quantity)`. This covers scheduled sales,
  wholesale or B2B tiers ("10+ units at ₹X"), and segment pricing using our existing customer
  segments. Take Medusa's `PriceList` and `Price.min_quantity` shape (MIT).
- *Scheduled availability (S).* `product.available_from` (Saleor's
  `available_for_purchase_at`) for drops.
- *Later:* introduce `sales_channel` when POS or marketplace sync (Amazon, Flipkart) arrives.
  Keep the sellable location in area 2 keyed so it can become per-channel.

**India.** B2B and wholesale buyers need GSTIN on the order and a B2B tax invoice, which is
separate from pricing. MRP is legally required on packaged goods, so a price list must never
exceed `mrp_paise`; validate that on save.

## 7. Plugin and app system

**We have (Tier 1, in-process).** A plugin is an npm package with a manifest: provider factories,
hooks for `order.paid`, `order.fulfilled` and `refund.created`, jobs, order links, product
fields, admin pages and an order card, and email attachments
(`packages/plugins/src/types.ts:15-143`). It is installed per store through `store.apps`
(`packages/db/src/schema.ts:54`). Hooks run in the worker with a full RLS-scoped transaction
(`types.ts:36-57`).

Problems:

- App events are derived from notification templates
  (`packages/core/src/plugins/events.ts:49-53`), so no event fires if notifications are
  disabled or the template is renamed.
- All installed apps' hooks for an event run one after another in *one* job
  (`events.ts:101-113`). One failing app retries all of them, so the others' hooks run again,
  and a slow app delays the rest.
- There is no permission scope per app: every hook can read and write the whole store.

**Saleor.** Apps are external services. An `App` has `permissions` (the same permission objects
staff get), `manifest_url`, `identifier`, `audience` and `is_active`. `AppToken` authenticates
the app to the API. `AppExtension` declares a `mount` (a dashboard location), a `target`
(popup, iframe or new tab) and its own permissions (`saleor/saleor/app/models.py:51-192`).
`AppInstallation` is an async job that shows the requested permissions (`:232`). A `Webhook`
belongs to an app and has `secret_key`, a `subscription_query` (GraphQL, so the app picks its
payload shape) and `custom_headers` (`saleor/saleor/webhook/models.py:19-43`). Deliveries are
logged in `EventDelivery` (pending, success or failed) and `EventDeliveryAttempt`
(`saleor/saleor/core/models.py:212-240`). Payloads are signed with JWS, and apps verify them
against Saleor's JWKS (`saleor/saleor/core/jwt_manager.py`). Synchronous webhooks let an app
*be* the tax engine, the shipping-rate source or the payment gateway (area 4).

**Medusa.** In-process modules that own their tables, joined by *module links*: link tables
declared outside both modules (`medusa/packages/modules/link-modules/src/definitions/`). Plugins
bundle modules, workflows, subscribers, API routes and admin widgets. There is no permission
scope for plugins.

**Vendure (idea).** A `@VendurePlugin` declares entities, Shop and Admin API schema
extensions, a `configuration` hook that edits the global config (strategies, custom fields),
dashboard extensions, and a `compatibility` semver range checked at boot
(`vendure/packages/core/src/plugin/vendure-plugin.ts:23-70`).

**Gap.** Durable per-app delivery, app-level permissions, and an external (Tier 2) app model.

**Recommendation.**

- *Now (S, part of the outbox PR).* Fire app events from domain events, not notification
  templates, and queue one job per `(event, plugin)`, keyed
  `${storeId}:${event}:${pluginId}:${entityId}`.
- *Tier 1 additions (S each, when needed):* a `compatibility` range in the manifest, checked
  in `loadPlugins` (Vendure idea); a `permissions` list in the manifest, enforced by giving
  hooks a context that runs `can()` (the 31 permissions already exist).
- *Tier 2 external apps (L, after the outbox and the versioned API in architecture 5g).*
  Follow Saleor's shape, reimplemented:
  1. `store_app(id, store_id, identifier, manifest_url, permissions[], status)`. Install shows
     the permissions and the merchant approves them.
  2. `app_token(app_id, token_hash)`, which authenticates to the public API; `storeProcedure`
     resolves the store from the token and checks `can()` against the app's permissions. RLS
     still isolates the store.
  3. `app_webhook(app_id, events[], target_url, secret)` with HMAC-SHA256 over the raw body and
     a timestamp header. That is simpler than JWS and the same thing Razorpay does to us.
  4. `event_delivery` and `event_delivery_attempt` tables fed by the outbox relay, with
     backoff, dead-lettering and a "Deliveries" tab on the app page.
  5. Admin extensions as iframes at named mount points (`order.detail.card`,
     `product.detail.card`, `app.page`), passing a short-lived signed token; this mirrors our
     Tier 1 `orderDetailCard`.
  6. Synchronous hooks (shipping rates, tax) only with a hard timeout and a core fallback.

**India.** The first Tier 2 apps merchants will want are Shiprocket or other aggregators,
Tally or Zoho Books export, WhatsApp commerce tools (Interakt, Gupshup) and COD verification
(an IVR call or WhatsApp confirmation before dispatch). The last of these needs an
`order.placed` event and an API to tag or hold the order, which is one more reason to fire
events from domain changes.

## 8. Workflows, jobs and events

**We have.** `runWorkflow` runs steps in order and, on failure, runs compensations in reverse,
logging and swallowing compensation errors (`packages/core/src/workflow/run.ts:18-42`). It is
used by `placeOrder`, inside one DB transaction, so the DB compensations are redundant: rollback
already does them. Only the gateway refund in `chargePayment.compensate` really matters
(`place-order.ts:467-474`), and if it fails the error is only logged. BullMQ queues handle
notifications, app events and jobs, marketing, shipping tracking and domains
(`apps/worker/src/`). Work is enqueued *after* commit from call sites
(`cart-actions.ts:174-181`), so a crash between commit and enqueue loses the notification and the
app event. The outbox is planned (`docs/architecture.md` 5a) but not built.

**Medusa.** A workflow engine with persisted executions (`store: true`, `retentionTime`), step
options `maxRetries`, `retryInterval`, `timeout`, `async` (long-running steps completed by an
external signal), `compensateAsync`, `skipOnPermanentFailure` and `continueOnPermanentFailure`
(`medusa/packages/core/orchestration/src/transaction/types.ts:30-100`). Hooks inject custom
steps, and `acquireLockStep` and `releaseLockStep` use the locking module
(`medusa/packages/modules/locking/`). Events emitted in a workflow are grouped and staged in
Redis, then released only when the workflow succeeds
(`medusa/packages/modules/event-bus-redis/src/services/event-bus-redis.ts:219-283`). That is
not transactional with the database: a crash between commit and release loses them.

**Saleor.** Celery tasks, with webhook deliveries persisted as `EventDelivery` rows before they
are sent, so a lost worker leaves a pending row to retry (see area 7).

**Vendure (idea).** The event bus awaits the publishing transaction's commit or rollback before
subscribers run (`vendure/packages/core/src/event-bus/event-bus.ts:293-303`). It is correct
about visibility but still in-memory, so events are lost if the process dies. A `JobQueue` has
pluggable strategies (SQL, BullMQ).

**Gap.** None of the three has a true transactional outbox. It is still the right design for
us: it closes the commit-then-enqueue gap that all three share. We lack durable events,
persisted workflow state for multi-hour flows (RTO, returns, COD verification), locking
helpers, and an alert when a compensation fails with money at stake.

**Recommendation.**

- *Outbox (M; architecture 5a, unchanged).* A `domain_event` row is written in the same
  transaction as the change. The worker relays unpublished rows to BullMQ with
  `FOR UPDATE SKIP LOCKED`, and subscribers are keyed by event type. First events:
  `order.placed`, `order.paid`, `order.cancelled`, `order.fulfilled`, `shipment.updated`,
  `refund.created`. Move notifications, marketing `onOrderPlaced` and app events onto it. Take
  the "release only after success" idea from Medusa and Vendure; ours is stronger because it
  is in the database.
- *Compensation failures are recorded (S).* When a compensation throws, write a
  `workflow_failure(store_id, workflow, step, state_json, error)` row and show it in the admin
  as "Refund needed". A captured payment whose refund failed must never be only a log line.
- *Locks (S).* A `withLock(tx, key)` helper using `pg_advisory_xact_lock(hashtext(key))`. It
  needs no Redis, is released on commit, and serves the cart lock (area 1) and any per-order
  mutation. This is Medusa's locking-step idea, implemented in Postgres.
- *Do not adopt a workflow engine yet (L).* Medusa's persisted orchestrator is large. Long
  flows (RTO, returns) can be state columns plus outbox subscribers until one flow needs
  timers; at that point evaluate Temporal (MIT) or Trigger.dev (Apache-2.0), both already on
  the open-source radar.

---

## Top 10 builds, ranked

Correctness on the money path first, then the platform pieces the rest depends on, then
features. Each item is one PR on its own branch.

| # | Build | Area | Take from (licence) | Effort | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | **Checkout lock and replay.** `select … for update` on the cart in `loadCart`; `order.cart_id` with unique `(store_id, cart_id)`; a converted cart returns its order. Kills duplicate orders, including duplicate COD orders. | 1 | Saleor `checkout_token` + `select_for_update` (BSD); Medusa `order_cart` + lock (MIT) | S | Low: one column, one migration |
| 2 | **Atomic money guards.** Conditional `used_count` increment and per-customer cap under a row lock; `for update` on the payment in `refundPayment` so refunds cannot exceed the capture. | 3, 5 | Medusa `registerUsage` lock-then-recheck (MIT) | S | Low |
| 3 | **Collection-scoped discounts fix.** Load collection ids in `loadDiscountCart`, with a test for `applies_to = collections`. | 3 | Ours | S | Low |
| 4 | **Reprice and recheck on submit.** `loadCart` reads live variant price and stock; if either changed, update the lines and return `CartChanged` so the storefront shows the new total. | 1 | Vendure changed-price idea (GPL: idea only); Saleor `price_expiration` (BSD) | S | Low: storefront copy |
| 5 | **Unpaid order expiry.** Store setting plus a worker repeat job cancelling stale online-payment orders after a `fetchStatus` check; late capture on a cancelled order raises "refund needed". | 1 | Saleor `expire_orders_after`, `release_funds_for_expired_checkouts` (BSD) | S/M | Medium: never expire COD; check the gateway first |
| 6 | **Domain event outbox.** `domain_event` written in-transaction plus a relay; notifications, marketing and app events move onto it, one job per `(event, plugin)`; `workflow_failure` rows for failed compensations. | 8, 7 | Architecture 5a; release-after-success idea from Medusa (MIT) and Vendure (idea) | M | Medium: touches every enqueue site |
| 7 | **Order status split.** `status` becomes `draft/open/cancelled/expired`, with `payment_status` and `fulfilment_status` derived by one recompute function. Handoff loose end 1. | 5 | Medusa `aggregate-status.ts` (MIT); Saleor `charge_status` (BSD) | M | Medium: backfill, and every reader of `status` |
| 8 | **Shipping rates.** `shipping_rate` table (flat, order-value or weight bands, pincode or state include/exclude, COD surcharge) plus optional `quoteRate` on `ShippingProvider`; re-quoted in `placeOrder`. Ends ₹0 shipping. | 4 | Saleor `ShippingMethod` + `PostalCodeRule` (BSD); Medusa `canCalculate`/`calculatePrice` (MIT) | M | Medium: checkout UI, free-shipping discount. **Built 2026-09-24** (`feat/shipping-rates-v2`): zones + rates, `quoteRate` optional and unused by Delhivery. |
| 9 | **RTO v1.** On `rto` tracking, void the COD payment and set the fulfilment state; "RTO received" restocks with an adjustment; RTO reason, charge and per-pincode or per-phone counts. | 5 | Medusa order-item counters (MIT, model) | M | Low/medium: depends on 7 for status |
| 10 | **Payment attempts and retry.** A new payment row per attempt, with an idempotency key through `createPayment` and `refund`; `createPayment` moved outside the reservation transaction; "Retry payment" on the pay page. | 1, 4 | Saleor `TransactionItem` (BSD); Medusa provider `idempotency_key` (MIT) | M | Medium: Razorpay flow; keep the contract additive |

**Next after the ten:** the allocation table and pincode-proximity allocation (area 2, M, M);
per-line discount rows, then the rule and action promotions v2 with buy X get Y and tiers
(area 3, M, M/L); tax classes with price slabs (area 4, S); price lists (area 6, M); the Tier 2
external app model (area 7, L); returns and exchanges (area 5, L).

## Licence notes for implementers

- Adapting Medusa code: copy only from paths not listed in `ENTERPRISE-LICENSE.md`. Keep the MIT
  notice in the package's `THIRD_PARTY_LICENSES.md`, put a header comment on each adapted file,
  and add a row to `THIRD_PARTY_NOTICES.md`.
- Saleor is BSD-3: the same steps apply, and the notice must keep Saleor's copyright line. We are
  porting data models and algorithms from Python, so a comment naming the source model is usually
  enough; add a notice row when logic is translated closely.
- Vendure is GPL-3: do not open its source while writing the corresponding code. Everything taken
  from it in this document is an idea stated in our own words.
