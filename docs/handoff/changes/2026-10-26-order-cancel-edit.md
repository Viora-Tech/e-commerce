# Order cancel, imported-order takeover, order editing (#801, #802)

Branch `feat/order-cancel-edit-2026-10-26`. **No migration** (new fields are jsonb/type-only).

## What existed

- Native orders already had "Cancel order" in More actions, but only a plain confirm that ran
  `changeOrderStatus('cancelled')`: always restock, always notify, no refund. Imported orders
  (`order.imported_from`) were read-only everywhere (`assertNotImported` on every write route), so
  an open imported order (#2331, paid via Razorpay on Shopify, unfulfilled) could not be shipped,
  cancelled or edited.
- No order editing at all (only drafts). Core already had `cancelOrder` (restock / notify
  options), `refundPayment`, the pre-order balance ledger and pay link
  (`preorder/balance.ts`, `balance-link.ts`), and parcels with per-location stock.

## Cancel (#801)

- `core/order/staff-cancel.ts` `cancelOrderByStaff`: reason, restock, notify, refund route.
  Reuses `cancelOrder` (stock released or written off, gift cards back, `order.cancel_notice`),
  writes `order.cancelled` for apps when notify is off, refunds what is left through
  `core/order/refund-routes.ts` (`original` gateway / `manual` record / `none`), and a timeline note.
  The route is checked before anything moves; the whole call is one transaction.
- `refundPayment` gained an additive `manual` flag (record without the gateway).
- Rules shared by admin and server: `core/order/edit-rules.ts` (`@commerce/core/order-edit-rules`):
  cancel = open and unfulfilled / partially fulfilled (was: anything but delivered).
- API `orders.cancel` (orders.cancel, plus orders.refund unless "No refund"),
  `orders.refundOptions`. Admin: `cancel-order-dialog.tsx` (centred, buttons right),
  shared `refund-route-field.tsx`.

## Imported orders: takeover

- `core/order/takeover.ts` `takeOverImportedOrder` ("Manage this order in Koomerce" on the
  Imported card, `orders.takeOver`, orders.write). Clears `imported_from` (so it is worked like a
  native order, and a re-run of the Shopify import skips it), keeps the source in
  `import_meta.takenOver {at, by, source}`, timeline note. Unpaid Shopify COD orders get
  `payment_method = 'cod'`.
- **Stock**: not retro-deducted. Shopify's exported quantity is *available* (already excludes
  open orders), so each unsent unit is counted back as on hand **and** committed
  (`holdTakenOverStock`, adjustment `other`): available is unchanged, and packing / cancelling
  then move stock like any order. Cancel's restock defaults **off** for imported (and taken-over)
  orders, with the reason in the dialog.
- **Refunds**: the importer stores the payment as provider `shopify` with `provider_ref` = the
  CSV "Payment Reference" or the order name (API import: always the name) — never a Razorpay
  `pay_…` id — so no gateway refund is possible safely: **manual "mark refunded" only**
  (`refundOptions.original = false`). Cancelling an open imported order takes it over first.
- Fulfilled / cancelled imports stay read-only history (no takeover button).

## Order edit (#802)

- Page `/orders/<id>/edit` (`routes.orders.edit`), "Edit order" in More actions for open,
  not-shipped, non-imported orders. Items (qty, remove/undo, add via `products.searchVariants`,
  price override on added lines), shipping, discount; summary card; review dialog.
- Core: `edit-plan.ts` (pure math, `OrderEditSchema`), `edit.ts` (`previewOrderEdit`,
  `editOrder`), `edit-stock.ts` (release units newest parcel first, route+hold added units into
  the open parcel at that location or a new parcel, settle parcels, re-run GST with
  `taxParcels`), `edit-settle.ts` (money). Totals move by the difference, so an imported order's
  recorded totals keep what its lines don't show. Packed units can't be removed; gift card lines
  can't change; OutOfStock refuses the whole edit; an unpaid order waiting on an online payment
  can't be edited.
- **Customer owes more** (paid at checkout): the order gets a balance of exactly the difference
  on the pre-order balance ledger (`balance_due_paise`), so "Collect payment" records it and the
  existing `/checkout/balance/<token>` link pays it online; with "Email the customer a payment
  link" `requestBalance` sends it. A previous balance capture is re-filed as `purpose='order'`
  (keeps the one-balance-capture index happy); stale balance attempts are cancelled.
  Edit balances (`deposit_paise IS NULL`) **do not block fulfilment** and are **excluded from the
  pre-order reminder/auto-cancel job**; the `balance_request` email has edit wording
  (`balance.kind = 'edit'`).
- **Store owes money**: refunded via `refund-routes` (original / manual / none), reason
  `ORDER_EDIT_REFUND_REASON`. Unpaid COD/manual orders: the pending offline payment moves to the
  new total.
- Events: `order.edited` (new outbox type + AppEvent, one app job per edit).
  - Affiliates: `commission-edit.ts` `recomputeCommissionForEdit` — pending: recomputed in place;
    approved / paid / in payout: only lowered (clawback in a payout, TDS scaled otherwise).
    `applyRefunds` now ignores edit refunds (`refundedForCommission`) so nothing is taken twice.
  - GST invoices: `order-edit.ts` `reviseForOrderEdit` — queued drafts regenerated; an issued
    invoice whose parcel now bills more is cancelled ("Order edited: re-issued…") and the paid
    rule re-run issues a new one; filed (GSTR-1) or credited invoices are left and reported
    in app activity. Decreases are credited by the refund's normal credit note.

## Also

- Duplicate order copied `order.phone` only; now falls back to the shipping address phone
  (`duplicate.ts`), tested.
- MCP action docs regenerated.
- Known, not changed: `orders.refund` route emits `refund.created` twice (router + service).
