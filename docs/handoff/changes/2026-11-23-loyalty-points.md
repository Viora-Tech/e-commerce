# Loyalty points app (23 Nov 2026)

Branch `feat/loyalty-points` (from `origin/dev`). Plan: `docs/design/loyalty-points.md`.
Owner's rules of 16 Nov 2026, all editable in the app's Settings: 1 point = ₹1 of store credit,
1 point per ₹100 of goods, credited after delivery and the return window, 12-month expiry
(oldest first) with a reminder email, 25 points per review, 100 on the birthday, no sign-up bonus,
no tiers.

## What changed

- **Points are store credit.** New store credit kind `loyalty`; a credited point is a `loyalty`
  line with an expiry date on the existing balance (PR #1286). Checkout needs nothing new: the
  Store credit box spends points, oldest expiry first (`openLots`). Expiry is the existing store
  credit expiry and its hourly sweep.
- **Built-in app `loyalty`** (free, not in `APP_PRICING`), hosted in core like COD & RTO:
  `packages/core/src/loyalty/` (`app.ts` manifest, `settings.ts` pure rules, `earn.ts`,
  `extras.ts`, `ledger.ts`, `reminders.ts`, `state.ts`). Listed in `commerce.config.ts`; catalogue
  entry added by hand to `catalogue.generated.ts` (rerun `bun scripts/gen-app-catalogue.ts`).
- **Hooks**: `order.delivered` makes a pending entry (available after `store.returns.windowDays`
  when returns are on); `refund.created`, `order.cancelled`, `order.rto` recount or take points
  back (never more than the balance).
- **Worker** `loyalty-points` sweep, hourly (`apps/worker/src/loyalty.ts`): review points,
  birthday points, credit due entries (one transaction each), `points_expiring` reminder emails.
- **API** `loyalty.*` (`packages/api/src/routers/loyalty.ts`): overview, forCustomer, adjust
  (sensitive in MCP), setBirthday, settings get/save. MCP area `customers`; action docs added by
  hand (rerun `bun scripts/gen-mcp-action-docs.ts`).
- **Admin**: app pages Overview and Settings, a Loyalty points card on the customer page (points,
  expiring soon, on the way, birthday, Adjust points, history). Copy in `data/loyalty.ts` with Hindi.
  Store credit history labels the `loyalty` kind. App icon `Gift` added to `app-icons.ts`.
- **Storefront**: `/account/points` (balance, worth, expiring soon, on the way, history, a
  one-time birthday form), a Points link in the account nav while the app is installed, and the
  store credit history names loyalty lines.
- **Email** `points_expiring` (email only): template id, copy, composer (stats block), sample,
  footer, admin Notifications copy (en + hi), WhatsApp switch case.
- Customer merge moves `loyalty_entry` rows; erasure clears `customer.birthday`.

## Migration

`0266_loyalty_points.sql` (journal `when` 1795281400000, after 0265): widens the
`store_credit_entry_kind_check` to add `loyalty`, adds `customer.birthday` (`MM-DD`), creates
`loyalty_entry` (store_id, RLS via `SELECT apply_store_rls();`, unique once-per-order /
once-per-product review / once-per-year birthday), and the SECURITY DEFINER
`stores_with_loyalty_points()`. Additive only. If dev gains a 0266 first, renumber and re-date.

## Not run

The new worktree has no `node_modules` (no `bun install`, per the owner), so no typecheck, tests or
sweeps ran. Only `biome check --write` (the binary from the wt-all worktree) ran on the changed
files. Written but not run:

- `packages/core/src/loyalty/loyalty.test.ts` (database): earn after the window and once,
  store credit spent earns nothing, refund in the window lowers points, cancel before credit
  cancels, refund after credit taken back once, RTO takes all, expiry oldest first, expiring soon,
  review once per product and only for a delivered product, birthday once a year and set once by
  the shopper, points pay at checkout, staff add and remove with the removal capped.
- `packages/core/src/loyalty/settings.test.ts` (pure rules).

On dev also run: `packages/notifications` tests (new template), `packages/api/test/mcp-action-catalogue.test.ts`,
the `app-catalogue` and `mcp-action-docs` sweeps, admin i18n test, `bun run lint:components`.

## Known limits

- Points moved by a customer merge become plain store credit on the kept customer (amounts and
  expiry kept), so that customer's points figure can read lower.
- With expiry set to 0 (never), the points figure is what was given, capped by the balance.
- Review points look back 7 days of published reviews, so installing the app rewards last
  week's reviews of delivered products.
- The expiry test spends at checkout with the real clock (`spendStoreCreditOnOrder` takes no
  `now`), so its dates assume it runs before November 2027.
- Built from scratch: points ride on our own store credit balance, which no open-source loyalty
  tool knows (they are Shopify apps or hosted services).

## Try it on localhost

1. `bun run --cwd packages/db migrate` (applies 0266).
2. Admin, Apps, install Loyalty points; check Settings (defaults 1 / 12 / 25 / 100 / 14).
3. Mark a signed-in customer's order delivered: the customer card shows the points "on the way".
   To skip the 7-day wait, set Settings, Returns off before delivery (no window), or move
   `loyalty_entry.available_at` back; the worker's hourly `loyalty-points` sweep credits it.
4. Storefront, Account, Points: balance, history, add a birthday. At checkout the Store credit
   box takes the points.
5. Refund part of the order: the points drop by the refunded share.
