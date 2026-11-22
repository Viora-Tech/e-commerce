# Loyalty points (plan, 23 Nov 2026)

Owner's decisions (16 Nov 2026), all merchant-editable in the app's settings:

| Rule | Default |
| --- | --- |
| Value | 1 point = ₹1 off a later order |
| Earn | 1 point per ₹100 spent (1%), on paid orders, net of refunds and cancels |
| When | After delivery, once the return window is over |
| Expiry | 12 months after earning, oldest first, with a reminder email before |
| Review | 25 points, a delivered order's product, once per product |
| Birthday | 100 points, once a year |
| Not in it | Sign-up bonus, tiers |

## Points are store credit

Points are not a second currency. A point that lands in a shopper's account is a store credit
line (₹1 per point) with an expiry date, on the existing balance (PR #1286, never a gift card):

- **Spending at checkout** needs nothing new: the Store credit checkbox at checkout already takes
  the balance (`customers/store-credit-checkout.ts`), part or full cover, held and released like
  any store credit.
- **Oldest first** is already how store credit spends: `openLots` replays the ledger and takes
  from the credit that expires soonest. Points all expire 12 months after earning, so soonest
  expiry is FIFO by earning date, and points are spent before refunds (which never expire).
- **Expiry** is the existing store credit expiry: `expireDueStoreCredit` writes the `expiry` line
  under the account lock, the hourly `store-credit-expiry` sweep writes it for idle accounts.
- **New store credit kind `loyalty`**: points credited or taken back are store credit lines of
  kind `loyalty`, so the shopper's store credit history says "Loyalty points" and the points
  balance is the part of the balance still held by `loyalty` lines (`openLots` remaining).

## What the app adds

| Piece | Where |
| --- | --- |
| App manifest (`loyalty`, built-in, free) | `packages/core/src/loyalty/app.ts`, in `commerce.config.ts` |
| Settings in `store.apps.settings.loyalty` (no table) | `packages/core/src/loyalty/settings.ts` |
| Points ledger `loyalty_entry` (why each point came or went, pending points) | `packages/db/src/loyalty-schema.ts` |
| Birthday (`MM-DD`) on the customer | `customer.birthday` |
| Earn, credit, reverse | `packages/core/src/loyalty/earn.ts` |
| Review and birthday points | `packages/core/src/loyalty/extras.ts` |
| Balance, history, staff adjust | `packages/core/src/loyalty/ledger.ts` |
| Hourly sweep (credit due points, reviews, birthdays, reminders) | `apps/worker/src/loyalty.ts` |
| Admin pages and the customer card | `apps/admin/src/components/apps/loyalty/` |
| Shopper's Points page | `apps/storefront/.../account/(signed-in)/points` |

The engine lives in core, like COD & RTO and Delivery options, because it writes store credit
(core) under the account's row lock, and a separate package would need a fresh `bun install`.

### `loyalty_entry`

One row per reason points moved: `order`, `review`, `birthday`, `adjustment`, `reversal`.
`status` is `pending` (waiting for the return window), `credited` (on the balance, with the
store credit line it wrote) or `cancelled` (the order was cancelled, returned or fully refunded
first). Unique: one `order` row per order, one `review` row per customer and product, one
`birthday` row per customer and year. So every hook and sweep can run twice safely.

## Flows

1. **Delivered** (`order.delivered` hook): an order with a customer, not a test or import, gets a
   `pending` row with `available_at` = now + the store's return window (`store.returns.windowDays`
   when returns are on, else now).
2. **Credit** (hourly sweep): each due row is locked, the points worked out again from the order
   as it is now, and written as a `loyalty` store credit line that expires in 12 months. A
   cancelled, returned (RTO) or fully refunded order cancels the row instead.
3. **Refund, cancel, RTO** (`refund.created`, `order.cancelled`, `order.rto` hooks): a pending
   row is recounted; a credited one has the difference taken back (a negative `loyalty` line and a
   `reversal` row), never more than the balance holds.
4. **Points base**: what the shopper paid for goods: line totals (gift cards left out) less the
   discount and any payment-method discount, less store credit spent on the order (no points on
   points), less refunds. Shipping and the COD fee earn nothing. `floor(base × rate / ₹100)`.
5. **Review** (sweep): a published storefront review in the last 7 days, by a customer with a
   delivered order containing that product, earns once per product.
6. **Birthday** (sweep): customers whose birthday is today in the store's time zone (29 Feb on 28
   Feb in other years) get the points once that year. Shoppers add their birthday on the Points
   page once; staff can change it on the customer card.
7. **Reminder** (sweep): points expiring within the reminder window send one
   `points_expiring` email per credited row.
8. **Staff adjust**: add or remove points with a reason on the customer card; removal is capped
   at the points balance.

## Not in this change

- Points on a merged customer move as plain store credit (the merge keeps amounts and expiry
  dates but not the `loyalty` kind), so the kept customer's points balance can read lower.
- No WhatsApp template for the reminder; email only.
