# Exchange email, Pixels AddPaymentInfo, affiliate commission on order edit

Branch `feat/followups-2026-10-26b`. **No migration.**

## 1. "Your exchange is on its way" (`return_exchanged`)

- `exchangeReturn` only makes a free **draft**; the shopper is told once that draft becomes an
  order. `convertDraft` (`packages/core/src/order/drafts.ts`) calls `announceExchangeOrder`
  (`returns/notify.ts`), which writes outbox `return.exchanged` `{ orderId: <new order>, returnId }`
  when the draft is a return's `exchange_order_id`. Any other draft converts silently, as before.
- Relay → `return_exchanged` (repeatable per row). `deliverNotification` builds it from the **new**
  order (number, link, its items) and takes only `returnInfo` from the return (label, plus the new
  `originalOrderNumber`), not the returned lines.
- Copy in `notifications/src/templates/content-parts.ts` (email + WhatsApp text), WhatsApp template
  params `[store, return label, new order number, order link]` (`notifications-whatsapp`). A store
  using approved WhatsApp templates needs a Meta template named `return_exchanged` with those four
  placeholders; until then the email goes and WhatsApp fails like any missing template.
- Settings → Notifications lists it under Returns (switchable), admin copy in English and Hindi.
  Shopper templates are English only, like the other return messages.
- Merchant guide: `orders/returns-and-rto.mdx`.

## 2. Pixels: AddPaymentInfo

- New event name `AddPaymentInfo` (`PIXEL_EVENTS`, `PixelEventName`, blocks `CommerceTrackDetail`).
  Fired by `checkout-payment-step.tsx` when the shopper picks a way to pay, through
  `trackCommerce`, so the same consent-gated listener sends the browser `fbq` copy and the
  `/api/px` beacon. Event id `api_<cartId>_<method>` (`addPaymentInfoEventId`): one per cart and
  method; picking the same method again is not re-sent (tab-level set, plus the server log's
  unique row). Value = cart subtotal in INR, content ids = variant ids (server reads the cart, as
  for InitiateCheckout).
- Existing pixels keep their saved `events` list, so AddPaymentInfo is **off** for pixels added
  before this change until the merchant ticks "Payment method picked" on the pixel card. New
  pixels get it (zod default = `PIXEL_EVENTS`). The DB column default was left as the old five to
  avoid a migration; no code path relies on it.
- GA4 `add_payment_info` was **not** added: the storefront only configures gtag (no GA4
  ecommerce events exist anywhere yet), and the Pixels app is Meta only.
- Not fired for the pre-selected method if the shopper never changes it (only an explicit pick).
- Merchant guide: `apps/pixels.mdx`.

## 3. Affiliate commission on order edit: not built

There is no order-edit feature on `dev`: nothing rewrites a placed order's lines, prices or totals
(only drafts, which earn no commission; `creditOrder` credits at `order.paid` with the lines then).
Every money change after placement already reaches the commission: refunds (`applyRefunds`,
clawback when in a payout), cancel/RTO (`reverseCommission`), late changes
(`approveDueCommissions` re-reads the order). When order editing is built, it must call a
recalculation in `packages/plugin-affiliates/src/commissions.ts`: pending → recompute with
`computeCommission` in place; approved / in a payout / paid → only lower, through
`clawbackPaise`, never rewrite paid money.
