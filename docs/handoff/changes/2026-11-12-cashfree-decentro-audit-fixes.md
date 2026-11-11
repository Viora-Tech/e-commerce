# Cashfree and Decentro: audit fixes (12 Nov 2026)

Issues #1593, #1594, #1595, #1596, #1597. Audit: `docs/audits/2026-11-12-apps-group-3.md`.
Neither app is marked `tested: true`; that waits for the owner's sandbox check.

- **Cashfree refund webhooks (#1593).** `cashfreeEventId` (`packages/payments-cashfree/src/webhook-events.ts`)
  now puts the refund's status in the event id of `REFUND_STATUS_WEBHOOK`
  (`REFUND_STATUS_WEBHOOK:<cf_refund_id>:<status>`). Before, a PENDING or ONHOLD webhook took
  the id first and the SUCCESS or CANCELLED after it was dropped as a duplicate. Payment
  webhooks keep their old ids.
- **Timeouts (#1594, #1597).** Every Cashfree call (now `cashfreeRequest` in the new
  `packages/payments-cashfree/src/http.ts`, split out to keep `cashfree.ts` under 500 lines) and every
  Decentro call (`decentroRequest`, collections and payouts) gives up after 15 s
  (`CASHFREE_TIMEOUT_MS`, `DECENTRO_TIMEOUT_MS`) with "Cashfree/Decentro did not answer in 15s".
- **Cashfree refund retry (#1595).** When the refund POST is refused and our refund key was
  sent, `refund` looks the refund up by that id (`GET /orders/{order}/refunds/{refund_id}`) and
  reports it if it is for the same amount; otherwise the original error stands.
- **Cashfree order id for drafts (#1596).** `buildCashfreeOrderId` uses `d<draftNumber>_…` when
  there is no order number, so drafts no longer share 8 hex chars of their id as their only
  difference. Orders keep `o<number>_…`.
- Tests (faked HTTP): `packages/payments-cashfree/test/robustness.test.ts` (8),
  `packages/payments-decentro/test/timeout.test.ts` (3). Cashfree 59 → 67, Decentro 41 → 44.
