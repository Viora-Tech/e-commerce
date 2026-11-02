# Drafts: payment due later, reserve items; inventory: on hand + product link

Shopify-matching fixes for the 2 Nov test-server issues.

- **#1031 Inventory → product.** The product (or variant) name in a row opens the product page.
- **#1032 On hand editable.** On hand takes the same type-over / stepper cell as Available; both
  adjust on-hand stock by the same amount (available = on hand − committed). Committed and
  Incoming stay read-only, as in Shopify. No "Unavailable" state yet (needs a stock-model change).
- **#1029 Payment due later.** Drafts get "When it is paid": paid now, due on receipt, on
  fulfilment, within 7/15/30/45/60/90 days, or on a date. Converting places the order unpaid with
  `order.payment_terms` and `order.payment_due_at` (migration 0217); the order's payment card shows
  "Payment due …" and an Overdue chip. `core/order/payment-terms.ts`.
- **#1030 Reserve items.** A saved draft can hold its stock until a date ("Reserve items" card):
  `routeAndReserve` holds it, `order.draft_reserved` / `reserved_until` remember it (migration
  0218). Converting, deleting or the date passing gives it back; editing a held draft re-holds the
  new lines. The worker's unpaid-expiry tick releases expired holds
  (`stores_with_expired_draft_holds()`). Prices were already fixed on drafts: each line keeps the
  price it was saved with. `core/order/draft-reserve.ts`.

Prod needs migrations 0217 and 0218 on release.
