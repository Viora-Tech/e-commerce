# A gateway that rejects the store's API keys no longer loses sales silently

Branch `fix/gateway-auth-failure`. Migration `0234_payment_gateway_health` (new table, safe
during a rolling deploy).

Why: from 7 Nov 2026 Razorpay answered Waimers' checkouts with 401 "Authentication failed" when
our server created the Razorpay order. Shoppers saw "Your payment did not go through" and
"Retry payment", which failed again, and each new try with another email became another unpaid
order (#2447–#2453, auto-cancelled after 30 minutes).

What happens now:

- **Classified as the merchant's problem.** `isGatewayKeysRefused` (`packages/payments/src/failure-reasons.ts`)
  reads a 401 / "Authentication failed". `startPaymentAttempt` stores the attempt's error as
  `keysRefusedError(...)` ("The payment gateway rejected the store’s API keys (…)") and returns
  `keysRefused: true`; fallback gateways are still tried first.
- **Gateway health** (`packages/core/src/payments/gateway-health.ts`, table
  `payment_gateway_health`): the gateway is marked unhealthy and hidden at checkout. After a
  10-minute cool-down the checkout runs its read-only `testConnection()` (one request claims the
  check) and shows it again once it passes. Razorpay UPI QR shares Razorpay's health. Saving keys
  that pass, the Live/Test switch and "Connect Razorpay" end the incident at once.
- **Shopper:** the checkout stays on the Payment step with "Online payment is temporarily
  unavailable. Please choose another payment method.", the gateway gone and the next way to pay
  picked. The cart keeps pointing at the order; the next Pay writes **the same order** again on
  its row with the new way to pay (`packages/core/src/order/checkout-reopen.ts`, `rewrite` in
  the place-order state). Works with unpaid-checkouts-as-drafts on (the draft keeps its #D
  number; cash on delivery turns it into the order in place) or off (the order keeps its number).
  No "your payment did not go through" email (pending nudge skips these). The thank-you page of
  such an order says the same words and links back to checkout instead of "Retry payment";
  "Retry payment" refuses a hidden gateway.
- **Merchant:** one alert per incident: outbox `payments.gateway_keys_refused`, emailed to the
  owners by the automations trigger job like the other owner alerts
  (`packages/core/src/payments/gateway-alert.ts`), and a red banner on Home and
  Settings → Payments (`payments.gatewayAlerts`, `GatewayKeysBanner`) until the keys work.
- **Settings → Payments:** saving gateway keys runs `testConnection()` first and refuses keys
  that fail, with the gateway's message (shown under "Test connection" too).

Left:

- An order with a gift card or store credit on it is not rewritten (it keeps the old thank-you
  page path with the new wording); rare, add when needed.
- The owner still has to re-enter the live Razorpay keys on Waimers.
- Tests: `packages/core/src/payments/gateway-health.test.ts` (drafts on and off).
