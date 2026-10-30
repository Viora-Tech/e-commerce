# GST invoice View/Download after generating (#1009), "Pay online instead" on transfer orders (#1010)

Pushed straight to `dev` (branch `agent/invoice-pay`). No migration.

## #1009 GST invoice: see what was generated

- `gstInvoices.generate` (`packages/api/src/routers/gst-invoices-order-actions.ts`) also returns
  `invoices: { id, number }[]` (newly issued and already issued).
- Order action procedures (`apps/admin/src/apps/order-action-procedures.ts`) now answer with
  `{ message, action?, secondary? }`; `useOrderAppActions` turns those into Sonner toast buttons
  (10 s). Generate with one invoice: **Download** and **View** (PDF opened in a new tab). A split
  order's several invoices: **View invoices** (order page `#order-invoices`). Add to queue (row
  and bulk): **Open queue**.
- Both procedures fire `gst-invoices:changed` on `window`; the order page's Invoices card
  (`components/apps/gst-invoices/order-card.tsx`) reloads on it (`router.refresh()` never
  remounted the client card, so the card used to stay stale until a reload). The card also polls
  every 5 s, at most 60 times, while a tax invoice is queued or a PDF is still rendering.
- Each issued document row has **View** beside **Download**.
- Editing an issued invoice is deliberately not offered (GST law). Under an issued tax invoice,
  "Need to change this invoice?" (`order-card-changes.tsx`) explains why and lists the existing
  paths: edit the order (auto cancel + re-issue when the bill grows, `order-edit.ts`), cancel on
  the invoice page and queue again, save a buyer GSTIN, or, once reported in GSTR-1, credit note /
  new invoice. Copy in `data/gst-invoices.ts` (the order card has no Hindi overlay yet, as before);
  toast labels have Hindi in `data/hi/order-app-actions.ts`.

## #1010 Payment link page: pay through the gateway

- Findings: "Resend payment link" on a manual (UPI to your own ID) order sends the payment
  reminder, which links the signed thank-you page `/checkout/thank-you/<n>?t=...`. That page
  already showed the shop's own UPI QR / ID and bank details (`TransferInstructions`), but no way
  to pay through a gateway. The admin's Collect payment dialog only records money by hand.
- New: on that page, while the transfer is open and the store has an online gateway, an
  "Or pay online" block with **Pay online now** (`thank-you.tsx`, copy `thankYouContent.payOnline`).
- `payOnlineAction` (`apps/storefront/src/lib/cart-actions.ts`): same access check and rate limit
  as Retry payment; picks the gateway with `payOnlineGateway` (`lib/payments.ts`: first online
  option in checkout order; a test-mode gateway only for a test order), then
  `payOnlineInstead` (`packages/core/src/payments/pay-online-instead.ts`): under the order lock,
  cancels the open manual attempt, opens a gateway attempt for the same amount, writes a timeline
  note, then starts it like checkout (client window via `/checkout/pay`, or redirect / UPI QR as
  the gateway gives). Two taps reuse the open gateway attempt.
- The order keeps `payment_method = 'manual'` on purpose: it stays out of the online unpaid-order
  expiry (which would cancel an old transfer order on its next sweep) and reminders keep working.
- Left out (owner-approved scope): no new static UPI ID / QR display beyond what the transfer
  instructions already show. A payment-method price adjustment (fee/discount on manual) is not
  recalculated; the gateway charges the order's existing amount.

## Not done

- No new tests; nothing run beyond `tsc --noEmit` in core, api, admin, storefront.
- "View" opens a blob PDF with `window.open` after the download call; a strict popup blocker
  could block it (Download still works).
