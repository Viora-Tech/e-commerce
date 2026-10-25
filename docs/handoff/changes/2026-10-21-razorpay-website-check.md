# Payments: tell the merchant which websites to register in Razorpay

Branch `fix/razorpay-website-check`. No migration.

Production: a live Razorpay payment on Waimers was refused with `BAD_REQUEST_ERROR` /
"Payment blocked as website does not match registered website(s)" / reason
`payment_risk_check_failed`. Checkout runs on `waimers.koomerce.app`, but the merchant's
Razorpay account only listed `waimers.in`. Razorpay has no API to add websites, so the admin
now lists them and warns when a payment is blocked. Separately, a payment row had stored
`error = "[object Object]"`.

## Readable payment errors

- `readableError(err)` (`packages/payments/src/readable-error.ts`, single owner in
  `HELPER_OWNERS`): Razorpay's SDK rejects with plain objects (`{ statusCode, error: { code,
  description } }`), which `String(err)` stored as "[object Object]". It reads
  `error.description` / `message` first, then JSON. Used by `startPaymentAttempt` (core
  `payments/attempts.ts`) and the webhook pipeline's failure write (`payments/webhook.ts`).
- The `payment.failed` webhook now stores the gateway's reason on the attempt: `applyPaymentStatus`
  takes an optional `error`, written only when the status moves to `failed`.
- Razorpay normaliser (`packages/payments-razorpay/src/webhook-events.ts`): the failed event's
  `reason` is the description plus the machine reason, e.g. "Payment blocked as website does not
  match registered website(s) (payment_risk_check_failed)". `RzpPayment` gained `error_code`,
  `error_reason`, `error_source`, `error_step`.
- `isWebsiteNotRegistered(error)` (`@commerce/payments/failure-reasons`, a pure subpath the admin
  client can import) recognises that failure from the stored text.

## Websites list and warning

- `packages/api/src/services/razorpay-websites.service.ts`:
  - `razorpayWebsites(tx, storeId)`: live (`status = 'active'`) `store_domain` hostnames, primary
    first, platform subdomain and custom domains, `*.localhost` dropped.
  - `latestRazorpayWebsiteBlock(tx, storeId, now)`: newest failed Razorpay (or Razorpay UPI QR)
    attempt in the last 7 days whose `error` is the website block, or null.
- `payments.setup` returns both as `razorpayWebsites` and `razorpayWebsiteBlock`.
- Admin:
  - `razorpay-website-list.tsx`: each address with the shared `CopyButton`. Shown in the Razorpay
    connect form under the webhook events (`razorpay-webhook-fields.tsx`) and as a card on
    Settings → Payments (`#razorpay-websites`) when Razorpay is configured.
  - `razorpay-website-banner.tsx`: destructive `Alert` on Settings → Payments while
    `razorpayWebsiteBlock` is set, naming the store's addresses and linking to the card.
  - Order page, payment card: a failed attempt shows "Why it failed: <reason>"
    (`orders/failed-attempt-reason.tsx`), plus the Razorpay fix for the website case.
  - Copy: `data/razorpay-websites.ts`, Hindi `data/hi/razorpay-websites.ts`.

## Not done

- Razorpay's payment entity does not carry the website the payment came from, and we do not
  record the checkout host on the attempt, so the banner lists every store address instead of
  the exact blocked one.
- Attempts that failed before this change keep their old `error` text (often null or
  "[object Object]"), so they do not trigger the banner.
