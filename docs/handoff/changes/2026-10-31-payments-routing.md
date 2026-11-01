# Several gateways at once, method routing, fallback and manual payment rows (31 Oct 2026)

Admin audit #148, #149, #150.

- **Several gateways together.** `PaymentSettings.routing` (`{ order, methods }`, optional) in
  `packages/core/src/payments/routing.ts` (pure, also `@commerce/core/payment-routing`):
  `activeGatewaysOf`, `routeMethods`, `methodsForGateway`, `fallbackChain`, `cleanRouting`,
  `enabledForGateways`. Unset routing = the old behaviour exactly (main gateway takes every
  method, no fallback). With a routing saved, `activateGateway` no longer switches the other
  gateway off; it appends to the order. `deactivateGateway` drops the gateway from the order.
- **Fallback.** `packages/core/src/payments/fallback.ts` (`runWithFallbacks`, `couldNotStart`)
  and `startPaymentWithFallback` in `attempts.ts`: when a gateway throws or does not answer in
  `GATEWAY_START_TIMEOUT_MS` (15 s), a new attempt (new number + idempotency key, its own
  `payment.provider`) is opened on the next active gateway that takes the offered methods. The
  order row is locked while reopening; paid/cancelled/retried orders stop the chain.
  `placeOrderAndPay` takes `paymentFallbacks`; the storefront builds them with
  `storePaymentFallbacks` (`apps/storefront/src/lib/payments.ts`). `startPaymentAttempt` gained
  an `options` arg (`methods`, `timeoutMs`); `claimAttempt` now offers only the methods routed
  to the claimed gateway.
- **Checkout.** `storeCheckoutMethods` gives each gateway only the methods routed to it and hides
  a gateway with none. The manual option is titled by which rows are on (`manualKinds`).
- **Manual payment rows.** `PaymentSettings.manualRows` (`packages/core/src/payments/manual-rows.ts`,
  `@commerce/core/manual-rows`): UPI ID and Bank transfer each with on/off and a shopper note,
  both on the one `manual` provider. `resolvePaymentProviders` strips the details of a row that
  is off and appends live rows' notes. Stores saved before the rows existed: both on.
  The order_placed email/WhatsApp now carries the transfer details (`paymentInstructions`,
  `core/src/notifications/payment-instructions.ts`).
- **API.** `payments.saveRouting`, `payments.saveManual`; `payments.setup` returns `routing`
  and a richer `manualMethods` (details, notes, adjustment, cod).
- **Admin.** Settings → Payments: `ActiveProvidersCard` (sortable list + switches, shown with 2+
  connected gateways), `RouteMethodsCard` (shown with 2+ active), `ManualMethodsCard` +
  `ManualMethodDialog` (UPI / bank details, note, fee or discount; COD row with switch and a
  link to Settings → Checkout). Manual transfer left the Advanced page's provider list.
- No migration (settings live in the `store.payments` JSON).
- Tests: `routing.test.ts`, `fallback.test.ts`, `manual-rows.test.ts`, and an order_placed
  template case. Not run here (owner runs checks on dev).
- Not done: storefront checkout still shows one option per gateway (not one per method); the
  "Retry payment" button retries on the last gateway without fallback; balance/invoice payments
  do not fall back.
