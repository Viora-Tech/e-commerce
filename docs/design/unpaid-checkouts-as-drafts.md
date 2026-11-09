# Unpaid checkouts as drafts

Status: proposal for review (8 Nov 2026). No code yet.

## Problem

Every checkout that picks an online payment creates a real, numbered order before any money
arrives. On Waimers an Australian shopper's card failed ("Authentication failed") and his retries
made orders #2434–#2439, each auto-cancelled after 30 minutes. Shoppers who pick manual "UPI or
bank transfer" and never pay leave open orders too. The Orders list fills with cancelled orders
and the order numbers are used up.

Goal: an unpaid attempt is a **draft**. Only a paid order, a COD order, or a manual transfer the
merchant marks received becomes a numbered order.

## 1. Today's flow

| Step | What happens | Where |
| --- | --- | --- |
| Place order | Storefront server action calls `placeOrderAndPay` | `apps/storefront/src/lib/cart-actions.ts` |
| Workflow | `loadCart → enforceLaunch → resolveDiscount → resolveShipping → enforceCheckoutRules → assessRisk → reserveStock → createOrder → redeemCards → recordPaymentAttempt → markCartConverted`, one transaction | `packages/core/src/order/place-order.ts` (`placeOrder`, ~l.311) |
| Number | `createOrder` takes the next number from `store_counter` | `packages/core/src/order/place-order-create.ts`, `packages/core/src/order/order-number.ts` (`takeOrderNumber`) |
| Stock | `reserveStock` routes lines and adds them to `reserved` (Committed) | `place-order.ts` (~l.189), `packages/core/src/order/committed-stock.ts` |
| Attempt | One `payment` row per try, idempotency key `<orderId>:<n>`; gateway called after commit | `packages/core/src/payments/attempts.ts` (`attemptKey`, `createPaymentAttempt`, `retryPayment`) |
| Gateway failure | Order stays placed, stock held, attempt `failed`, "Retry payment" on thank-you page | `place-order.ts` (`placeOrderAndPay`), `apps/storefront/src/components/checkout/thank-you.tsx` |
| Razorpay order | `receipt` = `order-<number>[-<attempt>]`, notes from the order | `packages/payments-razorpay/src/razorpay.ts` (`buildReceipt`, `buildOrderNotes`) |
| Webhook | Stored first on unique (store, provider, eventId), then applied | `packages/core/src/payments/webhook.ts` |
| Capture | `applyPaymentStatus`: locks order then payment, forward-only, amount check; a capture on a cancelled order is flagged refund-needed | `packages/core/src/payments/confirm.ts`, `packages/core/src/payments/transitions.ts` |
| Nudge | One "payment not finished" message per order with the retry link | `packages/core/src/payments/pending-nudge.ts` |
| Auto-cancel | Worker each minute; asks the gateway first, then `cancelOrder` releases stock. Exempt: `cod`, `manual`, gift card | `apps/worker/src/payments-expiry.ts`, `packages/core/src/payments/expiry.ts`, `packages/core/src/order/status.ts` (`cancelOrder`) |
| Manual UPI / transfer | Order placed with `payment_method = 'manual'`; merchant reminders (max every 6 h); opt-in auto-cancel with 12 h notice; "Mark as paid" records method/UTR | `packages/core/src/payments/manual-followup.ts`, `packages/core/src/payments/manual-collection.ts` |
| Pay online instead | Transfer order switches to a gateway attempt, stays `manual` | `packages/core/src/payments/pay-online-instead.ts` |
| COD | Order placed at once, exempt from expiry; COD & RTO confirmation sweep | `expiry.ts` (`EXPIRY_EXEMPT_METHODS`), `packages/core/src/cod-rto/confirm.ts` |
| Staff drafts | `order` row with status `draft`, own series #D1 (placeholder `number = -draftNumber`), excluded from lists/stats; stock only at conversion unless "Reserve items" | `packages/core/src/order/drafts.ts`, `draft-ref.ts`, `draft-reserve.ts`, `order-number.ts` (`takeDraftNumber`) |
| Convert | `convertDraft` locks the row, counts discount use, routes and reserves stock, bills GST, takes the order number | `packages/core/src/order/drafts.ts` (~l.352) |
| Draft invoice pay | Shopper pays a draft link: convert first, then a fresh attempt | `packages/core/src/order/draft-pay.ts` (`convertDraftForOnlinePayment`) |
| Abandoned checkouts | Carts with a contact, untouched 1 h; recovery link 7 days; converted carts drop out | `packages/core/src/cart/abandoned.ts` |
| Pending UPI counter | Count of open manual transfers | `packages/api/src/services/order.service.ts` (`pendingUpi`), `order-views.ts` |

