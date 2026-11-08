# Limit unpaid and repeated checkouts (#1306)

Shoppers were spamming orders: manual UPI orders never paid, and card retries that each became
a new order. All checks run in `placeOrder` (`enforceCheckoutRules` step), before stock is
reserved, and only for a storefront checkout (`input.checkout` set). Admin drafts, invoices and
"pay online instead" are untouched, and so is how Razorpay orders are created.

- **Core helper** `packages/core/src/order/duplicate-checkout.ts`:
  `findRecentDuplicateCheckout` (same variant ids and quantities, any order, same shopper by
  normalised email or phone, within `duplicateCheckoutHours`, not cancelled), returns `unpaid`
  (open, no checkout payment, not COD or authorised) or `placed`. `recentUnpaidCheckouts`
  counts the last hour's unpaid non-COD checkouts, cancelled ones included.
  `enforceCheckoutRepeats` throws `DuplicateCheckout` (`unpaid` always, `placed` unless
  `orderAgain`) or `TooManyUnpaidCheckouts`. The unpaid-checkouts-as-drafts design (#1293)
  should point this one helper at drafts.
- **One unpaid transfer per shopper** `packages/core/src/payments/manual-unpaid.ts`:
  `assertNoUnpaidTransfer` throws `UnpaidTransferExists` for a manual payment when the shopper
  already has an open, unpaid, non-imported manual order. Contact matching (`orderContactMatch`:
  lower-cased email, last 10 phone digits) is shared with the helper above.
- **Auto-cancel default on**: `manualCancelHoursOf` (payments/settings.ts) is the only reader.
  New key `manualAutoCancel: 'on' | 'off'` records the merchant's choice. Unset counts as never
  chosen, so the default applies: 6 hours, clamped to 1 to 72. A stored `0` without a choice
  also counts as never chosen, because every payments save used to write `0`. Notice:
  `cancelNoticeHours` is half the window under 24 h, else 12 h.
- **Settings** (store.payments, Settings → Payments → Advanced → Unpaid section):
  `manualAutoCancel`, `manualCancelAfterHours` (default 6, 1 to 72), `duplicateCheckoutHours`
  (default 24, 0 to 168, 0 off), `unpaidCheckoutsPerHour` (default 3, 0 to 50, 0 off). No migration.
- **Storefront**: `lib/checkout-repeat.ts` turns the errors into the form's result. The result
  links to the earlier order's status page (`thankYouPath`, which already offers pay / retry /
  "Pay online instead") only for the signed-in customer who owns it, or for a same-items
  duplicate when the guest's email and phone both match. `lib/checkout-result.ts` holds the
  result types, and `components/checkout/checkout-repeat-notice.tsx` shows the links and the
  "Order again?" panel. The per-IP cap uses the Redis limiter (`unpaid-checkout:ip`,
  `storeId:ip`) on every non-COD submit that gets to placing an order. Copy lives in
  `data/checkout-repeat.ts`.
- **Tests**: `order/duplicate-checkout.test.ts`, `payments/manual-followup.test.ts` (defaults,
  6 h timing, notice scaling), `payments/settings.test.ts`, storefront
  `lib/checkout-repeat.test.ts`.

## Owner changes (8 Nov 2026, before merge)
- **Auto-cancel of unpaid UPI / bank transfers is off by default.** The owner checks transfers and marks orders paid by hand, so a timer could cancel a paid order. `manualAutoCancel: 'on'` (or an old positive window) turns it on.
- **No hard blocks.** The one-unpaid-transfer-per-shopper rule is removed. The hourly cap (`unpaidCheckoutsPerHour`) defaults to 0, which is off. When a store sets it, the per-IP guard is a fixed 20 an hour, because Indian mobile networks share IPs.
- **Same items again while unpaid** still creates no new order: the shopper is sent to their existing order with "You already placed this order (#N) and it is waiting for payment. Please pay for it to confirm it."
