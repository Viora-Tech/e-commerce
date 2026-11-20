# Card testing guard on payment tries, and the 20 Nov security audit

Branch `sec/checkout-and-audit` (from `origin/dev`). No migration.

- **Audit:** `docs/security/2026-11-20-audit.md` maps every existing bot and card-testing control
  with file paths. It then checks the advisory classes from Solidus, Saleor, Sylius, Vendure,
  EverShop and Bagisto (2025–2026) against our code. No critical or high findings, so no GitHub
  issues were opened.
- **Fix CT-1:** an order with 10 failed gateway attempts in the last hour takes no new attempt
  until the hour passes.
  - The cap lives in `packages/core/src/payments/attempt-cap.ts`.
  - It applies in three places: "Retry payment" (`retryPayment`), COD → "Pay online instead",
    and `placeOrder` when a checkout draft or a rewritten order is reused.
  - In `placeOrder` it throws `TooManyPaymentTries`, and the shopper sees
    `checkoutErrorsContent.tooManyPaymentTries`.
  - Gateway fallback inside one checkout is not capped.
- **Fix CT-3:** `checkoutAction` reads at most 5 gift card codes (`MAX_GIFT_CARDS`).
- **Tests:** `packages/core/src/payments/attempt-cap.test.ts` runs on the test database.
  `apps/storefront/src/lib/checkout-errors.test.ts` gained a case, but this worktree's stale
  node_modules (no `@commerce/payments-snapmint`) stops it from loading here. Run it on dev.
- **Left for the owner:**
  - **CT-2:** set Settings → Payments → "unpaid checkouts per hour" for Waimers (for example 5).
    This also turns on the per-IP hourly guard.
  - **CT-4:** an optional Turnstile check after velocity triggers.
  - **L-1 to L-6:** low findings, listed in the audit with their fixes.
