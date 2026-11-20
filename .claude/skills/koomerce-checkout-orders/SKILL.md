---
name: koomerce-checkout-orders
description: Work on Koomerce checkout and orders - placeOrder and its workflow steps, totals and payment fees, gift cards and store credit (split tender), cash on delivery and the COD & RTO app, payment attempts, gateway webhooks, unpaid expiry, order statuses, refunds and cancels, and admin draft orders. Use for any change to how an order is priced, paid, confirmed, cancelled or refunded.
metadata:
  checked-against: "dev, 20 Nov 2026"
---

# Checkout, orders and payments

Overview pages: `apps/docs/content/developer-docs/how-it-works/orders.mdx` and `payments.mdx`,
plus `apps/docs/content/developer-docs/core-concepts/data-model.mdx`. Code map:
`bun run code-map packages/core/src/order` and `bun run code-map packages/core/src/payments`.

## placeOrder

`placeOrder` (`packages/core/src/order/place-order.ts`) is a saga on `runWorkflow`
(`packages/core/src/workflow/run.ts`): steps run in order and each completed step with a
`compensate` is undone in reverse on failure. The steps, as wired today:

`loadCart` → `enforceLaunch` → `resolveDiscount` → `resolveShipping` → `enforceCheckoutRules`
→ `assessRisk` → `prepareDraft` → `reserveStock` → `createOrder` → `redeemCards` (gift cards)
→ `spendStoreCredit` → `recordPaymentAttempt` → `markCartConverted`

| Step | File |
| --- | --- |
| Cart as it sells now, mixed-cart rule | `order/place-order-load.ts` |
| Checkout draft decision | `order/place-order-draft.ts` |
| Order row, totals, payment fee, per-parcel GST, lines, parcels | `order/place-order-create.ts` |
| Gift cards, store credit | `order/place-order-tenders.ts` |
| Small rules: `paymentAdjustmentFor`, `checkCheckoutPincode`, `chargeNowPaise`, `splitTenderPaise` | `order/place-order-rules.ts` |
| Input, result, shared state types | `order/place-order-types.ts` |

`placeOrderAndPay` commits the order first, then starts the gateway attempt after commit. A
gateway failure leaves the order placed, stock held, attempt `failed`, ready for Retry payment.
The storefront calls it from `checkoutAction` in `apps/storefront/src/lib/cart-actions.ts`.

Rules that must hold:

- **Never trust the client total.** Payment-method adjustments (COD fee, UPI discount) and
  shipping are recomputed server-side. Delivery options re-run the engine on the quote snapshot
  and charge `min(now, shown)` (see `koomerce-delivery-options`).
- **Statuses are derived.** `order.status` is lifecycle only (`draft | open | completed |
  cancelled`); payment and fulfilment status come from `recomputeOrderStatuses`
  (`order/recompute.ts`), which every mutation path calls in its transaction.
- Money is integer paise. Format with `@commerce/money` (`money-format` sweep).

## Store credit

A balance, never a gift card. Checkout: `customers/store-credit-checkout.ts`.

- Signed-in shoppers only; amount = min(balance, what is due now). Debit under the account's
  `FOR UPDATE` row lock.
- Full cover: no gateway, `payment_method = store_credit`, payment row captured.
- Part cover with a gateway: the credit row is a `pending` hold, captured with the gateway capture
  (`captureHeldStoreCredit`), released with a `release` ledger line if the order is cancelled
  unpaid (`releaseHeldStoreCredit`).
- **COD is not offered for the rest** after gift cards or store credit; the server refuses it.
- Split tender helpers: `payments/split-tender.ts` (`STORE_CREDIT_PROVIDER`, `isSplitTender`).
  Anything that skips gift card rows as "not a gateway attempt" must skip store credit too.
- Drafts: `order/draft-store-credit.ts` takes what the balance holds at convert, capped at the
  applied amount; never refuses the convert.
- History: `docs/handoff/changes/2026-11-08-store-credit-*.md`, `2026-11-11-store-credit-finish.md`,
  `2026-11-18-draft-order-store-credit.md`.

## Cash on delivery

- COD fee, largest order, blocked PIN codes and the WhatsApp check are edited in Settings,
  Payments, Manual; stored as `checkout.cod` and the `cod` payment adjustment.
- A delivery option in `separate` COD fee mode puts the courier's COD charge on
  `shipping.codSurchargePaise`, which replaces the store's COD fee in `paymentAdjustmentFor`.
- COD & RTO app: `packages/core/src/cod-rto/` (`risk.ts` scored in `assessRisk`, `confirm.ts`
  confirmation requests).
- Ask to pay online: `payments/pay-online-instead.ts` and `payments/cod-pay-online.ts`; a capture
  turns the order prepaid in `recompute.ts`.

## Payments

- Attempts: `payments/attempts.ts`; webhooks: `payments/webhook.ts` (worker entry
  `apps/worker/src/payments.ts`); confirm and the one-capture rule: `payments/confirm.ts`.
- Unpaid expiry (30 minutes for online, transfer follow-ups): `payments/expiry.ts`, run by the
  worker's `apps/worker/src/payments-expiry.ts`.
- Gateways are plugins (`packages/payments-razorpay`, `-cashfree`, `-snapmint`, `-decentro`);
  see `koomerce-plugin-app`.
- Cancel and refund: `order/status.ts` (`cancelOrder` gives back gift card and store credit),
  `order/refund.ts`, `order/refund-routes.ts`.

## Money-path checklist

Adapted from community Medusa skills (MIT); patterns, files and guarding tests are in
`koomerce-commerce-patterns`. Before merging a change that prices, pays, refunds or cancels:

- **Retry-safe**: a new gateway call carries a key (`attemptKey`, `refundKey`, the webhook
  event id). Check the adapter actually sends it; Razorpay refunds do not today.
- **Lock, then re-check**: anything with a limit (refund total, discount uses, store credit
  balance, one capture per order) re-reads under a `FOR UPDATE` lock. Lock order first, then
  payment, as `applyPaymentStatus` and `refundPayment` do.
- **No network inside a stock or order lock** unless the call is idempotent; prefer after
  commit (`startPaymentAttempt`).
- **Amounts from the server only**: the client sends ids (variant, rate, delivery option,
  discount code); amounts are recomputed, and a gateway's reported amount must cover the
  attempt (`gatewayPaidTooLittle`).
- **Every money row has its own record**: a refund is a `refund` row, so the derived status
  sees it. Never flip `payment.status` to `refunded` without one.
- **Store-scoped**: every lookup by id runs inside `withStore` with `storeId`; add a
  cross-store test for a new lookup.
- **Concurrency test** for any "exactly N" promise (see `koomerce-testing`).

## Tests

Database-backed (needs `docker compose up -d --wait`):

```sh
cd packages/core && bunx vitest run src/order/place-order.test.ts src/customers/store-credit-checkout.test.ts src/order/draft-store-credit.test.ts
cd packages/core && bunx vitest run src/payments
cd apps/storefront && bunx vitest run src/lib/checkout-preview.test.ts
```

Before a release only: `bun run smoke:checkout -- --base <storefront url>` walks a guest to the
Payment section and never pays (`scripts/smoke/checkout-smoke.ts`).

## Do not

- Charge or refund from a step without a `compensate`.
- Add a new tender without updating every place that skips split-tender rows.
- Let COD collect the rest of a part-paid order.
