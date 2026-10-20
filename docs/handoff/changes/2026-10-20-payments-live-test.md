# Payments: Live/Test key sets, Active/Inactive, test orders

Branch `feat/payments-live-test-deactivate`. Migration **0138_order_is_test** (`order.is_test
boolean not null default false`).

- **Two key sets per gateway** (Razorpay, Cashfree, Decentro): `packages/core/src/payments/modes.ts`
  (pure, also at `@commerce/core/payment-modes`). The set checkout uses stays at
  `store.payments.providers[id]`, so checkout, webhooks, refunds and token refresh are unchanged.
  The other set waits under `providers['<id>~<mode>']` (encrypted and masked like any provider,
  field lookups strip the `~mode` suffix). A set's mode is read from the keys (`rzp_test_`/`rzp_live_`,
  Cashfree/Decentro `mode`), so old single-set stores need no migration: their set is already
  in the right slot. Unknown mode counts as live.
- API (`payments` router): `connect`/`testConnection` take `mode` (which set); `switchMode`
  swaps the sets on the stored encrypted blob (going live runs the gateway's `testConnection`
  first; rate limited like test connection); `setActive` is the Active/Inactive switch;
  `testMode` feeds the admin-wide banner. `store.updatePayments` (generic Connect page, used by
  Decentro) parks a replaced set of the other mode via `keepReplacedKeySets` instead of losing it.
- **Inactive**: `store.payments.inactive[gatewayId] = provider ids it had on`. Removed from
  `enabled`, skipped by `resolvePaymentProviders`, and `savePaymentMethods` no longer re-adds it.
  Activating a main gateway marks the other main gateway inactive (as connecting always did).
- `PaymentProvider.mode` (optional, `packages/payments`): each adapter reports test/live.
  `placeOrder` sets `order.is_test` from it; the storefront shows a "Test mode" badge on that
  way to pay.
- Admin: Settings → Payments card has Keys in use (Test/Live) + Active switches
  (`components/payments/gateway-switches.tsx`), "Other payment companies" cards, orange test bar;
  admin-wide banner in `(admin)/layout.tsx`. Connect form edits one set at a time
  (`?keys=live` opens the live set). Copy: `data/payment-modes.ts` (+ Hindi).
- Test orders: `notTestOrder` (`packages/core/src/order/test-orders.ts`) applied across
  analytics, dashboards, reports, customer stats, plan usage and GST invoices; "Test" chip in the
  orders list and order header; "Delete test orders" (`deleteTestOrders`, only `is_test` rows).

Not done / risks: Decentro's own Connect page still edits only the set in use (switching its
mode there and saving makes that set active without the go-live check; the replaced set is kept).
After a switch, late webhooks / reconciliation for payments made under the other set are checked
against the set now in use and fail. Draft orders paid by payment link are not flagged.
DB integration tests in `packages/api/test/payments-setup.test.ts` were written but not run
(no Postgres here); pure tests (`modes.test.ts`) pass.
