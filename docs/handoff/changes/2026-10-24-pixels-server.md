# Pixels app, PR 3 of 5: queues, worker, owner alert and router

Server half of the Pixels app. Stacked on PR 2 (core) and PR 1 (data). Design:
`docs/superpowers/specs/2026-10-24-pixels-design.md` §4–6.

- Queues (`packages/core/src/pixels/jobs.ts`): `{pixels}-order` (one per outbox row, `px-order-<rowId>`),
  `{pixels}-send` (one per pixel and event, `px-<connId>-<event>-<eventId>`, 6 attempts from 30 s),
  `{pixels}-prune` (daily). `QUEUE_LIMITS.pixelsOrder {5, 2}`, `pixelsSend {10, 3}`. `pixelSendQueue()` in
  `@commerce/queue` is the producer the storefront collector (PR 4) will use.
- Relay: `order.placed|paid|delivered` and the new `pixel.connection_failed` go to `{pixels}-order` only
  when `pixels` is installed (`OutboxRelayDeps.pixelOrders`).
- `order-trigger.ts`: picks pixels with a token, Purchase on and a matching trigger; logs skips
  (test, imported, no tracking, no consent, older than 7 days, paused, errored); never re-queues a sent one.
- `send.ts`: loads the order (email, phone, address, lines) or storefront facts from Postgres, hashes,
  sends, records. Success → log (not for storefront PageViews), day count, `last_sent_at`, app activity.
  Retryable → `PixelRetryError` until the last attempt. 190/102 → pixel `errored`, `recordAppError`, one
  `pixel.connection_failed` row (only on the flip), later jobs skip as `errored`.
- `alerts.ts`: emails the owners for that row (reuses `ownerEmails` from Automations' owner alerts).
- `prune.ts`: log/day rows over 30 days, `order.tracking` ip/ua cleared after 30 days.
- `connections.ts` + `packages/api/src/routers/pixels.ts` (`pixels.*`): list/get/stats/log need
  `marketing.read`; create/update/setToken/clearToken/setStatus/remove/sendTest need `marketing.write`.
  Tokens are checked with `GET /<pixel>?fields=id,name`, stored with `encryptSecret`, shown as `tokenHint`.
  `sendTest` sends one PageView with the test code (needs a token and a code).
- MCP: `pixels` → marketing area; `setToken`/`clearToken` excluded; `remove` sensitive; reads at once.
- Worker: `apps/worker/src/pixels.ts`, registered in `index.ts` (watched, prune scheduled, closed on shutdown).
- Tests: `packages/core/src/pixels/engine.test.ts` (db), `packages/api/test/pixels.test.ts`.
