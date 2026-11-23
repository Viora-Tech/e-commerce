# Order page: five small fixes

Admin order detail page (`apps/admin/src/components/orders/`). No migration.

1. **Paid-in-full pre-order deposit.** `preorder-balance-line.tsx` showed "Balance due ₹0 (not
   requested yet)" when the deposit covered the whole order. With nothing owed and no balance
   payment it now reads "Deposit paid ₹X · Paid in full" (`payment.preorder.paidInFull`, English
   and Hindi). The Request balance button was already hidden in that case.
2. **Profit card delivery estimate.** Cause: `parcelCost` (`packages/core/src/order/profit-estimates.ts`)
   priced a parcel that was not booked yet at the highest real courier charge to that state in
   the last 60 days (any courier), else the store default. It never read the courier quote
   saved at checkout, so it could be several times the Delivery option card's figure. Now an
   unbooked parcel uses `ParcelFacts.quotePaise` first: `profit-parcels.ts` takes it from
   `order.shipping.delivery.courierCostPaise` (one route, order with at most one parcel) or the
   matching `delivery.parcels[].courierCostPaise` by fulfilment order id (split cart).
   `profit-service.ts` now selects `order.shipping`. It is still flagged as estimated. A booked
   consignment with no charge yet still uses the cautious estimate for its own courier (the
   booked courier may differ from checkout's route). The two help texts that explain the
   estimate (`data/order-cards.ts`, `data/profit-costs.ts`, plus Hindi) mention the quote.
3. **Courier name in the Next step banner.** `order-next-step.tsx` printed the stored provider id
   ("delhivery"); it now prints `shipment.providerLabel`, the shipping registry's name, which
   the order's shipment already carries (`packages/api/src/services/shipping.service.ts`).
4. **Shipment card expected date.** `shipment-panel.tsx` printed the courier's raw
   "2026-11-23"; it now formats it with `fmt.pattern` as "23 Nov" (read as a calendar day at noon
   UTC so it never slips a day). A value that is not a date is shown as it came.
5. **Shipping row in the totals.** `order-totals.ts` labelled the row with the checkout rate's
   name ("Standard · Courier X") even when another courier shipped it. The row is now always
   "Shipping", with the rate name as the grey `detail` note (`TotalsList` already supports it;
   `line-items-card.tsx` passes it through).

## Tests run

- `packages/core`: `bun x vitest run src/order/profit-estimates.test.ts`: 11 passed (2 new).
- `apps/admin`: `bun x vitest run src/components/orders/order-totals.test.ts
  src/components/orders/order-stage.test.ts src/components/orders/paid-method.test.ts`: 5 passed
  (`order-totals.test.ts` is new, 2 tests).
- `bun run typecheck` in `apps/admin` and `packages/core`: clean.
- Biome on the changed files: clean. `profit-service.test.ts` (database) was not run.
