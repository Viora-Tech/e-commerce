# Back in stock: confirm email sent, alert links fixed (12 Nov 2026)

Issues #1587, #1588. Found in the Phase 1b group 2 apps audit
(`docs/audits/2026-11-12-apps-group-2.md`).

- **Confirm email (#1587).** Nothing sent `back_in_stock_confirm`, so email signups stayed
  pending and were never alerted. `createSignup` now writes a `back_in_stock.confirm_requested`
  outbox event (payload `backInStockSignupId`) in the same transaction for a new email signup.
  The relay (`packages/core/src/outbox/relay.ts`) queues `back_in_stock_confirm` keyed by the
  row; the notifications worker (`apps/worker/src/notifications.ts`) builds it with
  `confirmMessageFor` and sends it on the store's email channel. Nothing goes out once the
  signup is confirmed or unsubscribed.
- **Alert (#1588).** New `alertMessageData` in `packages/plugin-back-in-stock/src/messages.ts`:
  the store name, `/products/<handle>` for "Buy it here", and the unsubscribe link at the real
  route `/api/back-in-stock/unsubscribe/<token>`, also passed as a "Stop these alerts" link so
  the email shows it. The worker (`apps/worker/src/back-in-stock.ts`) uses it.
- No migration (the outbox `type` column is free text).
- Tests: `packages/plugin-back-in-stock/test/messages.test.ts` (event once per email signup,
  message links, paths are real storefront routes) and a relay test in
  `packages/core/src/outbox/relay.test.ts`.
