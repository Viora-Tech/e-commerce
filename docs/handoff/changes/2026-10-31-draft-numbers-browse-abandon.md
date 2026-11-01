# Draft order numbers (#D1) and browse abandonment (31 October 2026)

## Draft numbers (audit #26)

- Drafts have their own series per store: #D1, #D2 … from `store_counter` row `draft`
  (`takeDraftNumber`, `packages/core/src/order/order-number.ts`).
- A new draft keeps minus its draft number in `order.number` (a placeholder, never shown) and takes
  a real order number only in `convertDraft`. Deleted or never-placed drafts leave no gaps.
- Migration **0200_draft_numbers**: `order.draft_number` (unique per store when set), backfilled
  D1..Dn by creation order (uuidv7 id) for every draft and every order tagged `draft`. Existing
  order numbers are untouched; a pre-0200 draft keeps the order number it reserved when it converts.
- Pure helpers `@commerce/core/draft-number` (`orderRef`, `draftLabel`, `parseDraftSearch`).
- Shown as #D12 on the drafts list, the draft page and tab title, the draft invoice email /
  WhatsApp / storefront invoice page, the return exchange messages. Drafts search accepts `D12`
  and `#D12`.
- The storefront "Pay invoice" action now follows the order number the draft takes on convert.

## Browse abandonment (audit #183)

- Migration **0201_product_views**: `product_view` (one row per known shopper and product, last
  view time), `marketing_automation_run.product_id`, and `stores_with_automation_work()` now also
  lists stores with an On `browse.abandoned` workflow.
- The storefront page-view beacon (`/api/beacon`, analytics consent only) records a product page
  view after the response (`after()`), for a signed-in shopper or a basket whose email/phone is a
  customer (`recordProductView`, throttled to one write per 5 minutes per product).
- Trigger "Browse abandoned": Growth (`browse_abandoned`, template "Browse abandonment", email
  "Still thinking about {product_title}?") and the engine (`browse.abandoned`, subject customer,
  product in `trigger_data.productId`). Both sweeps read `dueBrowseViews`: quiet for the wait
  (default 4 hours), within 7 days, product not in the shopper's baskets or bought since, shopper
  with email or WhatsApp marketing consent, at most one run per shopper and product per 7 days.
  Runs convert on an order like the cart flows.
- New merge tags: `{product_title}`, `{product_url}`, `{product_price}`.
- `customer.subscribed` / `customer_subscribed` already existed; nothing added.
