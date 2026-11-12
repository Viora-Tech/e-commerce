# Shiprocket and RapidShyp: scan times in India time, no crash on odd dates, x-api-key (#1555, #1556, #1557)

- New `courierTimeToIso` in `packages/shipping/src/courier-time.ts` (exported from
  `@commerce/shipping`): a bare date or date-time (year first or day first) is India time; a value
  with its own offset is read as it says; anything else is null, never a throw.
- Shiprocket and RapidShyp `track()` use it. Before, `new Date()` read IST scan times in the
  server's zone (UTC in containers, so 5 h 30 min late), and an unreadable date threw
  `RangeError` and stopped that parcel's tracking.
- Shiprocket `parseWebhook` also reads the token from `x-api-key` (the header Shiprocket's webhook
  Token field uses); `x-webhook-token` and `Authorization` still work. Copy says "Token field".
  Unconfirmed against a live account: the owner's live check covers it.
- Tests: `packages/shipping/test/courier-time.test.ts`, plus cases in both couriers' tests (they
  pass with `TZ=UTC` too).
- Found by the Phase 1b group 1 audit: `docs/audits/2026-11-11-apps-group-1.md`.
