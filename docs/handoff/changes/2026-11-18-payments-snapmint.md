# Snapmint cardless EMI, direct connector (18 Nov 2026)

Branch `feat/payments-snapmint`. A new payments app, `packages/payments-snapmint`, built from
Snapmint's "Cardless EMI Integration Document" with checkout 3.0 (version 20250722, shared
privately by Snapmint; not in the repo). Snapmint offered inside Razorpay Checkout
(`payments-razorpay` `SNAPMINT_PROVIDER`) is untouched.

## How a shopper pays

1. Checkout lists **Snapmint · EMI on UPI & cards, no credit card needed** only for an Indian
   address with a 10-digit Indian mobile. Once the contact and address are typed, the storefront
   asks Snapmint's visibility API (`lenderVisibleAction` → `checkAvailability`, 1.5 s, capped at
   ₹10,000) and hides the option when Snapmint says `visible: false`. Any error or timeout shows it.
2. Pay → `placeOrder` → `createPayment` posts the cart to `pay(.sandbox).snapmint.com/api/pub/carts`
   (rupees, name split in three, billing/shipping address, products, shopper IP) and the shopper
   is redirected to the `url` Snapmint returns. The order-view cookie for the thank-you page is
   set first.
3. Snapmint posts the shopper back to `<store origin>/checkout/return/snapmint?outcome=…`
   (`apps/storefront/src/app/-s/[storeId]/checkout/return/[provider]/route.ts`). The route asks
   Snapmint's order status API (`confirm` → `fetchStatus`) and records the result, then opens the
   thank-you page: with a fresh view token when the post's `checksum_hash` verifies, otherwise
   only for the browser holding the cookie from step 2.
4. Snapmint's S2S webhook hits `POST /webhooks/payments/snapmint/<storeId>` on the worker. The
   checksum is verified (SHA-512, constant time), then `confirmWebhookEvent` asks the order
   status API; CAPTURED/SETTLED/PARTIALLY_REFUNDED → paid, AUTHORIZED → authorised,
   CANCELLED/VOIDED/ABANDONED → failed, still PENDING → the webhook answers 500 so Snapmint
   retries. The unpaid-order expiry also asks `fetchStatus` before cancelling.
5. Refunds and part refunds from the order page call `refund_order` with our refund row key as
   `merchant_refund_id` (SNM0020 duplicate → the first refund is looked up). Pending refunds are
   synced daily by the worker's refund sync (`refund_status`); migration 0254 adds `snapmint` to
   `stores_with_pending_gateway_refunds()`.

Thank-you page: a pending redirect payment now shows "Pay now" back to the gateway's page.

## Where the merchant sets it up

Apps → Snapmint → Connect: Merchant ID, Merchant key (secret), Merchant token (secret),
Sandbox/Live key sets (same storage and encryption as Cashfree and Decentro), "Test connection"
(order status for an order that does not exist: checks the token only), the payment updates URL
to send Snapmint, and the note that Snapmint must allow-list the server IPs.

## Platform changes

- `@commerce/payments`: optional `customer.ip`, `billing`, `storefrontOrigin`, `shipping.stateName`,
  `lines[].sku` on `CreatePaymentInput`; optional provider members `parseReturn`,
  `confirmWebhookEvent`, `checkAvailability`.
- Core `claimAttempt` fills those (IP from `placeOrder`'s new `shopperIp`, retries pass theirs,
  else the order's tracking snapshot). `handlePaymentWebhook` runs `confirmWebhookEvent`.
- `snapmint` joined `MODE_GATEWAY_IDS` (Live/Test, Active/Inactive, checkout test mode banner)
  and `payments.testConnection`.
- App catalogue entry hand-written (could not run `gen-app-catalogue.ts` without node_modules);
  re-run it to confirm the `app-catalogue` sweep. `bun.lock` workspace entries were added by hand:
  run `bun install` once to confirm the lockfile.

Not run: the full test suite, lint, typecheck of core/storefront/admin (no node_modules in the
worktree). The Snapmint package's 35 tests pass.

## What Snapmint needs from us (before the first test)

- **Server IP addresses** to allow-list for `/api/pub/carts`: the staging (vioratech.in) and the
  production storefront servers' outbound IPs. Not in this repo: look them up on the servers
  (`curl -s https://ifconfig.me` from the storefront container) and send them.
- **Webhook URL** per store: `https://<worker host>/webhooks/payments/snapmint/<store id>`
  (shown on the Connect page).
- Sandbox Merchant ID, key and token for us; live ones after approval.

## Open questions from the PDF

1. Section 5.1.3 "Response" and 5.1.4 are listed in the index but missing from the text: the
   format of the browser return to `merchantConfirmationUrl` / `merchantFailureUrl` is not
   documented (form post or query string, which fields). We read form, JSON and query fields and
   expect the webhook's names (`order_id`, `status`, `order_value`, `full_name`, `email`,
   `checksum_hash`).
2. Checksum `order_value` spelling (`10000` vs `10000.0` vs `10000.00`): every spelling is tried.
   `status` values other than `success` are not listed (we treat anything else as not approved).
3. `order_id` in order status, refund and refund status: the document says "unique id of the
   transaction". We send our `merchantOrderId`; if Snapmint means its `snapmint_id`, `fetchStatus`
   and `refund` need the other id (we store `snapmint_id` as the payment id).
4. Refund status URL: the examples show `/refund_status/order_id=XXXX` (path) but the table lists
   query parameters. We use `?refund_id=` / `?merchant_refund_id=`.
5. Whether the products' total must equal `orderValue` (shipping, discounts, COD fees are not
   product lines). We send the order total and the lines as they are.
6. Allowed characters/length for `merchantOrderId` and `merchant_refund_id` (we use letters,
   digits and `_`, at most 40).
7. Whether `email` is required (no error code for it); a phone-only checkout sends none.
8. Whether `/api/pub/carts` also wants `Authorization` (it is not marked "authorization
   required"; we send only `merchantId` in the body).
9. Order status returns no amount: the paid amount comes from the checksummed post only.
10. AUTHORIZED is only for `auto_capture=false` merchants and the PDF documents no capture API;
    capture would happen on Snapmint's dashboard.
11. Plans API (`/v2/public/merchant_plans`, live sample says `/v1/`, header `token`) is not used;
    an EMI-per-month hint on the product page could use it later.
12. The sandbox section lists a sandbox merchant id and test mobiles/emails (name "test user");
    use those from the PDF when testing, do not put them in code.
13. Not checked: a password-protected store may render the password page for the return route
    too (proxy `locked`); the webhook still records the payment.
