# Extra charge for Snapmint, Razorpay and Cashfree

Owner, 23 Nov 2026: the merchant sets a fee (or, negative, a discount) for paying with an online
gateway, on that app's own page.

- **Admin.** New card `components/payments/gateway-fee-card.tsx` ("Extra charge for <app>"),
  built on `PaymentAdjustmentFields`, with its own Save/Discard. On the Snapmint Connect page
  (`/apps/snapmint/connect`, new `below` slot of `ProviderConnectPage`) and on the Razorpay and
  Cashfree Connect pages (`GatewayConnectPage`). An empty label is saved as the default:
  Snapmint "Platform fee" (owner: a platform fee, separate from the no-cost EMI), gateways
  "<name> convenience fee", a discount "<name> discount". `PaymentAdjustmentFields` takes an
  optional `labelPlaceholder`. Copy: `data/payments.ts` `gatewayFee`, `data/snapmint.ts`
  `feeName/feeLabel/feeIntro`, both with Hindi.
- **API.** `payments.saveAdjustment({ providerId: razorpay|cashfree|snapmint, adjustment|null })`
  (`services/payments-adjustment.service.ts`) writes through `writeSettings`, touching only
  `store.payments.adjustments[providerId]`. Test: `packages/api/test/payments-adjustment.test.ts`.
- **Stale blob fix.** `ProviderConnectPage` saves the whole payments/shipping blob; it now
  re-reads the saved settings before saving, so a key save after a fee save no longer undoes it.
- **Already in place (checked, unchanged).** Checkout lists the adjustment per provider
  (`apps/storefront/src/lib/payments.ts`), shows a fee as a pill on the method row and a line in
  the summary; `place-order-create.ts` applies it server-side, and the total sent to Snapmint
  (`orderValue`) includes it. GST: `parcel-gst.ts` treats any payment adjustment the same as the
  COD fee (a charge in the GST-inclusive total at the principal supply's rate; a discount is a
  reduction). Snapmint's `products` list still leaves out shipping and fees, as before.
- **Storefront.** Commits the owner's "No-cost EMI on UPI" pill beside Snapmint
  (`payment-methods.tsx`, `data/checkout.ts`).
- Settings → Payments → Advanced still edits the same key for Snapmint when installed; both
  write `adjustments.snapmint`.