Key observation: drafts already live in the `order` table with their own number series, and
`convertDraftForOnlinePayment` already does "draft → order, then pay". Today it converts
**before** payment. The proposal flips that order for checkout.

## 2. Proposed model

An online-payment checkout writes a draft (`status = 'draft'`, new column `draft_source =
'checkout' | 'staff'`) with contact, addresses, lines, prices, discount, shipping, fee and GST
frozen exactly as `createOrder` computes them now. Payment attempts hang off the draft id (the
`payment.order_id` FK is unchanged, since the draft is an `order` row). On capture, the draft
converts in place: same id, takes `takeOrderNumber`, status → `placed`/paid.

```
cart → placeDraftAndPay → draft #D57 (+ hold) → attempt 1 failed → attempt 2 captured
                                                        ↓ (webhook or return)
                                     convertCheckoutDraft → order #2434, paid
```

| Concern | Design |
| --- | --- |
| Idempotent conversion | Conversion runs inside `applyPaymentStatus` under the same order row lock. Guard: `status = 'draft'` → convert; already `placed` → no-op. The webhook's event dedupe stays. Late webhook after expiry: draft is `expired` → capture flagged refund-needed (today's cancelled-order rule), or re-converted if stock allows (open question Q3). |
| Retries reuse the draft | Draft keyed by `cart_id` (unique while `draft`). `lockCartOrReplay` returns the open draft; a retry adds attempt n+1 to it. Cart changed since? Re-price the draft (same frozen-at-retry rule) and drop the open attempts. |
| Number | Only at conversion. Receipts become `draft-D57-<n>`; Razorpay `notes.draft_id` = order id, so lookup is by id, never by number. |
| COD | Unchanged: immediate order. |
| Gift card covers all | Unchanged: immediate order (money already taken). |

### Manual UPI / bank transfer

| Option | Pros | Cons |
| --- | --- | --- |
| A. Draft until "Mark as paid" (converts then) | Clean list; numbers only for money received; matches the owner's goal | Shopper's confirmation shows "#D57", not an order number; bank-statement matching needs the draft ref; Pending UPI moves to Drafts |
| B. Order "awaiting payment" at once (today) | No change for staff; shopper gets a number to quote | Same clutter and burned numbers as today |
| C. Draft, but merchant can "Convert to order (unpaid)" | A's benefits plus a way to ship on trust | One more action |

**Recommendation: A with C's action.** Shoppers quote the draft ref (#D57) in the UPI note;
`parseDraftSearch` already finds it. Pending UPI counts checkout drafts with method `manual`.

## 3. Stock

- A checkout draft holds stock with the existing draft hold (`draft-reserve.ts`), but short:
  `hold_until = now + store's unpaid window` (default 30 min, same setting as today's expiry).
- The worker's `releaseExpiredDraftHolds` already releases it; the unpaid-expiry tick stops
  cancelling orders and only releases holds and expires drafts.
- After the hold lapses the draft stays (for the payment link) but holds nothing. Conversion
  re-reserves through `routeAndReserve`; out of stock → capture flagged refund-needed and the
  merchant is alerted (rare; same as today's late capture on a cancelled order).
- Manual transfer drafts: hold for the store's manual window (default 48 h), then release.

## 4. Admin UX

- Drafts page tabs: **From checkout (unpaid)** | **Created by staff**. Columns: draft ref,
  customer, total, method, last attempt result ("Authentication failed ×3"), age, hold.
- Actions: Send payment link (WhatsApp / email, reuses `manual-followup.ts` channels and the
  draft invoice page from `draft-pay.ts`), Mark as paid / Convert, Delete.
- Auto-expiry: checkout drafts go `expired` after 7 days (store setting) and are hard-deleted
  after 30; staff drafts never expire.
- Dashboard: "Pending UPI" = checkout drafts with method `manual` not yet expired. New small
  counter "Unpaid checkouts (24 h)" links to the tab. Orders tabs lose cancelled-unpaid noise.

## 5. Effects elsewhere

| Area | Change |
| --- | --- |
| Analytics | Already exclude `draft`; verify every query in `packages/core/src/analytics-query` and `dashboard.service.ts`. Add "checkout drafts" as a funnel step. |
| Notifications | No `order.placed` / confirmation until conversion. Today's `payment_pending` nudge (`pending-nudge.ts`) reads drafts, links to the draft pay page. Manual: "Here's how to pay #D57". |
| Automations | `order.placed` fires at conversion only (`automations/builtin-triggers.ts`). New trigger `checkout.payment_failed` optional. |
| GST invoices | Only for orders (`documents/service.ts`); draft shows a pro-forma at most. |
| Abandoned checkouts | **Recommend keep separate but linked**: abandoned = no payment chosen (cart, `cart/abandoned.ts`); checkout draft = payment chosen and not finished. A cart with a draft is excluded from abandoned so the shopper gets one message, not two. |
| MCP / API | `pendingOrders` (`packages/api/src/mcp/tools.ts`) gains `unpaidCheckouts`; order endpoints keep excluding drafts; drafts API gets `source` filter. |
| Razorpay | `receipt` `draft-D57-2`, `notes.draft_id`; `buildReceipt` must handle `orderNumber` null (it already falls back to id). |
| Storefront | Thank-you page for a draft shows "Payment not finished, #D57, Retry"; order page token works on draft ids. |
| Shopify import | No draft-order importer found in the repo today. If added, imported drafts land as `draft_source = 'staff'`, never expire. |

## 6. Migration and rollout

Flag per store: `store.checkout.unpaidAsDrafts` (off by default; on for Waimers first).
Existing pending orders stay orders and finish under today's rules (expiry / manual follow-up);
nothing is renumbered.

| PR | Scope |
| --- | --- |
| 1 | Migration: `order.draft_source`, unique partial index `(store_id, cart_id) where status='draft'`; backfill staff drafts as `staff`. Flag setting. |
| 2 | Core: `placeDraftAndPay` (workflow without number, with short hold), `convertCheckoutDraft` inside `applyPaymentStatus`; tests for double webhook, late capture, retry reuse. |
| 3 | Razorpay receipt/notes; storefront thank-you and retry on drafts. |
| 4 | Worker: expiry releases holds / expires drafts instead of cancelling; 7-day cleanup. |
| 5 | Manual transfer as draft + Mark as paid converts; Pending UPI counter. |
| 6 | Admin Drafts tabs and actions; dashboard counter. |
| 7 | Notifications, automations, abandoned-checkout exclusion, MCP/API, docs (merchant guide). |
| 8 | Turn on for Waimers, watch a week, then default on. |

## 7. Risks and open questions

| # | Question / risk | Recommendation |
| --- | --- | --- |
| Q1 | Manual UPI: draft or order? | Draft until marked paid, plus "Convert to order (unpaid)". |
| Q2 | Shopper sees #D57 not an order number. Confusing? | Acceptable; the order number arrives with the confirmation once paid. |
| Q3 | Capture lands after the hold lapsed and stock is gone | Convert anyway if stock allows, else refund-needed flag and merchant alert. |
| Q4 | Expiry window for checkout drafts | 7 days visible, hard delete after 30. |
| Q5 | Abandoned vs checkout drafts | Keep separate, de-duplicate messages. |
| Q6 | Order numbers gain no gaps, but draft numbers will have many | Fine; draft numbers are internal. |
| Q7 | Payment-method discount / fee frozen on the draft; shopper switches method on retry | Re-price the draft on method change (as `pay-online-instead.ts` does). |
| R1 | Razorpay authorisation (manual capture) is not "paid" | Convert on authorise for manual-capture stores, so staff can capture from the order page. |
| R2 | Rolling deploy with old workers | Flag off until all PRs are live. |
